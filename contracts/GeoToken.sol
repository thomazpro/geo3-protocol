// SPDX-License-Identifier: MIT
// Author: Thomaz Valadares Gontijo (Aura Tecnologia)

pragma solidity 0.8.24;

import {ERC20}  from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit}  from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Capped}  from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title GeoToken (CGT) - Carbon Guard Token
/// @notice Token utilitário emitido com base em medições climáticas verificadas
/// @dev Implementa ERC20, ERC20Permit e ERC20Capped com controle de acesso
contract GeoToken is ERC20, ERC20Permit, ERC20Capped, AccessControl {
    /* ───────────── ROLES ───────────── */
    /// @notice Papel autorizado a queimar tokens
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    /// @notice Papel autorizado a cunhar tokens
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /* ──────── STATE VARIABLES ──────── */
    /// @notice Contrato responsável pela distribuição de recompensas
    address public rewardManager;

    /* ───────────── EVENTS ───────────── */
    /// @notice Emitted quando o contrato de recompensas é atualizado
    /// @param rewardManager Novo endereço do RewardManager
    event RewardManagerSet(address rewardManager);


    /* ────────── CONSTRUCTOR ────────── */
    /// @notice Inicializa o token definindo administrador e limite máximo
    /// @dev Concede ao admin os papéis DEFAULT_ADMIN e BURNER_ROLE
    /// @param admin Address com papel DEFAULT_ADMIN
    /// @param cap   Limite máximo de supply
    constructor(address admin, uint256 cap)
        ERC20("Carbon Guard Token", "CGT")
        ERC20Permit("CGT")
        ERC20Capped(cap)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(BURNER_ROLE, admin);
    }

    /* ──────── FUNÇÃO DE MINT ──────── */
    /// @notice Emite novos CGTs para um endereço
    /// @dev Somente contas com MINTER_ROLE podem chamar
    /// @param to     Beneficiário dos tokens
    /// @param amount Quantidade a ser emitida
    function mint(address to, uint256 amount)
        external
        onlyRole(MINTER_ROLE)
    {
        _mint(to, amount);
    }

    /* ──────── FUNÇÃO DE BURN ──────── */
    /// @notice Queima tokens de um endereço autorizado
    /// @dev Restrito a contas com BURNER_ROLE
    /// @param from   Endereço de origem dos tokens
    /// @param amount Quantidade a ser queimada
    function burn(address from, uint256 amount) external onlyRole(BURNER_ROLE) {
        _burn(from, amount);
    }

    /* ──────── SET REWARD MANAGER ──────── */
    /// @notice Define o contrato responsável por gerenciar recompensas
    /// @dev Revoga o papel do gerente anterior e concede ao novo endereço
    /// @param _rewardManager Novo endereço do RewardManager
    function setRewardManager(address _rewardManager)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(_rewardManager != address(0), "reward manager zero");

        // Revoga papel do antigo reward manager, se houver
        if (rewardManager != address(0)) {
            _revokeRole(MINTER_ROLE, rewardManager);
        }

        rewardManager = _rewardManager;
        _grantRole(MINTER_ROLE, _rewardManager);

        emit RewardManagerSet(_rewardManager);
    }

    /* ──────── OVERRIDES NECESSÁRIOS ──────── */
    /// @dev Necessário devido ao múltiplo inheritance de ERC20 e ERC20Capped
    /// @param from Remetente dos tokens
    /// @param to   Destinatário dos tokens
    /// @param value Quantidade transferida
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Capped)
    {
        super._update(from, to, value);
    }
}
