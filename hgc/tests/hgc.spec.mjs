import { describe, test, expect } from 'vitest'
import * as h3 from 'h3-js'
import { performance } from 'perf_hooks'
import { runHGC, MAX_LEAVES_PER_BATCH, MAX_SAMPLES_PER_BATCH, HYSTERESIS_FAR, computeEpochSuperRoot } from '../src/utils/hgc.js'
import { compressTopDown } from '../src/utils/grouping.js'
import { sha256HexCanonical } from '../src/utils/hasher.js'

function buildSamples (radius = 18) {
  const start = h3.latLngToCell(0, 0, 8)
  const cells = h3.gridDisk(start, radius)
  const samples = []
  for (const cell of cells) {
    for (let i = 0; i < 4; i++) {
      samples.push({ geoCellId: cell, v: i, timestamp: i })
    }
  }
  return { cells, samples }
}

function radiusForCells (minCells) {
  let r = 0
  while (1 + 3 * r * (r + 1) < minCells) r++
  return r
}

describe('HGC', () => {
  test('cells mapped once and respect limits', () => {
    const { samples } = buildSamples()
    const { batches, map, summary } = runHGC(samples, 1)

    const seen = {}
    expect(summary.batchesTotal).toBe(batches.length)
    for (const batch of batches) {
      for (const cell of batch.compressedFrom) {
        expect(seen[cell]).toBeUndefined()
        seen[cell] = batch.geoBatchId
        expect(map[cell]).toBe(batch.geoBatchId)
      }
      expect(batch.compressedFrom.length).toBeLessThanOrEqual(MAX_LEAVES_PER_BATCH * HYSTERESIS_FAR)
      const sampleCount = Object.values(batch.data).reduce(
        (s, arr) =>
          s + arr.reduce((sum, e) => sum + (Array.isArray(e.samples) ? e.samples.length : 1), 0),
        0
      )
      expect(sampleCount).toBeLessThanOrEqual(MAX_SAMPLES_PER_BATCH * HYSTERESIS_FAR)
    }
  })

  test('determinism', () => {
    const { samples } = buildSamples()
    const run1 = runHGC(samples, 1)
    const run2 = runHGC(samples, 1)
    const run3 = runHGC(samples, 1)
    expect(run2.superRoot).toBe(run1.superRoot)
    expect(run3.superRoot).toBe(run1.superRoot)
    const hashes = run1.batches.map(b => b.hash)
    expect(run2.batches.map(b => b.hash)).toEqual(hashes)
    expect(run3.batches.map(b => b.hash)).toEqual(hashes)
  })

  test('stability to sample order', () => {
    const { samples } = buildSamples()
    const reversed = [...samples].reverse()
    const runA = runHGC(samples, 1)
    const runB = runHGC(reversed, 1)
    expect(runB).toEqual(runA)
  })

  test('deduplicates samples missing issuer or timestamp', () => {
    const cell = h3.latLngToCell(0, 0, 8)
    const samples = [
      { geoCellId: cell, pm25: 1 },
      { geoCellId: cell, pm25: 1 },
      { geoCellId: cell, pm25: 2, issuer: 'a' },
      { geoCellId: cell, pm25: 2, issuer: 'a' },
      { geoCellId: cell, pm25: 3, timestamp: 1 },
      { geoCellId: cell, pm25: 3, timestamp: 1 }
    ]
    const { batches } = runHGC(samples, 1)
    const data = batches[0].data[cell]
    expect(data.length).toBe(3)
    const values = data.map(s => s.pm25).sort((a, b) => a - b)
    expect(values).toEqual([1, 2, 3])
  })

  test('invalid geoCellId throws', () => {
    const bad = { geoCellId: 'abc', pm25: 1 }
    expect(() => runHGC([bad], 1)).toThrow(/geoCellId/)
  })

  test('invalid pm25 handling', () => {
    const cell = h3.latLngToCell(0, 0, 8)
    const bad = { geoCellId: cell, pm25: -1 }
    expect(() => runHGC([bad], 1)).toThrow(/pm25/)

    const samples = [{ geoCellId: cell, pm25: 1 }, bad]
    const { batches: discBatches, invalidSamples: discInvalid } = runHGC(samples, 1, undefined, { onInvalid: 'discard' })
    expect(discBatches[0].data[cell].length).toBe(1)
    expect(discInvalid.length).toBe(0)

    const { batches: markBatches, invalidSamples: markInvalid } = runHGC(samples, 1, undefined, { onInvalid: 'mark' })
    expect(markBatches[0].data[cell].length).toBe(1)
    expect(markInvalid.length).toBe(1)
    expect(markInvalid[0].errors[0]).toMatch(/pm25/)
  })

  describe('chunking & hysteresis', () => {
    test('splits batches that exceed limits', () => {
      const radius = radiusForCells(Math.floor(MAX_LEAVES_PER_BATCH * HYSTERESIS_FAR) + 1)
      const { samples } = buildSamples(radius)
      const { batches } = runHGC(samples, 1)
      expect(batches.length).toBeGreaterThan(1)
      for (const b of batches) {
        expect(b.countLeaves).toBeLessThanOrEqual(MAX_LEAVES_PER_BATCH)
        expect(b.countSamples).toBeLessThanOrEqual(MAX_SAMPLES_PER_BATCH)
      }
    })

    test('keeps groups within 90-110% at same level', () => {
      const radius = radiusForCells(MAX_LEAVES_PER_BATCH + 1)
      const { samples, cells } = buildSamples(radius)

      const { batches } = runHGC(samples, 1)
      expect(batches.length).toBe(1)
      const b = batches[0]
      expect(b.countLeaves).toBe(cells.length)
      expect(b.countLeaves).toBeGreaterThan(MAX_LEAVES_PER_BATCH)
      expect(b.countLeaves).toBeLessThanOrEqual(Math.floor(MAX_LEAVES_PER_BATCH * HYSTERESIS_FAR))
      expect(h3.getResolution(b.geoBatchId)).toBe(0)
    })
  })

  test('super-root independent of batch order', () => {
    const { samples } = buildSamples(19)
    const { batches } = runHGC(samples, 1)
    const { superRoot } = computeEpochSuperRoot(batches)
    const shuffled = [...batches].reverse()
    const { superRoot: root2 } = computeEpochSuperRoot(shuffled)
    expect(root2).toBe(superRoot)
  })

  test('batch metadata and ordering', () => {
    const { samples } = buildSamples()
    const { batches } = runHGC(samples, 1)
    const b = batches[0]
    expect(b.countLeaves).toBe(b.compressedFrom.length)
    const sampleCount = Object.values(b.data).reduce(
      (s, arr) =>
        s + arr.reduce((sum, e) => sum + (Array.isArray(e.samples) ? e.samples.length : 1), 0),
      0
    )
    expect(b.countSamples).toBe(sampleCount)
    const keys = Object.keys(b.data)
    expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b)))
    expect(b.merkleRoot).toBeDefined()
    expect(b.leavesIndex).toBeDefined()
    const { hash, ...rest } = b
    expect(hash).toBe(sha256HexCanonical(rest))
  })

  test('compressTopDown performance regression', () => {
    const { cells } = buildSamples(20)
    const sampleCountByCell = Object.fromEntries(cells.map(id => [id, 4]))

    const BASE_RES = 8
    const MIN_RES = 0

    function groupByParent (cellIds, parentRes) {
      const buckets = {}
      for (const id of cellIds) {
        const parent = h3.cellToParent(id, parentRes)
        if (!buckets[parent]) buckets[parent] = []
        buckets[parent].push(id)
      }
      return buckets
    }

    function sortChildren (children, parent, useLocalIj = false, resForChildren = BASE_RES) {
      const arr = [...children]
      if (!useLocalIj) {
        arr.sort((a, b) => a.localeCompare(b))
        return arr
      }

      try {
        const origin = h3.cellToCenterChild(parent, resForChildren)
        arr.sort((a, b) => {
          try {
            const { i: ia, j: ja } = h3.cellToLocalIj(origin, a)
            const { i: ib, j: jb } = h3.cellToLocalIj(origin, b)
            return ia - ib || ja - jb || a.localeCompare(b)
          } catch {
            return a.localeCompare(b)
          }
        })
      } catch {
        arr.sort((a, b) => a.localeCompare(b))
      }
      return arr
    }

    function chunkStableOld (childrenSorted, maxLeaves, maxVolume, getVol) {
      const chunks = []
      let current = []
      let leaves = 0
      let volume = 0

      for (const child of childrenSorted) {
        const childLeaves = Array.isArray(child) ? child.length : 1
        const childVol = getVol(child)

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

    function compressTopDownOld (cellIds, sampleCountByCell, currentRes = MIN_RES, useLocalIj = false) {
      if (currentRes === BASE_RES) {
        return [{ res: currentRes, cells: cellIds }]
      }

      const groups = groupByParent(cellIds, currentRes)
      const batches = []

      for (const [parent, children] of Object.entries(groups)) {
        const leaves = children.length
        const volumeSamples = children.reduce((sum, id) => sum + sampleCountByCell[id], 0)

        const tooBig =
          leaves > MAX_LEAVES_PER_BATCH * HYSTERESIS_FAR ||
          volumeSamples > MAX_SAMPLES_PER_BATCH * HYSTERESIS_FAR

        if (!tooBig || currentRes + 1 > BASE_RES) {
          const sortedLeaves = sortChildren(children, parent, useLocalIj, BASE_RES)
          batches.push({ res: currentRes, cells: sortedLeaves })
          continue
        }

        const nextGroups = groupByParent(children, currentRes + 1)
        for (const [p, arr] of Object.entries(nextGroups)) {
          nextGroups[p] = sortChildren(arr, p, useLocalIj, BASE_RES)
        }
        const nextIds = sortChildren(Object.keys(nextGroups), parent, useLocalIj, currentRes + 1)
        const groupsArray = nextIds.map(id => nextGroups[id])
        const chunks = chunkStableOld(
          groupsArray,
          MAX_LEAVES_PER_BATCH,
          MAX_SAMPLES_PER_BATCH,
          g => g.reduce((s, cid) => s + sampleCountByCell[cid], 0)
        )

        for (const chunk of chunks) {
          const nested = chunk.flat()
          batches.push(...compressTopDownOld(nested, sampleCountByCell, currentRes + 1, useLocalIj))
        }
      }

      return batches
    }

    const measure = fn => {
      // Warm up once before taking measurements to avoid JIT overhead.
      fn()
      const start = performance.now()
      // Run several iterations and average to reduce timing noise that can
      // cause false regressions on slower CI machines.
      const iterations = 5
      for (let i = 0; i < iterations; i++) fn()
      return (performance.now() - start) / iterations
    }

    const oldTime = measure(() => compressTopDownOld(cells, sampleCountByCell))
    const newTime = measure(() => compressTopDown(cells, sampleCountByCell))
    expect(newTime).toBeLessThanOrEqual(oldTime * 1.2)
  })
})

