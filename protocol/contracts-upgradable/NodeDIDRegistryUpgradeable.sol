// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

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
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {ECDSAUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/* -------------------------------------------------------------------------- */
/*                        GEO3 – NodeDIDRegistryUpgradeable                   */
/* -------------------------------------------------------------------------- */
/// @title NodeDIDRegistryUpgradeable
/// @notice Versão upgradável do registro de identidade dos nodes da rede GEO3.
contract NodeDIDRegistryUpgradeable is Initializable, AccessControlUpgradeable, EIP712Upgradeable, UUPSUpgradeable {
    /* ───────────── ROLES ───────────── */
    /// @notice Papel autorizado a gerenciar registros e operações de nodes
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    /// @notice Papel autorizado a atualizar a implementação do contrato
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

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
    ISensorResolver public sensorResolver;

    /* ───────────── EVENTS ───────────── */
    event NodeRegistered     (address indexed node, uint8 indexed nodeType, address controller);
    event ControllerChanged  (address indexed node, address newController);
    event MetadataURIUpdated (address indexed node, string newURI);
    event NodeStatusChanged  (address indexed node, bool active);

    /* ───────────── INITIALIZER ──────── */
    function initialize(address admin, address _sensorResolver) public initializer {
        __AccessControl_init();
        __EIP712_init("NodeDIDRegistry", "1");
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MANAGER_ROLE,       admin);
        _grantRole(UPGRADER_ROLE,      admin);

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
        if (ECDSAUpgradeable.recover(digest, sig) != node) revert InvalidSignature();

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
    /// @dev Somente contas com MANAGER_ROLE podem alterar status
    /// @param node  Endereço do node
    /// @param active Flag indicando se o node está ativo ou não
    function setNodeStatus(address node, bool active) external onlyRole(MANAGER_ROLE) {
        if (controllerOf[node] == address(0)) revert NodeNotRegistered();
        nodeData[node].active = active;
        emit NodeStatusChanged(node, active);
    }

    /* ──────────── UUPS AUTH ─────────── */
    function _authorizeUpgrade(address) internal override onlyRole(UPGRADER_ROLE) {}
}

