# Relatório de Conformidade Geoespacial

Este relatório destaca os cenários que preservaram melhor a distribuição espacial dos dados nos experimentos.

## Cenários em destaque

A tabela consolidada está disponível no [Resumo Executivo](../REPORT.md#resumo-executivo).

Os cenários **S1** e **S6** apresentaram a melhor preservação espacial durante a compressão.

Para uma análise que também considera custo e taxa de compressão, veja o [Comparativo de escalabilidade por volume](../REPORT.md#comparativo-de-escalabilidade-por-volume).

## Amostragem de nodes e volume de dados

Consulte [Volume 1,000](../REPORT.md#volume-1000) para detalhes por cenário.

A variação de tamanho entre os arquivos permaneceu abaixo de 7% em todos os cenários, sugerindo densidades semelhantes após a compressão.

## Metodologia resumida
- Demais detalhes de cálculo estão disponíveis em [REPORT.md](../REPORT.md).

## Conclusões do estudo de sensibilidade
Conforme observado em [Escalonamento 10k → 1M nodes](../REPORT.md#escalonamento-10k--1m-nodes), preços de gas mais altos encarecem todas as estratégias.
Reduzir `MAX_LEAVES` tem pouco efeito sobre o custo, mas diminui marginalmente o consumo em cenários como S4 e S5.
