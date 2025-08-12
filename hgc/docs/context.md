# GEO3 – Contexto Técnico Completo (HGC + Oráculo + Stack On-chain)

## 1. Resumo Executivo

O GEO3 é uma infraestrutura descentralizada para registro, compressão e publicação de dados ambientais na blockchain.  
Seu núcleo é o **HGC (Hierarchical Geospatial Compression)**, um algoritmo autoral que organiza dados geoespaciais de forma hierárquica usando malha **H3**, permitindo compressão adaptativa, verificação cripto e auditabilidade pública.

## 2. Arquitetura Geral

### Componentes On-chain:
- **GeoCellIDLib.sol** – Biblioteca de manipulação de IDs H3.
- **GeoDataRegistry.sol** – Registro oficial de batches geoespaciais.
- **GeoRewardManager.sol** – Distribuição de recompensas baseada em provas Merkle.
- **GeoToken.sol** – Token ERC20 do ecossistema (CGT).
- **NodeDIDRegistry.sol** – Identidade descentralizada de cada node.

### Componentes Off-chain (Oráculo):
- Simulação e coleta de dados (`nodes.js`, `samples.js`)
- Compressão HGC (`hgc.js`)
- Geração de Merkle roots (`hasher.js`)
- Upload no IPFS (`ipfs.js`)
- Publicação on-chain (`chain.js`, `epochJob.js`, `rewardJob.js`)

---

## 3. Fluxo de Dados – Passo a Passo

```ascii
[Nodes Físicos / Simulados]
         |
         v
[nodes.js] -> Geração de lista fixa de nodes com geolocalização
         |
[samples.js] -> Leituras horárias (pressão, temperatura, etc.)
         |
         v
[hgc.js] -> Compressão HGC (res8 -> res0)
         |
         v
[hasher.js] -> Geração de Merkle Root (dados determinísticos)
         |
         v
[ipfs.js] -> Upload JSON comprimido no IPFS
         |
         v
[chain.js] -> Registro on-chain (GeoDataRegistry)
         |
         +--> [GeoRewardManager] -> Distribuição de CGT via prova Merkle
```

---

## 4. Explicação Técnica do HGC

O **HGC**:
- Parte de uma resolução base fixa (H3 nível 8).
- Faz **varredura top-down** agregando células em níveis superiores.
- Usa **limites configuráveis** (`MAX_LEAVES_PER_BATCH`, `MAX_SAMPLES_PER_BATCH`) para definir quando agrupar ou manter granularidade.
- Garante que **cada batch tenha Merkle root único**, determinístico e auditável.
- Adota ordenação lexicográfica de células para consistência.

---

## 5. Exemplo Real de Compressão

### Entrada (res8):
```json
[
  {"cellId": "8828308299fffff", "avgTemp": 26.4, "pressure": 1013.2},
  {"cellId": "8828308299bffff", "avgTemp": 26.5, "pressure": 1013.1}
]
```

### Saída (res7 após compressão):
```json
[
  {"cellId": "872830829ffffff", "avgTemp": 26.45, "pressure": 1013.15}
]
```

---

## 6. Métricas de Compressão (Exemplo Simulado)

| Dataset         | Antes (KB) | Depois (KB) | Compressão % | Gas Estimado (Polygon) |
|-----------------|-----------:|------------:|-------------:|-----------------------:|
| 1.000 leituras  | 120        | 35          | 70,8%        | 190.000                |
| 10.000 leituras | 1.200      | 320         | 73,3%        | 1.900.000              |

---

## 7. Função de Cada Arquivo

- **nodes.js** – Gera nodes simulados com ID, localização e status.
- **samples.js** – Gera amostras de sensores para cada node.
- **hgc.js** – Executa o algoritmo HGC.
- **hasher.js** – Cria hashes e Merkle roots.
- **ipfs.js** – Faz upload para IPFS via Pinata.
- **chain.js** – Chama funções de registro no contrato.
- **epochJob.js** – Agendamento de publicação de batches.
- **rewardJob.js** – Agendamento de distribuição de recompensas.

**Este documento serve como base para qualquer evolução do repositório, garantindo preservação da lógica original e consistência técnica do GEO3.**
