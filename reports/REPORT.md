# Compression Benchmark Report

## Executive Summary
The scenarios below highlight the balance between gas cost, hierarchical compression, and homogeneity of samples and nodes.
- C1K-1024: 1 batch, compression 0.81x, cost 100,000 gas.
- C1K-4096: 1 batch, compression 0.81x, cost 100,000 gas.
- C1K-8192: 1 batch, compression 0.81x, cost 100,000 gas.
- C5K-1024: 26 batches, compression 0.81x, cost 2,600,000 gas.
- C5K-4096: 8 batches, compression 0.81x, cost 800,000 gas.
- C5K-8192: 7 batches, compression 0.81x, cost 700,000 gas.
- C10K-1024: 26 batches, compression 0.81x, cost 2,600,000 gas.
- C10K-4096: 26 batches, compression 0.81x, cost 2,600,000 gas.
- C10K-8192: 8 batches, compression 0.81x, cost 800,000 gas.
- C50K-1024: 156 batches, compression 0.82x, cost 15,600,000 gas.
- C50K-4096: 156 batches, compression 0.82x, cost 15,600,000 gas.
- C50K-8192: 34 batches, compression 0.82x, cost 3,400,000 gas.

## Volume 1,000

### File size distribution
Average: 1,931.673 bytes, standard deviation: 5.71 bytes

| Scenario | Bytes per file |
| --- | ---: |
| C1K-1024 | 1,926.707 |
| C1K-4096 | 1,928.644 |
| C1K-8192 | 1,939.667 |

### Compression balance
| Scenario | Batches | Original cells | Compressed cells |
| --- | ---: | ---: | ---: |
| C1K-1024 | 1 | 991 | 1 |
| C1K-4096 | 1 | 991 | 1 |
| C1K-8192 | 1 | 991 | 1 |

### Gas costs per scenario
| Scenario | Estimated cost (gas) |
| --- | ---: |
| C1K-1024 | 100,000 |
| C1K-4096 | 100,000 |
| C1K-8192 | 100,000 |

### Resolution distribution
| Scenario | Res 0 |
| --- | ---: |
| C1K-1024 | 1 |
| C1K-4096 | 1 |
| C1K-8192 | 1 |

## Volume 5,000

### File size distribution
Average: 1,939.667 bytes, standard deviation: 0.02 bytes

| Scenario | Bytes per file |
| --- | ---: |
| C5K-1024 | 1,939.634 |
| C5K-4096 | 1,939.688 |
| C5K-8192 | 1,939.678 |

### Compression balance
| Scenario | Batches | Original cells | Compressed cells |
| --- | ---: | ---: | ---: |
| C5K-1024 | 26 | 4,804 | 26 |
| C5K-4096 | 8 | 4,804 | 8 |
| C5K-8192 | 7 | 4,804 | 7 |

### Gas costs per scenario
| Scenario | Estimated cost (gas) |
| --- | ---: |
| C5K-1024 | 2,600,000 |
| C5K-4096 | 800,000 |
| C5K-8192 | 700,000 |

### Resolution distribution
| Scenario | Res 2 | Res 3 | Res 4 |
| --- | ---: | ---: | ---: |
| C5K-1024 | 1 | 4 | 21 |
| C5K-4096 | 1 | 7 | 0 |
| C5K-8192 | 2 | 5 | 0 |

## Volume 10,000

### File size distribution
Average: 1,939.684 bytes, standard deviation: 0.01 bytes

| Scenario | Bytes per file |
| --- | ---: |
| C10K-1024 | 1,939.684 |
| C10K-4096 | 1,939.673 |
| C10K-8192 | 1,939.697 |

### Compression balance
| Scenario | Batches | Original cells | Compressed cells |
| --- | ---: | ---: | ---: |
| C10K-1024 | 26 | 9,217 | 26 |
| C10K-4096 | 26 | 9,217 | 26 |
| C10K-8192 | 8 | 9,217 | 8 |

### Gas costs per scenario
| Scenario | Estimated cost (gas) |
| --- | ---: |
| C10K-1024 | 2,600,000 |
| C10K-4096 | 2,600,000 |
| C10K-8192 | 800,000 |

### Resolution distribution
| Scenario | Res 2 | Res 3 | Res 4 |
| --- | ---: | ---: | ---: |
| C10K-1024 | 1 | 4 | 21 |
| C10K-4096 | 1 | 4 | 21 |
| C10K-8192 | 1 | 7 | 0 |

## Volume 50,000

### File size distribution
Average: 1,939.668 bytes, standard deviation: 0.01 bytes

| Scenario | Bytes per file |
| --- | ---: |
| C50K-1024 | 1,939.654 |
| C50K-4096 | 1,939.689 |
| C50K-8192 | 1,939.662 |

### Compression balance
| Scenario | Batches | Original cells | Compressed cells |
| --- | ---: | ---: | ---: |
| C50K-1024 | 156 | 33,389 | 156 |
| C50K-4096 | 156 | 33,389 | 156 |
| C50K-8192 | 34 | 33,389 | 34 |

### Gas costs per scenario
| Scenario | Estimated cost (gas) |
| --- | ---: |
| C50K-1024 | 15,600,000 |
| C50K-4096 | 15,600,000 |
| C50K-8192 | 3,400,000 |

### Resolution distribution
| Scenario | Res 3 | Res 4 | Res 5 |
| --- | ---: | ---: | ---: |
| C50K-1024 | 3 | 13 | 140 |
| C50K-4096 | 3 | 13 | 140 |
| C50K-8192 | 4 | 30 | 0 |

## Scalability comparison by volume

### Batches per volume
| Volume | Batches (1024) | Batches (4096) | Batches (8192) |
| --- | ---: | ---: | ---: |
| 1,000 | 1 | 1 | 1 |
| 5,000 | 26 | 8 | 7 |
| 10,000 | 26 | 26 | 8 |
| 50,000 | 156 | 156 | 34 |

### Gas costs per volume
| Volume | Gas (1024) | Gas (4096) | Gas (8192) |
| --- | ---: | ---: | ---: |
| 1,000 | 100,000 | 100,000 | 100,000 |
| 5,000 | 2,600,000 | 800,000 | 700,000 |
| 10,000 | 2,600,000 | 2,600,000 | 800,000 |
| 50,000 | 15,600,000 | 15,600,000 | 3,400,000 |

## Scaling 10k → 1M nodes
| Scenario | Nodes | Batches | Original cells | Compressed cells | Estimated cost (gas) |
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

## Recommended parameters by volume
| Volume | baseRes | maxLeavesPerBatch | maxSamplesPerBatch | hysteresisNear | hysteresisFar |
| --- | ---: | ---: | ---: | ---: | ---: |
| < 5k | 8 | 1,024 | — | — | — |
| 5k – 50k | 8 | 4,096 | 16,000 | 0.9 | 1.1 |
| ≥ 50k | 8 | 8,192 | 32,000 | 0.95 | 1.05 |