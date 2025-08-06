// SPDX-License-Identifier: MIT
// Author: Thomaz Valadares Gontijo (Aura Tecnologia)

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
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/* -------------------------------------------------------------------------- */
/*                           GEO3 – NodeDIDRegistry                           */
/* -------------------------------------------------------------------------- */
/// @title NodeDIDRegistry
/// @notice Registro de identidade descentralizada dos nodes físicos da rede GEO3.
/// @dev    • Cada node é identificado por sua própria chave pública Ethereum (`nodeAddress`)
///         • O endereço `controller` recebe recompensas e pode atualizar metadados.
///         • A validação do tipo de node (nodeType) reutiliza a política definida no
///           contrato GeoDataRegistry através do `ISensorResolver`.
contract NodeDIDRegistry is AccessControl, EIP712 {
    /* ───────────── ROLES ───────────── */
    /// @notice Papel autorizado a gerenciar registros e operações de nodes
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    /* ───────────── ERRORS ───────────── */
    error InvalidController();
    error InvalidNodeAddress();
    error NodeAlreadyRegistered();
    error NodeTypeNotAllowed();
    error Unauthorized();
    error NodeNotRegistered();
    error ArrayLengthMismatch();
    error InvalidSignature();

    /* ──────────── STRUCTS ──────────── */
    struct NodeData {
        uint8  nodeType;     // corresponde 1-a-1 ao sensorType autorizado
        bool   active;       // flag de operação
        string metadataURI;  // DID-Document (IPFS/HTTPS)
    }

    /* ───────── STATE & STORAGE ─────── */
    /// @notice nodeAddress ⇒ controller (beneficiário)
    mapping(address => address) public controllerOf;

    /// @notice nodeAddress ⇒ NodeData imutável/frequência baixa de update
    mapping(address => NodeData) public nodeData;

    /// @notice nodeAddress ⇒ nonce para EIP-712 (previne reutilização de assinatura)
    mapping(address => uint256) public nonces;

    /// @notice Contrato que define quais sensorTypes estão habilitados e sua resolução máxima
    ISensorResolver public immutable sensorResolver;

    /* ───────────── EVENTS ───────────── */
    event NodeRegistered     (address indexed node, uint8 indexed nodeType, address controller);
    event ControllerChanged  (address indexed node, address newController);
    event MetadataURIUpdated (address indexed node, string newURI);
    event NodeStatusChanged  (address indexed node, bool active);

    /* ────────── CONSTRUCTOR ────────── */
    constructor(address admin, address _sensorResolver)
        EIP712("NodeDIDRegistry", "1")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MANAGER_ROLE,       admin);
        sensorResolver = ISensorResolver(_sensorResolver);
    }

    /* -------------------------------------------------------------------------- */
    /*                              NODE REGISTRATION                              */
    /* -------------------------------------------------------------------------- */
    bytes32 private constant REGISTER_TYPEHASH =
        keccak256(
            "Register(address node,address controller,uint8 nodeType,string metadataURI,uint256 nonce)"
        );

    function _registerNode(
        address node,
        uint8 nodeType,
        address controller,
        string calldata uri,
        bytes calldata sig
    ) internal {
        if (node        == address(0)) revert InvalidNodeAddress();
        if (controller  == address(0)) revert InvalidController();
        if (controllerOf[node] != address(0)) revert NodeAlreadyRegistered();

        uint256 nonce = nonces[node];
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    REGISTER_TYPEHASH,
                    node,
                    controller,
                    nodeType,
                    keccak256(bytes(uri)),
                    nonce
                )
            )
        );
        if (ECDSA.recover(digest, sig) != node) revert InvalidSignature();

        if (sensorResolver.sensorTypeMaxResolution(nodeType) == 0) revert NodeTypeNotAllowed();

        controllerOf[node] = controller;
        nodeData[node] = NodeData({nodeType: nodeType, active: true, metadataURI: uri});
        nonces[node] = nonce + 1;

        emit NodeRegistered(node, nodeType, controller);
    }

    /// @notice Registra um novo node físico na rede GEO3
    /// @dev Verifica assinatura EIP-712 e valida o tipo de node informado
    /// @param node        Endereço (chave pública Ethereum) embutido no hardware
    /// @param nodeType    Categoria do node (mapeada ao sensorType)
    /// @param controller  Carteira que receberá recompensas e poderá gerenciar o node
    /// @param metadataURI CID/URL do DID-Document contendo specs e credenciais
    /// @param signature   Assinatura EIP-712 do node autorizando o registro
    function registerNode(
        address node,
        uint8   nodeType,
        address controller,
        string calldata metadataURI,
        bytes calldata signature
    ) external onlyRole(MANAGER_ROLE) {
        _registerNode(node, nodeType, controller, metadataURI, signature);
    }

    /// @notice Registra múltiplos nodes em uma única transação
    /// @dev Reaproveita as validações de `registerNode` para cada entrada
    /// @param nodeAddresses  Lista dos endereços dos nodes a serem registrados
    /// @param nodeTypes      Lista dos tipos de cada node, pareada por índice
    /// @param controllers    Lista de controllers correspondentes a cada node
    /// @param metadataURIs   Lista de URIs do DID-Document de cada node
    /// @param signatures     Assinaturas EIP-712 dos respectivos nodes
    function registerMultipleNodes(
        address[] calldata nodeAddresses,
        uint8[] calldata nodeTypes,
        address[] calldata controllers,
        string[] calldata metadataURIs,
        bytes[] calldata signatures
    ) external onlyRole(MANAGER_ROLE) {
        uint256 length = nodeAddresses.length;
        if (length != nodeTypes.length || length != controllers.length ||
            length != metadataURIs.length || length != signatures.length)
        {
            revert ArrayLengthMismatch();
        }

        for (uint256 i; i < length; ) {
            address node = nodeAddresses[i];
            address controller = controllers[i];
            uint8 nodeType = nodeTypes[i];
            string calldata uri = metadataURIs[i];
            bytes calldata sig = signatures[i];

            _registerNode(node, nodeType, controller, uri, sig);

            unchecked { ++i; }
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                             NODE MAINTENANCE                               */
    /* -------------------------------------------------------------------------- */
    /// @notice Troca o controller associado a um node
    /// @dev Pode ser chamada pelo controller atual ou por contas com MANAGER_ROLE
    /// @param node          Endereço do node
    /// @param newController Novo endereço de controller
    function changeController(address node, address newController) external {
        if (controllerOf[node] == address(0)) revert NodeNotRegistered();
        if (msg.sender != controllerOf[node] && !hasRole(MANAGER_ROLE, msg.sender)) revert Unauthorized();
        if (newController == address(0)) revert InvalidController();

        controllerOf[node] = newController;
        emit ControllerChanged(node, newController);
    }

    /// @notice Atualiza o URI do documento DID do node
    /// @dev Acesso restrito ao controller atual ou MANAGER_ROLE
    /// @param node   Endereço do node
    /// @param newURI Novo URI do documento DID
    function updateMetadataURI(address node, string calldata newURI) external {
        if (controllerOf[node] == address(0)) revert NodeNotRegistered();
        if (msg.sender != controllerOf[node] && !hasRole(MANAGER_ROLE, msg.sender)) revert Unauthorized();
        nodeData[node].metadataURI = newURI;
        emit MetadataURIUpdated(node, newURI);
    }

    /// @notice Ativa ou desativa um node
    /// @dev Chamada somente por contas com MANAGER_ROLE
    /// @param node   Endereço do node
    /// @param active Novo estado de atividade
    function setNodeActive(address node, bool active) external onlyRole(MANAGER_ROLE) {
        if (controllerOf[node] == address(0)) revert NodeNotRegistered();
        nodeData[node].active = active;
        emit NodeStatusChanged(node, active);
    }

    /* -------------------------------------------------------------------------- */
    /*                                    VIEWs                                   */
    /* -------------------------------------------------------------------------- */
    /// @notice Retorna o controller associado a um node
    /// @dev Função de consulta simples
    /// @param node Endereço do node consultado
    /// @return controller Endereço que controla o node
    function getController(address node) external view returns (address controller) {
        return controllerOf[node];
    }

    /// @notice Retorna controller e status de um node
    /// @dev Combina duas consultas em uma única chamada
    /// @param node Endereço do node consultado
    /// @return controller Endereço que controla o node
    /// @return active     Indicador de operação do node
    function getControllerAndStatus(address node)
        external
        view
        returns (address controller, bool active)
    {
        controller = controllerOf[node];
        active = nodeData[node].active;
    }

    /// @notice Obtém os dados completos de um node, exceto o controller
    /// @dev Retorna struct `NodeData` armazenada
    /// @param node Endereço do node consultado
    /// @return data Estrutura com tipo, status e metadataURI
    function getNodeData(address node) external view returns (NodeData memory data) {
        return nodeData[node];
    }

    /// @notice Indica se um determinado endereço já possui registro
    /// @dev Útil para validações off-chain
    /// @param node Endereço do node a ser consultado
    /// @return registered Verdadeiro se o node já foi registrado
    function isRegistered(address node) external view returns (bool registered) {
        return controllerOf[node] != address(0);
    }

    /// @notice Verifica se um usuário é controller de um node
    /// @dev Utilizada por dApps para autorizações rápidas
    /// @param node Endereço do node
    /// @param user Endereço do possível controller
    /// @return isCtrl Verdadeiro se `user` controla `node`
    function isController(address node, address user) external view returns (bool isCtrl) {
        return controllerOf[node] == user;
    }

    /// @notice Informa se um node está ativo
    /// @dev Consulta estado armazenado na struct `NodeData`
    /// @param node Endereço do node
    /// @return active Verdadeiro se o node estiver ativo
    function isActive(address node) external view returns (bool active) {
        return nodeData[node].active;
    }
}
