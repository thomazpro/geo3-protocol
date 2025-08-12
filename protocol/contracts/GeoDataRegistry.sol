// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControlEnumerable} from "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import {Pausable}         from "@openzeppelin/contracts/utils/Pausable.sol";
import {MerkleProof}      from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {GeoCellIDLib}     from "./GeoCellIDLib.sol";

/// @title GeoDataRegistry
/// @notice Registra lotes de dados geoespaciais e suas respectivas raízes Merkle
/// @dev Controlado por papéis de oráculo e manager; utiliza GeoCellIDLib para validações
contract GeoDataRegistry is AccessControlEnumerable, Pausable {
    using GeoCellIDLib for uint64;

    /* ───────────── ROLES ───────────── */
    /// @notice Papel autorizado a registrar lotes de dados
    bytes32 public constant ORACLE_ROLE  = keccak256("ORACLE_ROLE");

    /// @notice Papel autorizado a configurar parâmetros críticos
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
    /// @notice Timestamp do início do epoch 0
    uint256 public immutable genesisTimestamp;

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

        // habilita sensorType 0 com res-8 por default
        sensorTypeMaxResolution[0] = 8;
        emit SensorTypeSet(0, 8);

        genesisTimestamp = block.timestamp;
    }

    /* ─────── REGISTRO ÚNICO ─────── */
    /// @notice Registra um lote geoespacial individual para o epoch corrente
    /// @dev Reverte se o lote já existir ou se merkleRoot/dataCID forem vazios
    /// @param geoBatchId  Identificador do lote geoespacial
    /// @param merkleRoot  Raiz Merkle dos dados
    /// @param dataCID     CID ou URL que aponta para os dados off-chain
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
    /// @notice Registra múltiplos lotes geoespaciais de uma só vez
    /// @dev Cada posição dos arrays deve corresponder ao mesmo índice
    /// @param geoBatchIds  Lista de identificadores dos lotes
    /// @param merkleRoots  Lista das raízes Merkle correspondentes
    /// @param dataCIDs     Lista de CIDs/URLs dos dados off-chain
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
    /// @notice Retorna os metadados de um lote específico
    /// @dev Consulta o mapeamento `geoBatches`
    /// @param epoch      Epoch em que o lote foi registrado
    /// @param geoBatchId Identificador do lote
    /// @return metadata Estrutura com merkleRoot e dataCID
    function getGeoBatch(uint64 epoch, uint64 geoBatchId)
        external view returns (GeoBatchMetadata memory metadata)
    {
        return geoBatches[epoch][geoBatchId];
    }

    /// @notice Verifica se uma folha pertence a um lote específico
    /// @dev Utiliza prova Merkle para verificar a inclusão
    /// @param epoch      Epoch em que o lote foi registrado
    /// @param geoBatchId Identificador do lote
    /// @param leaf       Hash da folha a ser comprovada
    /// @param proof      Caminho de prova Merkle
    /// @return valid Verdadeiro se a folha pertencer ao lote
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
    /// @notice Configura a resolução máxima permitida para um sensorType
    /// @dev Usa GeoCellIDLib para validar o nível informado
    /// @param sensor  Identificador do sensor
    /// @param maxRes  Resolução máxima permitida (0 desativa)
    function setSensorType(uint8 sensor, uint8 maxRes)
        external onlyRole(MANAGER_ROLE)
    {
        require(GeoCellIDLib.isValidLevel(maxRes), "invalid maxRes");
        sensorTypeMaxResolution[sensor] = maxRes;   // 0 desativa
        emit SensorTypeSet(sensor, maxRes);
    }

    /// @notice Adiciona um novo oráculo autorizado
    /// @dev Concede ORACLE_ROLE ao endereço informado
    /// @param oracle Endereço do oráculo
    function addOracle(address oracle) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(ORACLE_ROLE, oracle);
        emit OracleAdded(oracle);
    }

    /// @notice Remove um oráculo autorizado
    /// @dev Revoga ORACLE_ROLE do endereço
    /// @param oracle Endereço do oráculo
    function removeOracle(address oracle) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(ORACLE_ROLE, oracle);
        emit OracleRemoved(oracle);
    }

    /// @notice Ajusta o intervalo mínimo entre epochs
    /// @dev Reverte se `newInterval` for zero
    /// @param newInterval Novo intervalo em segundos
    function setEpochMinInterval(uint256 newInterval)
        external onlyRole(MANAGER_ROLE)
    {
        require(newInterval > 0, "interval zero");
        epochMinInterval = newInterval;
        emit EpochMinIntervalSet(newInterval);
    }

    /// @notice Ajusta o atraso máximo tolerado em epochs
    /// @param newMaxDelay Novo atraso máximo
    function setEpochMaxDelay(uint64 newMaxDelay)
        external onlyRole(MANAGER_ROLE)
    {
        epochMaxDelay = newMaxDelay;
        emit EpochMaxDelaySet(newMaxDelay);
    }


    /* ─── Pausable ── */
    /// @notice Pausa o registro de novos lotes
    /// @dev Função do módulo Pausable
    function pause()   external onlyRole(MANAGER_ROLE) { _pause(); }

    /// @notice Retoma o registro de lotes
    /// @dev Função do módulo Pausable
    function unpause() external onlyRole(MANAGER_ROLE) { _unpause(); }

    /* ─────── EPOCH ─────── */
    /// @notice Calcula o epoch atual com base no timestamp
    function currentEpoch() public view returns (uint64) {
        unchecked {
            return uint64((block.timestamp - genesisTimestamp) / epochMinInterval);
        }
    }

    /// @dev Valida se um epoch informado está dentro da janela permitida
    function _validateEpoch(uint64 epoch) internal view {
        uint64 current = currentEpoch();
        if (epoch > current) revert EpochInFuture(epoch);
        if (current - epoch > epochMaxDelay) revert EpochTooOld(epoch);
    }

}
