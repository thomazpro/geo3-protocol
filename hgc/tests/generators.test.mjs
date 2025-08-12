import { describe, test, expect } from 'vitest'
import { generateNodes } from '../src/generators/nodes.js'
import { generateSamplesForEpoch, flattenGroupedSamples } from '../src/generators/samples.js'

const NODE_COUNT = 5
const NODE_SEED = 42
const SAMPLE_SEED = 7
const EPOCH = 1
const N_SAMPLES = 3

describe('generators', () => {
  test('generateNodes is deterministic with same seed', () => {
    const a = generateNodes(NODE_COUNT, NODE_SEED)
    const b = generateNodes(NODE_COUNT, NODE_SEED)
    expect(a).toEqual(b)
  })

  test('generateSamplesForEpoch is deterministic with same seed', () => {
    const nodes = generateNodes(NODE_COUNT, NODE_SEED)
    const a = generateSamplesForEpoch(nodes, EPOCH, SAMPLE_SEED, N_SAMPLES)
    const b = generateSamplesForEpoch(nodes, EPOCH, SAMPLE_SEED, N_SAMPLES)
    expect(a).toEqual(b)
  })

  test('flattenGroupedSamples produces stable ordered output', () => {
    const grouped = {
      b: [
        { timestamp: 2 },
        { timestamp: 1 }
      ],
      a: [
        { timestamp: 5 },
        { timestamp: 4 }
      ]
    }
    const first = flattenGroupedSamples(grouped)
    const second = flattenGroupedSamples(grouped)
    expect(second).toEqual(first)
    expect(first.map(s => s.timestamp)).toEqual([4, 5, 1, 2])
  })
})
