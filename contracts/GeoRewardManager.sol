// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/* -------------------------------------------------------------------------- */
/*                              External Interfaces                           */
/* -------------------------------------------------------------------------- */

/// @title IGeoToken – interface mínima de mint/burn para o RewardManager
interface IGeoToken {
    function mint(address to, uint256 amount) external;
    function transfer(address to, uint256 amount) external returns (bool);
}

/// @title INodeDIDRegistry – consulta de controller para address de node
interface INodeDIDRegistry {
    function getController(address node) external view returns (address);
    function isActive(address node) external view returns (bool);
}

/* -------------------------------------------------------------------------- */
/*                               OpenZeppelin v5                              */
/* -------------------------------------------------------------------------- */

import {AccessControl}  from "@openzeppelin/contracts/access/AccessControl.sol";
import {MerkleProof}    from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/* -------------------------------------------------------------------------- */
/*                           GEO³ – GeoRewardManager                          */
/* -------------------------------------------------------------------------- */

/// @title GeoRewardManager
/// @notice Distribui CGT semanalmente com base em medições validadas no GeoDataRegistry.
/// @dev     – O oráculo off‑chain consolida leituras, calcula score & peso e gera 
///            uma árvore Merkle (leaf = nodeAddress, amount).
///          – Uma vez por semana publica (epochWeek, merkleRoot, totalToMint).
///          – Controllers dos nodes chamam `claim()` com prova para receber CGT.
contract GeoRewardManager is AccessControl {
    /* ───────────── ROLES ───────────── */
    bytes32 public constant ORACLE_ROLE  = keccak256("ORACLE_ROLE");  // publica ciclos de recompensa
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE"); // altera parâmetros críticos

    /* ───────────── ERRORS ───────────── */
    error CycleAlreadyExists();
    error InvalidProof();
    error AlreadyClaimed();
    error NodeInactive();

    /* ─────────── CONFIG CONSTANTS ─────────── */
    uint64  public immutable epochWindow; // nº de epochs (GeoDataRegistry) que formam 1 ciclo

    /* ───────── STATE & STORAGE ─────── */
    struct Cycle {
        bytes32 merkleRoot;   // raiz das recompensas semanais
        uint256 totalMinted;  // estatística
    }

    mapping(uint64 => Cycle) public cycles;                        // epochWeek => ciclo
    mapping(uint64 => mapping(address => bool)) public claimed;    // epochWeek => nodeAddress => claimed

    /* External Contracts */
    IGeoToken public immutable cgt;            // token CGT
    INodeDIDRegistry public immutable did;    // registro de nodes (para validar controller & ativo)

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
    /// @param epochWeek   Identificador incremental (ex.: floor(epoch/epochWindow))
    /// @param merkleRoot  Raiz (hash) da árvore (nodeAddress, amount)
    /// @param totalToMint Total de tokens a serem emitidos para este ciclo
    function publishCycle(
        uint64  epochWeek,
        bytes32 merkleRoot,
        uint256 totalToMint
    ) external onlyRole(ORACLE_ROLE) {
        if (cycles[epochWeek].merkleRoot != bytes32(0)) revert CycleAlreadyExists();

        // registra o ciclo
        cycles[epochWeek] = Cycle({merkleRoot: merkleRoot, totalMinted: totalToMint});

        // emite CGT para este contrato (minter role já delegada)
        cgt.mint(address(this), totalToMint);

        emit CyclePublished(epochWeek, merkleRoot, totalToMint);
    }

    /* -------------------------------------------------------------------------- */
    /*                               CLAIM DE RECOMPENSA                          */
    /* -------------------------------------------------------------------------- */

    /// @notice Controller reivindica CGT para um node específico em um ciclo
    /// @param epochWeek Ciclo de recompensa
    /// @param node      Endereço do node ligado ao controller
    /// @param amount    Valor esperado de recompensa
    /// @param proof     Caminho Merkle que comprova (node, amount) → merkleRoot
    function claim(
        uint64  epochWeek,
        address node,
        uint256 amount,
        bytes32[] calldata proof
    ) external {
        if (claimed[epochWeek][node]) revert AlreadyClaimed();
        if (!did.isActive(node))      revert NodeInactive();

        // o caller deve ser o controller do node
        require(did.getController(node) == msg.sender, "caller !controller");

        // verifica Merkle
        bytes32 leaf = keccak256(abi.encodePacked(node, amount));
        if (!MerkleProof.verify(proof, cycles[epochWeek].merkleRoot, leaf)) revert InvalidProof();

        claimed[epochWeek][node] = true;
        cgt.transfer(msg.sender, amount);

        emit RewardClaimed(msg.sender, node, epochWeek, amount);
    }
}