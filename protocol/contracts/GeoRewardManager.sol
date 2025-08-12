// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/* -------------------------------------------------------------------------- */
/*                              External Interfaces                           */
/* -------------------------------------------------------------------------- */

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title IGeoToken – interface mínima de mint para o RewardManager
interface IGeoToken is IERC20 {
    function mint(address to, uint256 amount) external;
}

/// @title INodeDIDRegistry – consulta conjunta de controller e status
interface INodeDIDRegistry {
    function getControllerAndStatus(address node)
        external
        view
        returns (address controller, bool active);
}

/* -------------------------------------------------------------------------- */
/*                               OpenZeppelin v5                              */
/* -------------------------------------------------------------------------- */

import {AccessControl}  from "@openzeppelin/contracts/access/AccessControl.sol";
import {MerkleProof}    from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/* -------------------------------------------------------------------------- */
/*                           GEO3 – GeoRewardManager                          */
/* -------------------------------------------------------------------------- */

/// @title GeoRewardManager
/// @notice Distribui CGT semanalmente com base em medições validadas no GeoDataRegistry.
/// @dev     – O oráculo off‑chain consolida leituras, calcula score & peso e gera 
///            uma árvore Merkle (leaf = nodeAddress, amount).
///          – Uma vez por semana publica (epochWeek, merkleRoot, totalToMint).
///          – Controllers dos nodes chamam `claim()` com prova para receber CGT.
contract GeoRewardManager is AccessControl, ReentrancyGuard {
    using SafeERC20 for IGeoToken;

    /* ───────────── ROLES ───────────── */
    /// @notice Papel autorizado a publicar ciclos de recompensa
    bytes32 public constant ORACLE_ROLE  = keccak256("ORACLE_ROLE");

    /// @notice Papel autorizado a alterar parâmetros críticos
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    /* ───────────── ERRORS ───────────── */
    error CycleAlreadyExists();
    error CycleNotPublished();
    error InvalidProof();
    error AlreadyClaimed();
    error NodeInactive();
    error NotController();
    error ZeroRootOrAmount();

    /* ─────────── CONFIG CONSTANTS ─────────── */
    /// @notice Número de epochs do GeoDataRegistry que compõem um ciclo de recompensa
    uint64  public immutable epochWindow;

    /* ───────── STATE & STORAGE ─────── */
    /// @notice Armazena a raiz Merkle de cada ciclo de recompensa
    mapping(uint64 => bytes32) public cycleRoot;

    /// @notice Marca se um node já reivindicou recompensa em determinado ciclo
    mapping(uint64 => mapping(address => bool)) public claimed;

    /* External Contracts */
    /// @notice Referência ao token CGT
    IGeoToken public immutable cgt;

    /// @notice Registro de nodes utilizado para validar controller e status
    INodeDIDRegistry public immutable did;

    /* ───────────── EVENTS ───────────── */
    event CyclePublished(uint64 indexed epochWeek, bytes32 root, uint256 totalMint);
    event RewardClaimed(address indexed controller, address indexed node, uint64 epochWeek, uint256 amount);

    /* ────────── CONSTRUCTOR ────────── */
    constructor(
        address admin,
        address oracle,
        IGeoToken _cgt,
        INodeDIDRegistry _did,
        uint64 _epochWindow
    ) {
        cgt          = _cgt;
        did          = _did;
        epochWindow  = _epochWindow; // ex.: 168 (7 dias * 24h)

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ROLE,        oracle);
        _grantRole(MANAGER_ROLE,       admin);
    }

    /* -------------------------------------------------------------------------- */
    /*                         PUBLICAÇÃO DO CICLO (ORACLE)                       */
    /* -------------------------------------------------------------------------- */

    /// @notice Publica a raiz Merkle das recompensas de uma janela semanal
    /// @dev Emite os tokens necessários e registra a raiz para futuras provas
    /// @param epochWeek   Identificador incremental (ex.: floor(epoch/epochWindow))
    /// @param merkleRoot  Raiz (hash) da árvore (nodeAddress, amount)
    /// @param totalToMint Total de tokens a serem emitidos para este ciclo
    function publishCycle(
        uint64  epochWeek,
        bytes32 merkleRoot,
        uint256 totalToMint
    ) external onlyRole(ORACLE_ROLE) nonReentrant {
        if (cycleRoot[epochWeek] != bytes32(0)) revert CycleAlreadyExists();
        if (merkleRoot == bytes32(0) || totalToMint == 0) revert ZeroRootOrAmount();

        // registra o ciclo
        cycleRoot[epochWeek] = merkleRoot;

        // emite CGT para este contrato (minter role já delegada)
        cgt.mint(address(this), totalToMint);

        emit CyclePublished(epochWeek, merkleRoot, totalToMint);
    }

    /* -------------------------------------------------------------------------- */
    /*                               CLAIM DE RECOMPENSA                          */
    /* -------------------------------------------------------------------------- */

    /// @notice Controller reivindica CGT para um node específico em um ciclo
    /// @dev Valida prova Merkle e verifica se o node está ativo e controlado pelo chamador
    /// @param epochWeek Ciclo de recompensa
    /// @param node      Endereço do node ligado ao controller
    /// @param amount    Valor esperado de recompensa
    /// @param proof     Caminho Merkle que comprova (node, amount) → merkleRoot
    function claim(
        uint64  epochWeek,
        address node,
        uint256 amount,
        bytes32[] calldata proof
    ) external nonReentrant {
        bytes32 root = cycleRoot[epochWeek];
        if (root == bytes32(0))       revert CycleNotPublished();
        if (claimed[epochWeek][node]) revert AlreadyClaimed();

        (address controller, bool active) = did.getControllerAndStatus(node);
        if (!active) revert NodeInactive();
        if (controller != msg.sender) revert NotController();

        // verifica Merkle
        bytes32 leaf = keccak256(abi.encodePacked(node, amount));
        if (!MerkleProof.verifyCalldata(proof, root, leaf)) revert InvalidProof();

        claimed[epochWeek][node] = true;
        cgt.safeTransfer(msg.sender, amount);

        emit RewardClaimed(msg.sender, node, epochWeek, amount);
    }
}