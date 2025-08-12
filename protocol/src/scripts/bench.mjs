import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const [,, epochArg, gasPriceArg] = process.argv;
if (!epochArg) {
  console.error('Usage: node src/scripts/bench.mjs <epoch> [gas-price-gwei]');
  process.exit(1);
}
const epoch = Number(epochArg);
if (Number.isNaN(epoch)) {
  console.error('Epoch must be a number');
  process.exit(1);
}
const gasPriceGwei = gasPriceArg ? Number(gasPriceArg) : 1;
if (Number.isNaN(gasPriceGwei)) {
  console.error('Gas price must be a number');
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const protocolRoot = path.resolve(__dirname, '..', '..');
const repoRoot = path.resolve(protocolRoot, '..');

const sampleFile = path.join(protocolRoot, `samples_epoch_${epoch}.json`);
const batchesDir = path.join(protocolRoot, 'data', `epoch_${epoch}`);
const reportsDir = path.join(repoRoot, 'reports', 'data');

async function fileSize(file) {
  return (await fs.stat(file)).size;
}

async function dirSize(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  let total = 0;
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += await dirSize(full);
    } else {
      total += (await fs.stat(full)).size;
    }
  }
  return total;
}

function h3Resolution(cell) {
  try {
    // resolution stored in bits 52-55 of index
    return Number((BigInt(cell) >> 52n) & 0xfn);
  } catch {
    return null;
  }
}

async function batchStats(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  let originalCells = 0;
  let batches = 0;
  const resCount = {};
  const sizes = [];
  const sampleCounts = [];
  const nodeCounts = [];
  for (const entry of entries) {
    if (entry.isDirectory() || !entry.name.endsWith('.json')) continue;
    const filePath = path.join(dir, entry.name);
    if (entry.name === 'superRoot.json') continue;
    try {
      const stat = await fs.stat(filePath);
      sizes.push(stat.size);
      const content = JSON.parse(await fs.readFile(filePath, 'utf8'));
      if (Array.isArray(content.compressedFrom)) {
        originalCells += content.compressedFrom.length;
      }
      const res = content.resBatch ?? (content.geoBatchId ? h3Resolution(content.geoBatchId) : null);
      if (res != null) resCount[res] = (resCount[res] || 0) + 1;
      const samples = typeof content.countSamples === 'number'
        ? content.countSamples
        : Object.values(content.data || {}).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);
      sampleCounts.push(samples);
      const nodesSet = new Set();
      if (content.data && typeof content.data === 'object') {
        for (const arr of Object.values(content.data)) {
          if (!Array.isArray(arr)) continue;
          for (const s of arr) {
            if (s && s.issuer !== undefined) nodesSet.add(s.issuer);
          }
        }
      }
      nodeCounts.push(nodesSet.size);
      batches++;
    } catch {
      // ignore parse errors
    }
  }
  return { originalCells, batches, resCount, sizes, sampleCounts, nodeCounts };
}

async function estimateGasTotal(batches) {
  const MOCK_GAS_PER_BATCH = 100000n;
  try {
    const { ethers } = await import('ethers');
    const provider = ethers.getDefaultProvider();
    const gas = await provider.estimateGas({ to: ethers.ZeroAddress });
    return Number(gas) * batches;
  } catch {
    return Number(MOCK_GAS_PER_BATCH) * batches;
  }
}

