# GEO3 Protocol

Infraestrutura pública e auditável para registrar e remunerar dados ambientais utilizando o padrão **HGC (Hierarchical Geospatial Compression)**. O projeto combina sensores físicos, compressão geoespacial e contratos inteligentes para criar uma rede DePIN focada na preservação da Terra.

## Requisitos

- Node.js >= 18
- npm
- Hardhat 2.25+

## Configuração do `.env`

O projeto utiliza variáveis de ambiente para credenciais e chaves. Use o arquivo `.env.example` como referência:

```bash
cp .env.example .env
# edite com suas informações
```

- `PRIVATE_KEY`: chave privada da conta deployer.
- `API_KEY`: chave do provedor RPC (Alchemy, Infura etc.).
- `POLYGONSCAN_KEY`: chave de API do Polygonscan (opcional para verificação).

## Estrutura do repositório

```
contracts/    contratos inteligentes
scripts/      scripts de deploy
tests/         testes Hardhat
ignition/     módulos para Hardhat Ignition
```

## Contratos

A stack on-chain é composta pelos seguintes contratos:

| Contrato | Função principal |
|----------|-----------------|
| `GeoToken` | Token nativo CGT (ERC20) com *cap* e *permit*. Utilizado para recompensas. |
| `NodeDIDRegistry` | Registro de identidade descentralizada dos nós físicos (DID), com controle de acesso e assinatura EIP‑712. |
| `GeoDataRegistry` | Armazena lotes de dados geoespaciais. Cada lote possui `geoBatchId`, `merkleRoot` e `dataCID` (IPFS/URL). |
| `GeoRewardManager` | Publica ciclos semanais de recompensa (Merkle root) e permite `claim()` pelos *controllers* dos nós. |
| `GeoCellIDLib` | Biblioteca de manipulação de identificadores H3 estendidos para compressão HGC. |

Os dados gerados pelos sensores são comprimidos off‑chain, publicados em IPFS e ancorados on‑chain através das raízes Merkle registradas no `GeoDataRegistry`. Semanalmente, o oráculo agrega leituras e o `GeoRewardManager` distribui CGT conforme o desempenho de cada node.

### GeoToken

Token utilitário ERC20 (símbolo **CGT**) com limite de emissão (`ERC20Capped`) e suporte a `permit` (EIP‑2612).
Principais papéis:

- `MINTER_ROLE` – cunha CGT (delegado ao `GeoRewardManager`);
- `BURNER_ROLE` – queima tokens;
- `DEFAULT_ADMIN_ROLE` – configura papéis e define o `rewardManager`.

### NodeDIDRegistry

Registro de identidade descentralizada dos nodes físicos.
Funcionalidades:

- `registerNode` / `registerMultipleNodes` validam assinatura EIP‑712 do hardware;
- mantém `controller` (carteira responsável) e `metadataURI` (DID Document);
- `MANAGER_ROLE` pode ativar/desativar nodes e trocar controllers;
- integra‑se ao `GeoDataRegistry` via `sensorResolver` para validar `nodeType`.

### GeoDataRegistry

Armazena lotes de dados geoespaciais agregados.
Recursos:

- `registerGeoBatch` e `registerGeoBatchBulk` publicam `geoBatchId`, `merkleRoot` e `dataCID`;
- política de epochs (`epochMinInterval`, `epochMaxDelay`);
- restrição de resolução por `sensorType` (`setSensorType`);
- roles: `ORACLE_ROLE` publica lotes e `MANAGER_ROLE` ajusta parâmetros;
- utiliza `GeoCellIDLib` para validar `geoBatchId` em HGC.

### GeoRewardManager

Distribui CGT com base em ciclos semanais. Principais funções:

- `publishCycle` registra a raiz Merkle e emite tokens para o contrato;
- `claim` valida prova Merkle, verifica status do node e transfere CGT ao `controller`;
- usa `epochWindow` para mapear epochs do `GeoDataRegistry`.

### GeoCellIDLib

Biblioteca de utilidades para o padrão HGC. Permite extrair cabeçalho `sensorType`, navegar entre níveis (`parentOf`, `aggregationGroup`) e comparar células (`isAncestorOf`, `isSameRoot`) mantendo compatibilidade com `H3` em *cell mode*.

## Como compilar

```bash
npm install
npm run compile
```

## Como testar

```bash
npm test
```

## Deploy

```bash
npx hardhat run scripts/deploy-geo3.js --network amoy
```


### Lint e formatação

```bash
npm run lint
npm run format
```


### Verificação no Polygonscan

```bash
npx hardhat verify --network amoy <endereco> <argumentos-do-construtor>
```

Certifique-se de definir `POLYGONSCAN_KEY` no `.env`. Os argumentos de cada construtor podem ser consultados no script de deploy.


## Registrando nodes

1. Cada node assina uma mensagem EIP‑712 contendo seu `nodeAddress`, `controller`, `nodeType` e `metadataURI`.
2. Uma conta com `MANAGER_ROLE` chama `registerMultipleNodes` (ou `registerNode`) passando os dados e assinaturas.

Exemplo em script Hardhat (ethers.js):

```js
const registry = await ethers.getContract("NodeDIDRegistry");
await registry.registerMultipleNodes(
  [nodeAddress],
  [nodeType],
  [controller],
  ["ipfs://cid"],
  [signature]
);
```

## Registrando batches de dados

Somente endereços com `ORACLE_ROLE` podem registrar lotes:

```js
const dataRegistry = await ethers.getContract("GeoDataRegistry");
const epoch = await dataRegistry.currentEpoch();
await dataRegistry.registerGeoBatch(
  epoch,
  geoBatchId,
  merkleRoot,
  "ipfs://data-cid"
);
```

É possível enviar vários lotes de uma vez com `registerGeoBatchBulk`.

## Hierarchical Geospatial Compression (HGC)

HGC é uma extensão ao índice hexagonal **H3** que adiciona um cabeçalho binário e regras de agregação hierárquica. Isso permite:

- Compactar grandes volumes de dados mantendo a relação espacial;
- Agrupar células por nível de resolução (`GeoCellIDLib`);
- Construir árvores Merkle determinísticas e auditáveis com baixo custo on-chain.

### Composição do `geoId`

Cada célula é identificada por um `geoId` de 64 bits que segue o formato:

```
[sensorType (8 bits)] [H3 cell index (56 bits)]
```

- **sensorType** – cabeçalho que define a categoria do sensor ou métrica (0‑255).
- **H3 cell index** – os 56 bits menos significativos preservam a estrutura padrão do H3
  em *cell mode*, incluindo nível de resolução, célula base e dígitos hierárquicos.

Ao reservar os 8 bits superiores para o `sensorType`, conseguimos multiplexar leituras de diferentes
sensores sem perder a compatibilidade com o ecossistema H3. Todas as operações de agregação e
navegação fornecidas pela `GeoCellIDLib` funcionam sobre esse mesmo layout, permitindo compressão
hierárquica e comparação eficiente entre células.

## Créditos

O projeto GEO3 é uma iniciativa da **Aura Tecnologia**, desenvolvida como infraestrutura pública para dados ambientais auditáveis.

Os contratos inteligentes deste protocolo foram criados por **Thomaz Valadares Gontijo**, sob licença MIT, como parte do compromisso da Aura com tecnologia aberta, confiável e soberana.

Contribuições são bem-vindas.

## Licença

Distribuído sob a licença MIT. Consulte `LICENSE` para mais informações.
