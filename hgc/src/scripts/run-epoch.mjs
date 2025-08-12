import path from 'path'
import { generateSamplesForEpoch, flattenGroupedSamples, DEFAULT_N_SAMPLES } from '../generators/samples.js'
import { runHGC } from '../utils/hgc.js'
import { saveResults } from '../utils/persistence.js'
import { loadHgcConfig } from '../config/index.js'
import { uploadFolder, isIpfsEnabled } from '../utils/ipfs.js'
import { registerGeoBatch, isChainEnabled } from '../utils/chain.js'
import { ensureNodes } from '../utils/ensureNodes.js'

const epochArg = process.argv.find(a => a.startsWith('--epoch='))
const epoch = epochArg ? parseInt(epochArg.split('=')[1]) : 1

export async function runEpoch () {
  const nodes = await ensureNodes()
  const params = loadHgcConfig()
  const nSamples = parseInt(process.env.N_SAMPLES ?? DEFAULT_N_SAMPLES, 10)
  const grouped = generateSamplesForEpoch(nodes, epoch, 0, nSamples)
  const samples = flattenGroupedSamples(grouped)

  const result = runHGC(samples, epoch, params)
  const superRoot = await saveResults({ ...result, meta: { nodes: nodes.length, nSamples } }, epoch)
  console.log('Resumo:', result.summary)
  console.log('SuperRoot:', superRoot.superRoot)

  let cid
  if (isIpfsEnabled()) {
    const epochDir = path.join(process.cwd(), 'data', `epoch_${epoch}`)
    cid = await uploadFolder(epochDir)
    console.log('CID:', cid)
  }

  if (isChainEnabled()) {
    for (const b of result.batches) {
      await registerGeoBatch(epoch, b.geoBatchId, b.merkleRoot, cid)
    }
  }

  return superRoot.superRoot
}

runEpoch().catch(err => {
  console.error(err)
  process.exit(1)
})
