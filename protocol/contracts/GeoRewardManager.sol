// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/* -------------------------------------------------------------------------- */
/*                              External Interfaces                           */
/* -------------------------------------------------------------------------- */

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title IGeoToken – minimal mint interface for the RewardManager
interface IGeoToken is IERC20 {
    function mint(address to, uint256 amount) external;
}

/// @title INodeDIDRegistry – joint query of controller and status
interface INodeDIDRegistry {
    function getControllerAndStatus(address node)
        external
        view
        returns (address controller, bool active);
}

/* -------------------------------------------------------------------------- */
/*                               OpenZeppelin v5                              */
/* -------------------------------------------------------------------------- */

import {AccessControl}  from "@openzeppelin/contracts/access/AccessControl.sol";
import {MerkleProof}    from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/* -------------------------------------------------------------------------- */
/*                           GEO3 – GeoRewardManager                          */
/* -------------------------------------------------------------------------- */

/// @title GeoRewardManager
/// @notice Distributes CGT weekly based on validated measurements in the GeoDataRegistry.
/// @dev     – The off-chain oracle consolidates readings, calculates score & weight, and generates 
///            a Merkle tree (leaf = nodeAddress, amount).
///          – Once a week it publishes (epochWeek, merkleRoot, totalToMint).
///          – Node controllers call `claim()` with proof to receive CGT.
contract GeoRewardManager is AccessControl, ReentrancyGuard {
    using SafeERC20 for IGeoToken;

    /* ───────────── ROLES ───────────── */
    /// @notice Role authorized to publish reward cycles
    bytes32 public constant ORACLE_ROLE  = keccak256("ORACLE_ROLE");

    /// @notice Role authorized to change critical parameters
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    /* ───────────── ERRORS ───────────── */
    error CycleAlreadyExists();
    error CycleNotPublished();
    error InvalidProof();
    error AlreadyClaimed();
    error NodeInactive();
    error NotController();
    error ZeroRootOrAmount();

    /* ─────────── CONFIG CONSTANTS ─────────── */
    /// @notice Number of GeoDataRegistry epochs that make up a reward cycle
    uint64  public immutable epochWindow;

    /* ───────── STATE & STORAGE ─────── */
    /// @notice Stores the Merkle root of each reward cycle
    mapping(uint64 => bytes32) public cycleRoot;

    /// @notice Marks if a node has already claimed rewards in a given cycle
    mapping(uint64 => mapping(address => bool)) public claimed;

    /* External Contracts */
    /// @notice Reference to the CGT token
    IGeoToken public immutable cgt;

    /// @notice Node registry used to validate controller and status
    INodeDIDRegistry public immutable did;

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
        epochWindow  = _epochWindow; // ex.: 168 (7 days * 24h)

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ROLE,        oracle);
        _grantRole(MANAGER_ROLE,       admin);
    }

    /* -------------------------------------------------------------------------- */
    /*                             CYCLE PUBLICATION (ORACLE)                     */
    /* -------------------------------------------------------------------------- */

    /// @notice Publishes the Merkle root of rewards for a weekly window
    /// @dev Mints the required tokens and records the root for future proofs
    /// @param epochWeek   Incremental identifier (e.g.: floor(epoch/epochWindow))
    /// @param merkleRoot  Root (hash) of the tree (nodeAddress, amount)
    /// @param totalToMint Total tokens to be minted for this cycle
    function publishCycle(
        uint64  epochWeek,
        bytes32 merkleRoot,
        uint256 totalToMint
    ) external onlyRole(ORACLE_ROLE) nonReentrant {
        if (cycleRoot[epochWeek] != bytes32(0)) revert CycleAlreadyExists();
        if (merkleRoot == bytes32(0) || totalToMint == 0) revert ZeroRootOrAmount();

        cycleRoot[epochWeek] = merkleRoot;

        // mint CGT to this contract (minter role already delegated)
        cgt.mint(address(this), totalToMint);

        emit CyclePublished(epochWeek, merkleRoot, totalToMint);
    }

    /* -------------------------------------------------------------------------- */
    /*                               REWARD CLAIM                                 */
    /* -------------------------------------------------------------------------- */

    /// @notice Controller claims CGT for a specific node in a cycle
    /// @dev Validates Merkle proof and checks that the node is active and controlled by the caller
    /// @param epochWeek Reward cycle
    /// @param node      Node address linked to the controller
    /// @param amount    Expected reward amount
    /// @param proof     Merkle path proving (node, amount) → merkleRoot
    function claim(
        uint64  epochWeek,
        address node,
        uint256 amount,
        bytes32[] calldata proof
    ) external nonReentrant {
        bytes32 root = cycleRoot[epochWeek];
        if (root == bytes32(0))       revert CycleNotPublished();
        if (claimed[epochWeek][node]) revert AlreadyClaimed();

        (address controller, bool active) = did.getControllerAndStatus(node);
        if (!active) revert NodeInactive();
        if (controller != msg.sender) revert NotController();

        // verify Merkle
        bytes32 leaf = keccak256(abi.encodePacked(node, amount));
        if (!MerkleProof.verifyCalldata(proof, root, leaf)) revert InvalidProof();

        claimed[epochWeek][node] = true;
        cgt.safeTransfer(msg.sender, amount);

        emit RewardClaimed(msg.sender, node, epochWeek, amount);
    }
}