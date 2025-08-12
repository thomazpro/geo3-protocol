// src/utils/hgc.js  –  versão com nível correto e limites duplos (células e volume)
import * as h3 from 'h3-js'
import keccak256 from 'keccak256'
import { MerkleTree } from 'merkletreejs'
import { sha256HexCanonical, merkleRootAndIndex } from './hasher.js'
import { loadHgcConfig } from '../config/index.js'
import { compressTopDown, cellIdComparator } from './grouping.js'
import { validateSample } from './validation.js'

/* parâmetros principais carregados de configuração */
export const HGC_DEFAULT_PARAMS = loadHgcConfig()
export const BASE_RES = HGC_DEFAULT_PARAMS.baseRes
export const MIN_RES = HGC_DEFAULT_PARAMS.minRes
export const MAX_LEAVES_PER_BATCH = HGC_DEFAULT_PARAMS.maxLeavesPerBatch
export const MAX_SAMPLES_PER_BATCH = HGC_DEFAULT_PARAMS.maxSamplesPerBatch
export const HYSTERESIS_NEAR = HGC_DEFAULT_PARAMS.hysteresisNear
export const HYSTERESIS_FAR = HGC_DEFAULT_PARAMS.hysteresisFar
export const ESTIMATED_VOLUME = HGC_DEFAULT_PARAMS.volume

const WINDOW_MS = 60 * 60 * 1000 // 1h
export const SCHEMA_VERSION = 1

function percentile(arr, p) {
  if (!arr.length) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = Math.ceil(p * sorted.length) - 1
  return sorted[idx >= 0 ? idx : 0]
}

/* === API principal === */
/**
 * Execute the Hierarchical Geo Compressor over a list of samples.
 * @param {object[]} samples - Array of sensor samples.
 * @param {number} epoch - Epoch number being processed.
 * @param {object} [params=HGC_DEFAULT_PARAMS] - HGC configuration parameters.
 * @param {{onInvalid?: 'throw' | 'mark' | 'discard'}} [options] - How to handle invalid samples.
 * @returns {{batches: object[], map: Object, superRoot: string, summary: Object, invalidSamples: object[], hgcParams: object}}
 *   Resulting batches, mappings and metadata.
 */