async function readRecords(file) {
  try {
    const data = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeReports(record) {
  await fs.mkdir(reportsDir, { recursive: true });

  const jsonFile = path.join(reportsDir, 'bench.json');
  const records = await readRecords(jsonFile);
  const idx = records.findIndex(r => r.epoch === record.epoch);
  if (idx >= 0) records[idx] = record; else records.push(record);
  await fs.writeFile(jsonFile, JSON.stringify(records, null, 2));

  const csvFile = path.join(reportsDir, 'bench.csv');
  const baseHeaders = [
    'epoch',
    'sampleBytes',
    'batchesBytes',
    'compressionRatio',
    'originalCells',
    'compressedCells',
    'gasEstimate',
    'gasPriceGwei',
    'gasCostEth',
    'avgBatchBytes',
    'medianBatchBytes',
    'stdBatchBytes',
    'avgSamplesPerBatch',
    'medianSamplesPerBatch',
    'stdSamplesPerBatch',
    'homogeneitySamples',
    'avgNodesPerBatch',
    'medianNodesPerBatch',
    'stdNodesPerBatch',
    'homogeneityNodes'
  ];
  const allRes = Array.from(new Set(records.flatMap(r => Object.keys(r.resDistribution || {}))))
    .sort((a, b) => Number(a) - Number(b));
  const csvLines = [baseHeaders.concat(allRes.map(r => `res${r}`)).join(',')];
  for (const r of records) {
    const baseValues = [
      r.epoch,
      r.sampleBytes,
      r.batchesBytes,
      r.compressionRatio,
      r.originalCells,
      r.compressedCells,
      r.gasEstimate,
      r.gasPriceGwei ?? '',
      r.gasCostEth ?? '',
      r.avgBatchBytes ?? '',
      r.medianBatchBytes ?? '',
      r.stdBatchBytes ?? '',
      r.avgSamplesPerBatch ?? '',
      r.medianSamplesPerBatch ?? '',
      r.stdSamplesPerBatch ?? '',
      r.homogeneitySamples ?? '',
      r.avgNodesPerBatch ?? '',
      r.medianNodesPerBatch ?? '',
      r.stdNodesPerBatch ?? '',
      r.homogeneityNodes ?? ''
    ];
    const resValues = allRes.map(res => r.resDistribution?.[res] ?? '');
    csvLines.push([...baseValues, ...resValues].join(','));
  }
  await fs.writeFile(csvFile, csvLines.join('\n'));
}

async function main() {
  const sampleBytes = await fileSize(sampleFile);
  const batchesBytes = await dirSize(batchesDir);
  const compressionRatio = sampleBytes / batchesBytes;

  const { originalCells, batches, resCount, sizes, sampleCounts, nodeCounts } = await batchStats(batchesDir);
  const compressedCells = batches;
  const gasEstimate = await estimateGasTotal(batches);
  const gasCostEth = gasEstimate * gasPriceGwei / 1e9;

  const stats = arr => {
    if (!arr.length) return { mean: 0, median: 0, std: 0 };
    const mean = arr.reduce((s, n) => s + n, 0) / arr.length;
    const sorted = [...arr].sort((a, b) => a - b);
    const median = sorted[Math.floor(arr.length / 2)];
    const variance = arr.reduce((s, n) => s + (n - mean) ** 2, 0) / arr.length;
    const std = Math.sqrt(variance);
    return { mean, median, std };
  };

  const sizeStats = stats(sizes);
  const sampleStats = stats(sampleCounts);
  const nodeStats = stats(nodeCounts);

  const homogeneitySamples = sampleStats.mean
    ? 1 - (sampleStats.std / sampleStats.mean)
    : 0;
  const homogeneityNodes = nodeStats.mean
    ? 1 - (nodeStats.std / nodeStats.mean)
    : 0;

  const record = {
    epoch,
    sampleBytes,
    batchesBytes,
    compressionRatio,
    originalCells,
    compressedCells,
    gasEstimate,
    gasPriceGwei,
    gasCostEth,
    avgBatchBytes: sizeStats.mean,
    medianBatchBytes: sizeStats.median,
    stdBatchBytes: sizeStats.std,
    avgSamplesPerBatch: sampleStats.mean,
    medianSamplesPerBatch: sampleStats.median,
    stdSamplesPerBatch: sampleStats.std,
    homogeneitySamples,
    avgNodesPerBatch: nodeStats.mean,
    medianNodesPerBatch: nodeStats.median,
    stdNodesPerBatch: nodeStats.std,
    homogeneityNodes,
    resDistribution: resCount
  };
  await writeReports(record);
  console.log(`Benchmark for epoch ${epoch} recorded.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
