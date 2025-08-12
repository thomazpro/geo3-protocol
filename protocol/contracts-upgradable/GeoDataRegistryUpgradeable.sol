// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AccessControlEnumerableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/extensions/AccessControlEnumerableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {GeoCellIDLib} from "../contracts/GeoCellIDLib.sol";

/// @title GeoDataRegistryUpgradeable
/// @notice Versão upgradável do registro de dados geoespaciais
contract GeoDataRegistryUpgradeable is Initializable, AccessControlEnumerableUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    using GeoCellIDLib for uint64;

    /* ───────────── ROLES ───────────── */
    /// @notice Papel autorizado a registrar lotes de dados
    bytes32 public constant ORACLE_ROLE  = keccak256("ORACLE_ROLE");

    /// @notice Papel autorizado a configurar parâmetros críticos
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    /// @notice Papel autorizado a atualizar a implementação do contrato
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

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
    /// @notice Timestamp do início do epoch 0
    uint256 public genesisTimestamp;

    /// @notice Intervalo mínimo entre epochs em segundos
    uint256 public epochMinInterval;

    /// @notice Atraso máximo tolerado em epochs para registro
    uint64 public epochMaxDelay;

    /// @notice Metadados dos lotes por epoch e geoBatchId
    mapping(uint64 epoch => mapping(uint64 geoBatchId => GeoBatchMetadata)) public geoBatches;

    /// @notice Resolução máxima permitida por sensorType (0 = não permitido)
    mapping(uint8 => uint8) public sensorTypeMaxResolution;

    /* ───────────── EVENTS ───────────── */
    event GeoBatchRegistered (uint64 indexed epoch, uint64 indexed geoBatchId, bytes32 merkleRoot, string dataCID, uint8 level);
    event OracleAdded        (address oracle);
    event OracleRemoved      (address oracle);
    event SensorTypeSet      (uint8 sensorType, uint8 maxResolution);
    event EpochMinIntervalSet(uint256 newInterval);
    event EpochMaxDelaySet   (uint64 newMaxDelay);

    /* ───────────── INITIALIZER ──────── */
    function initialize(
        address admin,
        address oracle,
        address manager,
        uint256 _epochMinInterval,
        uint64  _epochMaxDelay
    ) public initializer {
        __AccessControlEnumerable_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ROLE,        oracle);
        _grantRole(MANAGER_ROLE,       manager);
        _grantRole(UPGRADER_ROLE,      admin);

        epochMinInterval = _epochMinInterval;
        emit EpochMinIntervalSet(_epochMinInterval);

        epochMaxDelay = _epochMaxDelay;
        emit EpochMaxDelaySet(_epochMaxDelay);

        // habilita sensorType 0 com res-8 por default
        sensorTypeMaxResolution[0] = 8;
        emit SensorTypeSet(0, 8);

        genesisTimestamp = block.timestamp;
    }

    /* ─────── REGISTRO ÚNICO ─────── */
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

    /* ─────── REGISTRO EM LOTE ─────── */
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

    /* ───────── REGISTRO INTERNO ────── */
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

    /* ───────────── VIEWs ───────────── */
    function getGeoBatch(uint64 epoch, uint64 geoBatchId)
        external view returns (GeoBatchMetadata memory metadata)
    {
        return geoBatches[epoch][geoBatchId];
    }

    function verifyLeafInBatch(
        uint64  epoch,
        uint64  geoBatchId,
        bytes32 leaf,
        bytes32[] calldata proof
    ) external view returns (bool valid) {
        bytes32 root = geoBatches[epoch][geoBatchId].merkleRoot;
        return root != bytes32(0) && MerkleProof.verifyCalldata(proof, root, leaf);
    }

    /* ─────── CONFIGURAÇÕES ────────── */
    function setSensorType(uint8 sensor, uint8 maxRes)
        external onlyRole(MANAGER_ROLE)
    {
        require(GeoCellIDLib.isValidLevel(maxRes), "invalid maxRes");
        sensorTypeMaxResolution[sensor] = maxRes;   // 0 desativa
        emit SensorTypeSet(sensor, maxRes);
    }

    function setEpochMinInterval(uint256 newInterval)
        external onlyRole(MANAGER_ROLE)
    {
        epochMinInterval = newInterval;
        emit EpochMinIntervalSet(newInterval);
    }

    function setEpochMaxDelay(uint64 newMaxDelay)
        external onlyRole(MANAGER_ROLE)
    {
        epochMaxDelay = newMaxDelay;
        emit EpochMaxDelaySet(newMaxDelay);
    }

    function pause() external onlyRole(MANAGER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(MANAGER_ROLE) {
        _unpause();
    }

    /* ───────────── HELPERS ─────────── */
    function _validateEpoch(uint64 epoch) internal view {
        uint256 epochTime = genesisTimestamp + uint256(epoch) * epochMinInterval;
        if (epochTime + uint256(epochMaxDelay) * epochMinInterval < block.timestamp) {
            revert EpochTooOld(epoch);
        }
        if (epochTime > block.timestamp) {
            revert EpochInFuture(epoch);
        }
    }

    /* ──────────── UUPS AUTH ─────────── */
    function _authorizeUpgrade(address) internal override onlyRole(UPGRADER_ROLE) {}
}

