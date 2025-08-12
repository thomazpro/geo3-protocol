import { describe, test, expect } from 'vitest'
import * as h3 from 'h3-js'
import { groupByParent, compressTopDown } from '../src/utils/grouping.js'
import { MAX_LEAVES_PER_BATCH, HYSTERESIS_FAR } from '../src/utils/hgc.js'

describe('grouping utilities', () => {
  test('groupByParent groups children under their parent', () => {
    const parent = h3.latLngToCell(0, 0, 7)
    const children = h3.cellToChildren(parent, 8)
    const groups = groupByParent(children, 7)
    expect(Object.keys(groups)).toEqual([parent])
    expect(groups[parent]).toEqual(children)
  })

  test('compressTopDown respects batch limits', () => {
    const start = h3.latLngToCell(0, 0, 8)
    const radius = 39 // enough to exceed MAX_LEAVES_PER_BATCH * HYSTERESIS_FAR
    const cells = h3.gridDisk(start, radius)
    const sampleCountByCell = Object.fromEntries(cells.map(id => [id, 1]))
    const batches = compressTopDown(cells, sampleCountByCell)
    expect(batches.length).toBeGreaterThan(1)
    for (const b of batches) {
      expect(b.cells.length).toBeLessThanOrEqual(MAX_LEAVES_PER_BATCH * HYSTERESIS_FAR)
    }
  })
})

