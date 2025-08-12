// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title Interface for GeoDataRegistry
interface IGeoDataRegistry {
    /*────────────── Structs ─────────────*/
    struct GeoBatchMetadata {
        bytes32 merkleRoot;
        string  dataCID;
    }

    /*────────────── View Functions ─────────────*/
    /// @notice Returns the current epoch number
    /// @dev Calculated from `block.timestamp` and `epochMinInterval`
    /// @return epoch Current epoch
    function currentEpoch() external view returns (uint64 epoch);

    /// @notice Minimum interval between epochs in seconds
    /// @dev Determines epoch progression
    /// @return interval Interval in seconds
    function epochMinInterval() external view returns (uint256 interval);

    /// @notice Maximum number of epochs allowed as delay
    /// @return maxDelay Maximum delay
    function epochMaxDelay() external view returns (uint64 maxDelay);

    /// @notice Maximum resolution allowed for a given sensor type
    /// @dev SensorType 0 typically represents default sensors
    /// @param sensorType Identifier of the sensor
    /// @return maxRes Maximum resolution
    function sensorTypeMaxResolution(uint8 sensorType) external view returns (uint8 maxRes);

    /// @notice Retrieves metadata for a geo batch
    /// @dev Returns stored Merkle root and CID
    /// @param epoch      Epoch of the batch
    /// @param geoBatchId Identifier of the batch
    /// @return metadata  Struct with merkleRoot and dataCID
    function getGeoBatch(uint64 epoch, uint64 geoBatchId) external view returns (GeoBatchMetadata memory metadata);

    /// @notice Verifies whether a leaf is part of a batch Merkle tree
    /// @dev Uses MerkleProof.verify for calldata proofs
    /// @param epoch      Epoch of the batch
    /// @param geoBatchId Identifier of the batch
    /// @param leaf       Leaf hash to verify
    /// @param proof      Merkle proof path
    /// @return valid     True if the leaf is included
    function verifyLeafInBatch(
        uint64 epoch,
        uint64 geoBatchId,
        bytes32 leaf,
        bytes32[] calldata proof
    ) external view returns (bool valid);

    /*────────────── Mutating Functions ─────────────*/
    /// @notice Registers a single geo batch for a specific epoch
    /// @dev Should be called by an authorized oracle
    /// @param epoch      Epoch of the batch
    /// @param geoBatchId Identifier of the batch
    /// @param merkleRoot Root hash of the batch data
    /// @param dataCID    CID/URL referencing off-chain data
    function registerGeoBatch(
        uint64 epoch,
        uint64 geoBatchId,
        bytes32 merkleRoot,
        string calldata dataCID
    ) external;

    /// @notice Registers multiple geo batches at once
    /// @dev Each position in the arrays corresponds to one batch
    /// @param epoch       Epoch of the batches
    /// @param geoBatchIds Identifiers of the batches
    /// @param merkleRoots Roots hashes of the batches
    /// @param dataCIDs    CIDs/URLs of the batches
    function registerGeoBatchBulk(
        uint64 epoch,
        uint64[] calldata geoBatchIds,
        bytes32[] calldata merkleRoots,
        string[] calldata dataCIDs
    ) external;

    /// @notice Sets the maximum resolution allowed for a sensor type
    /// @dev maxRes must be validated in implementation
    /// @param sensor  Sensor type identifier
    /// @param maxRes  Maximum resolution (0 disables)
    function setSensorType(uint8 sensor, uint8 maxRes) external;

    /// @notice Adds a new oracle authorized to publish data
    /// @dev Grants ORACLE_ROLE to the address
    /// @param oracle Oracle address
    function addOracle(address oracle) external;

    /// @notice Removes an oracle from the authorized list
    /// @dev Revokes ORACLE_ROLE from the address
    /// @param oracle Oracle address
    function removeOracle(address oracle) external;

    /// @notice Sets the minimum interval between epochs
    /// @dev Reverts if interval is zero
    /// @param newInterval Interval in seconds
    function setEpochMinInterval(uint256 newInterval) external;

    /// @notice Sets the maximum allowed delay in epochs
    /// @param newMaxDelay New maximum delay
    function setEpochMaxDelay(uint64 newMaxDelay) external;

    /// @notice Pauses geo batch registrations
    /// @dev Uses OpenZeppelin's Pausable
    function pause() external;

    /// @notice Resumes geo batch registrations
    /// @dev Uses OpenZeppelin's Pausable
    function unpause() external;
}

