# Compression Benchmark Report

## Resumo Executivo
Os cenários abaixo destacam o equilíbrio entre custo de gas, compressão hierárquica e homogeneidade das amostras e nodes.
- C1K-1024: 1 batches, compressão 0.81x, custo 100,000 gas.
- C1K-4096: 1 batches, compressão 0.81x, custo 100,000 gas.
- C1K-8192: 1 batches, compressão 0.81x, custo 100,000 gas.
- C5K-1024: 26 batches, compressão 0.81x, custo 2,600,000 gas.
- C5K-4096: 8 batches, compressão 0.81x, custo 800,000 gas.
- C5K-8192: 7 batches, compressão 0.81x, custo 700,000 gas.
- C10K-1024: 26 batches, compressão 0.81x, custo 2,600,000 gas.
- C10K-4096: 26 batches, compressão 0.81x, custo 2,600,000 gas.
- C10K-8192: 8 batches, compressão 0.81x, custo 800,000 gas.
- C50K-1024: 156 batches, compressão 0.82x, custo 15,600,000 gas.
- C50K-4096: 156 batches, compressão 0.82x, custo 15,600,000 gas.
- C50K-8192: 34 batches, compressão 0.82x, custo 3,400,000 gas.

## Volume 1,000

### Distribuição de tamanhos de arquivo
Média: 1,931.673 bytes, desvio padrão: 5.71 bytes

| Cenário | Bytes por arquivo |
| --- | ---: |
| C1K-1024 | 1,926.707 |
| C1K-4096 | 1,928.644 |
| C1K-8192 | 1,939.667 |

### Equilíbrio de compressão
| Cenário | Batches | Células originais | Células comprimidas |
| --- | ---: | ---: | ---: |
| C1K-1024 | 1 | 991 | 1 |
| C1K-4096 | 1 | 991 | 1 |
| C1K-8192 | 1 | 991 | 1 |

### Custos de gas por cenário
| Cenário | Custo estimado (gas) |
| --- | ---: |
| C1K-1024 | 100,000 |
| C1K-4096 | 100,000 |
| C1K-8192 | 100,000 |

### Homogeneidade
| Cenário | Homog. amostras | Homog. nodes |
| --- | ---: | ---: |
| C1K-1024 | 1.00 | 1.00 |
| C1K-4096 | 1.00 | 1.00 |
| C1K-8192 | 1.00 | 1.00 |

### Distribuição de resoluções
| Cenário | Res 0 |
| --- | ---: |
| C1K-1024 | 1 |
| C1K-4096 | 1 |
| C1K-8192 | 1 |

## Volume 5,000

### Distribuição de tamanhos de arquivo
Média: 1,939.667 bytes, desvio padrão: 0.02 bytes

| Cenário | Bytes por arquivo |
| --- | ---: |
| C5K-1024 | 1,939.634 |
| C5K-4096 | 1,939.688 |
| C5K-8192 | 1,939.678 |

### Equilíbrio de compressão
| Cenário | Batches | Células originais | Células comprimidas |
| --- | ---: | ---: | ---: |
| C5K-1024 | 26 | 4,804 | 26 |
| C5K-4096 | 8 | 4,804 | 8 |
| C5K-8192 | 7 | 4,804 | 7 |

### Custos de gas por cenário
| Cenário | Custo estimado (gas) |
| --- | ---: |
| C5K-1024 | 2,600,000 |
| C5K-4096 | 800,000 |
| C5K-8192 | 700,000 |

### Homogeneidade
| Cenário | Homog. amostras | Homog. nodes |
| --- | ---: | ---: |
| C5K-1024 | 0.56 | 0.56 |
| C5K-4096 | 0.18 | 0.18 |
| C5K-8192 | 0.14 | 0.14 |

### Distribuição de resoluções
| Cenário | Res 2 | Res 3 | Res 4 |
| --- | ---: | ---: | ---: |
| C5K-1024 | 1 | 4 | 21 |
| C5K-4096 | 1 | 7 | 0 |
| C5K-8192 | 2 | 5 | 0 |

