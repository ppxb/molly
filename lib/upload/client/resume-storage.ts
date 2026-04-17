const STORAGE_KEY_PREFIX = 'molly-upload-resume:'

function buildStorageKey(fileFingerprint: string, fileSize: number) {
  return `${STORAGE_KEY_PREFIX}${fileFingerprint}:${fileSize}`
}

export function getResumeSessionId(fileFingerprint: string, fileSize: number) {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage.getItem(buildStorageKey(fileFingerprint, fileSize))
}

export function setResumeSessionId(fileFingerprint: string, fileSize: number, sessionId: string) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(buildStorageKey(fileFingerprint, fileSize), sessionId)
}

export function clearResumeSessionId(fileFingerprint: string, fileSize: number) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(buildStorageKey(fileFingerprint, fileSize))
}
