import fs from 'fs'
import path from 'path'
import { latLngToCell } from 'h3-js'
import { keccak256 } from 'ethers'
import { mulberry32 } from '../utils/rng.js'

export const DEFAULT_NUM_NODES = 10000
const DEFAULT_BASE_LAT = -10.0
const DEFAULT_BASE_LNG = -52.0
const RNG_SEED = 123456

const nodesArg = process.argv.find(a => a.startsWith('--nodes='))
const NUM_NODES = parseInt(
  process.env.NUM_NODES ?? (nodesArg ? nodesArg.split('=')[1] : DEFAULT_NUM_NODES),
  10
)
const OUTPUT_PATH = path.join(process.cwd(), 'data/nodes.json')

// Região base: centro do Brasil
const BASE_LAT = parseFloat(process.env.BASE_LAT ?? DEFAULT_BASE_LAT)
const BASE_LNG = parseFloat(process.env.BASE_LNG ?? DEFAULT_BASE_LNG)

function generateNode (index, rand) {
  const lat = BASE_LAT + rand() * 2
  const lng = BASE_LNG + rand() * 2
  const geoCellId = latLngToCell(lat, lng, 8) // res=8
  const nodeAddress = `0x${keccak256(Buffer.from(`node-${index}`)).slice(26)}`

  return {
    id: index,
    nodeAddress,
    lat: parseFloat(lat.toFixed(6)),
    lng: parseFloat(lng.toFixed(6)),
    geoCellId
  }
}

export function generateNodes (count = NUM_NODES, seed = RNG_SEED) {
  const rand = mulberry32(seed)
  const nodes = []
  for (let i = 0; i < count; i++) nodes.push(generateNode(i, rand))
  return nodes
}

if (process.argv[1] && process.argv[1].includes('nodes.js')) {
  const nodes = generateNodes(NUM_NODES)
  const dataDir = path.join(process.cwd(), 'data')
  fs.mkdirSync(dataDir, { recursive: true })
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(nodes, null, 2))
  const metaPath = path.join(dataDir, 'nodes_meta.json')
  fs.writeFileSync(metaPath, JSON.stringify({ nodes: nodes.length }, null, 2))
  console.log(`✅ Gerados ${nodes.length} nodes em ${OUTPUT_PATH}`)
}
