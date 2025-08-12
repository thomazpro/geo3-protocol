import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Paths ------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const dataDir = path.join(repoRoot, 'reports', 'data');

const benchFile = path.join(dataDir, 'bench.json');
const experimentsFile = path.join(dataDir, 'experiments.json');
const reportFile = path.join(repoRoot, 'reports', 'REPORT.md');

// Helpers ----------------------------------------------------------
function fmt(num, digits = 2) {
  if (num === null || num === undefined || Number.isNaN(num)) return 'N/A';
  return Number(num).toFixed(digits);
}

async function loadJson(file) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Failed to read ${file}:`, err);
    return [];
  }
}

function formatInt(n) {
  return Number(n).toLocaleString('en-US');
}

function stddev(values) {
  if (!values.length) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// Static scenarios grouped by volume -------------------------------
function buildRowsByVolume(experiments, bench) {
  const benchMap = new Map(bench.map(r => [r.epoch, r]));
  const volumeMap = new Map();
  for (const e of experiments) {
    const b = benchMap.get(e.epoch);
    if (!b) continue;
    const row = {
      id: `C${Math.round(e.volume / 1000)}K-${e.params.maxLeavesPerBatch}`,
      volume: e.volume,
      maxLeaves: e.params.maxLeavesPerBatch,
      batches: b.compressedCells,
      bytesPerFile: b.sampleBytes / e.volume,
      originalCells: b.originalCells,
      compressedCells: b.compressedCells,
      compression: b.compressionRatio,
      gas: b.gasEstimate,
      homogeneitySamples: b.homogeneitySamples,
      homogeneityNodes: b.homogeneityNodes,
      resDistribution: b.resDistribution || {}
    };
    if (!volumeMap.has(e.volume)) volumeMap.set(e.volume, []);
    volumeMap.get(e.volume).push(row);
  }
  for (const rows of volumeMap.values()) {
    rows.sort((a, b) => a.maxLeaves - b.maxLeaves);
  }
  return volumeMap;
}

function fileSizeTable(rows, std) {
  let md = `Média: ${formatInt(rows.reduce((s, r) => s + r.bytesPerFile, 0) / rows.length)} bytes, desvio padrão: ${fmt(std)} bytes\n\n`;
  md += '| Cenário | Bytes por arquivo |\n';
  md += '| --- | ---: |\n';
  for (const r of rows) {
    md += `| ${r.id} | ${formatInt(r.bytesPerFile)} |\n`;
  }
  return md;
}

function compressionTable(rows) {
  let md = '| Cenário | Batches | Células originais | Células comprimidas |\n';
  md += '| --- | ---: | ---: | ---: |\n';
  for (const r of rows) {
    md += `| ${r.id} | ${formatInt(r.batches)} | ${formatInt(r.originalCells)} | ${formatInt(r.compressedCells)} |\n`;
  }
  return md;
}

function gasTable(rows) {
  let md = '| Cenário | Custo estimado (gas) |\n';
  md += '| --- | ---: |\n';
  for (const r of rows) {
    md += `| ${r.id} | ${formatInt(r.gas)} |\n`;
  }
  return md;
}

function homogeneityTable(rows) {
  let md = '| Cenário | Homog. amostras | Homog. nodes |\n';
  md += '| --- | ---: | ---: |\n';
  for (const r of rows) {
    md += `| ${r.id} | ${fmt(r.homogeneitySamples)} | ${fmt(r.homogeneityNodes)} |\n`;
  }
  return md;
}

function resolutionTable(rows) {
  const resKeys = Array.from(new Set(rows.flatMap(r => Object.keys(r.resDistribution || {}))))
    .sort((a, b) => Number(a) - Number(b));
  if (!resKeys.length) return '';
  let md = '| Cenário |' + resKeys.map(r => ` Res ${r} |`).join('');
  md += '\n| --- |' + resKeys.map(() => ' ---: |').join('');
  md += '\n';
  for (const r of rows) {
    md += `| ${r.id} |`;
    for (const k of resKeys) {
      const val = r.resDistribution?.[k] ?? 0;
      md += ` ${formatInt(val)} |`;
    }
    md += '\n';
  }
  return md;
}

function scalingTable(rows) {
  const scales = [10000, 100000, 1000000];
  let md = '| Cenário | Nodes | Batches | Células originais | Células comprimidas | Custo estimado (gas) |\n';
  md += '| --- | ---: | ---: | ---: | ---: | ---: |\n';
  for (const r of rows) {
    for (const v of scales) {
      const f = v / r.volume;
      md += `| ${r.id} | ${formatInt(v)} | ${formatInt(r.batches * f)} | ${formatInt(r.originalCells * f)} | ${formatInt(r.compressedCells * f)} | ${formatInt(r.gas * f)} |\n`;
    }
  }
  return md;
}

// Recommended parameter sets --------------------------------------
function paramsForVolume(volume) {
  if (volume < 5000) {
    return { baseRes: 8, maxLeavesPerBatch: 1024 };
  }
  if (volume < 50000) {
    return {
      baseRes: 8,
      maxLeavesPerBatch: 4096,
      maxSamplesPerBatch: 16000,
      hysteresisNear: 0.9,
      hysteresisFar: 1.1
    };
  }
  return {
    baseRes: 8,
    maxLeavesPerBatch: 8192,
    maxSamplesPerBatch: 32000,
    hysteresisNear: 0.95,
    hysteresisFar: 1.05
  };
}

function recommendedParamsTable() {
  const ranges = [
    { label: '< 5k', volume: 1000 },
    { label: '5k – 50k', volume: 10000 },
    { label: '≥ 50k', volume: 100000 }
  ];
  let md = '| Volume | baseRes | maxLeavesPerBatch | maxSamplesPerBatch | hysteresisNear | hysteresisFar |\n';
  md += '| --- | ---: | ---: | ---: | ---: | ---: |\n';
  for (const r of ranges) {
    const p = paramsForVolume(r.volume);
    md += `| ${r.label} | ${p.baseRes} | ${formatInt(p.maxLeavesPerBatch)} | ${p.maxSamplesPerBatch ? formatInt(p.maxSamplesPerBatch) : '—'} | ${p.hysteresisNear ?? '—'} | ${p.hysteresisFar ?? '—'} |\n`;
  }
  return md;
}

// Cross-volume comparison tables ----------------------------------
function batchesVolumeTable(volumeMap) {
  const leaves = Array.from(new Set([...volumeMap.values()].flatMap(rows => rows.map(r => r.maxLeaves)))).sort((a, b) => a - b);
  let md = '| Volume |' + leaves.map(l => ` Batches (${l}) |`).join('');
  md += '\n| --- |' + leaves.map(() => ' ---: |').join('');
  md += '\n';
  const volumes = Array.from(volumeMap.keys()).sort((a, b) => a - b);
  for (const v of volumes) {
    const rowMap = new Map(volumeMap.get(v).map(r => [r.maxLeaves, r]));
    md += `| ${formatInt(v)} |`;
    for (const l of leaves) {
      const r = rowMap.get(l);
      md += ` ${r ? formatInt(r.batches) : 'N/A'} |`;
    }
    md += '\n';
  }
  return md;
}

function gasVolumeTable(volumeMap) {
  const leaves = Array.from(new Set([...volumeMap.values()].flatMap(rows => rows.map(r => r.maxLeaves)))).sort((a, b) => a - b);
  let md = '| Volume |' + leaves.map(l => ` Gas (${l}) |`).join('');
  md += '\n| --- |' + leaves.map(() => ' ---: |').join('');
  md += '\n';
  const volumes = Array.from(volumeMap.keys()).sort((a, b) => a - b);
  for (const v of volumes) {
    const rowMap = new Map(volumeMap.get(v).map(r => [r.maxLeaves, r]));
    md += `| ${formatInt(v)} |`;
    for (const l of leaves) {
      const r = rowMap.get(l);
      md += ` ${r ? formatInt(r.gas) : 'N/A'} |`;
    }
    md += '\n';
  }
  return md;
}

// Main -------------------------------------------------------------
async function main() {
  const experiments = await loadJson(experimentsFile);
  const bench = await loadJson(benchFile);
  const volumeMap = buildRowsByVolume(experiments, bench);

  let md = '# Compression Benchmark Report\n\n';
  md += '## Resumo Executivo\n';
  md += 'Os cenários abaixo destacam o equilíbrio entre custo de gas, compressão hierárquica e homogeneidade das amostras e nodes.\n';
  for (const [volume, rows] of [...volumeMap.entries()].sort((a, b) => a[0] - b[0])) {
    for (const r of rows) {
      md += `- ${r.id}: ${formatInt(r.batches)} batches, compressão ${fmt(r.compression)}x, custo ${formatInt(r.gas)} gas.\n`;
    }
  }

  for (const [volume, rows] of [...volumeMap.entries()].sort((a, b) => a[0] - b[0])) {
    const bytesArray = rows.map(r => r.bytesPerFile);
    const bytesStd = stddev(bytesArray);
    md += `\n## Volume ${formatInt(volume)}\n`;
    md += '\n### Distribuição de tamanhos de arquivo\n';
    md += fileSizeTable(rows, bytesStd);
    md += '\n### Equilíbrio de compressão\n';
    md += compressionTable(rows);
    md += '\n### Custos de gas por cenário\n';
    md += gasTable(rows);
    md += '\n### Homogeneidade\n';
    md += homogeneityTable(rows);
    const resTable = resolutionTable(rows);
    if (resTable) {
      md += '\n### Distribuição de resoluções\n';
      md += resTable;
    }
  }

  md += '\n## Comparativo de escalabilidade por volume\n';
  md += '\n### Batches por volume\n';
  md += batchesVolumeTable(volumeMap);
  md += '\n### Custos de gas por volume\n';
  md += gasVolumeTable(volumeMap);

  md += '\n## Escalonamento 10k → 1M nodes\n';
  md += scalingTable([...volumeMap.values()].flat());

  md += '\n## Parâmetros recomendados por volume\n';
  md += recommendedParamsTable();

  await fs.writeFile(reportFile, md);
  console.log(`Report written to ${reportFile}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
