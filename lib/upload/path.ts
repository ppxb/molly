export const ROOT_FOLDER_PATH = ''

function toPathSegments(rawPath: string) {
  const normalized = rawPath.replaceAll('\\', '/')
  const inputSegments = normalized.split('/')
  const stack: string[] = []

  for (const segment of inputSegments) {
    const trimmed = segment.trim()
    if (!trimmed || trimmed === '.') {
      continue
    }

    if (trimmed === '..') {
      stack.pop()
      continue
    }

    stack.push(trimmed)
  }

  return stack
}

export function normalizeFolderPath(input: unknown) {
  if (typeof input !== 'string') {
    return ROOT_FOLDER_PATH
  }

  return toPathSegments(input).join('/')
}

export function splitFolderPath(path: string) {
  return normalizeFolderPath(path).split('/').filter(Boolean)
}

export function getParentFolderPath(path: string) {
  const segments = splitFolderPath(path)
  if (segments.length === 0) {
    return null
  }

  return segments.slice(0, -1).join('/')
}

export function normalizeFolderName(input: unknown) {
  if (typeof input !== 'string') {
    return ''
  }

  return input.trim()
}

export function isValidFolderName(name: string) {
  if (!name) {
    return false
  }

  if (name === '.' || name === '..') {
    return false
  }

  if (name.length > 120) {
    return false
  }

  return !/[\\/]/.test(name)
}

export function joinFolderPath(parentPath: string, childName: string) {
  const safeParent = normalizeFolderPath(parentPath)
  const safeChild = normalizeFolderName(childName)
  return normalizeFolderPath(`${safeParent}/${safeChild}`)
}
