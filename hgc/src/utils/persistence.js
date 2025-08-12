import fs from 'fs'
import path from 'path'
import { sha256HexCanonical } from './hasher.js'
import { computeEpochSuperRoot, SCHEMA_VERSION } from './hgc.js'
import { cellIdComparator } from './grouping.js'

/**
 * Persist HGC results to disk.
 * @param {{batches:object[], map:Object, hgcParams:Object, meta?:Object}} result - HGC output.
 * @param {number} epoch - Epoch number associated with the results.
 * @param {string} [baseDir=process.cwd()] - Base directory for persistence.
 * @returns {Promise<object>} Super-root payload saved to disk.
 */
export async function saveResults ({ batches, map, hgcParams, meta = {} }, epoch, baseDir = process.cwd()) {
  const dir = path.join(baseDir, 'data', `epoch_${epoch}`)
  await fs.promises.mkdir(dir, { recursive: true })

  for (const b of batches) {
    const payload = { ...b }
    if (b.merkleRoot) payload.merkleRoot = b.merkleRoot
    await fs.promises.writeFile(
      path.join(dir, `${b.geoBatchId}.json`),
      JSON.stringify(payload, null, 2)
    )
  }
  const { superRoot, batchIds, batchRoots } = computeEpochSuperRoot(batches)
  const tsMin = batches.reduce((m, b) => (b.tsMin !== null && b.tsMin < m ? b.tsMin : m), Infinity)
  const tsMax = batches.reduce((m, b) => (b.tsMax !== null && b.tsMax > m ? b.tsMax : m), -Infinity)
  const samplesTotal = batches.reduce((s, b) => s + (b.countSamples || 0), 0)
  const superPayload = {
    epoch,
    superRoot,
    batchIds,
    batchRoots,
    schemaVersion: SCHEMA_VERSION,
    hgcParams,
    ...meta,
    tsMin: tsMin === Infinity ? null : tsMin,
    tsMax: tsMax === -Infinity ? null : tsMax,
    batchesTotal: batches.length,
    samplesTotal
  }
  await fs.promises.writeFile(path.join(dir, 'superRoot.json'), JSON.stringify(superPayload, null, 2))

  const mapPath = path.join(baseDir, 'data', 'cellToBatchMap.json')
  let merged = {}
  try {
    const existing = await fs.promises.readFile(mapPath, 'utf8')
    merged = JSON.parse(existing)
  } catch (e) {
    // ignore missing file or parse errors
  }

  if (!merged[epoch]) merged[epoch] = {}
  const epochMap = merged[epoch]

  for (const [cell, batchId] of Object.entries(map)) {
    if (epochMap[cell] && epochMap[cell] !== batchId) {
      throw new Error(`celula ${cell} já mapeada para ${epochMap[cell]} (novo: ${batchId})`)
    }
    epochMap[cell] = batchId
  }

  const sortedMap = {}
  for (const e of Object.keys(merged).sort((a, b) => Number(a) - Number(b))) {
    const cells = merged[e]
    const sortedCells = {}
    for (const key of Object.keys(cells).sort(cellIdComparator)) {
      sortedCells[key] = cells[key]
    }
    sortedMap[e] = sortedCells
  }
  await fs.promises.writeFile(mapPath, JSON.stringify(sortedMap, null, 2))
  const hash = sha256HexCanonical(sortedMap)
  const cellCount = Object.values(sortedMap).reduce((s, m) => s + Object.keys(m).length, 0)
  console.log(`✅ HGC: ${batches.length} geoBatches salvos • map contém ${cellCount} células em ${Object.keys(sortedMap).length} epochs • hash ${hash}`)
  return superPayload
}

