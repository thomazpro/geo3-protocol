# Relatório de Desempenho dos Contratos

Este relatório resume o custo estimado de gas para registrar lotes de dados no contrato `GeoDataRegistry`.

## Top cenários por menor custo total

Veja a tabela consolidada em [Custos de gas por volume](../REPORT.md#custos-de-gas-por-volume).

O cenário **S2** apresentou o menor custo total, enquanto **S1** teve o menor gasto por batch.

Para uma visão que equilibra custo e compressão, consulte o [Comparativo de escalabilidade por volume](../REPORT.md#comparativo-de-escalabilidade-por-volume).

## Volume de nodes e arquivos

Consulte [Volume 1,000](../REPORT.md#volume-1000) para a distribuição completa de dados.

A correlação entre volume de dados e custo fica evidente: cenários com mais batches gerados exigem maior quantidade de gás, especialmente quando o número de nodes cresce além de 1 500.

## Metodologia resumida
- O custo de gas é calculado a partir de `gasPerBatch` e `gasTotalEpoch` com constantes: `baseTx = 21000`, `gasPerByte = 16` e `gasPerLeaf = 50`.
- Os valores foram extraídos de [REPORT.md](../REPORT.md).

## Conclusões do estudo de sensibilidade
O [Escalonamento 10k → 1M nodes](../REPORT.md#escalonamento-10k--1m-nodes) mostra que o custo total cresce de forma linear com o preço de gas.
Limitar `MAX_LEAVES` para 50 traz redução modesta de consumo em cenários com muitas folhas, como S4 e S5.
