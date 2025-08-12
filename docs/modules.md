# Modules & Pipeline

## Pipeline Flow
1. **Node data collection** – physical or simulated nodes produce hourly sensor readings.
2. **Compression** – `hgc` aggregates readings with Hierarchical Geospatial Compression, grouping cells top‑down and building Merkle roots.
3. **Storage** – the compressed batches are pinned to IPFS and mapped to their Merkle roots. A `cellToBatchMap.json` file keeps the association of H3 cells to `geoBatchId` grouped by epoch.
4. **On‑chain publication** – batch metadata (`geoBatchId`, `merkleRoot`, `dataCID`) is registered on the `GeoDataRegistry` contract.
5. **Rewards** – `GeoRewardManager` uses the registered roots to distribute CGT tokens via Merkle proofs.

## Module Responsibilities
### `hgc/`
Off‑chain toolkit that simulates nodes, collects samples and compresses them. It produces deterministic batches ready for IPFS and on‑chain submission.

*Key file*: `hgc/src/utils/hgc.js` – core implementation of the compression pipeline. It groups H3 cells by resolution, enforces batch limits and outputs Merkle‑rooted objects for each epoch.

### `protocol/`
Set of Solidity contracts defining the on‑chain registry and reward logic. Contracts validate HGC identifiers, store batch metadata and manage token distribution.

*Key file*: `protocol/contracts/GeoDataRegistry.sol` – registry contract that validates `geoBatchId`, ensures epoch rules and stores Merkle roots and data CIDs for each batch.

## Further Reading
- [hgc/docs/context.md](../hgc/docs/context.md) – full technical background of the off‑chain pipeline.
- [protocol/docs/overview.md](../protocol/docs/overview.md) – detailed explanation of the on‑chain contracts.
