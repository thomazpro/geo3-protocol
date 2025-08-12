import fs from 'fs'
import path from 'path'
import { keccak256, toUtf8Bytes } from 'ethers'
import { mulberry32 } from '../utils/rng.js'

export const DEFAULT_N_SAMPLES = 12 // por node por epoch
const SAMPLE_INTERVAL_MS = 5 * 60 * 1000 // 5 minutos

const NODES_PATH = path.join(process.cwd(), 'data/nodes.json')

function generateSample (seed, rand, timestamp) {
  return {
    co2: 390 + (seed % 30),
    pm25: 10 + (seed % 40),
    temp: 15 + (seed % 20) + rand(),
    hum: 40 + (seed % 35),
    timestamp
  }
}

export function generateSamplesForEpoch (nodes, epoch, seed = 0, nSamples = DEFAULT_N_SAMPLES) {
  const grouped = {}
  const rand = mulberry32(seed + epoch)
  const epochBase = epoch * nSamples * SAMPLE_INTERVAL_MS

  for (const node of nodes) {
    const entry = {
      geoCellId: node.geoCellId,
      samples: [],
      timestamp: epochBase,
      issuer: node.nodeAddress,
      signature: keccak256(toUtf8Bytes(`${node.nodeAddress}-${epoch}`)) // mock
    }

    for (let i = 0; i < nSamples; i++) {
      const ts = epochBase + i * SAMPLE_INTERVAL_MS
      const sample = generateSample(node.id + i, rand, ts)
      entry.samples.push(sample)
    }

    if (!grouped[node.geoCellId]) grouped[node.geoCellId] = []
    grouped[node.geoCellId].push(entry)
  }

  return grouped
}

export function flattenGroupedSamples (grouped) {
  const flattened = []
  const keys = Object.keys(grouped).sort()
  for (const key of keys) {
    const group = grouped[key]
    if (!Array.isArray(group)) continue
    let ordered = true
    for (let i = 1; i < group.length; i++) {
      if (group[i - 1].timestamp > group[i].timestamp) {
        ordered = false
        break
      }
    }
    const arr = ordered ? group : [...group].sort((a, b) => a.timestamp - b.timestamp)
    for (const entry of arr) {
      flattened.push(entry)
    }
  }
  return flattened
}

export function saveToFile (data, epoch, meta = {}) {
  const fileName = `samples_epoch_${epoch.toString().padStart(5, '0')}.json`
  const dirPath = path.join(process.cwd(), 'data')
  fs.mkdirSync(dirPath, { recursive: true })
  const filePath = path.join(dirPath, fileName)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
  const metaPath = path.join(dirPath, fileName.replace('.json', '_meta.json'))
  fs.writeFileSync(metaPath, JSON.stringify({ epoch, ...meta }, null, 2))
  console.log(`✅ Amostras geradas e salvas em ${filePath}`)
}

if (process.argv[1] && process.argv[1].includes('samples.js')) {
  const epochArg = process.argv.find(a => a.startsWith('--epoch='))
  const samplesArg = process.argv.find(a => a.startsWith('--samples='))
  const seedArg = process.argv.find(a => a.startsWith('--seed='))
  const epoch = parseInt(process.env.EPOCH ?? (epochArg ? epochArg.split('=')[1] : '1'), 10)
  const nSamples = parseInt(
    process.env.N_SAMPLES ?? (samplesArg ? samplesArg.split('=')[1] : DEFAULT_N_SAMPLES),
    10
  )
  const seed = parseInt(process.env.RNG_SEED ?? (seedArg ? seedArg.split('=')[1] : '0'), 10)
  const nodes = JSON.parse(fs.readFileSync(NODES_PATH, 'utf-8'))
  const grouped = generateSamplesForEpoch(nodes, epoch, seed, nSamples)
  const flattened = flattenGroupedSamples(grouped)
  saveToFile(flattened, epoch, { nSamples, seed, nodes: nodes.length })
}

