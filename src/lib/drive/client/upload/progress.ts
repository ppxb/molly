import type { UploadCallbacks } from '@/lib/drive/client/upload/types'

export interface MonotonicProgressReporter {
  report: (nextLoaded: number) => number
  force: (nextLoaded: number) => number
}

export function emitProgress(callbacks: UploadCallbacks, loaded: number, total: number) {
  const safeTotal = Math.max(1, total)
  callbacks.onProgress?.({
    loaded,
    total,
    percent: (loaded / safeTotal) * 100
  })
}

export function createMonotonicProgressReporter(
  callbacks: UploadCallbacks,
  total: number,
  initialLoaded = 0
): MonotonicProgressReporter {
  const boundedTotal = Math.max(1, total)
  let lastLoaded = Math.min(boundedTotal, Math.max(0, initialLoaded))

  emitProgress(callbacks, lastLoaded, boundedTotal)

  const normalizeLoaded = (nextLoaded: number) => Math.min(boundedTotal, Math.max(0, nextLoaded))

  return {
    report(nextLoaded: number) {
      const normalized = normalizeLoaded(nextLoaded)
      if (normalized <= lastLoaded) {
        return lastLoaded
      }

      lastLoaded = normalized
      emitProgress(callbacks, lastLoaded, boundedTotal)
      return lastLoaded
    },
    force(nextLoaded: number) {
      const normalized = normalizeLoaded(nextLoaded)
      if (normalized > lastLoaded) {
        lastLoaded = normalized
      }

      emitProgress(callbacks, lastLoaded, boundedTotal)
      return lastLoaded
    }
  }
}
