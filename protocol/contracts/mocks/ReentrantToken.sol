// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IGeoRewardManagerClaim {
    function claim(uint64 epochWeek, address node, uint256 amount, bytes32[] calldata proof) external;
}

/// @dev Minimal token to attempt reentrancy via GeoRewardManager.claim
contract ReentrantToken {
    mapping(address => uint256) public balanceOf;
    IGeoRewardManagerClaim public manager;

    bool private attack;
    uint64 private attackEpoch;
    address private attackNode;
    uint256 private attackAmount;
    bytes32[] private attackProof;

    function setAttack(
        IGeoRewardManagerClaim _manager,
        uint64 epochWeek,
        address node,
        uint256 amount,
        bytes32[] calldata proof
    ) external {
        manager = _manager;
        attackEpoch = epochWeek;
        attackNode = node;
        attackAmount = amount;
        delete attackProof;
        for (uint256 i = 0; i < proof.length; i++) {
            attackProof.push(proof[i]);
        }
        attack = true;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        if (attack) {
            attack = false;
            manager.claim(attackEpoch, attackNode, attackAmount, attackProof);
        }
        return true;
    }
}
