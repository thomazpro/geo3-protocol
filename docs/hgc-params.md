# Recomendações de Parâmetros HGC por Volume

Este documento lista parâmetros sugeridos para operadores que processam diferentes volumes de nodes. As recomendações foram derivadas dos experimentos de benchmarking e dos cenários descritos no relatório final.

## Lógica de ajuste por volume

Os parâmetros abaixo foram definidos para manter o número de batches baixo sem sacrificar a distribuição geográfica e a coerência espacial do H3. A lógica de ajuste considera principalmente a quantidade de nodes recebidos:

- **Baixo volume (< 5 000 nodes):** valores padrão são suficientes e evitam subdivisões desnecessárias.
- **Volume médio (5 000 – 50 000 nodes):** elevar limites de folhas e amostras reduz o número de batches mantendo a semântica geográfica.
- **Alto volume (≥ 50 000 nodes):** empregar limites máximos para manter o custo de gás próximo da escala linear em relação ao volume processado.

## Faixas de volume e parâmetros

| Volume | baseRes | maxLeavesPerBatch | maxSamplesPerBatch | hysteresisNear | hysteresisFar |
| --- | ---: | ---: | ---: | ---: | ---: |
| < 5 000 | 8 | 1 024 | — | — | — |
| 5 000 – 49 999 | 8 | 4 096 | 16 000 | 0.90 | 1.10 |
| ≥ 50 000 | 8 | 8 192 | 32 000 | 0.95 | 1.05 |

## Parâmetros

### `baseRes`
- **Valor recomendado:** `8`
- **Impacto:** Define a resolução base das células H3 que delimitam os batches. Valores mais altos ampliam o número de células raiz, aumentando o tamanho da árvore e o custo de gás, mas fornecendo semântica geográfica mais fina. Mantemos `8` para equilibrar granulação geográfica e eficiência.

### `maxLeavesPerBatch`
- **Valor recomendado:** `8 192`
- **Impacto:** Estabelece o número máximo de folhas H3 em cada batch. Um limite maior mantém a árvore mais rasa, reduz o número de batches e diminui o custo de gás proporcionalmente sem quebrar a proximidade geográfica das células.

### `maxSamplesPerBatch`
- **Valor recomendado:** `32 000`
- **Impacto:** Limita a quantidade de amostras agregadas em cada batch. Valores altos evitam divisões artificiais, controlam a profundidade da árvore e mantêm o custo de gás próximo do linear enquanto preservam a semântica espacial do H3.

### `hysteresisFar` e `hysteresisNear`
- **Valores recomendados:** `hysteresisNear = 0.95`, `hysteresisFar = 1.05`
- **Impacto:** Controlam o momento de subdividir ou agrupar células adjacentes, suavizando flutuações de tamanho de batch. Ao introduzir uma faixa de tolerância, estabilizam a estrutura da árvore, preservam a semântica geográfica e evitam reprocessamentos que elevariam o custo de gás.

## Referências
- Relatório final de compressão【F:reports/REPORT.md†L1-L14】
- Experimentos de batching em alto volume【F:reports/archives/high-volume-batching.md†L1-L21】

## Próximos Passos
Revisar estas recomendações com a equipe para garantir alinhamento com os objetivos do protocolo e ajustar os limites conforme novas métricas forem coletadas.
