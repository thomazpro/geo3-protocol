// src/utils/ipfs.js
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { fileURLToPath } from 'url';
import { sha256Hex } from './hasher.js';
import { loadEnv } from '../config/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { pinataJwt: PINATA_JWT } = loadEnv();
const pinataUrl = 'https://api.pinata.cloud/pinning';

export function isIpfsEnabled () {
  return Boolean(PINATA_JWT);
}

/** Envia arquivo individual para IPFS via Pinata ou modo mockado */
export async function uploadFile (localPath) {
  if (!isIpfsEnabled()) {
    const mockDir = path.resolve(__dirname, '../../data/ipfs-mock', String(Date.now()));
    await fs.promises.mkdir(mockDir, { recursive: true });
    await fs.promises.copyFile(localPath, path.join(mockDir, path.basename(localPath)));
    // Hash the file contents deterministically instead of the path
    const bytes = await fs.promises.readFile(localPath);
    return sha256Hex(bytes);
  }

  const data = new FormData();
  data.append('file', fs.createReadStream(localPath));

  const res = await axios.post(`${pinataUrl}/pinFileToIPFS`, data, {
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    headers: {
      Authorization: `Bearer ${PINATA_JWT}`,
      ...data.getHeaders(),
    },
  });

  return res.data.IpfsHash; // o CID
}

/**
 * Calcula um hash determinístico para todos os arquivos de uma pasta.
 * O hash leva em conta tanto o conteúdo quanto o caminho relativo de cada arquivo.
 */
export async function hashFolder (folderPath) {
  const fileHashes = [];

  const walk = async (dir, base = '') => {
    const entries = (await fs.promises.readdir(dir, { withFileTypes: true }))
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const rel = path.posix.join(base, entry.name);
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, rel);
      } else if (entry.isFile()) {
        const bytes = await fs.promises.readFile(full);
        const fileHash = sha256Hex(bytes);
        fileHashes.push(`${rel}:${fileHash}`);
      }
    }
  };

  await walk(folderPath);
  fileHashes.sort();
  return sha256Hex(fileHashes.join('|'));
}

/** Envia uma pasta completa para IPFS */
export async function uploadFolder (folderPath) {
  if (!isIpfsEnabled()) {
    const mockDir = path.resolve(__dirname, '../../data/ipfs-mock', String(Date.now()));
    await fs.promises.mkdir(mockDir, { recursive: true });
    await fs.promises.cp(folderPath, mockDir, { recursive: true });
    return await hashFolder(folderPath);
  }

  const data = new FormData();

  const walk = async (dir, base = '') => {
    const entries = (await fs.promises.readdir(dir, { withFileTypes: true }))
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const rel = path.posix.join(base, entry.name);
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, rel);
      } else if (entry.isFile()) {
        data.append('file', fs.createReadStream(full), {
          filepath: path.posix.join('data', rel), // precisa manter estrutura relativa
        });
      }
    }
  };

  await walk(folderPath);

  const res = await axios.post(`${pinataUrl}/pinFileToIPFS`, data, {
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    headers: {
      Authorization: `Bearer ${PINATA_JWT}`,
      ...data.getHeaders(),
    },
  });

  return res.data.IpfsHash;
}
