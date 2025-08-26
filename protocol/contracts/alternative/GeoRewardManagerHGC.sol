// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/* -------------------------------------------------------------------------- */
/*                               External Interfaces                          */
/* -------------------------------------------------------------------------- */

/// @title IGeoToken
/// @notice Minimal interface for minting and transferring CGT tokens
interface IGeoToken {
    function mint(address to, uint256 amount) external;
    function transfer(address to, uint256 amount) external returns (bool);
}

/// @title INodeDIDRegistry
/// @notice Interface for querying node controller and active status
interface INodeDIDRegistry {
    function getControllerAndStatus(address node)
        external
        view
        returns (address controller, bool active);
}

/* -------------------------------------------------------------------------- */
/*                              OpenZeppelin v5                               */
/* -------------------------------------------------------------------------- */
import {AccessControl}   from "@openzeppelin/contracts/access/AccessControl.sol";
import {MerkleProof}     from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {BitMaps}         from "@openzeppelin/contracts/utils/structs/BitMaps.sol";

/* -------------------------------------------------------------------------- */
/*                    GEO3 – Hierarchical Reward Manager (HGC)                */
/* -------------------------------------------------------------------------- */
/// @title GeoRewardManagerHGC
/// @notice Decentralized HGC-based distribution of CGT rewards.
/// @dev    – Each geoBatchId (compressed cell) has its own Merkle root of rewards  
///         – Regional oracles publish batches independently  
///         – Node controllers claim rewards via regional Merkle proofs
contract GeoRewardManagerHGC is AccessControl {
    using BitMaps for BitMaps.BitMap;

    /* ───────────── ROLES ───────────── */
    /// @notice Role authorized to publish reward batches
    bytes32 public constant ORACLE_ROLE  = keccak256("ORACLE_ROLE");

    /// @notice Role authorized to update critical parameters
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    /* ───────────── ERRORS ───────────── */
    error BatchAlreadyExists();
    error InvalidProof();
    error AlreadyClaimed();
    error NodeInactive();
    error NotController();

    /* ─────────── CONFIG CONSTANTS ─────────── */
    /// @notice Reference to CGT token
    IGeoToken         public immutable cgt;

    /// @notice Node registry used to validate controllers and node status
    INodeDIDRegistry  public immutable did;

    /* ---------------------------------------------------------------------- */
    /*                          Storage Structures                            */
    /* ---------------------------------------------------------------------- */
    struct RewardBatch {
        bytes32 merkleRoot; // Merkle root of the reward batch
        uint256 totalMint;  // statistical info
        string  dataCID;    // optional: IPFS link with complete dataset
    }

    /// @notice Mapping of epochWeek ⇒ geoBatchId ⇒ RewardBatch
    mapping(uint64 => mapping(uint64 => RewardBatch)) public rewardBatches;

    /// @notice Bitmap of claims: hash(epochWeek, geoBatchId, controller)
    BitMaps.BitMap private _claimed;

    /* ───────────── EVENTS ───────────── */
    event RewardBatchPublished(uint64 indexed epochWeek, uint64 indexed geoBatchId, bytes32 root, uint256 totalMint);
    event RewardClaimed(address indexed controller, uint64 indexed epochWeek, uint64 geoBatchId, uint256 amount);

    /* ────────── CONSTRUCTOR ────────── */
    /// @param admin        Address with DEFAULT_ADMIN_ROLE
    /// @param oracleGlobal Address authorized as global oracle
    /// @param _cgt         Reference to CGT token contract
    /// @param _did         Reference to NodeDIDRegistry
    constructor(
        address admin,
        address oracleGlobal,
        IGeoToken _cgt,
        INodeDIDRegistry _did
    ) {
        cgt = _cgt;
        did = _did;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ROLE,        oracleGlobal);
        _grantRole(MANAGER_ROLE,       admin);
    }

    /* -------------------------------------------------------------------------- */
    /*                           BATCH PUBLICATION (ORACLE)                       */
    /* -------------------------------------------------------------------------- */
    /// @notice Publishes a reward batch for a given regional aggregation (geoBatchId)
    /// @param epochWeek   Weekly epoch identifier
    /// @param geoBatchId  Regional batch identifier
    /// @param merkleRoot  Merkle root of the reward distribution
    /// @param totalToMint Total tokens to mint for this batch
    /// @param dataCID     Optional off-chain data reference
    function publishRewardBatch(
        uint64  epochWeek,
        uint64  geoBatchId,
        bytes32 merkleRoot,
        uint256 totalToMint,
        string  calldata dataCID
    ) external onlyRole(ORACLE_ROLE) {
        if (rewardBatches[epochWeek][geoBatchId].merkleRoot != bytes32(0)) revert BatchAlreadyExists();

        rewardBatches[epochWeek][geoBatchId] = RewardBatch({
            merkleRoot: merkleRoot,
            totalMint:  totalToMint,
            dataCID:    dataCID
        });

        cgt.mint(address(this), totalToMint);

        emit RewardBatchPublished(epochWeek, geoBatchId, merkleRoot, totalToMint);
    }

    /* -------------------------------------------------------------------------- */
    /*                               CLAIM REGION                                */
    /* -------------------------------------------------------------------------- */
    /// @notice Controller claims reward for a node belonging to a specific batch
    /// @param epochWeek Weekly epoch identifier
    /// @param geoBatchId Regional batch identifier
    /// @param amount Expected reward amount
    /// @param proof Merkle proof validating (node, amount) against the batch root
    function claim(
        uint64  epochWeek,
        uint64  geoBatchId,
        uint256 amount,
        bytes32[] calldata proof
    ) external {
        // verify node is active and caller is controller
        (address controller, bool active) = did.getControllerAndStatus(msg.sender);
        if (!active) revert NodeInactive();
        if (controller != msg.sender) revert NotController();

        // ensure no double claim
        uint256 bitIndex = _claimKey(epochWeek, geoBatchId, msg.sender);
        if (_claimed.get(bitIndex)) revert AlreadyClaimed();

        // verify Merkle proof
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        if (!MerkleProof.verify(proof, rewardBatches[epochWeek][geoBatchId].merkleRoot, leaf)) revert InvalidProof();

        _claimed.set(bitIndex);
        cgt.transfer(msg.sender, amount);

        emit RewardClaimed(msg.sender, epochWeek, geoBatchId, amount);
    }

    /* -------------------------------------------------------------------------- */
    /*                             INTERNAL HELPERS                               */
    /* -------------------------------------------------------------------------- */
    /// @dev Generates a unique index for the bitmap: hash(epochWeek, geoBatchId, controller)
    /// @param epochWeek   Weekly epoch identifier
    /// @param geoBatchId  Regional batch identifier
    /// @param controller  Controller address
    /// @return uint256 Unique claim index
    function _claimKey(uint64 epochWeek, uint64 geoBatchId, address controller) private pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(epochWeek, geoBatchId, controller)));
    }
}
