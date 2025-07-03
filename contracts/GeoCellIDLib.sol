// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title GeoCellIDLib – Biblioteca para manipulação de geo-identificadores (H3 + extensões)
/// @notice Permite extrair, comparar, navegar e agrupar geoIds com extensão para compressão HGC.
/// @dev Compatível com modelo GEO³ baseado em resolução H3 e cabeçalho binário estendido.

library GeoCellIDLib {
    uint8 internal constant MAX_LEVEL = 15;

    /* -------------------------------------------------------------------------- */
    /*                                Custom Errors                               */
    /* -------------------------------------------------------------------------- */
    error InvalidDigit();
    error InvalidAggregationTarget();
    error InvalidLevel();
    error RootLevelHasNoParent();

    /* -------------------------------------------------------------------------- */
    /*                           Extração de Componentes                          */
    /* -------------------------------------------------------------------------- */

    function extractLevel(uint64 geoId) internal pure returns (uint8) {
        return uint8((geoId >> 8) & 0xF); // bits 8–11
    }

    function extractBaseCell(uint64 geoId) internal pure returns (uint8) {
        return uint8((geoId >> 12) & 0x7F); // bits 12–18
    }

    function extractResolutionDigit(uint64 geoId, uint8 digit) internal pure returns (uint8) {
        if (digit < 1 || digit > MAX_LEVEL) revert InvalidDigit();
        uint8 startBit = 19 + (digit - 1) * 3;
        return uint8((geoId >> startBit) & 0x7);
    }

    function extractHeader(uint64 geoId) internal pure returns (uint8) {
        return uint8(geoId >> 56); // bits 56–63
    }

    /* -------------------------------------------------------------------------- */
    /*                            Modificadores Diretos                            */
    /* -------------------------------------------------------------------------- */

    function setHeader(uint64 geoId, uint8 header) internal pure returns (uint64) {
        return (uint64(header) << 56) | (geoId & 0x00FFFFFFFFFFFFFF);
    }

    function clearHeader(uint64 geoId) internal pure returns (uint64) {
        return geoId & 0x00FFFFFFFFFFFFFF;
    }

    /* -------------------------------------------------------------------------- */
    /*                        Operações Hierárquicas e Lógicas                    */
    /* -------------------------------------------------------------------------- */

    function parentOf(uint64 geoId) internal pure returns (uint64) {
        uint8 level = extractLevel(geoId);
        if (level == 0) revert RootLevelHasNoParent();

        uint64 mask = ~(uint64(0x7) << (19 + (level - 1) * 3));
        uint64 parentId = geoId & mask;
        parentId = (parentId & ~(uint64(0xF) << 8)) | (uint64(level - 1) << 8);
        return parentId;
    }

    function aggregationGroup(uint64 geoId, uint8 targetLevel) internal pure returns (uint64) {
        if (extractLevel(geoId) < targetLevel) revert InvalidAggregationTarget();
        uint64 aggregated = geoId;
        while (extractLevel(aggregated) > targetLevel) {
            aggregated = parentOf(aggregated);
        }
        return aggregated;
    }

    /* -------------------------------------------------------------------------- */
    /*                      Relações de Parentesco e Agrupamento                  */
    /* -------------------------------------------------------------------------- */

    function isAncestorOf(uint64 ancestor, uint64 descendant) internal pure returns (bool) {
        uint8 ancLevel = extractLevel(ancestor);
        uint8 descLevel = extractLevel(descendant);
        if (ancLevel >= descLevel) return false;
        if (extractBaseCell(ancestor) != extractBaseCell(descendant)) return false;

        for (uint8 i = 1; i <= ancLevel; i++) {
            if (extractResolutionDigit(ancestor, i) != extractResolutionDigit(descendant, i)) {
                return false;
            }
        }
        return true;
    }

    function isSiblingOf(uint64 a, uint64 b) internal pure returns (bool) {
        uint8 levelA = extractLevel(a);
        if (levelA != extractLevel(b)) return false;
        if (levelA == 0) return false;
        if (extractBaseCell(a) != extractBaseCell(b)) return false;

        for (uint8 i = 1; i < levelA; i++) {
            if (extractResolutionDigit(a, i) != extractResolutionDigit(b, i)) return false;
        }
        return extractResolutionDigit(a, levelA) != extractResolutionDigit(b, levelA);
    }

    function isSameRoot(uint64 a, uint64 b, uint8 targetLevel) internal pure returns (bool) {
        if (extractLevel(a) < targetLevel || extractLevel(b) < targetLevel) return false;
        if (extractBaseCell(a) != extractBaseCell(b)) return false;

        for (uint8 i = 1; i <= targetLevel; i++) {
            if (extractResolutionDigit(a, i) != extractResolutionDigit(b, i)) return false;
        }
        return true;
    }

    /* -------------------------------------------------------------------------- */
    /*                         Validações e Extrações Diversas                    */
    /* -------------------------------------------------------------------------- */

    function isValidLevel(uint8 level) internal pure returns (bool) {
        return level <= MAX_LEVEL;
    }

    function matchesHeader(uint64 geoId, uint64 mask, uint64 value) internal pure returns (bool) {
        return (geoId & mask) == value;
    }

    function extractGeoCellPart(uint128 geo128) internal pure returns (uint64) {
        return uint64(geo128);
    }

    function extractMetaPart(uint128 geo128) internal pure returns (uint64) {
        return uint64(geo128 >> 64);
    }
}
