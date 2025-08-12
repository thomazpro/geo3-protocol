// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/* -------------------------------------------------------------------------- */
/*                               External Interfaces                          */
/* -------------------------------------------------------------------------- */

interface IGeoToken {
    function mint(address to, uint256 amount) external;
    function transfer(address to, uint256 amount) external returns (bool);
}

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
/// @notice Versão descentralizada por agrupamento HGC da distribuição de CGT.
/// @dev    – Cada geoBatchId (célula compressa) possui sua própria Merkle root de recompensas
///         – Oráculos regionais publicam batches independentemente
///         – Controllers dos nodes reivindicam via proof regional
contract GeoRewardManagerHGC is AccessControl {
    using BitMaps for BitMaps.BitMap;

    /* ───────────── ROLES ───────────── */
    bytes32 public constant ORACLE_ROLE  = keccak256("ORACLE_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    /* ───────────── ERRORS ───────────── */
    error BatchAlreadyExists();
    error InvalidProof();
    error AlreadyClaimed();
    error NodeInactive();
    error NotController();

    /* ─────────── CONFIG CONSTANTS ─────────── */
    IGeoToken         public immutable cgt;
    INodeDIDRegistry  public immutable did;

    /* ---------------------------------------------------------------------- */
    /*                          Storage Structures                            */
    /* ---------------------------------------------------------------------- */
    struct RewardBatch {
        bytes32 merkleRoot; // raiz Merkle dos rewards do agrupamento
        uint256 totalMint;  // estatística
        string  dataCID;    // opcional: IPFS com planilha completa
    }

    /// epochWeek ⇒ geoBatchId ⇒ RewardBatch
    mapping(uint64 => mapping(uint64 => RewardBatch)) public rewardBatches;

    /// BitMap de claims: hash(epochWeek, geoBatchId, controller)
    BitMaps.BitMap private _claimed;

    /* ───────────── EVENTS ───────────── */
    event RewardBatchPublished(uint64 indexed epochWeek, uint64 indexed geoBatchId, bytes32 root, uint256 totalMint);
    event RewardClaimed(address indexed controller, uint64 indexed epochWeek, uint64 geoBatchId, uint256 amount);

    /* ────────── CONSTRUCTOR ────────── */
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
    /*                        PUBLICAÇÃO DE BATCH (ORACLE)                        */
    /* -------------------------------------------------------------------------- */
    /// @notice Publica recompensa de um agrupamento regional (geoBatchId)
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
    /*                                CLAIM REGION                               */
    /* -------------------------------------------------------------------------- */
    /// @notice Controller reivindica recompensa de um node pertencente a um agrupamento
    function claim(
        uint64  epochWeek,
        uint64  geoBatchId,
        uint256 amount,
        bytes32[] calldata proof
    ) external {
        // verifica node ativo e controller
        (address controller, bool active) = did.getControllerAndStatus(msg.sender);
        if (!active) revert NodeInactive();
        if (controller != msg.sender) revert NotController();

        // garante não-duplicação
        uint256 bitIndex = _claimKey(epochWeek, geoBatchId, msg.sender);
        if (_claimed.get(bitIndex)) revert AlreadyClaimed();

        // Merkle verify
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        if (!MerkleProof.verify(proof, rewardBatches[epochWeek][geoBatchId].merkleRoot, leaf)) revert InvalidProof();

        _claimed.set(bitIndex);
        cgt.transfer(msg.sender, amount);
        emit RewardClaimed(msg.sender, epochWeek, geoBatchId, amount);
    }

    /* -------------------------------------------------------------------------- */
    /*                             INTERNAL HELPERS                               */
    /* -------------------------------------------------------------------------- */
    /// @dev Gera um índice único para bitmap: hash(epoch, geoBatchId, controller) → uint256 mod 2^256
    function _claimKey(uint64 epochWeek, uint64 geoBatchId, address controller) private pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(epochWeek, geoBatchId, controller)));
    }
}
