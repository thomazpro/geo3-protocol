// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title Interface for GeoRewardManager
interface IGeoRewardManager {
    /*────────────── View Functions ─────────────*/
    /// @notice Returns the number of epochs that compose one reward cycle
    /// @dev Immutable configuration value
    /// @return window Number of epochs per cycle
    function epochWindow() external view returns (uint64 window);

    /// @notice Gets the Merkle root for a given cycle
    /// @dev Root is zero if cycle not published
    /// @param epochWeek Identifier of the cycle
    /// @return root Merkle root hash
    function cycleRoot(uint64 epochWeek) external view returns (bytes32 root);

    /// @notice Checks if a node has already claimed rewards in a cycle
    /// @dev Returns true once `claim` has been executed
    /// @param epochWeek Cycle identifier
    /// @param node      Node address
    /// @return hasClaimed True if rewards were claimed
    function claimed(uint64 epochWeek, address node) external view returns (bool hasClaimed);

    /// @notice Address of the CGT token contract
    /// @dev Used for minting and transfers
    /// @return token Address of CGT
    function cgt() external view returns (address token);

    /// @notice Address of the Node DID registry
    /// @dev Used to verify controller and activity
    /// @return registry Address of the registry contract
    function did() external view returns (address registry);

    /*────────────── Mutating Functions ─────────────*/
    /// @notice Publishes a reward cycle with its Merkle root and total amount to mint
    /// @dev Only callable by an authorized oracle
    /// @param epochWeek   Cycle identifier
    /// @param merkleRoot  Merkle root of (node, amount) pairs
    /// @param totalToMint Total CGT to mint for the cycle
    function publishCycle(
        uint64 epochWeek,
        bytes32 merkleRoot,
        uint256 totalToMint
    ) external;

    /// @notice Claims CGT rewards for a node in a specific cycle
    /// @dev Validates Merkle proof and node controller
    /// @param epochWeek Cycle identifier
    /// @param node      Node address
    /// @param amount    Amount of CGT to claim
    /// @param proof     Merkle proof for the claim
    function claim(
        uint64 epochWeek,
        address node,
        uint256 amount,
        bytes32[] calldata proof
    ) external;
}

