# Simulador (hgc)

Ferramentas off-chain que geram nodes, simulam leituras e executam o pipeline de compressão HGC.

Scripts principais:

- `npm run nodes -- --nodes=<N>` – gera nodes simulados (padrão: 10000)
- `npm run samples -- --epoch=<E> --samples=<S>` – gera amostras do epoch (padrão: 12 por node)
- `npm run epoch` – comprime e registra lotes

Os valores passados via `--nodes` e `--samples` são registrados em arquivos de metadados junto aos resultados gerados.

Documentação detalhada está em [docs/context.md](./docs/context.md).
Instruções de deploy em [docs/deploy.md](./docs/deploy.md).
