# Relatório de Desempenho da Compressão HGC

Este documento resume os cenários com melhor taxa de compressão observados no relatório geral localizado em [REPORT.md](../REPORT.md).

## Top cenários por taxa de compressão

Confira a tabela completa no [Resumo Executivo](../REPORT.md#resumo-executivo).

Os valores indicam que o cenário **S6** alcançou a maior taxa de compressão, enquanto **S2** obteve bom equilíbrio entre compressão e custo de gas.

Para um comparativo que também avalia custo, consulte o [Comparativo de escalabilidade por volume](../REPORT.md#comparativo-de-escalabilidade-por-volume).

## Amostragem de nodes e configurações

Detalhes das configurações podem ser vistos em [Volume 1,000](../REPORT.md#volume-1000).

Os cenários variaram tanto o volume de nodes quanto parâmetros do HGC, permitindo observar impactos de escala e de configuração na eficiência de compressão.

## Comparativo com 1 000 nodes
Uma análise isolando esse volume está em [Volume 1,000](../REPORT.md#volume-1000), destacando o efeito de ajustes de `samplesPerNode` e `MAX_LEAVES` sobre custo.

## Projeção em escala milionária
A projeção para 1 milhão de nodes, derivada do cenário S6, encontra-se em [Escalonamento 10k → 1M nodes](../REPORT.md#escalonamento-10k--1m-nodes) e demonstra que a taxa de compressão se mantém enquanto o custo de gas escala linearmente.

## Volume e arquivos gerados

As métricas completas estão em [Comparativo de escalabilidade por volume](../REPORT.md#comparativo-de-escalabilidade-por-volume).

## Equilíbrio da compressão

Veja o [Comparativo de escalabilidade por volume](../REPORT.md#comparativo-de-escalabilidade-por-volume) para a tabela de densidade por cenário.

As variações percentuais representam o desvio padrão em relação ao tamanho médio dos arquivos de cada cenário, indicando se a compressão distribui dados de forma uniforme entre os batches.

## Metodologia resumida
- A taxa de compressão é calculada como `bytesRaw / bytesBatches`.
- O custo de gas estima `gasPerBatch` e `gasTotalEpoch` conforme descrito no relatório principal.

## Conclusões do estudo de sensibilidade
O [Escalonamento 10k → 1M nodes](../REPORT.md#escalonamento-10k--1m-nodes) evidenciou que ajustes em `MAX_LEAVES` influenciam pouco a eficiência de compressão,
mas reduzem ligeiramente o consumo de gas em cenários de alto volume como S4 e S5.
