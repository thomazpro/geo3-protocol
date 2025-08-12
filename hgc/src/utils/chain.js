import { ethers } from 'ethers';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEnv } from '../config/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let signer;
let geoDataRegistry;
let nodeDIDRegistry;
let rewardManager;
const config = loadEnv();

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isChainEnabled() {
  return (
    !!config.polygonRpcUrl &&
    !!config.privateKey &&
    !!config.geoDataRegistry &&
    !!config.nodeDidRegistry &&
    !!config.geoRewardManager
  );
}

async function initChain() {
  if (!isChainEnabled() || geoDataRegistry) return;
  const provider = new ethers.JsonRpcProvider(config.polygonRpcUrl);
  signer = new ethers.Wallet(config.privateKey, provider);

  const abiDir = path.resolve(__dirname, '../..', 'abi');

  const geoDataAbi = JSON.parse(
    await fs.readFile(path.join(abiDir, 'GeoDataRegistry.json'), 'utf8'),
  ).abi;
  const didAbi = JSON.parse(
    await fs.readFile(path.join(abiDir, 'NodeDIDRegistry.json'), 'utf8'),
  ).abi;
  const rewardAbi = JSON.parse(
    await fs.readFile(path.join(abiDir, 'GeoRewardManager.json'), 'utf8'),
  ).abi;

  geoDataRegistry = new ethers.Contract(
    config.geoDataRegistry,
    geoDataAbi,
    signer,
  );
  nodeDIDRegistry = new ethers.Contract(config.nodeDidRegistry, didAbi, signer);
  rewardManager = new ethers.Contract(
    config.geoRewardManager,
    rewardAbi,
    signer,
  );
}

export async function registerGeoBatch(epoch, geoBatchId, merkleRoot, cid) {
  if (!isChainEnabled()) {
    const filePath = path.resolve(__dirname, '../..', 'data', 'mock-chain.json');
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    let data = [];
    if (await fileExists(filePath)) {
      data = JSON.parse(await fs.readFile(filePath, 'utf8'));
    }
    data.push({ epoch, geoBatchId, merkleRoot, cid });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    console.log('MOCK registerGeoBatch');
    return;
  }

  await initChain();
  const tx = await geoDataRegistry.registerGeoBatchBulk(
    [geoBatchId],
    [merkleRoot],
    [cid],
  );
  await tx.wait();
}

export async function getGeoBatch(epoch, batchId) {
  if (!isChainEnabled()) return null;
  await initChain();
  return geoDataRegistry.getGeoBatch(epoch, batchId);
}

export async function getCurrentEpoch() {
  if (!isChainEnabled()) return null;
  await initChain();
  return geoDataRegistry.currentEpoch();
}

export { geoDataRegistry, nodeDIDRegistry, rewardManager, isChainEnabled };
