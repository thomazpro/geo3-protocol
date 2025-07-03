// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/* -------------------------------------------------------------------------- */
/*                               External Interface                           */
/* -------------------------------------------------------------------------- */
/// @title ISensorResolver
/// @dev  Interface mínima para consultar o sensorType ⇒ maxResolution
interface ISensorResolver {
    function sensorTypeMaxResolution(uint8 sensorType) external view returns (uint8);
}

/* -------------------------------------------------------------------------- */
/*                               OpenZeppelin                                */
/* -------------------------------------------------------------------------- */
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/* -------------------------------------------------------------------------- */
/*                           GEO³ – NodeDIDRegistry                           */
/* -------------------------------------------------------------------------- */
/// @title NodeDIDRegistry
/// @notice Registro de identidade descentralizada dos nodes físicos da rede GEO³.
/// @dev    • Cada node é identificado por sua própria chave pública Ethereum (`nodeAddress`)
///         • O endereço `controller` recebe recompensas e pode atualizar metadados.
///         • A validação do tipo de node (nodeType) reutiliza a política definida no
///           contrato GeoDataRegistry através do `ISensorResolver`.
contract NodeDIDRegistry is AccessControl {
    /* ───────────── ROLES ───────────── */
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    /* ───────────── ERRORS ───────────── */
    error InvalidController();
    error InvalidNodeAddress();
    error NodeAlreadyRegistered();
    error NodeTypeNotAllowed();
    error Unauthorized();

    /* ──────────── STRUCTS ──────────── */
    struct NodeData {
        uint8  nodeType;     // corresponde 1-a-1 ao sensorType autorizado
        string metadataURI;  // DID-Document (IPFS/HTTPS)
        bool   active;       // flag de operação
    }

    /* ───────── STATE & STORAGE ─────── */
    /// @notice nodeAddress ⇒ controller (beneficiário)
    mapping(address => address) public controllerOf;

    /// @notice nodeAddress ⇒ NodeData imutável/frequência baixa de update
    mapping(address => NodeData) public nodeData;

    /// @notice Contrato que define quais sensorTypes estão habilitados e sua resolução máxima
    ISensorResolver public immutable sensorResolver;

    /* ───────────── EVENTS ───────────── */
    event NodeRegistered     (address indexed node, uint8 indexed nodeType, address controller);
    event ControllerChanged  (address indexed node, address newController);
    event MetadataURIUpdated (address indexed node, string newURI);
    event NodeStatusChanged  (address indexed node, bool active);

    /* ────────── CONSTRUCTOR ────────── */
    constructor(address admin, address _sensorResolver) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MANAGER_ROLE,       admin);
        sensorResolver = ISensorResolver(_sensorResolver);
    }

    /* -------------------------------------------------------------------------- */
    /*                              NODE REGISTRATION                              */
    /* -------------------------------------------------------------------------- */
    /// @notice Registra um novo node físico na rede GEO³
    /// @param node        Endereço (chave pública Ethereum) embutido no hardware
    /// @param nodeType    Categoria do node (mapeada ao sensorType)
    /// @param controller  Carteira que receberá recompensas e poderá gerenciar o node
    /// @param metadataURI CID/URL do DID-Document contendo specs e credenciais
    function registerNode(
        address node,
        uint8   nodeType,
        address controller,
        string calldata metadataURI
    ) external onlyRole(MANAGER_ROLE) {
        if (node        == address(0)) revert InvalidNodeAddress();
        if (controller  == address(0)) revert InvalidController();
        if (controllerOf[node] != address(0)) revert NodeAlreadyRegistered();

        // Verifica se o nodeType está habilitado no GeoDataRegistry
        if (sensorResolver.sensorTypeMaxResolution(nodeType) == 0) revert NodeTypeNotAllowed();

        controllerOf[node] = controller;
        nodeData[node] = NodeData({nodeType: nodeType, metadataURI: metadataURI, active: true});

        emit NodeRegistered(node, nodeType, controller);
    }

    /* -------------------------------------------------------------------------- */
    /*                             NODE MAINTENANCE                               */
    /* -------------------------------------------------------------------------- */
    /// @notice Troca o controller (somente controller atual ou MANAGER_ROLE)
    function changeController(address node, address newController) external {
        if (msg.sender != controllerOf[node] && !hasRole(MANAGER_ROLE, msg.sender)) revert Unauthorized();
        if (newController == address(0)) revert InvalidController();

        controllerOf[node] = newController;
        emit ControllerChanged(node, newController);
    }

    /// @notice Atualiza o URI do documento DID do node
    function updateMetadataURI(address node, string calldata newURI) external {
        if (msg.sender != controllerOf[node] && !hasRole(MANAGER_ROLE, msg.sender)) revert Unauthorized();
        nodeData[node].metadataURI = newURI;
        emit MetadataURIUpdated(node, newURI);
    }

    /// @notice Ativa ou desativa um node (somente manager)
    function setNodeActive(address node, bool active) external onlyRole(MANAGER_ROLE) {
        nodeData[node].active = active;
        emit NodeStatusChanged(node, active);
    }

    /* -------------------------------------------------------------------------- */
    /*                                    VIEWs                                   */
    /* -------------------------------------------------------------------------- */
    /// @return controller Endereço que controla o node (pode receber recompensas)
    function getController(address node) external view returns (address controller) {
        return controllerOf[node];
    }

    /// @return data Dados completos do node (sem o controller)
    function getNodeData(address node) external view returns (NodeData memory data) {
        return nodeData[node];
    }

    function isController(address node, address user) external view returns (bool) {
        return controllerOf[node] == user;
    }

    function isActive(address node) external view returns (bool) {
        return nodeData[node].active;
    }
}
