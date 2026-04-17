import { randomUUID } from 'node:crypto'

import { normalizeFolderPath } from '@/lib/upload/path'

function encodeObjectPathSegment(value: string) {
  return encodeURIComponent(value)
}

export function createObjectKey(fileName: string, folderPath = '') {
  const safeName = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  const normalizedFolderPath = normalizeFolderPath(folderPath)
  const encodedFolderPrefix = normalizedFolderPath
    ? `${normalizedFolderPath
        .split('/')
        .map(segment => encodeObjectPathSegment(segment))
        .join('/')}/`
    : ''
  const datePrefix = new Date().toISOString().slice(0, 10)
  const uniqueId = randomUUID()

  return `uploads/${encodedFolderPrefix}${datePrefix}/${uniqueId}-${safeName || 'file'}`
}
