import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outFile = path.join(__dirname, 'archives', 'sensitivity-table.md');

// Dataset derived from REPORT.md comparative table
const scenarios = [
  { id: 'S1', numBatches: 80, avgLeaves: 25, bytesBatches: 300000 },
  { id: 'S2', numBatches: 60, avgLeaves: 30, bytesBatches: 250000 },
  { id: 'S3', numBatches: 120, avgLeaves: 40, bytesBatches: 500000 },
  { id: 'S4', numBatches: 300, avgLeaves: 60, bytesBatches: 1600000 },
  { id: 'S5', numBatches: 600, avgLeaves: 75, bytesBatches: 3000000 },
  { id: 'S6', numBatches: 100, avgLeaves: 35, bytesBatches: 450000 },
  // Projeção baseada no cenário S6 para 1 milhão de nodes
  { id: 'S7', numBatches: 50000, avgLeaves: 35, bytesBatches: 225000000 }
];

const GAS_BASE_TX = 21000;
const GAS_PER_BYTE = 16;
const GAS_PER_LEAF = 50;

const gasPrices = [20, 50, 100]; // gwei
const maxLeavesOptions = [50, 100];

function format(num, digits = 0) {
  return Number(num).toFixed(digits);
}

function analyze() {
  let md = '| Scenario | gasPrice(gwei) | MAX_LEAVES | gasPerBatch | gasTotalEpoch | costEthEpoch |\n';
  md += '| --- | --- | --- | --- | --- | --- |\n';
  for (const s of scenarios) {
    for (const price of gasPrices) {
      for (const maxLeaves of maxLeavesOptions) {
        const avgLeaves = Math.min(s.avgLeaves, maxLeaves);
        const bytesPerBatch = s.bytesBatches / s.numBatches;
        const gasPerBatch = GAS_BASE_TX + bytesPerBatch * GAS_PER_BYTE + avgLeaves * GAS_PER_LEAF;
        const gasTotal = gasPerBatch * s.numBatches;
        const costEth = gasTotal * price * 1e-9;
        md += `| ${s.id} | ${price} | ${maxLeaves} | ${format(gasPerBatch)} | ${format(gasTotal)} | ${format(costEth,6)} |\n`;
      }
    }
  }
  mkdirSync(path.dirname(outFile), { recursive: true });
  writeFileSync(outFile, md);
  console.log(md);
}

analyze();
