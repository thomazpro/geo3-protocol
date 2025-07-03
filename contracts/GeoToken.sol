// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20}  from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit}  from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Capped}  from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title GeoToken (CGT) - Carbon Guard Token
/// @notice Token utilitário emitido com base em medições climáticas verificadas
contract GeoToken is ERC20, ERC20Permit, ERC20Capped, AccessControl {
    /* ───────────── ROLES ───────────── */
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    /* ────────── CONSTRUCTOR ────────── */
    constructor(address admin, uint256 cap)
        ERC20("Carbon Guard Token", "CGT")
        ERC20Permit("CGT")
        ERC20Capped(cap)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(BURNER_ROLE, admin); // opcional, delegável
    }

    /* ──────── FUNÇÃO DE MINT ──────── */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    /* ──────── FUNÇÃO DE BURN ──────── */
    function burn(address from, uint256 amount) external onlyRole(BURNER_ROLE) {
        _burn(from, amount);
    }

    /* ──────── OVERRIDES NECESSÁRIOS ──────── */
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Capped)
    {
        super._update(from, to, value);
    }
}
