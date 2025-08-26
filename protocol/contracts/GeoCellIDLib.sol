// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title GeoCellIDLib – Library for manipulating geoidentifiers (H3 + extensions)
/// @notice Provides functionality to extract, compare, navigate, and group geoIDs with the HGC compression extension.
/// @dev Compatible with the GEO3 model based on H3 resolution and extended binary header.

library GeoCellIDLib {
    uint8 internal constant MAX_LEVEL = 15;
    uint8 internal constant LEVEL_OFFSET = 8;
    uint8 internal constant BASE_CELL_OFFSET = 12;
    uint8 internal constant DIGIT_OFFSET = 19;
    uint64 internal constant HEADER_MASK = 0xFF00000000000000;
    uint64 internal constant BODY_MASK = 0x00FFFFFFFFFFFFFF;

    /* -------------------------------------------------------------------------- */
    /*                                Custom Errors                               */
    /* -------------------------------------------------------------------------- */
    error InvalidDigit();
    error InvalidAggregationTarget();
    error InvalidLevel();
    error RootLevelHasNoParent();

    /* -------------------------------------------------------------------------- */
    /*                           Component Extraction                             */
    /* -------------------------------------------------------------------------- */

    /// @notice Extracts the resolution level of the geoId
    /// @dev Reads bits 8–11 of the identifier
    /// @param geoId Encoded geospatial identifier
    /// @return level Resolution level (0–15)
    function extractLevel(uint64 geoId) internal pure returns (uint8 level) {
        return uint8((geoId >> LEVEL_OFFSET) & 0xF); // bits 8–11
    }

    /// @notice Gets the H3 base cell from the geoId
    /// @dev Reads bits 12–18 of the identifier
    /// @param geoId Encoded geospatial identifier
    /// @return baseCell Base cell index
    function extractBaseCell(uint64 geoId) internal pure returns (uint8 baseCell) {
        return uint8((geoId >> BASE_CELL_OFFSET) & 0x7F); // bits 12–18
    }

    /// @notice Reads the resolution digit without range validation
    /// @dev Auxiliary function used internally
    /// @param geoId Geospatial identifier
    /// @param digit Digit position (1–15)
    /// @return value Digit value
    function _resolutionDigit(uint64 geoId, uint8 digit) private pure returns (uint8 value) {
        return uint8((geoId >> (DIGIT_OFFSET + (digit - 1) * 3)) & 0x7);
    }

    /// @notice Extracts a specific resolution digit
    /// @dev Validates digit range before reading
    /// @param geoId Geospatial identifier
    /// @param digit Digit position (1–15)
    /// @return value Digit value
    function extractResolutionDigit(uint64 geoId, uint8 digit) internal pure returns (uint8 value) {
        if (digit < 1 || digit > MAX_LEVEL) revert InvalidDigit();
        return _resolutionDigit(geoId, digit);
    }

    /// @notice Extracts the header (sensorType) from the geoId
    /// @dev Reads bits 56–63 of the identifier
    /// @param geoId Encoded geospatial identifier
    /// @return header Header value
    function extractHeader(uint64 geoId) internal pure returns (uint8 header) {
        return uint8(geoId >> 56); // bits 56–63
    }

    /* -------------------------------------------------------------------------- */
    /*                            Direct Modifiers                                */
    /* -------------------------------------------------------------------------- */

    /// @notice Sets the header of a geoId
    /// @dev Replaces the upper bits with the new value
    /// @param geoId  Original geospatial identifier
    /// @param header New header value
    /// @return newGeoId GeoId with updated header
    function setHeader(uint64 geoId, uint8 header) internal pure returns (uint64 newGeoId) {
        return (uint64(header) << 56) | (geoId & BODY_MASK);
    }

    /// @notice Removes the header from a geoId
    /// @dev Zeros bits 56–63
    /// @param geoId Geospatial identifier with header
    /// @return bareGeoId GeoId without header
    function clearHeader(uint64 geoId) internal pure returns (uint64 bareGeoId) {
        return geoId & BODY_MASK;
    }

    /* -------------------------------------------------------------------------- */
    /*                        Hierarchical and Logical Operations                 */
    /* -------------------------------------------------------------------------- */

    /// @notice Gets the immediate parent identifier of a cell
    /// @dev Decreases the resolution level by one
    /// @param geoId Child cell identifier
    /// @return parentId Parent cell identifier
    function parentOf(uint64 geoId) internal pure returns (uint64 parentId) {
        uint8 level = extractLevel(geoId);
        if (level == 0) revert RootLevelHasNoParent();

        unchecked {
            uint64 mask = ~(uint64(0x7) << (DIGIT_OFFSET + (level - 1) * 3));
            parentId = geoId & mask;
            parentId = (parentId & ~(uint64(0xF) << LEVEL_OFFSET)) | (uint64(level - 1) << LEVEL_OFFSET);
        }
    }

    /// @notice Aggregates a geoId to a specific ancestor level
    /// @dev Navigates to the parent corresponding to `targetLevel`
    /// @param geoId       Source identifier
    /// @param targetLevel Target aggregation level
    /// @return rootId Aggregated identifier
    function aggregationGroup(uint64 geoId, uint8 targetLevel) internal pure returns (uint64 rootId) {
        uint8 level = extractLevel(geoId);
        if (level < targetLevel) revert InvalidAggregationTarget();
        while (level > targetLevel) {
            geoId = parentOf(geoId);
            unchecked { --level; }
        }
        return geoId;
    }

    /* -------------------------------------------------------------------------- */
    /*                      Kinship and Grouping Relations                        */
    /* -------------------------------------------------------------------------- */

    /// @notice Checks if one cell is ancestor of another
    /// @dev Compares resolution digits at each level
    /// @param ancestor   Potential ancestor
    /// @param descendant Potential descendant
    /// @return isAncestor True if `ancestor` is an ancestor of `descendant`
    function isAncestorOf(uint64 ancestor, uint64 descendant) internal pure returns (bool isAncestor) {
        uint8 ancLevel = extractLevel(ancestor);
        uint8 descLevel = extractLevel(descendant);
        if (ancLevel >= descLevel) return false;
        if (extractBaseCell(ancestor) != extractBaseCell(descendant)) return false;

        for (uint8 i = 1; i <= ancLevel;) {
            if (_resolutionDigit(ancestor, i) != _resolutionDigit(descendant, i)) {
                return false;
            }
            unchecked { ++i; }
        }
        return true;
    }

    /// @notice Checks if two cells share the same parent
    /// @dev Compares all digits except the last
    /// @param a First cell
    /// @param b Second cell
    /// @return siblings True if they are siblings
    function isSiblingOf(uint64 a, uint64 b) internal pure returns (bool siblings) {
        uint8 levelA = extractLevel(a);
        if (levelA != extractLevel(b)) return false;
        if (levelA == 0) return false;
        if (extractBaseCell(a) != extractBaseCell(b)) return false;

        for (uint8 i = 1; i < levelA;) {
            if (_resolutionDigit(a, i) != _resolutionDigit(b, i)) return false;
            unchecked { ++i; }
        }
        return _resolutionDigit(a, levelA) != _resolutionDigit(b, levelA);
    }

    /// @notice Checks if two cells share the same root up to a given level
    /// @dev Iterates resolution digits up to `targetLevel`
    /// @param a           First cell
    /// @param b           Second cell
    /// @param targetLevel Target level for comparison
    /// @return sameRoot True if both share the same root
    function isSameRoot(uint64 a, uint64 b, uint8 targetLevel) internal pure returns (bool sameRoot) {
        if (extractLevel(a) < targetLevel || extractLevel(b) < targetLevel) return false;
        if (extractBaseCell(a) != extractBaseCell(b)) return false;

        for (uint8 i = 1; i <= targetLevel;) {
            if (_resolutionDigit(a, i) != _resolutionDigit(b, i)) return false;
            unchecked { ++i; }
        }
        return true;
    }

    /* -------------------------------------------------------------------------- */
    /*                         Miscellaneous Validations and Extractions          */
    /* -------------------------------------------------------------------------- */

    /// @notice Checks if a level is valid within the supported range
    /// @dev Upper limit defined by `MAX_LEVEL`
    /// @param level Resolution level
    /// @return valid True if the level is supported
    function isValidLevel(uint8 level) internal pure returns (bool valid) {
        return level <= MAX_LEVEL;
    }

    /// @notice Compares header parts with mask and value
    /// @dev Bitwise operation for fast filtering
    /// @param geoId Geospatial identifier
    /// @param mask  Bit mask to be applied
    /// @param value Expected value after mask
    /// @return matches True if it matches
    function matchesHeader(uint64 geoId, uint64 mask, uint64 value) internal pure returns (bool matches) {
        return (geoId & mask) == value;
    }

    /// @notice Extracts the cell part of a 128-bit identifier
    /// @dev Returns the least significant 64 bits
    /// @param geo128 Extended identifier
    /// @return geoCell 64-bit part corresponding to geoId
    function extractGeoCellPart(uint128 geo128) internal pure returns (uint64 geoCell) {
        return uint64(geo128);
    }

    /// @notice Extracts the metadata part of a 128-bit identifier
    /// @dev Returns the most significant 64 bits
    /// @param geo128 Extended identifier
    /// @return meta 64-bit part for metadata
    function extractMetaPart(uint128 geo128) internal pure returns (uint64 meta) {
        return uint64(geo128 >> 64);
    }
}
