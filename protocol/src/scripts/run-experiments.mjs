import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const protocolDir = path.resolve(__dirname, '..', '..');
const repoRoot = path.resolve(protocolDir, '..');
const hgcDir = path.resolve(repoRoot, 'hgc');
const reportsDataDir = path.join(repoRoot, 'reports', 'data');

const defaultVolumes = [1000, 5000, 10000, 50000, 100000, 500000, 1000000];
const volumesArg = process.argv.find(a => a.startsWith('--volumes='));
const volumes = volumesArg
  ? volumesArg
      .split('=')[1]
      .split(',')
      .map(v => parseInt(v, 10))
  : defaultVolumes;

function paramSetsForVolume(volume) {
  if (volume < 5000) {
    return [{ baseRes: 8, maxLeavesPerBatch: 1024 }];
  }
  if (volume < 50000) {
    return [
      {
        baseRes: 8,
        maxLeavesPerBatch: 4096,
        maxSamplesPerBatch: 16000,
        hysteresisNear: 0.9,
        hysteresisFar: 1.1
      }
    ];
  }
  return [
    {
      baseRes: 8,
      maxLeavesPerBatch: 8192,
      maxSamplesPerBatch: 32000,
      hysteresisNear: 0.95,
      hysteresisFar: 1.05
    }
  ];
}

const paramSetsArg = process.argv.find(a => a.startsWith('--paramSets='));
const samplesPerNode = 12;

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', ...options });
    p.on('close', code => {
      if (code !== 0) reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`));
      else resolve();
    });
  });
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

async function readJson(file) {
  try {
    const data = await fs.readFile(file, 'utf8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function saveRecord(record) {
  await fs.mkdir(reportsDataDir, { recursive: true });
  const jsonFile = path.join(reportsDataDir, 'experiments.json');
  const records = await readRecords(jsonFile);
  records.push(record);
  await fs.writeFile(jsonFile, JSON.stringify(records, null, 2));
}

async function timedRun(cmd, args, opts) {
  const start = Date.now();
  await run(cmd, args, opts);
  return Date.now() - start;
}

async function main() {
  let epoch = 1;
  for (const volume of volumes) {
    let paramSets = paramSetsForVolume(volume);
    if (paramSetsArg) {
      try {
        paramSets = JSON.parse(paramSetsArg.split('=')[1]);
      } catch {
        console.error('Invalid paramSets JSON, using defaults for volume', volume);
      }
    }
    await saveRecord({ volume, generatedParamSets: paramSets });
    for (const params of paramSets) {
      const seed = Math.floor(Math.random() * 1e9);
      const paramArgs = Object.entries(params).map(([k, v]) => `--${k}=${v}`);

      const times = {};
      const record = {
        epoch,
        volume,
        params,
        seed,
        times,
        nodesProcessed: null,
        samplesGenerated: null,
        error: null
      };

      try {
        await fs.rm(path.join(hgcDir, 'data'), { recursive: true, force: true });
        times.nodes = await timedRun('npm', ['run', 'nodes', '--', `--nodes=${volume}`], { cwd: hgcDir });
        const nodesMeta = await readJson(path.join(hgcDir, 'data', 'nodes_meta.json'));
        if (nodesMeta) record.nodesProcessed = nodesMeta.nodes;

        times.samples = await timedRun(
          'npm',
          ['run', 'samples', '--', `--epoch=${epoch}`, `--samples=${samplesPerNode}`, `--seed=${seed}`],
          { cwd: hgcDir }
        );
        const sampleMeta = await readJson(
          path.join(
            hgcDir,
            'data',
            `samples_epoch_${String(epoch).padStart(5, '0')}_meta.json`
          )
        );
        if (sampleMeta) {
          record.samplesGenerated = sampleMeta.nodes * sampleMeta.nSamples;
        }

        const sampleSrc = path.join(
          hgcDir,
          'data',
          `samples_epoch_${String(epoch).padStart(5, '0')}.json`
        );
        const sampleDest = path.join(protocolDir, `samples_epoch_${epoch}.json`);
        await fs.copyFile(sampleSrc, sampleDest);
        times.epoch = await timedRun(
          'node',
          ['src/scripts/run-epoch.mjs', `--epoch=${epoch}`, ...paramArgs],
          { cwd: hgcDir }
        );
        const epochSrcDir = path.join(hgcDir, 'data', `epoch_${epoch}`);
        const epochDestDir = path.join(protocolDir, 'data', `epoch_${epoch}`);
        await fs.cp(epochSrcDir, epochDestDir, { recursive: true });
        times.bench = await timedRun('npm', ['run', 'bench', '--', String(epoch)], { cwd: protocolDir });
      } catch (err) {
        record.error = err.message;
      }

      await saveRecord(record);

      epoch += 1;
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
