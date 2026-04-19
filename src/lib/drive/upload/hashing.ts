import { hashFileSampleSHA256, hashFileSHA256 } from '@/lib/drive/hash'
import { SAMPLE_HASH_THRESHOLD } from '@/lib/drive/types'
import type { TransferFileInput } from '@/lib/drive/upload/types'

export async function computePreHash(input: TransferFileInput) {
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
