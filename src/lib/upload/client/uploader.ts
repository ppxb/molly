import {
  completeFileRequest,
  createWithFoldersFileRequest,
  getUploadURLFileRequest,
  searchFileRequest
} from '@/lib/upload/client/api'
import {
  buildPartInfoList,
  buildSearchQuery,
  raiseIfAborted,
  resolveChunkSize,
  resolveTargetFolderID,
  UPLOAD_URL_BATCH_SIZE
} from '@/lib/upload/client/upload/helpers'
import { computePreHash } from '@/lib/upload/client/upload/hashing'
import { mapCompletedFileToUploadedFile, mapSearchItemToUploadedFile } from '@/lib/upload/client/upload/mappers'
import { uploadPartBatch } from '@/lib/upload/client/upload/multipart'
import { createMonotonicProgressReporter, emitProgress } from '@/lib/upload/client/upload/progress'
import type { UploadFileInput, UploadFileResult } from '@/lib/upload/client/upload/types'
import { DEFAULT_MULTIPART_THRESHOLD } from '@/lib/upload/shared'
import type { UploadStrategy } from '@/lib/upload/shared'

export type { UploadFileInput, UploadFileResult } from '@/lib/upload/client/upload/types'

export async function uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
  if (!input.file) {
    throw new Error('No file selected')
  }

  raiseIfAborted(input.signal)

  const folderID = resolveTargetFolderID(input)
  const chunkSize = resolveChunkSize(input)
  const shouldMultipart = input.file.size >= (input.multipartThreshold ?? DEFAULT_MULTIPART_THRESHOLD)
  const totalParts = shouldMultipart ? Math.max(1, Math.ceil(input.file.size / chunkSize)) : 1
  const strategy: UploadStrategy = totalParts > 1 ? 'multipart' : 'single'

  input.onStageChange?.('checking', '检查是否使用秒传')
  const searchResult = await searchFileRequest({
    query: buildSearchQuery(folderID, input.file.name),
    order_by: 'name ASC',
    limit: 1
  })

  if (searchResult.items.length > 0) {
    emitProgress(input, input.file.size, input.file.size)
    input.onStageChange?.('done', '秒传完成')
    return {
      file: mapSearchItemToUploadedFile(searchResult.items[0], input),
      strategy: 'instant',
      instantUpload: true
    }
  }

  const preHash = await computePreHash(input)
  raiseIfAborted(input.signal)

  const firstBatchEnd = Math.min(UPLOAD_URL_BATCH_SIZE, totalParts)
  const firstBatchParts = buildPartInfoList(1, firstBatchEnd)
  const localModifiedAt = input.file.lastModified > 0 ? new Date(input.file.lastModified).toISOString() : undefined

  input.onStageChange?.('checking', '创建上传会话')
  const createResult = await createWithFoldersFileRequest({
    part_info_list: firstBatchParts,
    parent_file_id: folderID,
    name: input.file.name,
    type: 'file',
    check_name_mode: 'auto_rename',
    size: input.file.size,
    create_scene: 'file_upload',
    device_name: 'web',
    local_modified_at: localModifiedAt,
    pre_hash: preHash,
    content_type: input.file.type || 'application/octet-stream',
    chunk_size: chunkSize
  })

  if (createResult.rapid_upload) {
    input.onStageChange?.('finalizing', 'Rapid upload hit, finalizing...')
  } else {
    input.onStageChange?.('uploading', '上传文件')
    const progressReporter = createMonotonicProgressReporter(input, input.file.size, 0)
    const committedBytesRef = { value: 0 }
    let nextPartNumber = 1
    let partInfoList = createResult.part_info_list ?? []

    while (nextPartNumber <= totalParts) {
      if (partInfoList.length === 0) {
        const batchEnd = Math.min(nextPartNumber + UPLOAD_URL_BATCH_SIZE - 1, totalParts)
        const uploadURLResult = await getUploadURLFileRequest({
          upload_id: createResult.upload_id,
          file_id: createResult.file_id,
          part_info_list: buildPartInfoList(nextPartNumber, batchEnd)
        })
        partInfoList = uploadURLResult.part_info_list
      }

      await uploadPartBatch(input, partInfoList, chunkSize, committedBytesRef, progressReporter)
      const maxPartNumber = Math.max(...partInfoList.map(item => item.part_number))
      nextPartNumber = maxPartNumber + 1
      partInfoList = []
    }

    progressReporter.force(input.file.size)
  }

  raiseIfAborted(input.signal)
  input.onStageChange?.('finalizing', '分片合并')
  const completed = await completeFileRequest({
    upload_id: createResult.upload_id,
    file_id: createResult.file_id
  })

  emitProgress(input, input.file.size, input.file.size)
  input.onStageChange?.('done', '上传完成')
  return {
    file: mapCompletedFileToUploadedFile(completed, input, strategy),
    strategy,
    instantUpload: false
  }
}
