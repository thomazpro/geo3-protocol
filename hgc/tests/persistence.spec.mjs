import { describe, test, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import * as h3 from 'h3-js'
import { runHGC } from '../src/utils/hgc.js'
import { saveResults } from '../src/utils/persistence.js'

describe('persistence utilities', () => {
  test('saveResults writes superRoot file', async () => {
    const epoch = 1
    const cell = h3.latLngToCell(0, 0, 8)
    const sample = { geoCellId: cell, pm25: 1, timestamp: 0 }
    const result = runHGC([sample], epoch)
    const tmp = fs.mkdtempSync(path.join(process.cwd(), 'tmp-'))
    await saveResults(result, epoch, tmp)
    const superPath = path.join(tmp, 'data', `epoch_${epoch}`, 'superRoot.json')
    expect(fs.existsSync(superPath)).toBe(true)
    fs.rmSync(tmp, { recursive: true, force: true })
  })
})

