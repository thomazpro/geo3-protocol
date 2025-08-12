// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title Interface for GeoToken
interface IGeoToken {
    /*────────────── Events ─────────────*/
    /// @notice Emitted when the reward manager is updated
    /// @param rewardManager Address of the new RewardManager
    event RewardManagerSet(address rewardManager);

    /*────────────── View Functions ─────────────*/
    /// @notice Returns the current reward manager address
    /// @dev Getter for the rewardManager variable
    /// @return manager Address of the RewardManager contract
    function rewardManager() external view returns (address manager);

    /// @notice Hash of the role allowed to burn tokens
    /// @dev Constant defined in implementation
    /// @return role Role identifier
    function BURNER_ROLE() external view returns (bytes32 role);

    /// @notice Hash of the role allowed to mint tokens
    /// @dev Constant defined in implementation
    /// @return role Role identifier
    function MINTER_ROLE() external view returns (bytes32 role);

    /*────────────── Mutating Functions ─────────────*/
    /// @notice Mints new tokens to an address
    /// @dev Access controlled by MINTER_ROLE
    /// @param to Recipient of the tokens
    /// @param amount Amount to mint
    function mint(address to, uint256 amount) external;

    /// @notice Burns tokens from an address
    /// @dev Access controlled by BURNER_ROLE
    /// @param from Address whose tokens will be burned
    /// @param amount Amount to burn
    function burn(address from, uint256 amount) external;

    /// @notice Sets the reward manager contract
    /// @dev Should grant MINTER_ROLE to the new manager
    /// @param _rewardManager Address of the new RewardManager
    function setRewardManager(address _rewardManager) external;
}

