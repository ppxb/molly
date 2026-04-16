import { randomUUID } from 'node:crypto'

export function createObjectKey(fileName: string) {
  const safeName = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  const datePrefix = new Date().toISOString().slice(0, 10)
  const uniqueId = randomUUID()

  return `tenant-demo/uploads/${datePrefix}/${uniqueId}-${safeName || 'file'}`
}
