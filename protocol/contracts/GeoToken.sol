// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20}  from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit}  from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Capped}  from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title GeoToken (CGT) - Carbon Guard Token
/// @notice Utility token issued based on verified climate measurements
/// @dev Implements ERC20, ERC20Permit, and ERC20Capped with access control
contract GeoToken is ERC20, ERC20Permit, ERC20Capped, AccessControl {
    /* ───────────── ROLES ───────────── */
    /// @notice Role authorized to burn tokens
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    /// @notice Role authorized to mint tokens
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /* ──────── STATE VARIABLES ──────── */
    /// @notice Contract responsible for reward distribution
    address public rewardManager;

    /* ───────────── EVENTS ───────────── */
    /// @notice Emitted when the reward manager contract is updated
    /// @param rewardManager New RewardManager address
    event RewardManagerSet(address rewardManager);

    /* ────────── CONSTRUCTOR ────────── */
    /// @notice Initializes the token by setting the admin and maximum cap
    /// @dev Grants the admin both DEFAULT_ADMIN and BURNER_ROLE
    /// @param admin Address with DEFAULT_ADMIN_ROLE
    /// @param cap   Maximum token supply cap
    constructor(address admin, uint256 cap)
        ERC20("Carbon Guard Token", "CGT")
        ERC20Permit("CGT")
        ERC20Capped(cap)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(BURNER_ROLE, admin);
    }

    /* ──────── MINT FUNCTION ──────── */
    /// @notice Mints new CGT tokens to an address
    /// @dev Only accounts with MINTER_ROLE can call this function
    /// @param to     Recipient of the tokens
    /// @param amount Amount of tokens to mint
    function mint(address to, uint256 amount)
        external
        onlyRole(MINTER_ROLE)
    {
        _mint(to, amount);
    }

    /* ──────── BURN FUNCTION ──────── */
    /// @notice Burns tokens from an authorized address
    /// @dev Restricted to accounts with BURNER_ROLE
    /// @param from   Address from which tokens will be burned
    /// @param amount Amount of tokens to burn
    function burn(address from, uint256 amount) external onlyRole(BURNER_ROLE) {
        _burn(from, amount);
    }

    /* ──────── SET REWARD MANAGER ──────── */
    /// @notice Sets the contract responsible for managing rewards
    /// @dev Revokes the role from the previous reward manager (if any) and grants it to the new one
    /// @param _rewardManager New RewardManager address
    function setRewardManager(address _rewardManager)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(_rewardManager != address(0), "reward manager zero");

        // Revoke role from the old reward manager, if any
        if (rewardManager != address(0)) {
            _revokeRole(MINTER_ROLE, rewardManager);
        }

        rewardManager = _rewardManager;
        _grantRole(MINTER_ROLE, _rewardManager);

        emit RewardManagerSet(_rewardManager);
    }

    /* ──────── REQUIRED OVERRIDES ──────── */
    /// @dev Required due to multiple inheritance from ERC20 and ERC20Capped
    /// @param from  Sender of the tokens
    /// @param to    Recipient of the tokens
    /// @param value Amount transferred
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Capped)
    {
        super._update(from, to, value);
    }
}
