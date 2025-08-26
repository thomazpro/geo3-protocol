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

/** Upload individual file to IPFS via Pinata or mocked mode */
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
* Calculates a deterministic hash for all files in a folder.
* The hash takes into account both the content and the relative path of each file.
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

/** Uploads a complete folder to IPFS */
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
          filepath: path.posix.join('data', rel),
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
