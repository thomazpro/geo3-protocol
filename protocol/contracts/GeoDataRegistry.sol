// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControlEnumerable} from "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import {Pausable}         from "@openzeppelin/contracts/utils/Pausable.sol";
import {MerkleProof}      from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {GeoCellIDLib}     from "./GeoCellIDLib.sol";

/// @title GeoDataRegistry
/// @notice Registers geospatial data batches and their corresponding Merkle roots
/// @dev Controlled by oracle and manager roles; uses GeoCellIDLib for validations
contract GeoDataRegistry is AccessControlEnumerable, Pausable {
    using GeoCellIDLib for uint64;

    /* ───────────── ROLES ───────────── */
    /// @notice Role authorized to register data batches
    bytes32 public constant ORACLE_ROLE  = keccak256("ORACLE_ROLE");

    /// @notice Role authorized to configure critical parameters
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    /* ───────────── ERRORS ───────────── */
    error ArrayLengthMismatch();
    error EmptyRoot();
    error EmptyCID();
    error SensorTypeNotAllowed();
    error SensorResolutionExceeded();
    error GeoBatchAlreadyRegistered();
    error EpochTooOld(uint64 epoch);
    error EpochInFuture(uint64 epoch);

    /* ──────────── STRUCTS ──────────── */
    struct GeoBatchMetadata {
        bytes32 merkleRoot;
        string  dataCID;
    }

    /* ───────── STATE & STORAGE ─────── */
    /// @notice Timestamp marking the start of epoch 0
    uint256 public immutable genesisTimestamp;

    /// @notice Minimum interval between epochs in seconds
    uint256 public epochMinInterval;

    /// @notice Maximum tolerated delay in epochs for registration
    uint64 public epochMaxDelay;

    /// @notice Metadata of batches by epoch and geoBatchId
    mapping(uint64 epoch => mapping(uint64 geoBatchId => GeoBatchMetadata)) public geoBatches;

    /// @notice Maximum resolution allowed per sensorType (0 = not allowed)
    mapping(uint8 => uint8) public sensorTypeMaxResolution;

    /* ───────────── EVENTS ───────────── */
    event GeoBatchRegistered (uint64 indexed epoch, uint64 indexed geoBatchId, bytes32 merkleRoot, string dataCID, uint8 level);
    event OracleAdded        (address oracle);
    event OracleRemoved      (address oracle);
    event SensorTypeSet      (uint8 sensorType, uint8 maxResolution);
    event EpochMinIntervalSet(uint256 newInterval);
    event EpochMaxDelaySet   (uint64 newMaxDelay);

    /* ────────── CONSTRUCTOR ────────── */
    constructor(
        address admin,
        address oracle,
        address manager,
        uint256 _epochMinInterval,
        uint64  _epochMaxDelay
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ROLE,        oracle);
        _grantRole(MANAGER_ROLE,       manager);

        epochMinInterval = _epochMinInterval;
        emit EpochMinIntervalSet(_epochMinInterval);

        epochMaxDelay = _epochMaxDelay;
        emit EpochMaxDelaySet(_epochMaxDelay);

        // enables sensorType 0 with res-8 by default
        sensorTypeMaxResolution[0] = 8;
        emit SensorTypeSet(0, 8);

        genesisTimestamp = block.timestamp;
    }

    /* ─────── SINGLE REGISTRATION ─────── */
    /// @notice Registers a single geospatial batch for the current epoch
    /// @dev Reverts if the batch already exists or if merkleRoot/dataCID are empty
    /// @param geoBatchId  Identifier of the geospatial batch
    /// @param merkleRoot  Merkle root of the data
    /// @param dataCID     CID or URL pointing to the off-chain data
    function registerGeoBatch(
        uint64  epoch,
        uint64  geoBatchId,
        bytes32 merkleRoot,
        string calldata dataCID
    )
        external
        onlyRole(ORACLE_ROLE)
        whenNotPaused
    {
        _validateEpoch(epoch);
        _register(epoch, geoBatchId, merkleRoot, dataCID);
    }

    /* ─────── BULK REGISTRATION ─────── */
    /// @notice Registers multiple geospatial batches at once
    /// @dev Each array position must correspond to the same index
    /// @param geoBatchIds  List of batch identifiers
    /// @param merkleRoots  List of corresponding Merkle roots
    /// @param dataCIDs     List of CIDs/URLs of the off-chain data
    function registerGeoBatchBulk(
        uint64   epoch,
        uint64[] calldata geoBatchIds,
        bytes32[] calldata merkleRoots,
        string[] calldata dataCIDs
    )
        external
        onlyRole(ORACLE_ROLE)
        whenNotPaused
    {
        if (geoBatchIds.length != merkleRoots.length || geoBatchIds.length != dataCIDs.length)
            revert ArrayLengthMismatch();
        _validateEpoch(epoch);

        for (uint256 i; i < geoBatchIds.length; ) {
            _register(epoch, geoBatchIds[i], merkleRoots[i], dataCIDs[i]);
            unchecked { ++i; }
        }
    }

    /* ───────── INTERNAL REGISTRATION ────── */
    function _register(
        uint64  epoch,
        uint64  geoBatchId,
        bytes32 merkleRoot,
        string  memory dataCID
    ) internal {
        if (merkleRoot == bytes32(0)) revert EmptyRoot();
        if (bytes(dataCID).length == 0) revert EmptyCID();

        if (geoBatches[epoch][geoBatchId].merkleRoot != bytes32(0)) {
            revert GeoBatchAlreadyRegistered();
        }

        uint8 level  = uint8(geoBatchId.extractLevel());
        uint8 sensor = uint8(geoBatchId.extractHeader());

        uint8 maxRes = sensorTypeMaxResolution[sensor];
        if (maxRes == 0)                revert SensorTypeNotAllowed();
        if (level > maxRes)             revert SensorResolutionExceeded();

        geoBatches[epoch][geoBatchId] = GeoBatchMetadata(merkleRoot, dataCID);

        emit GeoBatchRegistered(epoch, geoBatchId, merkleRoot, dataCID, level);
    }

    /* ───────────── VIEWS ───────────── */
    /// @notice Returns the metadata of a specific batch
    /// @dev Queries the `geoBatches` mapping
    /// @param epoch      Epoch in which the batch was registered
    /// @param geoBatchId Batch identifier
    /// @return metadata Structure with merkleRoot and dataCID
    function getGeoBatch(uint64 epoch, uint64 geoBatchId)
        external view returns (GeoBatchMetadata memory metadata)
    {
        return geoBatches[epoch][geoBatchId];
    }

    /// @notice Verifies if a leaf belongs to a specific batch
    /// @dev Uses a Merkle proof to verify inclusion
    /// @param epoch      Epoch in which the batch was registered
    /// @param geoBatchId Batch identifier
    /// @param leaf       Hash of the leaf to be proven
    /// @param proof      Merkle proof path
    /// @return valid True if the leaf belongs to the batch
    function verifyLeafInBatch(
        uint64  epoch,
        uint64  geoBatchId,
        bytes32 leaf,
        bytes32[] calldata proof
    ) external view returns (bool valid) {
        bytes32 root = geoBatches[epoch][geoBatchId].merkleRoot;
        return root != bytes32(0) && MerkleProof.verifyCalldata(proof, root, leaf);
    }

    /* ─────── CONFIGURATIONS ────────── */
    /// @notice Sets the maximum allowed resolution for a sensorType
    /// @dev Uses GeoCellIDLib to validate the provided level
    /// @param sensor  Sensor identifier
    /// @param maxRes  Maximum allowed resolution (0 disables)
    function setSensorType(uint8 sensor, uint8 maxRes)
        external onlyRole(MANAGER_ROLE)
    {
        require(GeoCellIDLib.isValidLevel(maxRes), "invalid maxRes");
        sensorTypeMaxResolution[sensor] = maxRes;   // 0 desativa
        emit SensorTypeSet(sensor, maxRes);
    }

    /// @notice Adds a new authorized oracle
    /// @dev Grants ORACLE_ROLE to the given address
    /// @param oracle Oracle address
    function addOracle(address oracle) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(ORACLE_ROLE, oracle);
        emit OracleAdded(oracle);
    }

    /// @notice Removes an authorized oracle
    /// @dev Revokes ORACLE_ROLE from the address
    /// @param oracle Oracle address
    function removeOracle(address oracle) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(ORACLE_ROLE, oracle);
        emit OracleRemoved(oracle);
    }

    /// @notice Adjusts the minimum interval between epochs
    /// @dev Reverts if `newInterval` is zero
    /// @param newInterval New interval in seconds
    function setEpochMinInterval(uint256 newInterval)
        external onlyRole(MANAGER_ROLE)
    {
        require(newInterval > 0, "interval zero");
        epochMinInterval = newInterval;
        emit EpochMinIntervalSet(newInterval);
    }

    /// @notice Adjusts the maximum tolerated delay in epochs
    /// @param newMaxDelay New maximum delay
    function setEpochMaxDelay(uint64 newMaxDelay)
        external onlyRole(MANAGER_ROLE)
    {
        epochMaxDelay = newMaxDelay;
        emit EpochMaxDelaySet(newMaxDelay);
    }


    /* ─── Pausable ── */
    /// @notice Pauses the registration of new batches
    /// @dev Function from the Pausable module
    function pause()   external onlyRole(MANAGER_ROLE) { _pause(); }

    /// @notice Resumes batch registration
    /// @dev Function from the Pausable module
    function unpause() external onlyRole(MANAGER_ROLE) { _unpause(); }

    /* ─────── EPOCH ─────── */
    /// @notice Calculates the current epoch based on the timestamp
    function currentEpoch() public view returns (uint64) {
        unchecked {
            return uint64((block.timestamp - genesisTimestamp) / epochMinInterval);
        }
    }

    /// @dev Validates whether a given epoch is within the allowed window
    function _validateEpoch(uint64 epoch) internal view {
        uint64 current = currentEpoch();
        if (epoch > current) revert EpochInFuture(epoch);
        if (current - epoch > epochMaxDelay) revert EpochTooOld(epoch);
    }

}
