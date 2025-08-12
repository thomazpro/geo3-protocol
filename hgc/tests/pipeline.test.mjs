import { describe, test, expect } from 'vitest'
import { promises as fs } from 'fs'
import path from 'path'
import { generateNodes } from '../src/generators/nodes.js'
import { generateSamplesForEpoch, flattenGroupedSamples } from '../src/generators/samples.js'
import { runHGC, computeEpochSuperRoot } from '../src/utils/hgc.js'
import { compressTopDown } from '../src/utils/grouping.js'
import { saveResults } from '../src/utils/persistence.js'
import { uploadFolder, hashFolder } from '../src/utils/ipfs.js'
import { registerGeoBatch } from '../src/utils/chain.js'
import { merkleRootAndIndex } from '../src/utils/hasher.js'

describe('pipeline', () => {
  // This integration test exercises the full mock pipeline and can
  // occasionally exceed Vitest's default 5s timeout on slower
  // environments. Bump the timeout to reduce flakiness.
  test('runs end-to-end in mock mode', async () => {
    const epoch = 1
    const dataDir = path.join(process.cwd(), 'data')
    await fs.rm(dataDir, { recursive: true, force: true })

    const nodes = generateNodes()
    const grouped = generateSamplesForEpoch(nodes, epoch)
    const samples = flattenGroupedSamples(grouped)

    // Configuração explícita para facilitar ajustes futuros ao explorar
    // parâmetros do HGC. Os valores abaixo replicam os padrões atuais.
    const hgcConfig = {
      baseRes: 8,
      minRes: 0,
      maxLeavesPerBatch: 4096,
      maxSamplesPerBatch: 16000,
      hysteresisNear: 0.9,
      hysteresisFar: 1.1
    }

    const result = runHGC(samples, epoch, hgcConfig)
    const cells = Object.keys(grouped)
    const sampleCountByCell = Object.fromEntries(
      cells.map(id => [id, grouped[id].reduce((s, e) => s + e.samples.length, 0)])
    )
    const expectedMaxBatches = compressTopDown(cells, sampleCountByCell, undefined, false, hgcConfig).length
    expect(result.batches.length).toBe(expectedMaxBatches)
    const superContent = await saveResults(result, epoch)

    const epochDir = path.join(dataDir, `epoch_${epoch}`)
    const cid = await uploadFolder(epochDir)
    const expectedCid = await hashFolder(epochDir)
    expect(cid).toBe(expectedCid)

    for (const b of result.batches) {
      await registerGeoBatch(epoch, b.geoBatchId, b.merkleRoot, cid)
    }

    const exists = async p => !!(await fs.stat(p).catch(() => false))
    const mapFilePath = path.join(dataDir, 'cellToBatchMap.json')
    expect(await exists(mapFilePath)).toBe(true)
    const mapContent = JSON.parse(await fs.readFile(mapFilePath, 'utf8'))
    expect(mapContent[epoch]).toBeDefined()
    const superFile = path.join(epochDir, 'superRoot.json')
    expect(await exists(superFile)).toBe(true)
    const fileContent = JSON.parse(await fs.readFile(superFile, 'utf8'))
    const { superRoot: compRoot, batchIds, batchRoots } = computeEpochSuperRoot(result.batches)
    expect(result.superRoot).toBe(compRoot)
    expect(superContent.superRoot).toBe(result.superRoot)
    expect(fileContent).toEqual(superContent)
    expect(superContent.batchIds).toEqual(batchIds)
    expect(superContent.batchRoots).toEqual(batchRoots)
    expect(superContent.batchesTotal).toBe(result.batches.length)
    const expectedSamples = result.batches.reduce((s, b) => s + b.countSamples, 0)
    expect(superContent.samplesTotal).toBe(expectedSamples)
    expect(result.summary.batchesTotal).toBe(result.batches.length)

    for (const b of result.batches) {
      const filePath = path.join(epochDir, `${b.geoBatchId}.json`)
      expect(await exists(filePath)).toBe(true)
      const content = JSON.parse(await fs.readFile(filePath, 'utf8'))
      expect(content.merkleRoot).toBe(b.merkleRoot)
      expect(merkleRootAndIndex(content.data).root).toBe(b.merkleRoot)
    }

    const chainFile = path.join(dataDir, 'mock-chain.json')
    expect(await exists(chainFile)).toBe(true)
    const records = JSON.parse(await fs.readFile(chainFile, 'utf8'))
    expect(records.length).toBe(result.batches.length)
    for (const r of records) {
      expect(r.cid).toBe(cid)
    }

    await fs.rm(dataDir, { recursive: true, force: true })
  }, 15_000)
})

