// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

contract MockSensorResolver {
    mapping(uint8 => uint8) public resolutions;

    function set(uint8 nodeType, uint8 maxResolution) external {
        resolutions[nodeType] = maxResolution;
    }

    function sensorTypeMaxResolution(uint8 sensorType) external view returns (uint8) {
        return resolutions[sensorType];
    }
}
