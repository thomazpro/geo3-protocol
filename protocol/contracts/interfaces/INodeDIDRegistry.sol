// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title Interface for NodeDIDRegistry
interface INodeDIDRegistry {
    /*────────────── Structs ─────────────*/
    struct NodeData {
        uint8  nodeType;
        bool   active;
        string metadataURI;
    }

    /*────────────── Registration ─────────────*/
    /// @notice Registers a new node in the registry
    /// @dev Requires a valid EIP-712 signature from the node
    /// @param node        Node address (public key)
    /// @param nodeType    Type/category of the node
    /// @param controller  Controller wallet for rewards and management
    /// @param metadataURI CID/URL for the node DID document
    /// @param signature   EIP-712 signature proving ownership
    function registerNode(
        address node,
        uint8 nodeType,
        address controller,
        string calldata metadataURI,
        bytes calldata signature
    ) external;

    /// @notice Batch version of `registerNode`
    /// @dev Each index across arrays represents one node
    /// @param nodeAddresses Array of node addresses
    /// @param nodeTypes     Array of node types
    /// @param controllers   Array of controller addresses
    /// @param metadataURIs  Array of metadata URIs
    /// @param signatures    Array of EIP-712 signatures
    function registerMultipleNodes(
        address[] calldata nodeAddresses,
        uint8[] calldata nodeTypes,
        address[] calldata controllers,
        string[] calldata metadataURIs,
        bytes[] calldata signatures
    ) external;

    /*────────────── Maintenance ─────────────*/
    /// @notice Updates the controller of a node
    /// @dev Only current controller or manager may call
    /// @param node          Node address
    /// @param newController New controller address
    function changeController(address node, address newController) external;

    /// @notice Updates the metadata URI of a node
    /// @dev Only current controller or manager may call
    /// @param node   Node address
    /// @param newURI New metadata URI
    function updateMetadataURI(address node, string calldata newURI) external;

    /// @notice Activates or deactivates a node
    /// @dev Manager-only operation
    /// @param node   Node address
    /// @param active New active status
    function setNodeActive(address node, bool active) external;

    /*────────────── Views ─────────────*/
    /// @notice Returns the controller of a node
    /// @dev Getter for mapping controllerOf
    /// @param node Node address
    /// @return controller Address that controls the node
    function getController(address node) external view returns (address controller);

    /// @notice Returns controller and active status of a node
    /// @dev Convenience getter combining controller and active flag
    /// @param node Node address
    /// @return controller Address that controls the node
    /// @return active     Whether the node is active
    function getControllerAndStatus(address node) external view returns (address controller, bool active);

    /// @notice Retrieves node data without the controller
    /// @dev Returns struct with type, status and metadataURI
    /// @param node Node address
    /// @return data Struct containing node info
    function getNodeData(address node) external view returns (NodeData memory data);

    /// @notice Checks if a node has been registered
    /// @dev Returns true if controllerOf has a non-zero address
    /// @param node Node address
    /// @return registered True if the node exists
    function isRegistered(address node) external view returns (bool registered);

    /// @notice Checks if a given user is the controller of a node
    /// @dev Useful for authorization checks
    /// @param node Node address
    /// @param user Potential controller address
    /// @return isCtrl True if `user` controls `node`
    function isController(address node, address user) external view returns (bool isCtrl);

    /// @notice Returns whether a node is active
    /// @dev Reads the `active` flag from storage
    /// @param node Node address
    /// @return active True if the node is active
    function isActive(address node) external view returns (bool active);
}

