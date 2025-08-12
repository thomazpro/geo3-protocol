import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import fs from 'fs/promises';
import path from 'path';

vi.mock('../src/utils/chain.js', () => ({
  getGeoBatch: vi.fn(async (_epoch, batchId) => ({
    merkleRoot: `root-${batchId}`,
    dataCID: `cid-${batchId}`,
  })),
  getCurrentEpoch: vi.fn(async () => 1),
}));

import app from '../src/index.js';

const DATA_DIR = path.join(process.cwd(), 'data');

beforeAll(async () => {
  await fs.mkdir(path.join(DATA_DIR, 'epoch_1'), { recursive: true });
  const batchData = {
    geoBatchId: 'batch1',
    epoch: 1,
    data: { cell1: ['value'] },
  };
  await fs.writeFile(
    path.join(DATA_DIR, 'epoch_1', 'batch1.json'),
    JSON.stringify(batchData),
  );
  const map = { '1': { cell1: 'batch1' } };
  await fs.writeFile(
    path.join(DATA_DIR, 'cellToBatchMap.json'),
    JSON.stringify(map),
  );
});

afterAll(async () => {
  await fs.rm(DATA_DIR, { recursive: true, force: true });
});

describe('API routes', () => {
  test('/epochs/:id', async () => {
    const res = await request(app).get('/epochs/1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      epoch: 1,
      batches: [
        {
          geoBatchId: 'batch1',
          epoch: 1,
          data: { cell1: ['value'] },
          merkleRoot: 'root-batch1',
          cid: 'cid-batch1',
        },
      ],
    });
  });

  test('/batches/:id', async () => {
    const res = await request(app).get('/batches/batch1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      geoBatchId: 'batch1',
      epoch: 1,
      data: { cell1: ['value'] },
      merkleRoot: 'root-batch1',
      cid: 'cid-batch1',
    });
  });

  test('/cells/:id', async () => {
    const res = await request(app).get('/cells/cell1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(['value']);
  });

  test('/stats', async () => {
    const res = await request(app).get('/stats');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ currentEpoch: 1, totalEpochs: 1, batches: 1 });
  });
});
