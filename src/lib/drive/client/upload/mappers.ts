import type { FileCompleteResponse, FileSearchItem } from '@/lib/drive/client/api'
import type { UploadFileInput } from '@/lib/drive/client/upload/types'
import type { UploadStrategy, UploadedFileRecord } from '@/lib/drive/shared'

import { resolveTargetFolderID, resolveTargetFolderPath } from '@/lib/drive/client/upload/helpers'

function inferFileExtension(fileName: string) {
  const dot = fileName.lastIndexOf('.')
  if (dot <= 0 || dot + 1 >= fileName.length) {
    return ''
  }
  return fileName.slice(dot + 1).toLowerCase()
}

export function mapSearchItemToUploadedFile(item: FileSearchItem, input: UploadFileInput): UploadedFileRecord {
  return {
    id: item.file_id,
    fileName: item.name,
    fileExtension: inferFileExtension(item.name),
    folderId: item.parent_file_id,
    folderPath: resolveTargetFolderPath(input),
    contentType: input.file.type || 'application/octet-stream',
    fileSize: item.size,
    fileHash: '',
    fileSampleHash: '',
    objectKey: '',
    bucket: '',
    strategy: 'instant',
    createdAt: item.created_at || '',
    updatedAt: item.updated_at || ''
  }
}

export function mapCompletedFileToUploadedFile(
  completed: FileCompleteResponse,
  input: UploadFileInput,
  strategy: UploadStrategy
): UploadedFileRecord {
  const fileName = completed.name || input.file.name
  const fileExtension = completed.file_extension || inferFileExtension(fileName)

  return {
    id: completed.file_id,
    fileName,
    fileExtension,
    folderId: completed.parent_file_id || resolveTargetFolderID(input),
    folderPath: resolveTargetFolderPath(input),
    contentType: completed.content_type || input.file.type || 'application/octet-stream',
    fileSize: completed.size ?? input.file.size,
    fileHash: completed.content_hash || '',
    fileSampleHash: '',
    objectKey: '',
    bucket: '',
    strategy,
    createdAt: completed.created_at || '',
    updatedAt: completed.updated_at || ''
  }
}
