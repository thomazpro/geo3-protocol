import * as h3 from 'h3-js'
import { loadHgcConfig } from '../config/index.js'

export const HGC_DEFAULT_PARAMS = loadHgcConfig()

/**
 * Group cell IDs by their parent at a given resolution.
 * @param {string[]} cellIds - Array of H3 cell IDs.
 * @param {number} parentRes - Resolution of the parent cell.
 * @returns {Record<string, string[]>} Map of parent cell to its children IDs.
 */
export function groupByParent (cellIds, parentRes) {
  const buckets = {}
  for (const id of cellIds) {
    const parent = h3.cellToParent(id, parentRes)
    if (!buckets[parent]) buckets[parent] = []
    buckets[parent].push(id)
  }
  return buckets
}

/**
 * Compare two H3 cell IDs using locale string order.
 * @param {string} a - First cell ID.
 * @param {string} b - Second cell ID.
 * @returns {number} Comparison result for Array.sort.
 */
export const cellIdComparator = (a, b) => a.localeCompare(b)

function sortChildren (children, parent, params, useLocalIj = false, resForChildren = params.baseRes) {
  const arr = [...children]
  if (!useLocalIj) {
    arr.sort(cellIdComparator)
    return arr
  }

  try {
    const origin = h3.cellToCenterChild(parent, resForChildren)
    arr.sort((a, b) => {
      try {
        const { i: ia, j: ja } = h3.cellToLocalIj(origin, a)
        const { i: ib, j: jb } = h3.cellToLocalIj(origin, b)
        return ia - ib || ja - jb || cellIdComparator(a, b)
      } catch {
        return cellIdComparator(a, b)
      }
    })
  } catch {
    arr.sort(cellIdComparator)
  }
  return arr
}

function chunkStable (childrenSorted, volumes, maxLeaves, maxVolume) {
  const chunks = []
  let current = []
  let leaves = 0
  let volume = 0

  for (let i = 0; i < childrenSorted.length; i++) {
    const child = childrenSorted[i]
    const childLeaves = Array.isArray(child) ? child.length : 1
    const childVol = volumes[i]

    if (current.length && (leaves + childLeaves > maxLeaves || volume + childVol > maxVolume)) {
      chunks.push(current)
      current = []
      leaves = 0
      volume = 0
    }

    current.push(child)
    leaves += childLeaves
    volume += childVol
  }

  if (current.length) chunks.push(current)
  return chunks
}

/**
 * Recursively compress cell IDs into batches respecting limits.
 * @param {string[]} cellIds - Array of leaf cell IDs.
 * @param {Record<string, number>} sampleCountByCell - Sample count per cell.
 * @param {number} [currentRes] - Resolution currently processed.
 * @param {boolean} [useLocalIj=false] - Whether to sort children using local IJ.
 * @param {object} [params=HGC_DEFAULT_PARAMS] - Compression parameters.
 * @returns {{res:number,cells:string[]}[]} Array of batches with resolution and cell IDs.
 */
export function compressTopDown (cellIds, sampleCountByCell, currentRes, useLocalIj = false, params = HGC_DEFAULT_PARAMS) {
  if (currentRes === undefined) currentRes = params.minRes
  const { baseRes, maxLeavesPerBatch, maxSamplesPerBatch, hysteresisFar } = params

  if (currentRes === baseRes) {
    return [{ res: currentRes, cells: cellIds }]
  }

  const groups = groupByParent(cellIds, currentRes)
  const sampleSumByGroup = {}
  for (const [parent, children] of Object.entries(groups)) {
    sampleSumByGroup[parent] = children.reduce((sum, id) => sum + sampleCountByCell[id], 0)
  }
  const batches = []

  for (const [parent, children] of Object.entries(groups)) {
    const leaves = children.length
    const volumeSamples = sampleSumByGroup[parent]

    const tooBig =
      leaves > maxLeavesPerBatch * hysteresisFar ||
      volumeSamples > maxSamplesPerBatch * hysteresisFar

    if (!tooBig || currentRes + 1 > baseRes) {
      const sortedLeaves = sortChildren(children, parent, params, useLocalIj, baseRes)
      batches.push({ res: currentRes, cells: sortedLeaves })
      continue
    }

    const nextGroups = groupByParent(children, currentRes + 1)
    const nextCounts = {}
    for (const [p, arr] of Object.entries(nextGroups)) {
      nextCounts[p] = arr.reduce((s, cid) => s + sampleCountByCell[cid], 0)
      nextGroups[p] = sortChildren(arr, p, params, useLocalIj, baseRes)
    }
    const nextIds = sortChildren(Object.keys(nextGroups), parent, params, useLocalIj, currentRes + 1)
    const groupsArray = nextIds.map(id => nextGroups[id])
    const volumesArray = nextIds.map(id => nextCounts[id])
    const chunks = chunkStable(
      groupsArray,
      volumesArray,
      maxLeavesPerBatch,
      maxSamplesPerBatch
    )

    for (const chunk of chunks) {
      const nested = chunk.flat()
      batches.push(...compressTopDown(nested, sampleCountByCell, currentRes + 1, useLocalIj, params))
    }
  }

  return batches
}

