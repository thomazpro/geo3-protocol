# GEO3 – Technical Context (HGC + Oracle + On-chain Stack)

## 1. Overview

GEO3 is a decentralized infrastructure to collect, compress, and publish environmental data on the blockchain. Its core is the **HGC (Hierarchical Geospatial Compression)**, an algorithm that organizes geospatial readings into **H3** grid levels, generating deterministic batches with auditable Merkle roots.

## 2. Components

### On-chain
- **GeoCellIDLib.sol** – utilities for manipulating H3 IDs.
- **GeoDataRegistry.sol** – stores Merkle root and CID of each geospatial batch.
- **GeoToken.sol** – ecosystem ERC20 token (CGT).
- **NodeDIDRegistry.sol** – decentralized identity for nodes.
- **GeoRewardManager.sol** – reward distribution contract (still under development).

### Off-chain (Oracle/Simulator)
- `generators/nodes.js` – generates a list of simulated nodes with geolocation.
- `generators/samples.js` – produces hourly samples for each node.
- `utils/hgc.js` – implementation of the HGC algorithm and Merkle root calculation.
- `utils/hasher.js` – deterministic hash and Merkle tree functions.
- `utils/ipfs.js` – uploads results to IPFS (or mock folder when not configured).
- `utils/chain.js` – registers batches in contracts or mock file.
- `scripts/run-epoch.mjs` – orchestrates generation, compression, and registration of an epoch.
- `pipelines/rewardJob.js` – stub for future reward distribution.

## 3. Data Pipeline

```ascii
[nodes.js] --generate--> nodes.json
        |
[samples.js] --epoch--> samples.json
        |
[run-epoch.mjs] -> runHGC -> batches + cellToBatch map
        |                     |
        |                     +-> saveResults (data/epoch_X)
        |                     |
        +-> uploadFolder -> IPFS (optional)
        +-> registerGeoBatch -> GeoDataRegistry (optional)
```

- Typical execution is `npm run epoch -- --epoch=<N>`.
- `run-epoch.mjs` ensures nodes exist, applies configured parameters (`src/config/hgc.js`), generates `N_SAMPLES` per node, runs `runHGC`, saves batches in `data/epoch_<N>` and, if configured, uploads to IPFS and registers in the contract.
- `rewardJob.js` will be executed separately for reward calculation (not yet implemented).

## 4. HGC Details

1. Normalizes samples to the base resolution (`baseRes`, default 8) and removes duplicates by `(issuer,timestamp)`.
2. Validates required fields and discards invalid samples.
3. Counts samples per cell and orders H3 IDs lexicographically.
4. Executes top‑down scan (`compressTopDown`) grouping neighboring cells according to limits:
   - `MAX_LEAVES_PER_BATCH`
   - `MAX_SAMPLES_PER_BATCH`
   - hysteresis `hysteresisNear` / `hysteresisFar`
5. For each group generates a **geoBatch** containing aggregated data, metadata (counts, timestamps, center, boundary), and Merkle root.
6. At the end calculates a *super-root* of the epoch by combining the Merkle roots of all batches.

Parameters are loaded from `src/config/hgc.js` and can be adjusted via environment variables or command line. The estimated node volume automatically adjusts `maxLeavesPerBatch`, `maxSamplesPerBatch`, and hysteresis thresholds.

## 5. Main Files

- `generators/nodes.js` – creates simulated nodes with ID and location.
- `generators/samples.js` – generates sensor samples.
- `utils/hgc.js` – runs compression and Merkle root.
- `utils/hasher.js` – deterministic hashing and Merkle.
- `utils/ipfs.js` – upload to IPFS or mock folder.
- `utils/chain.js` – contract registration (or mock file).
- `scripts/run-epoch.mjs` – complete pipeline for an epoch.
- `pipelines/rewardJob.js` – placeholder for CGT distribution.

## 6. Deterministic Rules

1. Always normalize IDs to `baseRes` before processing.
2. Sort lists before building Merkle trees.
3. `MAX_LEAVES_PER_BATCH = 4096` and `MAX_SAMPLES_PER_BATCH = 16000` for standard volume (doubles when `volume >= 5000`).
4. Final files include fixed fields: `geoBatchId`, `epoch`, `data`, `countLeaves`, `countSamples`, `merkleRoot`, `hgcParams` and related metadata.

**This document describes the current state of the HGC pipeline and serves as a foundation for its evolution.**