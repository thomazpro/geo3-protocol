# High Volume Batching Experiments

The experiment script was extended to test larger volumes (10 000 and 50 000) and new HGC parameter sets.
The table below shows the resulting batch counts for each configuration.

| Volume | maxLeavesPerBatch | maxSamplesPerBatch | hysteresisFar | Batches |
|-------:|------------------:|-------------------:|--------------:|--------:|
| 1 000  | 1 024 | –     | –    | 1 |
| 1 000  | 4 096 | 16 000| 1.1  | 1 |
| 1 000  | 8 192 | 32 000| 1.05 | 1 |
| 5 000  | 1 024 | –     | –    | 26 |
| 5 000  | 4 096 | 16 000| 1.1  | 3 |
| 5 000  | 8 192 | 32 000| 1.05 | 1 |
| 10 000 | 1 024 | –     | –    | 26 |
| 10 000 | 4 096 | 16 000| 1.1  | 7 |
| 10 000 | 8 192 | 32 000| 1.05 | 3 |
| 50 000 | 1 024 | –     | –    | 150 |
| 50 000 | 4 096 | 16 000| 1.1  | 27 |
| 50 000 | 8 192 | 32 000| 1.05 | 15 |

Higher aggregation thresholds (maxLeavesPerBatch = 8 192 and maxSamplesPerBatch = 32 000 with hysteresisFar = 1.05) produced the fewest batches for larger volumes, showing better scalability.
