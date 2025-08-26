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
/// @notice Compact version: stores **a single Merkle root per epoch**.
/// @dev    – Designed for scenarios where a global oracle consolidates all batches.
///         – Less granular, but cheaper on-chain.
contract GeoDataRegistrySuperRoot is AccessControlEnumerable, ReentrancyGuard, Pausable {
    /* ───────────── ROLES ───────────── */
    /// @notice Role authorized to publish epoch roots
    bytes32 public constant ORACLE_ROLE  = keccak256("ORACLE_ROLE");

    /// @notice Role authorized to configure and manage parameters
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    /* ───────────── ERRORS ───────────── */
    error EmptyRoot();
    error EmptyCID();
    error EpochAlreadyPublished();

    /* ──────────── STRUCTS ──────────── */
    struct EpochMetadata {
        bytes32 merkleRoot; // global Merkle root of the epoch
        string  dataCID;    // IPFS/Arweave with details (e.g., list of HGC roots)
    }

    /* ───────── STATE & STORAGE ─────── */
    /// @notice Current epoch identifier
    uint64  public currentEpoch;

    /// @notice Timestamp of the last epoch update
    uint256 public lastEpochTimestamp;

    /// @notice Minimum interval between epochs in seconds
    uint256 public epochMinInterval;

    /// @notice Mapping of epochId ⇒ metadata
    mapping(uint64 => EpochMetadata) public epochs;

    /* ───────────── EVENTS ───────────── */
    event EpochStarted   (uint64 indexed epochId, uint256 timestamp);
    event RootPublished  (uint64 indexed epochId, bytes32 merkleRoot, string dataCID);

    /* ────────── CONSTRUCTOR ────────── */
    /// @param admin Address with DEFAULT_ADMIN_ROLE
    /// @param oracle Address authorized as oracle
    /// @param _epochMinInterval Minimum time between epochs (in seconds)
    constructor(address admin, address oracle, uint256 _epochMinInterval) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ROLE,        oracle);
        epochMinInterval = _epochMinInterval;
    }

    /* -------------------------------------------------------------------------- */
    /*                             ROOT PUBLICATION (ORACLE)                      */
    /* -------------------------------------------------------------------------- */
    /// @notice Publishes the global Merkle root for a new epoch
    /// @param merkleRoot  Root hash of the consolidated regional/batch roots
    /// @param dataCID     CID with off-chain artifacts (e.g., JSON / CSV with metrics)
    function publishEpoch(bytes32 merkleRoot, string calldata dataCID)
        external
        onlyRole(ORACLE_ROLE)
        nonReentrant
        whenNotPaused
    {
        if (merkleRoot == bytes32(0)) revert EmptyRoot();
        if (bytes(dataCID).length == 0) revert EmptyCID();

        _updateEpoch(); // advance epoch if minimum interval has passed

        if (epochs[currentEpoch].merkleRoot != bytes32(0)) revert EpochAlreadyPublished();

        epochs[currentEpoch] = EpochMetadata({merkleRoot: merkleRoot, dataCID: dataCID});
        emit RootPublished(currentEpoch, merkleRoot, dataCID);
    }

    /* -------------------------------------------------------------------------- */
    /*                                  VIEWS                                    */
    /* -------------------------------------------------------------------------- */
    /// @notice Verifies if a leaf belongs to the epoch's Merkle root
    /// @param epochId Epoch identifier
    /// @param leaf    Leaf hash to prove
    /// @param proof   Merkle path proof
    /// @return True if the leaf is included in the root
    function verifyLeaf(uint64 epochId, bytes32 leaf, bytes32[] calldata proof) external view returns (bool) {
        bytes32 root = epochs[epochId].merkleRoot;
        return root != bytes32(0) && MerkleProof.verify(proof, root, leaf);
    }

    /* -------------------------------------------------------------------------- */
    /*                           ADMIN & GOVERNANCE                               */
    /* -------------------------------------------------------------------------- */
    /// @notice Sets the minimum interval between epochs
    /// @param newInterval New interval in seconds
    function setEpochMinInterval(uint256 newInterval) external onlyRole(MANAGER_ROLE) {
        epochMinInterval = newInterval;
    }

    /// @notice Pauses root publication
    function pause()   external onlyRole(MANAGER_ROLE) { _pause(); }

    /// @notice Resumes root publication
    function unpause() external onlyRole(MANAGER_ROLE) { _unpause(); }

    /* -------------------------------------------------------------------------- */
    /*                                 INTERNAL                                   */
    /* -------------------------------------------------------------------------- */
    /// @dev Updates the epoch counter if enough time has passed
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
