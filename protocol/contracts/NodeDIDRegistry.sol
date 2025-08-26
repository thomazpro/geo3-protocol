// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/* -------------------------------------------------------------------------- */
/*                               External Interface                           */
/* -------------------------------------------------------------------------- */
/// @title ISensorResolver
/// @dev  Minimal interface to query sensorType ⇒ maxResolution
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
/// @notice Decentralized identity registry for GEO3 network physical nodes.
/// @dev    • Each node is identified by its own Ethereum public key (`nodeAddress`)
///         • The `controller` address receives rewards and can update metadata.
///         • Validation of nodeType reuses the policy defined in the GeoDataRegistry
///           contract through the `ISensorResolver`.
contract NodeDIDRegistry is AccessControl, EIP712 {
    /* ───────────── ROLES ───────────── */
    /// @notice Role authorized to manage node registrations and operations
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
        uint8  nodeType;     // corresponds 1-to-1 with authorized sensorType
        bool   active;       // operational flag
        string metadataURI;  // DID-Document (IPFS/HTTPS)
    }

    /* ───────── STATE & STORAGE ─────── */
    /// @notice nodeAddress ⇒ controller (beneficiary)
    mapping(address => address) public controllerOf;

    /// @notice nodeAddress ⇒ NodeData (low-frequency updates)
    mapping(address => NodeData) public nodeData;

    /// @notice nodeAddress ⇒ nonce for EIP-712 (prevents signature replay)
    mapping(address => uint256) public nonces;

    /// @notice Contract defining which sensorTypes are enabled and their maximum resolution
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

    /// @notice Registers a new physical node in the GEO3 network
    /// @dev Verifies EIP-712 signature and validates the informed node type
    /// @param node        Address (Ethereum public key) embedded in hardware
    /// @param nodeType    Node category (mapped to sensorType)
    /// @param controller  Wallet that will receive rewards and manage the node
    /// @param metadataURI CID/URL of the DID-Document containing specs and credentials
    /// @param signature   EIP-712 signature from the node authorizing registration
    function registerNode(
        address node,
        uint8   nodeType,
        address controller,
        string calldata metadataURI,
        bytes calldata signature
    ) external onlyRole(MANAGER_ROLE) {
        _registerNode(node, nodeType, controller, metadataURI, signature);
    }

    /// @notice Registers multiple nodes in a single transaction
    /// @dev Reuses the same validations as `registerNode` for each entry
    /// @param nodeAddresses  List of node addresses to be registered
    /// @param nodeTypes      List of node types, paired by index
    /// @param controllers    List of controllers corresponding to each node
    /// @param metadataURIs   List of DID-Document URIs for each node
    /// @param signatures     EIP-712 signatures from the respective nodes
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
    /// @notice Changes the controller associated with a node
    /// @dev Can be called by the current controller or accounts with MANAGER_ROLE
    /// @param node          Node address
    /// @param newController New controller address
    function changeController(address node, address newController) external {
        if (controllerOf[node] == address(0)) revert NodeNotRegistered();
        if (msg.sender != controllerOf[node] && !hasRole(MANAGER_ROLE, msg.sender)) revert Unauthorized();
        if (newController == address(0)) revert InvalidController();

        controllerOf[node] = newController;
        emit ControllerChanged(node, newController);
    }

    /// @notice Updates the DID document URI of the node
    /// @dev Access restricted to current controller or MANAGER_ROLE
    /// @param node   Node address
    /// @param newURI New DID document URI
    function updateMetadataURI(address node, string calldata newURI) external {
        if (controllerOf[node] == address(0)) revert NodeNotRegistered();
        if (msg.sender != controllerOf[node] && !hasRole(MANAGER_ROLE, msg.sender)) revert Unauthorized();
        nodeData[node].metadataURI = newURI;
        emit MetadataURIUpdated(node, newURI);
    }

    /// @notice Activates or deactivates a node
    /// @dev Only callable by accounts with MANAGER_ROLE
    /// @param node   Node address
    /// @param active New active status
    function setNodeActive(address node, bool active) external onlyRole(MANAGER_ROLE) {
        if (controllerOf[node] == address(0)) revert NodeNotRegistered();
        nodeData[node].active = active;
        emit NodeStatusChanged(node, active);
    }

    /* -------------------------------------------------------------------------- */
    /*                                    VIEWs                                   */
    /* -------------------------------------------------------------------------- */
    /// @notice Returns the controller associated with a node
    /// @dev Simple query function
    /// @param node Node address
    /// @return controller Address that controls the node
    function getController(address node) external view returns (address controller) {
        return controllerOf[node];
    }

    /// @notice Returns controller and status of a node
    /// @dev Combines two queries into a single call
    /// @param node Node address
    /// @return controller Address controlling the node
    /// @return active     Node operational indicator
    function getControllerAndStatus(address node)
        external
        view
        returns (address controller, bool active)
    {
        controller = controllerOf[node];
        active = nodeData[node].active;
    }

    /// @notice Retrieves full node data except the controller
    /// @dev Returns the stored `NodeData` struct
    /// @param node Node address
    /// @return data Struct with type, status, and metadataURI
    function getNodeData(address node) external view returns (NodeData memory data) {
        return nodeData[node];
    }

    /// @notice Indicates if a given address is already registered
    /// @dev Useful for off-chain validations
    /// @param node Node address
    /// @return registered True if the node is already registered
    function isRegistered(address node) external view returns (bool registered) {
        return controllerOf[node] != address(0);
    }

    /// @notice Checks if a user is the controller of a node
    /// @dev Used by dApps for quick authorization
    /// @param node Node address
    /// @param user Potential controller address
    /// @return isCtrl True if `user` controls `node`
    function isController(address node, address user) external view returns (bool isCtrl) {
        return controllerOf[node] == user;
    }

    /// @notice Indicates whether a node is active
    /// @dev Queries the state stored in the `NodeData` struct
    /// @param node Node address
    /// @return active True if the node is active
    function isActive(address node) external view returns (bool active) {
        return nodeData[node].active;
    }
}
