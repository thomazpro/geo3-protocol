import path from 'path'
import { generateSamplesForEpoch, flattenGroupedSamples, saveToFile, DEFAULT_N_SAMPLES } from '../generators/samples.js'
import { runHGC, addMerkleRoots } from '../utils/hgc.js'
import { saveResults } from '../utils/persistence.js'
import { loadHgcConfig } from '../config/index.js'
import { uploadFolder } from '../utils/ipfs.js'
import { registerGeoBatch } from '../utils/chain.js'
import { ensureNodes } from '../utils/ensureNodes.js'

const epochArg = process.argv.find(a => a.startsWith('--epoch='))
const epoch = epochArg ? parseInt(epochArg.split('=')[1]) : 1

async function main() {
  const nodes = await ensureNodes()
  const params = loadHgcConfig()
  const nSamples = parseInt(process.env.N_SAMPLES ?? DEFAULT_N_SAMPLES, 10)
  const grouped = generateSamplesForEpoch(nodes, epoch, 0, nSamples)
  const samples = flattenGroupedSamples(grouped)
  saveToFile(samples, epoch, { nSamples, nodes: nodes.length })

  const result = runHGC(samples, epoch, params)
  addMerkleRoots(result.batches)
  await saveResults({ ...result, meta: { nodes: nodes.length, nSamples } }, epoch)

  const epochDir = path.join(process.cwd(), 'data', `epoch_${epoch}`)
  const cid = await uploadFolder(epochDir)
  console.log('CID:', cid)

  for (const b of result.batches) {
    await registerGeoBatch(epoch, b.geoBatchId, b.merkleRoot, cid)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

