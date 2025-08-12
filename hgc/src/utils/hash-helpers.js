import crypto from 'crypto'
import keccak256 from 'keccak256'
import { MerkleTree } from 'merkletreejs'

export function sha256Hex (bufferOrString) {
  return '0x' + crypto.createHash('sha256').update(bufferOrString).digest('hex')
}

export function canonical (value) {
  if (value === null) return 'null'
  if (typeof value === 'number') return Number(value).toString()
  if (typeof value !== 'object') return JSON.stringify(value)

  if (Array.isArray(value)) {
    return '[' + value.map(v => canonical(v)).join(',') + ']'
  }

  const entries = Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`)
  return '{' + entries.join(',') + '}'
}

export function merkleRootAndIndex (dataObject) {
  const cellIds = Object.keys(dataObject).sort()
  const leaves = []
  const leavesIndex = {}

  cellIds.forEach((cellId, i) => {
    const data = canonical(dataObject[cellId])
    const leafValue = Buffer.concat([
      Buffer.from(cellId),
      Buffer.from(':'),
      Buffer.from(data)
    ])
    const leaf = keccak256(leafValue)
    leaves.push(leaf)
    leavesIndex[cellId] = i
  })

  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true })
  return { root: tree.getHexRoot(), leavesIndex }
}

