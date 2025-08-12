import fs from 'fs/promises'
import path from 'path'
import { generateNodes } from '../generators/nodes.js'

export async function ensureNodes() {
  const nodesPath = path.join(process.cwd(), 'data', 'nodes.json')
  try {
    await fs.access(nodesPath)
    const content = await fs.readFile(nodesPath, 'utf8')
    return JSON.parse(content)
  } catch {
    const nodes = generateNodes()
    await fs.mkdir(path.dirname(nodesPath), { recursive: true })
    await fs.writeFile(nodesPath, JSON.stringify(nodes, null, 2))
    return nodes
  }
}
