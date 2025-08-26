# GEO3 Pipeline

GEO3 — Public Infrastructure for Physical Data On-Chain

GEO3 is a decentralized infrastructure to collect, compress, and record physical data on the blockchain in an auditable and programmable way. It connects real-world devices — such as environmental sensors, cameras, and water quality meters — to smart contracts and distributed storage, creating a reliable flow from physical events to immutable records.

## What makes GEO3 unique

- **Hierarchical Geospatial Compression (HGC)**: proprietary algorithm capable of aggregating data across multiple H3 resolution levels, preserving geographic intelligence while reducing gas costs.
- **Full verifiability**: use of Merkle trees and deterministic proofs to audit any published data.
- **Hybrid on-chain/off-chain integration**: specialized oracles for sending compacted batches and metadata to IPFS.
- **Modular design**: architecture separated between protocol (smart contracts and libraries) and HGC + simulator (compression, benchmarks, and publishing pipeline).
- **Institutional and DePIN focus**: designed for applications in parametric insurance, rural credit, green finance, ESG audits, and large-scale environmental monitoring.

## Relation to GEO3
This repository integrates the off-chain simulator, HGC compression, and protocol smart contracts, composing a complete pipeline that links physical sensors to GEO3’s on-chain records.

Official project materials and updates can be found at [geo3.live](https://geo3.live).

## Overview
The project coordinates the generation, compression, and anchoring of environmental readings.  
This flow powers the GEO3 platform, which exposes data publicly and  
auditable for environmental applications.

## Quick Start

### Requirements
- Node.js ≥ 18
- npm
- Hardhat

### Simulator
```bash
cd hgc && npm install && npm run nodes && npm run samples && npm run epoch
```

### Contracts
```bash
cd protocol && npm install && npm test && npm run verify
```

## End-to-end Pipeline
1. **Node generation** – creates simulated identities for physical sensors.
2. **Sample collection** – produces environmental readings grouped by epoch.
3. **Epoch execution** – compresses samples via HGC, uploads them to  
   IPFS, and registers batches in the `GeoDataRegistry` contract.
4. **Verification** – reprocesses generated files and checks hashes and  
   Merkle roots.
5. **Benchmark & report** – calculates compression rates and generates a  
   `REPORT.md` with results.

## Scripts
Scripts are distributed across two subprojects. Make sure you are in the  
correct directory before executing them.

### Simulator (`hgc`)
```bash
npm run nodes   # generate simulated nodes
npm run samples # generate samples for the current epoch
npm run epoch   # execute the epoch pipeline (generate batches and register on-chain)
```

### Contracts (`protocol`)
```bash
npm run verify -- --dir data/epoch_1 # validate files from a given epoch
npm run bench -- 1                   # record statistics from epoch 1
npm run report                       # generate reports/REPORT.md
```

## `.env.example` Files
The repository includes three example environment variable files:

- [`.env.example`](./.env.example) – shared variables such as `PINATA_JWT`, `POLYGON_RPC_URL`, `PRIVATE_KEY`, contract addresses (`GEO_DATA_REGISTRY`, `NODE_DID_REGISTRY`, `GEO_REWARD_MANAGER`) and `NEXT_PUBLIC_MAPBOX_TOKEN`.
- [`hgc/.env.example`](./hgc/.env.example) – reserved for HGC simulator settings. Currently no required variables.
- [`protocol/.env.example`](./protocol/.env.example) – contract credentials: `PRIVATE_KEY`, `API_KEY` of the RPC provider, and `POLYGONSCAN_KEY`.

## Compression Experiments
### Configuring parameters and volumes
- Adjust HGC parameters via environment variables or flags: `HGC_BASE_RES`, `HGC_MIN_RES`, `HGC_MAX_LEAVES_PER_BATCH`, `HGC_MAX_SAMPLES_PER_BATCH`, `HGC_HYSTERESIS_NEAR`, and `HGC_HYSTERESIS_FAR`.
- Define the data volume with `npm run nodes -- --nodes=<N>` and `npm run samples -- --epoch=<E> --samples=<S>` to control number of nodes and samples per node.

### Running the orchestrator
- Use `npm run epoch -- --epoch=<E>` to compress epoch samples and register batches. Results are saved in `hgc/data/epoch_<E>/` and, if configured, uploaded to IPFS and the chain.

### Reports
- After each run, record statistics with `cd protocol && npm run bench -- <E>`; data is saved to `reports/data/bench.json` and `bench.csv`.
- Generate a comparative report with `npm run report`, consolidating benchmarks into `reports/REPORT.md`.]

Summary reports are available in the [`reports`](./reports) directory.


## Mock mode for IPFS and chain
The [.env.example](./.env.example) file lists variables for integration with  
Pinata and the Polygon network. If `PINATA_JWT` or chain credentials are not provided, the system operates in *mock* mode:

- **IPFS** – files are copied to `data/ipfs-mock/` and a local SHA‑256 hash is returned.
- **Chain** – transactions are recorded in `data/mock-chain.json` instead of being sent to the blockchain.

## Development
- Simulator tests: `cd hgc && npm test`
- Contract tests: `cd protocol && npm test`
- CI: the repository uses GitHub Actions for linting, tests, and report generation (locally you can use `npm run ci` in the simulator).

## Authors and License
Developed by Aura Tecnologia, authored by Thomaz Valadares Gontijo.  
Distributed under the [MIT](./LICENSE) license.