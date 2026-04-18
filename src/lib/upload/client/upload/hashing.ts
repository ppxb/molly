import { hashFileSampleSHA256, hashFileSHA256 } from '@/lib/upload/client/hash'
import { SAMPLE_HASH_THRESHOLD } from '@/lib/upload/shared'
import type { UploadFileInput } from '@/lib/upload/client/upload/types'

export async function computePreHash(input: UploadFileInput) {
  if (input.file.size >= SAMPLE_HASH_THRESHOLD) {
    input.onStageChange?.('hashing', '快速预哈希')
    return hashFileSampleSHA256(
      input.file,
      (loaded, total) => {
        const percent = (loaded / Math.max(1, total)) * 100
        input.onStageChange?.('hashing', `快速预哈希 ${percent.toFixed(1)}%`)
      },
      input.signal
    )
  }

  input.onStageChange?.('hashing', '计算完整预哈希')
  return hashFileSHA256(
    input.file,
    (loaded, total) => {
      const percent = (loaded / Math.max(1, total)) * 100
      input.onStageChange?.('hashing', `计算完整预哈希 ${percent.toFixed(1)}%`)
    },
    input.signal
  )
}
