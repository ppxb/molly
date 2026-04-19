import { DEFAULT_MULTIPART_CHUNK_SIZE } from '@/lib/drive/shared'

import type { UploadFileInput } from '@/lib/drive/client/upload/types'

const MIN_MULTIPART_PART_SIZE = 5 * 1024 * 1024
const MAX_MULTIPART_CONCURRENCY = 8

export const UPLOAD_URL_BATCH_SIZE = 20

export function createAbortError() {
  return new DOMException('Upload aborted', 'AbortError')
}

export function raiseIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw createAbortError()
  }
}

export function resolveTargetFolderID(input: UploadFileInput) {
  return input.folderId?.trim() || 'root'
}

export function resolveTargetFolderPath(input: UploadFileInput) {
  return input.folderPath?.trim() || ''
}

function escapeSearchValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export function buildSearchQuery(parentFileID: string, fileName: string) {
  return `parent_file_id = "${escapeSearchValue(parentFileID)}" and (name = "${escapeSearchValue(fileName)}")`
}

export function buildPartInfoList(fromPart: number, toPart: number) {
  const partInfoList: Array<{ part_number: number }> = []
  for (let partNumber = fromPart; partNumber <= toPart; partNumber += 1) {
    partInfoList.push({ part_number: partNumber })
  }
  return partInfoList
}

export function resolveChunkSize(input: UploadFileInput) {
  const chunkSize = input.chunkSize ?? DEFAULT_MULTIPART_CHUNK_SIZE
  return Math.max(chunkSize, MIN_MULTIPART_PART_SIZE)
}

export function resolveConcurrency(input: UploadFileInput) {
  return Math.max(1, Math.min(input.multipartConcurrency ?? 3, MAX_MULTIPART_CONCURRENCY))
}
