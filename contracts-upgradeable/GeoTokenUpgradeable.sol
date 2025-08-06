// SPDX-License-Identifier: MIT
// Author: Thomaz Valadares Gontijo (Aura Tecnologia)

pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ERC20PermitUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import {ERC20CappedUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20CappedUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @title GeoTokenUpgradeable (CGT) - Carbon Guard Token
/// @notice Versão upgradável do token utilitário CGT
contract GeoTokenUpgradeable is Initializable, ERC20Upgradeable, ERC20PermitUpgradeable, ERC20CappedUpgradeable, AccessControlUpgradeable, UUPSUpgradeable {
    /* ───────────── ROLES ───────────── */
    /// @notice Papel autorizado a queimar tokens
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    /// @notice Papel autorizado a cunhar tokens
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @notice Papel autorizado a atualizar a implementação do contrato
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    /* ──────── STATE VARIABLES ──────── */
    /// @notice Contrato responsável pela distribuição de recompensas
    address public rewardManager;

    /* ───────────── EVENTS ───────────── */
    /// @notice Emitted quando o contrato de recompensas é atualizado
    /// @param rewardManager Novo endereço do RewardManager
    event RewardManagerSet(address rewardManager);

    /// @notice Inicializador do token definindo administrador e limite máximo
    /// @param admin Address com papel DEFAULT_ADMIN
    /// @param cap   Limite máximo de supply
    function initialize(address admin, uint256 cap) public initializer {
        __ERC20_init("Carbon Guard Token", "CGT");
        __ERC20Permit_init("CGT");
        __ERC20Capped_init(cap);
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(BURNER_ROLE,        admin);
        _grantRole(UPGRADER_ROLE,      admin);
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
        override(ERC20Upgradeable, ERC20CappedUpgradeable)
    {
        super._update(from, to, value);
    }

    /* ──────────── UUPS AUTH ─────────── */
    function _authorizeUpgrade(address) internal override onlyRole(UPGRADER_ROLE) {}
}

