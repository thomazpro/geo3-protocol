# Simulator (hgc)

Off-chain tools that generate nodes, simulate readings, and execute the HGC compression pipeline.

Main scripts:

- `npm run nodes -- --nodes=<N>` – generates simulated nodes (default: 10000)
- `npm run samples -- --epoch=<E> --samples=<S>` – generates epoch samples (default: 12 per node)
- `npm run epoch` – compresses and registers batches

The values passed via `--nodes` and `--samples` are recorded in metadata files along with the generated results.

Detailed documentation is available at [docs/context.md](./docs/context.md).