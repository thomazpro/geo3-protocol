import { describe, test, expect } from 'vitest'
import { merkleRootAndIndex } from '../src/utils/hasher.js'

describe('merkle root', () => {
  test('cell key order does not affect root', () => {
    const dataA = {
      cell1: [{ v: 1 }],
      cell2: [{ v: 2 }]
    }
    const dataB = {
      cell2: [{ v: 2 }],
      cell1: [{ v: 1 }]
    }
    const rootA = merkleRootAndIndex(dataA).root
    const rootB = merkleRootAndIndex(dataB).root
    expect(rootA).toBe(rootB)
  })

  test('sample property order does not affect root', () => {
    const dataA = { cell1: [{ a: 1, b: 2 }] }
    const dataB = { cell1: [{ b: 2, a: 1 }] }
    const rootA = merkleRootAndIndex(dataA).root
    const rootB = merkleRootAndIndex(dataB).root
    expect(rootA).toBe(rootB)
  })

  test('different cellId/data pairs yield different hashes', () => {
    const dataA = { cell12: 3 }
    const dataB = { cell1: 23 }
    const rootA = merkleRootAndIndex(dataA).root
    const rootB = merkleRootAndIndex(dataB).root
    expect(rootA).not.toBe(rootB)
  })
})

