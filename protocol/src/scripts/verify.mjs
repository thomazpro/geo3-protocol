import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import keccak256 from 'keccak256'
import { MerkleTree } from 'merkletreejs'
import { canonical, sha256Hex, merkleRootAndIndex } from '../../../hgc/src/utils/hash-helpers.js'

function sha256HexCanonical (obj) {
  return sha256Hex(canonical(obj))
}

export async function verifyFile (file) {
  try {
    const raw = await fs.readFile(file, 'utf8')
    const json = JSON.parse(raw)
    const { hash: storedSha } = json
    const objNoHash = { ...json }
    delete objNoHash.hash

    const computedSha = sha256HexCanonical(objNoHash)
    const { root: computedMerkle } = merkleRootAndIndex(objNoHash.data)

    const shaOk = computedSha === storedSha
    const merkleOk = computedMerkle === objNoHash.merkleRoot

    if (shaOk && merkleOk) {
      return { file, ok: true }
    }

    const errors = []
    if (!shaOk) errors.push(`hash mismatch: expected ${storedSha}, got ${computedSha}`)
    if (!merkleOk) errors.push(`merkleRoot mismatch: expected ${objNoHash.merkleRoot}, got ${computedMerkle}`)
    return { file, ok: false, errors }
  } catch (err) {
    return { file, ok: false, errors: [err.message] }
  }
}

export async function verifySuperRootFile (file) {
  try {
    const raw = await fs.readFile(file, 'utf8')
    const json = JSON.parse(raw)
    const { superRoot: storedRoot, batchIds: storedIds, batchRoots: storedRoots } = json

    const dir = path.dirname(file)
    const entries = await fs.readdir(dir, { withFileTypes: true })
    const batches = []
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'superRoot.json') {
        const batchRaw = await fs.readFile(path.join(dir, entry.name), 'utf8')
        const batchJson = JSON.parse(batchRaw)
        const { geoBatchId, merkleRoot } = batchJson
        if (geoBatchId && merkleRoot) {
          batches.push({ geoBatchId, merkleRoot })
        }
      }
    }

    const sorted = batches.sort((a, b) => a.geoBatchId.localeCompare(b.geoBatchId))
    const computedIds = sorted.map(b => b.geoBatchId)
    const computedRoots = sorted.map(b => b.merkleRoot)
    const leaves = sorted.map(b => keccak256(b.geoBatchId + b.merkleRoot))
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true })
    const computedRoot = tree.getHexRoot()

    const superOk = storedRoot === computedRoot
    const idsOk = JSON.stringify(storedIds) === JSON.stringify(computedIds)
    const rootsOk = JSON.stringify(storedRoots) === JSON.stringify(computedRoots)

    if (superOk && idsOk && rootsOk) {
      return { file, ok: true }
    }

    const errors = []
    if (!superOk) errors.push(`superRoot mismatch: expected ${storedRoot}, got ${computedRoot}`)
    if (!idsOk) errors.push('batchIds mismatch')
    if (!rootsOk) errors.push('batchRoots mismatch')
    return { file, ok: false, errors }
  } catch (err) {
    return { file, ok: false, errors: [err.message] }
  }
}

export async function verifyDir (dir) {
  const targetDir = path.resolve(dir)
  const entries = await fs.readdir(targetDir, { withFileTypes: true })
  const results = []
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.json')) {
      const fullPath = path.join(targetDir, entry.name)
      if (entry.name === 'superRoot.json') {
        results.push(await verifySuperRootFile(fullPath))
      } else {
        results.push(await verifyFile(fullPath))
      }
    }
  }
  return results
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  let dirArg
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dir' && args[i + 1]) {
      dirArg = args[i + 1]
      i++
    }
  }

  if (!dirArg) {
    console.error('Usage: node src/scripts/verify.mjs --dir <directory>')
    process.exit(1)
  }

  verifyDir(dirArg).then(results => {
    for (const r of results) {
      console.log(`${path.basename(r.file)}: ${r.ok ? 'verified' : 'failed'}`)
      if (!r.ok && r.errors) {
        for (const e of r.errors) {
          console.log(`  ${e}`)
        }
      }
    }
    const ok = results.every(r => r.ok)
    process.exit(ok ? 0 : 1)
  }).catch(err => {
    console.error(err)
    process.exit(1)
  })
}

