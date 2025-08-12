import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { getGeoBatch, getCurrentEpoch } from './utils/chain.js';

const app = express();
app.use(cors());

const DATA_DIR = path.join(process.cwd(), 'data');

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    throw new Error(`Failed to read JSON from ${filePath}: ${err.message}`);
  }
}

async function readDir(dirPath) {
  try {
    return await fs.readdir(dirPath);
  } catch (err) {
    throw new Error(`Failed to read directory ${dirPath}: ${err.message}`);
  }
}

async function loadBatch(epoch, batchId) {
  const file = path.join(DATA_DIR, `epoch_${epoch}`, `${batchId}.json`);
  if (!(await pathExists(file))) return null;
  return await readJson(file);
}

app.get('/epochs/:id', async (req, res) => {
  const epoch = parseInt(req.params.id);
  const dir = path.join(DATA_DIR, `epoch_${epoch}`);
  if (!(await pathExists(dir)))
    return res.status(404).json({ error: 'epoch not found' });
  try {
    const files = (await readDir(dir)).filter((f) => f.endsWith('.json'));
    const batches = [];
    for (const file of files) {
      const data = await readJson(path.join(dir, file));
      const meta = await getGeoBatch(epoch, data.geoBatchId);
      batches.push({ ...data, merkleRoot: meta.merkleRoot, cid: meta.dataCID });
    }
    res.json({ epoch, batches });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/batches/:id', async (req, res) => {
  const batchId = req.params.id;
  try {
    const dirs = (await readDir(DATA_DIR)).filter((d) => d.startsWith('epoch_'));
    for (const dir of dirs) {
      const epoch = parseInt(dir.split('_')[1]);
      const file = path.join(DATA_DIR, dir, `${batchId}.json`);
      if (await pathExists(file)) {
        const data = await readJson(file);
        const meta = await getGeoBatch(epoch, batchId);
        return res.json({
          epoch,
          ...data,
          merkleRoot: meta.merkleRoot,
          cid: meta.dataCID,
        });
      }
    }
    res.status(404).json({ error: 'batch not found' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/cells/:id', async (req, res) => {
  const cell = req.params.id;
  try {
    const mapPath = path.join(DATA_DIR, 'cellToBatchMap.json');
    if (!(await pathExists(mapPath)))
      return res.status(404).json({ error: 'map not found' });
    const epoch = await getCurrentEpoch();
    const map = await readJson(mapPath);
    const batchId = map[epoch]?.[cell];
    if (!batchId) return res.status(404).json({ error: 'cell not found' });
    const batch = await loadBatch(epoch, batchId);
    if (!batch) return res.status(404).json({ error: 'batch not found' });
    res.json(batch.data[cell] || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/stats', async (_req, res) => {
  try {
    const epoch = await getCurrentEpoch();
    const dirs = (await readDir(DATA_DIR)).filter((d) => d.startsWith('epoch_'));
    const dir = path.join(DATA_DIR, `epoch_${epoch}`);
    const batches = (await pathExists(dir)) ? (await readDir(dir)).length : 0;
    res.json({ currentEpoch: epoch, totalEpochs: dirs.length, batches });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = process.env.PORT || 3001;
  app.listen(port, () => console.log(`API running on port ${port}`));
}

export default app;
