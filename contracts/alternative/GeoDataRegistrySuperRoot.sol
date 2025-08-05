// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/* -------------------------------------------------------------------------- */
/*                             OpenZeppelin Imports                           */
/* -------------------------------------------------------------------------- */
import {AccessControlEnumerable} from "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import {ReentrancyGuard}        from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable}               from "@openzeppelin/contracts/utils/Pausable.sol";
import {MerkleProof}            from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/* -------------------------------------------------------------------------- */
/*                       GEO3 – GeoDataRegistry (SuperRoot)                   */
/* -------------------------------------------------------------------------- */
/// @title GeoDataRegistrySuperRoot
/// @notice Versão compacta: armazena **uma única Merkle root por epoch**.
/// @dev    – Ideal para cenários onde um oráculo global consolida todos os batches.
///         – Menos granular, porém mais barata on‑chain.
contract GeoDataRegistrySuperRoot is AccessControlEnumerable, ReentrancyGuard, Pausable {
    /* ───────────── ROLES ───────────── */
    bytes32 public constant ORACLE_ROLE  = keccak256("ORACLE_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    /* ───────────── ERRORS ───────────── */
    error EmptyRoot();
    error EmptyCID();
    error EpochAlreadyPublished();

    /* ──────────── STRUCTS ──────────── */
    struct EpochMetadata {
        bytes32 merkleRoot; // raiz Merkle global do epoch
        string  dataCID;    // IPFS/Arweave com detalhes (ex.: lista de roots HGC)
    }

    /* ───────── STATE & STORAGE ─────── */
    uint64  public currentEpoch;
    uint256 public lastEpochTimestamp;
    uint256 public epochMinInterval; // segundos

    /// epochId ⇒ Metadata
    mapping(uint64 => EpochMetadata) public epochs;

    /* ───────────── EVENTS ───────────── */
    event EpochStarted   (uint64 indexed epochId, uint256 timestamp);
    event RootPublished  (uint64 indexed epochId, bytes32 merkleRoot, string dataCID);

    /* ────────── CONSTRUCTOR ────────── */
    constructor(address admin, address oracle, uint256 _epochMinInterval) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ROLE,        oracle);
        epochMinInterval = _epochMinInterval;
    }

    /* -------------------------------------------------------------------------- */
    /*                        PUBLICAÇÃO DE ROOT (ORACLE)                          */
    /* -------------------------------------------------------------------------- */
    /// @notice Publica a Merkle root global de um novo epoch.
    /// @param merkleRoot  Hash raiz das roots regionais/batches.
    /// @param dataCID     CID com artefatos off‑chain (JSON / CSV com métricas).
    function publishEpoch(bytes32 merkleRoot, string calldata dataCID)
        external
        onlyRole(ORACLE_ROLE)
        nonReentrant
        whenNotPaused
    {
        if (merkleRoot == bytes32(0)) revert EmptyRoot();
        if (bytes(dataCID).length == 0) revert EmptyCID();

        _updateEpoch(); // avança se intervalo mínimo atingido

        if (epochs[currentEpoch].merkleRoot != bytes32(0)) revert EpochAlreadyPublished();

        epochs[currentEpoch] = EpochMetadata({merkleRoot: merkleRoot, dataCID: dataCID});
        emit RootPublished(currentEpoch, merkleRoot, dataCID);
    }

    /* -------------------------------------------------------------------------- */
    /*                                  VIEWs                                     */
    /* -------------------------------------------------------------------------- */
    function verifyLeaf(uint64 epochId, bytes32 leaf, bytes32[] calldata proof) external view returns (bool) {
        bytes32 root = epochs[epochId].merkleRoot;
        return root != bytes32(0) && MerkleProof.verify(proof, root, leaf);
    }

    /* -------------------------------------------------------------------------- */
    /*                           ADMIN & GOVERNANCE                               */
    /* -------------------------------------------------------------------------- */
    function setEpochMinInterval(uint256 newInterval) external onlyRole(MANAGER_ROLE) {
        epochMinInterval = newInterval;
    }

    function pause()   external onlyRole(MANAGER_ROLE) { _pause(); }
    function unpause() external onlyRole(MANAGER_ROLE) { _unpause(); }

    /* -------------------------------------------------------------------------- */
    /*                                 INTERNAL                                   */
    /* -------------------------------------------------------------------------- */
    function _updateEpoch() internal {
        if (block.timestamp >= lastEpochTimestamp + epochMinInterval) {
            unchecked {
                uint64 delta = uint64((block.timestamp - lastEpochTimestamp) / epochMinInterval);
                currentEpoch += delta;
                lastEpochTimestamp += delta * epochMinInterval;
            }
            emit EpochStarted(currentEpoch, lastEpochTimestamp);
        }
    }
}
