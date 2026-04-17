const STORAGE_KEY_PREFIX = 'molly-upload-resume:'

function buildStorageKey(fileFingerprint: string, fileSize: number, folderPath: string) {
  return `${STORAGE_KEY_PREFIX}${folderPath}:${fileFingerprint}:${fileSize}`
}

export function getResumeSessionId(fileFingerprint: string, fileSize: number, folderPath = '') {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage.getItem(buildStorageKey(fileFingerprint, fileSize, folderPath))
}

export function setResumeSessionId(fileFingerprint: string, fileSize: number, sessionId: string, folderPath = '') {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(buildStorageKey(fileFingerprint, fileSize, folderPath), sessionId)
}

export function clearResumeSessionId(fileFingerprint: string, fileSize: number, folderPath = '') {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(buildStorageKey(fileFingerprint, fileSize, folderPath))
}
