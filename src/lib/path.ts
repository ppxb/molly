export const ROOT_FOLDER_PATH = ''

function toSegments(raw: string) {
  const stack: string[] = []

  for (const seg of raw.replaceAll('\\', '/').split('/')) {
    const s = seg.trim()
    if (!s || s === '.') continue
    if (s === '..') {
      stack.pop()
      continue
    }
    stack.push(s)
  }
  return stack
}

export function normalizeFolderPath(input: unknown) {
  if (typeof input !== 'string') return ROOT_FOLDER_PATH
  return toSegments(input).join('/')
}

export function splitFolderPath(path: string) {
  return normalizeFolderPath(path).split('/').filter(Boolean)
}

export function getParentFolderPath(path: string) {
  const segs = splitFolderPath(path)
  if (segs.length === 0) return null
  return segs.slice(0, -1).join('/')
}

export function joinFolderPath(parent: string, child: string) {
  return normalizeFolderPath(`${normalizeFolderPath(parent)}/${child.trim()}`)
}

export function isValidFolderName(name: string) {
  if (!name || name === '.' || name === '..') return false
  if (name.length > 120) return false
  return !/[\\/]/.test(name)
}
