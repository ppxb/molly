const STORAGE_KEY_PREFIX = 'molly-upload-resume:'

function buildStorageKey(fileHash: string, fileSize: number) {
  return `${STORAGE_KEY_PREFIX}${fileHash}:${fileSize}`
}

export function getResumeSessionId(fileHash: string, fileSize: number) {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage.getItem(buildStorageKey(fileHash, fileSize))
}

export function setResumeSessionId(fileHash: string, fileSize: number, sessionId: string) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(buildStorageKey(fileHash, fileSize), sessionId)
}

export function clearResumeSessionId(fileHash: string, fileSize: number) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(buildStorageKey(fileHash, fileSize))
}
