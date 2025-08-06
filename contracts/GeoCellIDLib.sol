// SPDX-License-Identifier: MIT
// Author: Thomaz Valadares Gontijo (Aura Tecnologia)

pragma solidity ^0.8.24;

/// @title GeoCellIDLib – Biblioteca para manipulação de geo-identificadores (H3 + extensões)
/// @notice Permite extrair, comparar, navegar e agrupar geoIds com extensão para compressão HGC.
/// @dev Compatível com modelo GEO3 baseado em resolução H3 e cabeçalho binário estendido.

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
    /*                           Extração de Componentes                          */
    /* -------------------------------------------------------------------------- */

    /// @notice Extrai o nível de resolução do geoId
    /// @dev Lê os bits 8–11 do identificador
    /// @param geoId Identificador geoespacial codificado
    /// @return level Nível de resolução (0-15)
    function extractLevel(uint64 geoId) internal pure returns (uint8 level) {
        return uint8((geoId >> LEVEL_OFFSET) & 0xF); // bits 8–11
    }

    /// @notice Obtém a célula base H3 do geoId
    /// @dev Lê os bits 12–18 do identificador
    /// @param geoId Identificador geoespacial codificado
    /// @return baseCell Índice da célula base
    function extractBaseCell(uint64 geoId) internal pure returns (uint8 baseCell) {
        return uint8((geoId >> BASE_CELL_OFFSET) & 0x7F); // bits 12–18
    }

    /// @notice Lê o dígito de resolução sem validação de faixa
    /// @dev Função auxiliar usada internamente
    /// @param geoId Identificador geoespacial
    /// @param digit Posição do dígito (1-15)
    /// @return value Valor do dígito
    function _resolutionDigit(uint64 geoId, uint8 digit) private pure returns (uint8 value) {
        return uint8((geoId >> (DIGIT_OFFSET + (digit - 1) * 3)) & 0x7);
    }

    /// @notice Extrai um dígito de resolução específico
    /// @dev Valida o intervalo do dígito antes da leitura
    /// @param geoId Identificador geoespacial
    /// @param digit Posição do dígito (1-15)
    /// @return value Valor do dígito
    function extractResolutionDigit(uint64 geoId, uint8 digit) internal pure returns (uint8 value) {
        if (digit < 1 || digit > MAX_LEVEL) revert InvalidDigit();
        return _resolutionDigit(geoId, digit);
    }

    /// @notice Extrai o cabeçalho (sensorType) do geoId
    /// @dev Lê os bits 56–63 do identificador
    /// @param geoId Identificador geoespacial codificado
    /// @return header Valor do cabeçalho
    function extractHeader(uint64 geoId) internal pure returns (uint8 header) {
        return uint8(geoId >> 56); // bits 56–63
    }

    /* -------------------------------------------------------------------------- */
    /*                            Modificadores Diretos                            */
    /* -------------------------------------------------------------------------- */

    /// @notice Define o cabeçalho de um geoId
    /// @dev Substitui os bits superiores pelo novo valor
    /// @param geoId  Identificador geoespacial original
    /// @param header Novo valor de cabeçalho
    /// @return newGeoId GeoId com cabeçalho atualizado
    function setHeader(uint64 geoId, uint8 header) internal pure returns (uint64 newGeoId) {
        return (uint64(header) << 56) | (geoId & BODY_MASK);
    }

    /// @notice Remove o cabeçalho de um geoId
    /// @dev Zera os bits 56–63
    /// @param geoId Identificador geoespacial com cabeçalho
    /// @return bareGeoId GeoId sem cabeçalho
    function clearHeader(uint64 geoId) internal pure returns (uint64 bareGeoId) {
        return geoId & BODY_MASK;
    }

    /* -------------------------------------------------------------------------- */
    /*                        Operações Hierárquicas e Lógicas                    */
    /* -------------------------------------------------------------------------- */

    /// @notice Obtém o identificador do pai imediato de uma célula
    /// @dev Regride o nível de resolução em uma unidade
    /// @param geoId Identificador da célula filha
    /// @return parentId Identificador da célula pai
    function parentOf(uint64 geoId) internal pure returns (uint64 parentId) {
        uint8 level = extractLevel(geoId);
        if (level == 0) revert RootLevelHasNoParent();

        unchecked {
            uint64 mask = ~(uint64(0x7) << (DIGIT_OFFSET + (level - 1) * 3));
            parentId = geoId & mask;
            parentId = (parentId & ~(uint64(0xF) << LEVEL_OFFSET)) | (uint64(level - 1) << LEVEL_OFFSET);
        }
    }

    /// @notice Agrega um geoId a um nível ancestral específico
    /// @dev Navega até o pai correspondente ao `targetLevel`
    /// @param geoId       Identificador de origem
    /// @param targetLevel Nível alvo para agregação
    /// @return rootId Identificador agregado
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
    /*                      Relações de Parentesco e Agrupamento                  */
    /* -------------------------------------------------------------------------- */

    /// @notice Verifica se uma célula é ancestral de outra
    /// @dev Compara dígitos de resolução em cada nível
    /// @param ancestor   Possível ancestral
    /// @param descendant Possível descendente
    /// @return isAncestor Verdadeiro se `ancestor` for ancestral de `descendant`
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

    /// @notice Indica se duas células compartilham o mesmo pai
    /// @dev Compara todos os dígitos exceto o último
    /// @param a Primeira célula
    /// @param b Segunda célula
    /// @return siblings Verdadeiro se forem irmãs
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

    /// @notice Verifica se duas células compartilham a mesma raiz até certo nível
    /// @dev Percorre dígitos de resolução até o `targetLevel`
    /// @param a           Primeira célula
    /// @param b           Segunda célula
    /// @param targetLevel Nível alvo de comparação
    /// @return sameRoot Verdadeiro se ambas tiverem a mesma raiz
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
    /*                         Validações e Extrações Diversas                    */
    /* -------------------------------------------------------------------------- */

    /// @notice Verifica se um nível é válido dentro da faixa suportada
    /// @dev Limite superior definido por `MAX_LEVEL`
    /// @param level Nível de resolução
    /// @return valid Verdadeiro se o nível for suportado
    function isValidLevel(uint8 level) internal pure returns (bool valid) {
        return level <= MAX_LEVEL;
    }

    /// @notice Compara partes de cabeçalho com máscara e valor
    /// @dev Operação bitwise para filtragem rápida
    /// @param geoId Identificador geoespacial
    /// @param mask  Máscara de bits a ser aplicada
    /// @param value Valor esperado após a máscara
    /// @return matches Verdadeiro se corresponder
    function matchesHeader(uint64 geoId, uint64 mask, uint64 value) internal pure returns (bool matches) {
        return (geoId & mask) == value;
    }

    /// @notice Extrai a parte de célula de um identificador 128 bits
    /// @dev Retorna os 64 bits menos significativos
    /// @param geo128 Identificador estendido
    /// @return geoCell Parte de 64 bits correspondente ao geoId
    function extractGeoCellPart(uint128 geo128) internal pure returns (uint64 geoCell) {
        return uint64(geo128);
    }

    /// @notice Extrai a parte de metadados de um identificador 128 bits
    /// @dev Retorna os 64 bits superiores
    /// @param geo128 Identificador estendido
    /// @return meta Parte de 64 bits destinada a metadados
    function extractMetaPart(uint128 geo128) internal pure returns (uint64 meta) {
        return uint64(geo128 >> 64);
    }
}
