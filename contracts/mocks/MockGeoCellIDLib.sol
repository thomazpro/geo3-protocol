// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "../GeoCellIDLib.sol";

contract MockGeoCellIDLib {
    function extractLevel(uint64 geoId) external pure returns (uint8) {
        return GeoCellIDLib.extractLevel(geoId);
    }
    function extractBaseCell(uint64 geoId) external pure returns (uint8) {
        return GeoCellIDLib.extractBaseCell(geoId);
    }
    function extractResolutionDigit(uint64 geoId, uint8 digit) external pure returns (uint8) {
        return GeoCellIDLib.extractResolutionDigit(geoId, digit);
    }
    function extractHeader(uint64 geoId) external pure returns (uint8) {
        return GeoCellIDLib.extractHeader(geoId);
    }
    function setHeader(uint64 geoId, uint8 header) external pure returns (uint64) {
        return GeoCellIDLib.setHeader(geoId, header);
    }
    function clearHeader(uint64 geoId) external pure returns (uint64) {
        return GeoCellIDLib.clearHeader(geoId);
    }
    function parentOf(uint64 geoId) external pure returns (uint64) {
        return GeoCellIDLib.parentOf(geoId);
    }
    function aggregationGroup(uint64 geoId, uint8 targetLevel) external pure returns (uint64) {
        return GeoCellIDLib.aggregationGroup(geoId, targetLevel);
    }
    function isAncestorOf(uint64 ancestor, uint64 descendant) external pure returns (bool) {
        return GeoCellIDLib.isAncestorOf(ancestor, descendant);
    }
    function isSiblingOf(uint64 a, uint64 b) external pure returns (bool) {
        return GeoCellIDLib.isSiblingOf(a, b);
    }
    function isSameRoot(uint64 a, uint64 b, uint8 targetLevel) external pure returns (bool) {
        return GeoCellIDLib.isSameRoot(a, b, targetLevel);
    }
    function isValidLevel(uint8 level) external pure returns (bool) {
        return GeoCellIDLib.isValidLevel(level);
    }
    function matchesHeader(uint64 geoId, uint64 mask, uint64 value) external pure returns (bool) {
        return GeoCellIDLib.matchesHeader(geoId, mask, value);
    }
    function extractGeoCellPart(uint128 geo128) external pure returns (uint64) {
        return GeoCellIDLib.extractGeoCellPart(geo128);
    }
    function extractMetaPart(uint128 geo128) external pure returns (uint64) {
        return GeoCellIDLib.extractMetaPart(geo128);
    }
}
