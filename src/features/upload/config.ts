// 上传阈值 & 分片配置
export const DEFAULT_MULTIPART_THRESHOLD = 64 * 1024 * 1024 // 64MB
export const DEFAULT_MULTIPART_CHUNK_SIZE = 16 * 1024 * 1024 // 16MB
export const DEFAULT_MULTIPART_CONCURRENCY = 6 // 同时上传的分片数量

// 采样哈希配置
export const SAMPLE_HASH_THRESHOLD = 32 * 1024 * 1024 // 32MB
export const SAMPLE_HASH_HEAD_SIZE = 4 * 1024 * 1024 // 4MB
export const SAMPLE_HASH_TAIL_SIZE = 4 * 1024 * 1024 // 4MB
export const SAMPLE_HASH_MIDDLE_PART_COUNT = 8 // 中间部分数量
export const SAMPLE_HASH_MIDDLE_PART_SIZE = 1 * 1024 * 1024 // 1MB
export const SAMPLE_HASH_VERSION = 'sample-v1' // 哈希算法版本

function parsePositiveInt(value: unknown) {
  if (typeof value !== 'string') return null
  const n = parseInt(value.trim(), 10)
  return Number.isInteger(n) && n > 0 ? n : null
}

export const uploadConfig = {
  multipartThreshold: parsePositiveInt(import.meta.env.VITE_UPLOAD_MULTIPART_THRESHOLD) ?? DEFAULT_MULTIPART_THRESHOLD,
  multipartConcurrency:
    parsePositiveInt(import.meta.env.VITE_UPLOAD_MULTIPART_CONCURRENCY) ?? DEFAULT_MULTIPART_CONCURRENCY,
  chunkSize: DEFAULT_MULTIPART_CHUNK_SIZE
} as const
