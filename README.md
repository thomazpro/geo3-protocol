# GEO3 Pipeline

GEO3 — Infraestrutura Pública para Dados Físicos On-Chain

O GEO3 é uma infraestrutura descentralizada para coletar, comprimir e registrar dados físicos na blockchain de forma auditável e programável. Ele conecta dispositivos no mundo real — como sensores ambientais, câmeras e medidores de qualidade da água — a contratos inteligentes e armazenamento distribuído, criando um fluxo confiável do evento físico até o registro imutável.

## O que torna o GEO3 único

- **Compressão Geoespacial Hierárquica (HGC)**: algoritmo proprietário capaz de agregar dados em múltiplos níveis de resolução H3, preservando a inteligência geográfica e reduzindo custos de gás.
- **Verificabilidade completa**: uso de árvores de Merkle e provas determinísticas para auditar qualquer dado publicado.
- **Integração híbrida on-chain/off-chain**: oráculos especializados para envio de batches compactados e metadados para IPFS.
- **Design modular**: arquitetura separada entre protocolo (contratos inteligentes e bibliotecas) e HGC + simulador (compressão, benchmarks e pipeline de publicação).
- **Foco institucional e DePIN**: pensado para aplicações em seguros paramétricos, crédito rural, finanças verdes, auditorias ESG e monitoramento ambiental em escala nacional.

## Relação com o GEO3
Este repositório integra o simulador off-chain, a compressão HGC e os contratos inteligentes do protocolo, compondo um pipeline completo que liga sensores físicos ao registro on-chain do GEO3.

Materiais oficiais e atualizações do projeto podem ser encontrados em [geo3.org](https://geo3.org).

## Visão Geral
O projeto coordena geração, compressão e ancoragem de leituras ambientais.
Esse fluxo abastece a plataforma GEO3, que expõe os dados de forma pública e
auditável para aplicações ambientais.

## Quick Start

### Requisitos
- Node.js ≥ 18
- npm
- Hardhat

### Simulador
```bash
cd hgc && npm install && npm run nodes && npm run samples && npm run epoch
```

### Contratos
```bash
cd protocol && npm install && npm test && npm run verify
```

## Pipeline end-to-end
1. **Geração de nodes** – cria identidades simuladas para sensores físicos.
2. **Coleta de amostras** – produz leituras ambientais agrupadas por epoch.
3. **Execução do epoch** – comprime as amostras via HGC, faz upload para
   IPFS e registra os lotes no contrato `GeoDataRegistry`.
4. **Verificação** – reprocessa os arquivos gerados e confere hashes e
   raízes Merkle.
5. **Benchmark & relatório** – calcula taxas de compressão e gera um
   `REPORT.md` com os resultados.

## Scripts
Os scripts estão distribuídos em dois subprojetos. Certifique‑se de estar no
 diretório correto antes de executá‑los.

### Simulador (`hgc`)
```bash
npm run nodes   # gera nodes simulados
npm run samples # gera amostras para o epoch atual
npm run epoch   # executa o pipeline do epoch (gera lotes e registra na chain)
```

### Contratos (`protocol`)
```bash
npm run verify -- --dir data/epoch_1 # valida arquivos de um epoch
npm run bench -- 1                   # registra estatísticas do epoch 1
npm run report                       # gera reports/REPORT.md a partir dos benchmarks
```

## Arquivos `.env.example`
O repositório possui três arquivos de exemplo de variáveis de ambiente:

- [`.env.example`](./.env.example) – variáveis compartilhadas como `PINATA_JWT`, `POLYGON_RPC_URL`, `PRIVATE_KEY`, endereços dos contratos (`GEO_DATA_REGISTRY`, `NODE_DID_REGISTRY`, `GEO_REWARD_MANAGER`) e `NEXT_PUBLIC_MAPBOX_TOKEN`.
- [`hgc/.env.example`](./hgc/.env.example) – reservado para configurações do simulador HGC. Atualmente não há variáveis obrigatórias.
- [`protocol/.env.example`](./protocol/.env.example) – credenciais para os contratos: `PRIVATE_KEY`, `API_KEY` do provedor RPC e `POLYGONSCAN_KEY`.

## Experimentos de compressão
### Configurando parâmetros e volumes
- Ajuste parâmetros do HGC via variáveis de ambiente ou flags: `HGC_BASE_RES`, `HGC_MIN_RES`, `HGC_MAX_LEAVES_PER_BATCH`, `HGC_MAX_SAMPLES_PER_BATCH`, `HGC_HYSTERESIS_NEAR` e `HGC_HYSTERESIS_FAR`.
- Defina o volume de dados com `npm run nodes -- --nodes=<N>` e `npm run samples -- --epoch=<E> --samples=<S>` para controlar número de nodes e amostras por node.

### Executando o orquestrador
- Use `npm run epoch -- --epoch=<E>` para comprimir as amostras do epoch e registrar os lotes. Os resultados ficam em `hgc/data/epoch_<E>/` e, se configurado, são enviados ao IPFS e à chain.

### Relatórios
- Após cada execução, registre estatísticas com `cd protocol && npm run bench -- <E>`; os dados são gravados em `reports/data/bench.json` e `bench.csv`.
- Gere um relatório comparativo com `npm run report`, que consolida os benchmarks em `reports/REPORT.md`.

### Analisando trade-offs
- O cenário S2 (1000 nodes, 12 amostras) alcançou compressão de 4.80x ao custo de 5.35M gas.
- O cenário S1 alcançou compressão de 4.00x com custo de 6.58M gas.
- Aumentar o volume para 2000 nodes no cenário S6 elevou a compressão para 5.33x, mas o custo subiu para 9.47M gas, ilustrando o equilíbrio entre compressão hierárquica e gasto de gas.

## Modo mock de IPFS e chain
O arquivo [.env.example](./.env.example) lista variáveis para integração com
Pinata e com a rede Polygon. Se `PINATA_JWT` ou as credenciais da chain não
forem fornecidas, o sistema opera em modo *mock*:

- **IPFS** – arquivos são copiados para `data/ipfs-mock/` e é retornado o
  hash SHA‑256 local.
- **Chain** – as transações são gravadas em `data/mock-chain.json` em vez de
  enviar para a blockchain.

## Desenvolvimento
- Testes do simulador: `cd hgc && npm test`
- Testes dos contratos: `cd protocol && npm test`
- CI: o repositório utiliza GitHub Actions para lint, testes e geração de
  relatórios (localmente pode‑se usar `npm run ci` no simulador).

## Relatórios

Relatórios resumidos estão disponíveis no diretório [`reports`](./reports):

- [Desempenho da Compressão HGC](./reports/archives/hgc-compression.md)
- [Conformidade Geoespacial](./reports/archives/geospatial-compliance.md)
- [Desempenho dos Contratos](./reports/archives/contract-performance.md)

## Autoria e Licença
Desenvolvido pela Aura Tecnologia, com autoria de Thomaz Valadares Gontijo.
Distribuído sob a licença [MIT](./LICENSE).