## Volume 10,000

### Distribuição de tamanhos de arquivo
Média: 1,939.684 bytes, desvio padrão: 0.01 bytes

| Cenário | Bytes por arquivo |
| --- | ---: |
| C10K-1024 | 1,939.684 |
| C10K-4096 | 1,939.673 |
| C10K-8192 | 1,939.697 |

### Equilíbrio de compressão
| Cenário | Batches | Células originais | Células comprimidas |
| --- | ---: | ---: | ---: |
| C10K-1024 | 26 | 9,217 | 26 |
| C10K-4096 | 26 | 9,217 | 26 |
| C10K-8192 | 8 | 9,217 | 8 |

### Custos de gas por cenário
| Cenário | Custo estimado (gas) |
| --- | ---: |
| C10K-1024 | 2,600,000 |
| C10K-4096 | 2,600,000 |
| C10K-8192 | 800,000 |

### Homogeneidade
| Cenário | Homog. amostras | Homog. nodes |
| --- | ---: | ---: |
| C10K-1024 | 0.56 | 0.56 |
| C10K-4096 | 0.56 | 0.56 |
| C10K-8192 | 0.18 | 0.18 |

### Distribuição de resoluções
| Cenário | Res 2 | Res 3 | Res 4 |
| --- | ---: | ---: | ---: |
| C10K-1024 | 1 | 4 | 21 |
| C10K-4096 | 1 | 4 | 21 |
| C10K-8192 | 1 | 7 | 0 |

## Volume 50,000

### Distribuição de tamanhos de arquivo
Média: 1,939.668 bytes, desvio padrão: 0.01 bytes

| Cenário | Bytes por arquivo |
| --- | ---: |
| C50K-1024 | 1,939.654 |
| C50K-4096 | 1,939.689 |
| C50K-8192 | 1,939.662 |

### Equilíbrio de compressão
| Cenário | Batches | Células originais | Células comprimidas |
| --- | ---: | ---: | ---: |
| C50K-1024 | 156 | 33,389 | 156 |
| C50K-4096 | 156 | 33,389 | 156 |
| C50K-8192 | 34 | 33,389 | 34 |

### Custos de gas por cenário
| Cenário | Custo estimado (gas) |
| --- | ---: |
| C50K-1024 | 15,600,000 |
| C50K-4096 | 15,600,000 |
| C50K-8192 | 3,400,000 |

### Homogeneidade
| Cenário | Homog. amostras | Homog. nodes |
| --- | ---: | ---: |
| C50K-1024 | 0.46 | 0.46 |
| C50K-4096 | 0.46 | 0.46 |
| C50K-8192 | 0.47 | 0.47 |

### Distribuição de resoluções
| Cenário | Res 3 | Res 4 | Res 5 |
| --- | ---: | ---: | ---: |
| C50K-1024 | 3 | 13 | 140 |
| C50K-4096 | 3 | 13 | 140 |
| C50K-8192 | 4 | 30 | 0 |

## Comparativo de escalabilidade por volume

### Batches por volume
| Volume | Batches (1024) | Batches (4096) | Batches (8192) |
| --- | ---: | ---: | ---: |
| 1,000 | 1 | 1 | 1 |
| 5,000 | 26 | 8 | 7 |
| 10,000 | 26 | 26 | 8 |
| 50,000 | 156 | 156 | 34 |

### Custos de gas por volume
| Volume | Gas (1024) | Gas (4096) | Gas (8192) |
| --- | ---: | ---: | ---: |
| 1,000 | 100,000 | 100,000 | 100,000 |
| 5,000 | 2,600,000 | 800,000 | 700,000 |
| 10,000 | 2,600,000 | 2,600,000 | 800,000 |
| 50,000 | 15,600,000 | 15,600,000 | 3,400,000 |