export function runHGC(samples, epoch, params = HGC_DEFAULT_PARAMS, { onInvalid = 'throw' } = {}) {
  const { baseRes } = params
  // 1. mapear leituras por geoCellId (folhas res8)
  //    - normaliza ids para res8
  //    - remove duplicados por (issuer,timestamp) ou hash do conteúdo
  //    - valida valores
  const tmpByCell = {}
  const invalidSamples = []
  for (const s of samples) {
    const topErrors = validateSample(s)
    if (topErrors.length) {
      if (onInvalid === 'throw') throw new Error(topErrors.join('; '))
      if (onInvalid === 'mark') invalidSamples.push({ ...s, errors: topErrors })
      continue
    }

    let id = s.geoCellId
    if (h3.getResolution(id) !== baseRes) id = h3.cellToParent(id, baseRes)

    if (!tmpByCell[id]) tmpByCell[id] = new Map()
    const cellMap = tmpByCell[id]

    const key = (s.issuer !== undefined && s.timestamp !== undefined)
      ? `${s.issuer}-${s.timestamp}`
      : sha256HexCanonical({ ...s, geoCellId: id })
    if (cellMap.has(key)) continue

    const arr = Array.isArray(s.samples) ? s.samples : [s]
    const validArr = []
    for (const sample of arr) {
      const errors = validateSample({ ...sample, geoCellId: id })
      if (errors.length) {
        if (onInvalid === 'throw') throw new Error(errors.join('; '))
        if (onInvalid === 'mark') invalidSamples.push({ ...sample, geoCellId: id, errors })
        if (onInvalid === 'discard') continue
      } else {
        validArr.push(sample)
      }
    }

    if (!validArr.length) continue
    const payload = Array.isArray(s.samples)
      ? { ...s, geoCellId: id, samples: validArr }
      : { ...s, geoCellId: id }
    cellMap.set(key, payload)
  }

  const entriesByCell = {}
  for (const [cell, map] of Object.entries(tmpByCell)) {
    entriesByCell[cell] = Array.from(map.values())
      .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
  }

  const allCells = Object.keys(entriesByCell)
  allCells.sort(cellIdComparator)
  const sampleCountByCell = Object.fromEntries(
    allCells.map(id => [
      id,
      entriesByCell[id].reduce((sum, entry) => {
        return sum + (Array.isArray(entry.samples) ? entry.samples.length : 1)
      }, 0)
    ])
  )

  // 2. compressão hierárquica adaptativa
  const compressed = compressTopDown(allCells, sampleCountByCell, undefined, false, params)

  // 3. construir geoBatches + cellToBatchMap
  const batches = []
  const map     = {}

  for (const { res, cells } of compressed) {
    // o pai é a célula em "res" que contém os filhos res8
    const parent = h3.cellToParent(cells[0], res)

    const sortedCells = [...cells].sort(cellIdComparator)
    const dataObj = {}
    let countSamples = 0
    let tsMin = Infinity
    let tsMax = -Infinity

    for (const cell of sortedCells) {
      const arr = entriesByCell[cell]
      dataObj[cell] = arr
      map[cell]     = parent
      countSamples += arr.reduce((s, e) => s + (Array.isArray(e.samples) ? e.samples.length : 1), 0)
      if (arr.length) {
        const localMin = arr[0].timestamp ?? Infinity
        const localMax = arr[arr.length - 1].timestamp ?? -Infinity
        if (localMin < tsMin) tsMin = localMin
        if (localMax > tsMax) tsMax = localMax
      }
    }

    const countLeaves = sortedCells.length
    const { root: merkleRoot, leavesIndex } = merkleRootAndIndex(dataObj)
    const center = h3.cellToLatLng(parent)
    const boundary = h3.cellToBoundary(parent)

    const batchObj = {
      geoBatchId     : parent,
      epoch,
      compressedFrom : sortedCells,
      data           : dataObj,
      countLeaves,
      countSamples,
      tsMin: tsMin === Infinity ? null : tsMin,
      tsMax: tsMax === -Infinity ? null : tsMax,
      center,
      boundary,
      resBase: baseRes,
      resBatch: res,
      epochStartMs: epoch * WINDOW_MS,
      windowMs: WINDOW_MS,
      schemaVersion: SCHEMA_VERSION,
      hgcParams: params,
      merkleRoot,
      leavesIndex
    }

    batchObj.hash = sha256HexCanonical(batchObj)
    batches.push(batchObj)
  }

  const { superRoot } = computeEpochSuperRoot(batches)
  const leavesArr = batches.map(b => b.countLeaves)
  const samplesArr = batches.map(b => b.countSamples)
  const batchesTotal = batches.length
  const avgLeaves = batchesTotal ? leavesArr.reduce((s, n) => s + n, 0) / batchesTotal : 0
  const avgSamples = batchesTotal ? samplesArr.reduce((s, n) => s + n, 0) / batchesTotal : 0
  const p95Leaves = percentile(leavesArr, 0.95)
  const p95Samples = percentile(samplesArr, 0.95)
  const summary = { batchesTotal, avgLeaves, p95Leaves, avgSamples, p95Samples }

  return { batches, map, superRoot, summary, invalidSamples, hgcParams: params }
}

/* adiciona merkleRoots in-place, se ainda não definidos */
export function addMerkleRoots(batches) {
  for (const b of batches) {
    if (b.merkleRoot && b.leavesIndex) continue
    const { root, leavesIndex } = merkleRootAndIndex(b.data)
    b.merkleRoot = root
    b.leavesIndex = leavesIndex
  }
}

/* gera super-root do epoch a partir dos geoBatches */
export function computeEpochSuperRoot(batches) {
  const sorted = [...batches].sort((a, b) => cellIdComparator(a.geoBatchId, b.geoBatchId))
  const batchIds = sorted.map(b => b.geoBatchId)
  const batchRoots = sorted.map(b => b.merkleRoot)
  const leaves = sorted.map(b => keccak256(b.geoBatchId + b.merkleRoot))
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true })
  return { superRoot: tree.getHexRoot(), batchIds, batchRoots }
}
