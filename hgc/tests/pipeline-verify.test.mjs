import { describe, test, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { generateNodes } from '../src/generators/nodes.js'
import { generateSamplesForEpoch, flattenGroupedSamples } from '../src/generators/samples.js'
import { runHGC } from '../src/utils/hgc.js'
import { saveResults } from '../src/utils/persistence.js'
import { verifyDir } from '../../protocol/src/scripts/verify.mjs'

describe('pipeline verify', () => {
  test('verifies generated epoch data', async () => {
    const epoch = 1
    const tmp = fs.mkdtempSync(path.join(process.cwd(), 'tmp-'))

    const nodes = generateNodes()
    const grouped = generateSamplesForEpoch(nodes, epoch)
    const samples = flattenGroupedSamples(grouped)

    const result = runHGC(samples, epoch)
    await saveResults(result, epoch, tmp)

    const epochDir = path.join(tmp, 'data', `epoch_${epoch}`)
    const results = await verifyDir(epochDir)
    for (const r of results) {
      expect(r.ok).toBe(true)
    }

    fs.rmSync(tmp, { recursive: true, force: true })
  })
})

