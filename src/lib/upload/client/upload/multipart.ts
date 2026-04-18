import type { FileUploadPartInfo } from '@/lib/upload/client/api'
import { uploadBlobWithProgress } from '@/lib/upload/client/transport'
import { raiseIfAborted, resolveConcurrency } from '@/lib/upload/client/upload/helpers'
import type { MonotonicProgressReporter } from '@/lib/upload/client/upload/progress'
import type { UploadFileInput } from '@/lib/upload/client/upload/types'

async function runWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  if (items.length === 0) {
    return
  }

  const taskCount = Math.max(1, Math.min(concurrency, items.length))
  let currentIndex = 0

  await Promise.all(
    Array.from({ length: taskCount }).map(async () => {
      while (true) {
        const index = currentIndex
        if (index >= items.length) {
          return
        }
        currentIndex += 1
        await worker(items[index])
      }
    })
  )
}

export async function uploadPartBatch(
  input: UploadFileInput,
  partInfoList: FileUploadPartInfo[],
  chunkSize: number,
  committedBytesRef: { value: number },
  progressReporter: MonotonicProgressReporter
) {
  const orderedPartInfoList = [...partInfoList].sort((left, right) => left.part_number - right.part_number)
  const inFlightBytes = new Map<number, number>()

  await runWithConcurrency(orderedPartInfoList, resolveConcurrency(input), async partInfo => {
    raiseIfAborted(input.signal)

    const start = (partInfo.part_number - 1) * chunkSize
    const end = Math.min(start + chunkSize, input.file.size)
    const blob = input.file.slice(start, end)

    await uploadBlobWithProgress({
      uploadUrl: partInfo.upload_url,
      blob,
      contentType: input.file.type || 'application/octet-stream',
      signal: input.signal,
      onProgress: loaded => {
        inFlightBytes.set(partInfo.part_number, loaded)
        let transientUploadedBytes = 0
        for (const value of inFlightBytes.values()) {
          transientUploadedBytes += value
        }
        progressReporter.report(committedBytesRef.value + transientUploadedBytes)
      }
    })

    committedBytesRef.value += blob.size
    inFlightBytes.delete(partInfo.part_number)
    progressReporter.report(committedBytesRef.value)
  })
}
