import { DEFAULT_MULTIPART_THRESHOLD } from '@/lib/upload/shared'

const DEFAULT_MULTIPART_CONCURRENCY = 3

function parsePositiveInteger(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  if (normalized.length === 0) {
    return null
  }

  const parsed = Number.parseInt(normalized, 10)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

export const uploadRuntimeConfig = {
  multipartThreshold:
    parsePositiveInteger(import.meta.env.VITE_UPLOAD_MULTIPART_THRESHOLD) ?? DEFAULT_MULTIPART_THRESHOLD,
  multipartConcurrency:
    parsePositiveInteger(import.meta.env.VITE_UPLOAD_MULTIPART_CONCURRENCY) ?? DEFAULT_MULTIPART_CONCURRENCY
}
