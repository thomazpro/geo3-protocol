import { describe, test, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { ensureNodes } from '../src/utils/ensureNodes.js'

const dataDir = path.join(process.cwd(), 'data')
const nodesFile = path.join(dataDir, 'nodes.json')

describe('ensureNodes', () => {
  test('creates and reads nodes.json', async () => {
    fs.rmSync(dataDir, { recursive: true, force: true })

    const nodes = await ensureNodes()
    expect(fs.existsSync(nodesFile)).toBe(true)
    const fileNodes = JSON.parse(fs.readFileSync(nodesFile, 'utf8'))
    expect(nodes).toEqual(fileNodes)

    const nodesAgain = await ensureNodes()
    expect(nodesAgain).toEqual(nodes)

    fs.rmSync(dataDir, { recursive: true, force: true })
  })
})
