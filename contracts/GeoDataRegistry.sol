// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControlEnumerable} from "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import {ReentrancyGuard}  from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable}         from "@openzeppelin/contracts/utils/Pausable.sol";
import {MerkleProof}      from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {GeoCellIDLib}     from "./GeoCellIDLib.sol";

contract GeoDataRegistry is AccessControlEnumerable, ReentrancyGuard, Pausable {
    using GeoCellIDLib for uint64;

    /* ───────────── ROLES ───────────── */
    bytes32 public constant ORACLE_ROLE  = keccak256("ORACLE_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    /* ───────────── ERRORS ───────────── */
    error ArrayLengthMismatch();
    error EmptyRoot();
    error EmptyCID();
    error SensorTypeNotAllowed();
    error SensorResolutionExceeded();
    error BatchRootAlreadyRegistered();

    /* ──────────── STRUCTS ──────────── */
    struct GeoBatchMetadata {
        bytes32 merkleRoot;
        string  dataCID;
    }

    /* ───────── STATE & STORAGE ─────── */
    uint64 public currentEpoch;
    uint256 public lastEpochTimestamp;
    uint256 public epochMinInterval;      // seg

    mapping(uint64 => mapping(uint64 => GeoBatchMetadata)) public geoBatches;

    /// sensorType ⇒ resolução máxima permitida (0 = não permitido)
    mapping(uint8 => uint8) public sensorTypeMaxResolution;

    /* ───────────── EVENTS ───────────── */
    event EpochStarted       (uint64 indexed epoch, uint256 timestamp);
    event GeoBatchRegistered (uint64 indexed epoch, uint64 indexed geoBatchId, bytes32 merkleRoot, string dataCID, uint8 level);
    event GeoBatchRejected   (uint64 indexed epoch, uint64 indexed geoBatchId, string reason);
    event OracleAdded        (address oracle);
    event OracleRemoved      (address oracle);
    event SensorTypeSet      (uint8 sensorType, uint8 maxResolution);
    event EpochMinIntervalSet(uint256 newInterval);

    /* ────────── CONSTRUCTOR ────────── */
    constructor(
        address admin,
        address oracle,
        address manager,
        uint256 _epochMinInterval
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ROLE,        oracle);
        _grantRole(MANAGER_ROLE,       manager);

        epochMinInterval = _epochMinInterval;
        emit EpochMinIntervalSet(_epochMinInterval);

        // habilita sensorType 0 com res-8 por default
        sensorTypeMaxResolution[0] = 8;
        emit SensorTypeSet(0, 8);
    }

    /* ─────── REGISTRO EM LOTE ─────── */
    function registerGeoBatchBulk(
        uint64[]  calldata geoBatchIds,
        bytes32[] calldata merkleRoots,
        string[]  calldata dataCIDs
    )
        external
        onlyRole(ORACLE_ROLE)
        whenNotPaused
        nonReentrant
    {
        if (geoBatchIds.length != merkleRoots.length || geoBatchIds.length != dataCIDs.length)
            revert ArrayLengthMismatch();

        _updateEpoch();

        for (uint256 i; i < geoBatchIds.length; ) {
            _register(geoBatchIds[i], merkleRoots[i], dataCIDs[i]);
            unchecked { ++i; }
        }
    }

    /* ───────── REGISTRO INTERNO ────── */
    function _register(
        uint64  geoBatchId,
        bytes32 merkleRoot,
        string  memory dataCID
    ) internal {
        if (merkleRoot == bytes32(0)) revert EmptyRoot();
        if (bytes(dataCID).length == 0) revert EmptyCID();

        uint8 level  = uint8(geoBatchId.extractLevel());
        uint8 sensor = uint8(geoBatchId.extractHeader());

        uint8 maxRes = sensorTypeMaxResolution[sensor];
        if (maxRes == 0)                revert SensorTypeNotAllowed();
        if (level > maxRes)             revert SensorResolutionExceeded();

        if (geoBatches[currentEpoch][geoBatchId].merkleRoot != bytes32(0)) {
            emit GeoBatchRejected(currentEpoch, geoBatchId, "root already registred");
            return;
        }

        geoBatches[currentEpoch][geoBatchId] = GeoBatchMetadata(merkleRoot, dataCID);

        emit GeoBatchRegistered(currentEpoch, geoBatchId, merkleRoot, dataCID, level);
    }

    /* ───────────── VIEWs ───────────── */
    function getGeoBatch(uint64 epoch, uint64 geoBatchId)
        external view returns (GeoBatchMetadata memory)
    {
        return geoBatches[epoch][geoBatchId];
    }

    function verifyLeafInBatch(
        uint64  epoch,
        uint64  geoBatchId,
        bytes32 leaf,
        bytes32[] calldata proof
    ) external view returns (bool) {
        bytes32 root = geoBatches[epoch][geoBatchId].merkleRoot;
        return root != bytes32(0) && MerkleProof.verify(proof, root, leaf);
    }

    /* ─────── CONFIGURAÇÕES ────────── */
    function setSensorType(uint8 sensor, uint8 maxRes)
        external onlyRole(MANAGER_ROLE)
    {
        require(GeoCellIDLib.isValidLevel(maxRes), "invalid maxRes");
        sensorTypeMaxResolution[sensor] = maxRes;   // 0 desativa
        emit SensorTypeSet(sensor, maxRes);
    }

    function addOracle(address oracle) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(ORACLE_ROLE, oracle);
        emit OracleAdded(oracle);
    }
    function removeOracle(address oracle) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(ORACLE_ROLE, oracle);
        emit OracleRemoved(oracle);
    }

    function setEpochMinInterval(uint256 newInterval)
        external onlyRole(MANAGER_ROLE)
    {
        epochMinInterval = newInterval;
        emit EpochMinIntervalSet(newInterval);
    }


    /* ─── Pausable ── */
    function pause()   external onlyRole(MANAGER_ROLE) { _pause(); }
    function unpause() external onlyRole(MANAGER_ROLE) { _unpause(); }

    /* ─────── EPOCH ─────── */
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
