import { describe, expect, test } from 'vitest'
import { canonical, sha256HexCanonical, merkleRootAndIndex } from '../src/utils/hasher.js'

describe('deterministic hashing', () => {
  test('canonical sorts keys and normalizes numbers', () => {
    const obj = { b: 1, a: 1.0 }
    expect(canonical(obj)).toBe('{"a":1,"b":1}')
  })

  test('sha256HexCanonical ignores key order', () => {
    const first = { a: [1], b: [2] }
    const second = { b: [2], a: [1] }
    expect(sha256HexCanonical(first)).toBe(sha256HexCanonical(second))
  })

  test('merkle root ignores inner object order', () => {
    const batch1 = { cell: [{ x: 1, y: 2 }] }
    const batch2 = { cell: [{ y: 2, x: 1 }] }
    const root1 = merkleRootAndIndex(batch1).root
    const root2 = merkleRootAndIndex(batch2).root
    expect(root1).toBe(root2)
  })
})