## Escalonamento 10k → 1M nodes
| Cenário | Nodes | Batches | Células originais | Células comprimidas | Custo estimado (gas) |
| --- | ---: | ---: | ---: | ---: | ---: |
| C1K-1024 | 10,000 | 10 | 9,910 | 10 | 1,000,000 |
| C1K-1024 | 100,000 | 100 | 99,100 | 100 | 10,000,000 |
| C1K-1024 | 1,000,000 | 1,000 | 991,000 | 1,000 | 100,000,000 |
| C1K-4096 | 10,000 | 10 | 9,910 | 10 | 1,000,000 |
| C1K-4096 | 100,000 | 100 | 99,100 | 100 | 10,000,000 |
| C1K-4096 | 1,000,000 | 1,000 | 991,000 | 1,000 | 100,000,000 |
| C1K-8192 | 10,000 | 10 | 9,910 | 10 | 1,000,000 |
| C1K-8192 | 100,000 | 100 | 99,100 | 100 | 10,000,000 |
| C1K-8192 | 1,000,000 | 1,000 | 991,000 | 1,000 | 100,000,000 |
| C5K-1024 | 10,000 | 52 | 9,608 | 52 | 5,200,000 |
| C5K-1024 | 100,000 | 520 | 96,080 | 520 | 52,000,000 |
| C5K-1024 | 1,000,000 | 5,200 | 960,800 | 5,200 | 520,000,000 |
| C5K-4096 | 10,000 | 16 | 9,608 | 16 | 1,600,000 |
| C5K-4096 | 100,000 | 160 | 96,080 | 160 | 16,000,000 |
| C5K-4096 | 1,000,000 | 1,600 | 960,800 | 1,600 | 160,000,000 |
| C5K-8192 | 10,000 | 14 | 9,608 | 14 | 1,400,000 |
| C5K-8192 | 100,000 | 140 | 96,080 | 140 | 14,000,000 |
| C5K-8192 | 1,000,000 | 1,400 | 960,800 | 1,400 | 140,000,000 |
| C10K-1024 | 10,000 | 26 | 9,217 | 26 | 2,600,000 |
| C10K-1024 | 100,000 | 260 | 92,170 | 260 | 26,000,000 |
| C10K-1024 | 1,000,000 | 2,600 | 921,700 | 2,600 | 260,000,000 |
| C10K-4096 | 10,000 | 26 | 9,217 | 26 | 2,600,000 |
| C10K-4096 | 100,000 | 260 | 92,170 | 260 | 26,000,000 |
| C10K-4096 | 1,000,000 | 2,600 | 921,700 | 2,600 | 260,000,000 |
| C10K-8192 | 10,000 | 8 | 9,217 | 8 | 800,000 |
| C10K-8192 | 100,000 | 80 | 92,170 | 80 | 8,000,000 |
| C10K-8192 | 1,000,000 | 800 | 921,700 | 800 | 80,000,000 |
| C50K-1024 | 10,000 | 31.2 | 6,677.8 | 31.2 | 3,120,000 |
| C50K-1024 | 100,000 | 312 | 66,778 | 312 | 31,200,000 |
| C50K-1024 | 1,000,000 | 3,120 | 667,780 | 3,120 | 312,000,000 |
| C50K-4096 | 10,000 | 31.2 | 6,677.8 | 31.2 | 3,120,000 |
| C50K-4096 | 100,000 | 312 | 66,778 | 312 | 31,200,000 |
| C50K-4096 | 1,000,000 | 3,120 | 667,780 | 3,120 | 312,000,000 |
| C50K-8192 | 10,000 | 6.8 | 6,677.8 | 6.8 | 680,000 |
| C50K-8192 | 100,000 | 68 | 66,778 | 68 | 6,800,000 |
| C50K-8192 | 1,000,000 | 680 | 667,780 | 680 | 68,000,000 |

## Parâmetros recomendados por volume
| Volume | baseRes | maxLeavesPerBatch | maxSamplesPerBatch | hysteresisNear | hysteresisFar |
| --- | ---: | ---: | ---: | ---: | ---: |
| < 5k | 8 | 1,024 | — | — | — |
| 5k – 50k | 8 | 4,096 | 16,000 | 0.9 | 1.1 |
| ≥ 50k | 8 | 8,192 | 32,000 | 0.95 | 1.05 |
