import { describe, test, expect } from 'vitest'
import { promises as fs } from 'fs'
import path from 'path'
import { uploadFile, uploadFolder, hashFolder } from '../src/utils/ipfs.js'
import { sha256Hex } from '../src/utils/hasher.js'

describe('ipfs utils', () => {
  test('uploadFile hashes file contents', async () => {
    const file = path.join(process.cwd(), 'tmp-file.txt')
    await fs.writeFile(file, 'hello world')
    const cid = await uploadFile(file)
    expect(cid).toBe(sha256Hex(await fs.readFile(file)))
    await fs.unlink(file)
  })

  test('uploadFolder hashes folder contents', async () => {
    const dir = path.join(process.cwd(), 'tmp-folder')
    await fs.rm(dir, { recursive: true, force: true })
    await fs.mkdir(path.join(dir, 'sub'), { recursive: true })
    await fs.writeFile(path.join(dir, 'a.txt'), 'AAA')
    await fs.writeFile(path.join(dir, 'sub', 'b.txt'), 'BBB')
    const cid = await uploadFolder(dir)
    const expected = await hashFolder(dir)
    expect(cid).toBe(expected)
    await fs.rm(dir, { recursive: true, force: true })
  })
})
