import { getParentFolderPath, isValidFolderName, joinFolderPath, normalizeFolderName } from '@/lib/upload/path'
import type {
  FileAccessUrlResponse,
  InstantCheckResponse,
  MultipartPartUrlResponse,
  MultipartStatusResponse,
  MultipartUploadInitResponse,
  MultipartUploadedPart,
  SingleUploadCompleteResponse,
  SingleUploadInitResponse,
  UploadBatchRequest,
  UploadBatchResponse,
  UploadEntriesResponse,
  UploadFileMoveResponse,
  UploadFileRenameResponse,
  UploadFolderCreateResponse,
  UploadFolderMoveResponse,
  UploadFolderRecord,
  UploadFolderRenameResponse,
  UploadMoveTargetsResponse,
  UploadedFileRecord,
  UploadStrategy
} from '@/lib/upload/shared'

const MOCK_BUCKET = 'mock-upload-bucket'
const MOCK_UPLOAD_URL_BASE = 'mock://upload'
const MIN_LATENCY_MS = 30
const MAX_LATENCY_MS = 120

interface SingleUploadSession {
  id: string
  objectKey: string
  fileName: string
  folderId: string
  folderPath: string
  contentType: string
  fileSize: number
  fileSampleHash: string
  fileHash?: string
}

interface MultipartUploadSession {
  id: string
  objectKey: string
  fileName: string
  folderId: string
  folderPath: string
  contentType: string
  fileSize: number
  fileSampleHash: string
  fileHash?: string
  chunkSize: number
  totalParts: number
  uploadedParts: Map<number, MultipartUploadedPart>
}

const state = {
  initialized: false,
  folders: new Map<string, UploadFolderRecord>(),
  files: new Map<string, UploadedFileRecord>(),
  singleSessions: new Map<string, SingleUploadSession>(),
  multipartSessions: new Map<string, MultipartUploadSession>()
}

function nowIso() {
  return new Date().toISOString()
}

function createId(prefix: string) {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `${prefix}-${random}`
}

function fileExtensionFromName(fileName: string) {
  const dotIndex = fileName.lastIndexOf('.')
  if (dotIndex <= 0 || dotIndex === fileName.length - 1) {
    return ''
  }

  return fileName.slice(dotIndex + 1)
}

function toPositiveNumber(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null
  }

  return value
}

function toNonEmptyString(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function cloneFile(file: UploadedFileRecord): UploadedFileRecord {
  return { ...file }
}

function cloneFolder(folder: UploadFolderRecord): UploadFolderRecord {
  return { ...folder }
}

function cloneUploadedParts(parts: Map<number, MultipartUploadedPart>) {
  return Array.from(parts.values())
    .map(part => ({ ...part }))
    .sort((left, right) => left.partNumber - right.partNumber)
}

function sortFoldersByName(folders: UploadFolderRecord[]) {
  return folders.sort((left, right) => left.folderName.localeCompare(right.folderName))
}

function sortFoldersByPath(folders: UploadFolderRecord[]) {
  return folders.sort((left, right) => left.folderPath.localeCompare(right.folderPath))
}

function sortFilesByName(files: UploadedFileRecord[]) {
  return files.sort((left, right) => left.fileName.localeCompare(right.fileName))
}

function ensureInitialized() {
  if (state.initialized) {
    return
  }

  const rootCreatedAt = nowIso()
  state.folders.set('root', {
    id: 'root',
    folderName: 'root',
    parentId: null,
    folderPath: '',
    parentPath: '',
    createdAt: rootCreatedAt,
    updatedAt: rootCreatedAt
  })
  state.initialized = true
}

function getFolderById(folderId: string) {
  const folder = state.folders.get(folderId)
  if (!folder) {
    throw new Error('Folder does not exist')
  }
  return folder
}

function getFileById(fileId: string) {
  const file = state.files.get(fileId)
  if (!file) {
    throw new Error('File does not exist')
  }
  return file
}

function findFolderByPath(path: string) {
  for (const folder of state.folders.values()) {
    if (folder.folderPath === path) {
      return folder
    }
  }

  return null
}

function findFileNameConflict(folderId: string, fileName: string, ignoreFileId?: string) {
  for (const file of state.files.values()) {
    if (file.folderId === folderId && file.fileName === fileName && file.id !== ignoreFileId) {
      return file
    }
  }

  return null
}

function findFolderNameConflict(parentId: string | null, folderName: string, ignoreFolderId?: string) {
  for (const folder of state.folders.values()) {
    if (folder.parentId === parentId && folder.folderName === folderName && folder.id !== ignoreFolderId) {
      return folder
    }
  }

  return null
}

function ensureNoNameConflict(
  targetParentId: string,
  entryName: string,
  options: {
    ignoreFileId?: string
    ignoreFolderId?: string
  } = {}
) {
  if (findFileNameConflict(targetParentId, entryName, options.ignoreFileId)) {
    throw new Error('A file with the same name already exists in this folder')
  }

  if (findFolderNameConflict(targetParentId, entryName, options.ignoreFolderId)) {
    throw new Error('A folder with the same name already exists in this folder')
  }
}

function getFolderChildren(parentId: string) {
  return sortFoldersByName(
    Array.from(state.folders.values())
      .filter(folder => folder.parentId === parentId)
      .map(folder => cloneFolder(folder))
  )
}

function getFolderFiles(folderId: string) {
  return sortFilesByName(
    Array.from(state.files.values())
      .filter(file => file.folderId === folderId)
      .map(file => cloneFile(file))
  )
}

function buildBreadcrumbs(folderId: string) {
  const breadcrumbs: UploadEntriesResponse['breadcrumbs'] = []
  const seen = new Set<string>()
  let cursor: UploadFolderRecord | null = getFolderById(folderId)

  while (cursor && !seen.has(cursor.id)) {
    breadcrumbs.push({
      id: cursor.id,
      label: cursor.folderName,
      path: cursor.folderPath
    })
    seen.add(cursor.id)
    cursor = cursor.parentId ? (state.folders.get(cursor.parentId) ?? null) : null
  }

  return breadcrumbs.reverse()
}

function createObjectKey(folderPath: string, fileName: string) {
  const normalizedFolderPath = folderPath ? `${folderPath}/` : ''
  return `mock/${normalizedFolderPath}${Date.now()}-${Math.random().toString(16).slice(2)}-${fileName}`
}

function createMockUploadUrl(kind: 'single' | 'multipart', sessionId: string, partNumber?: number) {
  if (kind === 'multipart' && partNumber) {
    return `${MOCK_UPLOAD_URL_BASE}/${kind}/${sessionId}/${partNumber}`
  }

  return `${MOCK_UPLOAD_URL_BASE}/${kind}/${sessionId}`
}

function createStoredFileRecord(input: {
  fileName: string
  folderId: string
  folderPath: string
  contentType: string
  fileSize: number
  fileHash: string
  fileSampleHash: string
  objectKey: string
  strategy: UploadStrategy
}) {
  const timestamp = nowIso()
  const record: UploadedFileRecord = {
    id: createId('file'),
    fileName: input.fileName,
    fileExtension: fileExtensionFromName(input.fileName),
    folderId: input.folderId,
    folderPath: input.folderPath,
    contentType: input.contentType || 'application/octet-stream',
    fileSize: input.fileSize,
    fileHash: input.fileHash,
    fileSampleHash: input.fileSampleHash,
    objectKey: input.objectKey,
    bucket: MOCK_BUCKET,
    strategy: input.strategy,
    createdAt: timestamp,
    updatedAt: timestamp
  }
  state.files.set(record.id, record)
  return record
}

function createInstantAliasFile(
  sourceFile: UploadedFileRecord,
  targetFolder: UploadFolderRecord,
  nextFileName: string,
  contentType?: string
) {
  ensureNoNameConflict(targetFolder.id, nextFileName)
  return createStoredFileRecord({
    fileName: nextFileName,
    folderId: targetFolder.id,
    folderPath: targetFolder.folderPath,
    contentType: contentType || sourceFile.contentType,
    fileSize: sourceFile.fileSize,
    fileHash: sourceFile.fileHash,
    fileSampleHash: sourceFile.fileSampleHash,
    objectKey: sourceFile.objectKey,
    strategy: 'instant'
  })
}

function findFileByHash(fileHash: string) {
  for (const file of state.files.values()) {
    if (file.fileHash === fileHash) {
      return file
    }
  }
  return null
}

function findFileBySampleHash(fileSampleHash: string, fileSize: number) {
  for (const file of state.files.values()) {
    if (file.fileSampleHash === fileSampleHash && file.fileSize === fileSize) {
      return file
    }
  }
  return null
}

function isDescendantFolder(candidateFolderId: string, ancestorFolderId: string) {
  if (candidateFolderId === ancestorFolderId) {
    return true
  }

  let cursor: UploadFolderRecord | null = state.folders.get(candidateFolderId) ?? null
  while (cursor?.parentId) {
    if (cursor.parentId === ancestorFolderId) {
      return true
    }
    cursor = state.folders.get(cursor.parentId) ?? null
  }

  return false
}

function syncFolderTreePaths(folderId: string, timestamp: string) {
  const folder = getFolderById(folderId)
  folder.updatedAt = timestamp

  for (const file of state.files.values()) {
    if (file.folderId !== folder.id) {
      continue
    }

    file.folderPath = folder.folderPath
    file.updatedAt = timestamp
  }

  const directChildren = Array.from(state.folders.values()).filter(item => item.parentId === folder.id)
  for (const child of directChildren) {
    child.parentPath = folder.folderPath
    child.folderPath = joinFolderPath(folder.folderPath, child.folderName)
    syncFolderTreePaths(child.id, timestamp)
  }
}

function renameUploadedFileInternal(input: { fileId: string; fileName: string }) {
  const file = getFileById(input.fileId)
  const nextFileName = normalizeFolderName(input.fileName)
  if (!nextFileName) {
    throw new Error('fileName is required')
  }

  ensureNoNameConflict(file.folderId, nextFileName, {
    ignoreFileId: file.id
  })

  file.fileName = nextFileName
  file.fileExtension = fileExtensionFromName(nextFileName)
  file.updatedAt = nowIso()
  return file
}

function renameUploadFolderInternal(input: { folderId: string; folderName: string }) {
  const folder = getFolderById(input.folderId)
  if (folder.id === 'root') {
    throw new Error('Root folder cannot be renamed')
  }

  const nextFolderName = normalizeFolderName(input.folderName)
  if (!nextFolderName) {
    throw new Error('folderName is required')
  }

  if (!isValidFolderName(nextFolderName)) {
    throw new Error('Invalid folder name')
  }

  ensureNoNameConflict(folder.parentId ?? 'root', nextFolderName, {
    ignoreFolderId: folder.id
  })

  const parentFolder = getFolderById(folder.parentId ?? 'root')
  const timestamp = nowIso()

  folder.folderName = nextFolderName
  folder.parentPath = parentFolder.folderPath
  folder.folderPath = joinFolderPath(parentFolder.folderPath, nextFolderName)
  syncFolderTreePaths(folder.id, timestamp)
  return folder
}

function moveUploadedFileInternal(input: { fileId: string; targetFolderId: string }) {
  const file = getFileById(input.fileId)
  const targetFolder = getFolderById(input.targetFolderId)

  ensureNoNameConflict(targetFolder.id, file.fileName, {
    ignoreFileId: file.id
  })

  const timestamp = nowIso()
  file.folderId = targetFolder.id
  file.folderPath = targetFolder.folderPath
  file.updatedAt = timestamp
  return file
}

function moveUploadFolderInternal(input: { folderId: string; targetParentId: string }) {
  const folder = getFolderById(input.folderId)
  if (folder.id === 'root') {
    throw new Error('Root folder cannot be moved')
  }

  const targetParent = getFolderById(input.targetParentId)
  if (targetParent.id === folder.id || isDescendantFolder(targetParent.id, folder.id)) {
    throw new Error('Cannot move a folder into itself or its descendant folder')
  }

  ensureNoNameConflict(targetParent.id, folder.folderName, {
    ignoreFolderId: folder.id
  })

  const timestamp = nowIso()
  folder.parentId = targetParent.id
  folder.parentPath = targetParent.folderPath
  folder.folderPath = joinFolderPath(targetParent.folderPath, folder.folderName)
  syncFolderTreePaths(folder.id, timestamp)
  return folder
}

async function withLatency<T>(handler: () => T | Promise<T>) {
  ensureInitialized()
  const latency = MIN_LATENCY_MS + Math.floor(Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS + 1))
  await new Promise(resolve => setTimeout(resolve, latency))
  return handler()
}

export function listUploadedFilesRequest() {
  return withLatency(() => sortFilesByName(Array.from(state.files.values()).map(file => cloneFile(file))))
}

export function listUploadEntriesRequest(folderId: string) {
  return withLatency<UploadEntriesResponse>(() => {
    const targetFolder = getFolderById(toNonEmptyString(folderId) ?? 'root')
    return {
      folderId: targetFolder.id,
      path: targetFolder.folderPath,
      parentPath: getParentFolderPath(targetFolder.folderPath),
      breadcrumbs: buildBreadcrumbs(targetFolder.id),
      folders: getFolderChildren(targetFolder.id),
      files: getFolderFiles(targetFolder.id)
    }
  })
}

export function createUploadFolderRequest(input: { parentFolderId?: string; parentPath?: string; folderName: string }) {
  return withLatency<UploadFolderCreateResponse>(() => {
    const folderName = normalizeFolderName(input.folderName)
    if (!folderName) {
      throw new Error('folderName is required')
    }
    if (!isValidFolderName(folderName)) {
      throw new Error('Invalid folder name')
    }

    const parentFromId = input.parentFolderId ? (state.folders.get(input.parentFolderId) ?? null) : null
    const parentFolder =
      parentFromId ?? (input.parentPath ? findFolderByPath(input.parentPath) : null) ?? getFolderById('root')

    ensureNoNameConflict(parentFolder.id, folderName)

    const timestamp = nowIso()
    const folder: UploadFolderRecord = {
      id: createId('folder'),
      folderName,
      parentId: parentFolder.id,
      folderPath: joinFolderPath(parentFolder.folderPath, folderName),
      parentPath: parentFolder.folderPath,
      createdAt: timestamp,
      updatedAt: timestamp
    }
    state.folders.set(folder.id, folder)
    return {
      folder: cloneFolder(folder)
    }
  })
}

export function listUploadMoveTargetsRequest(input?: { excludeFolderId?: string }) {
  return withLatency<UploadMoveTargetsResponse>(() => {
    const excludeFolderId = toNonEmptyString(input?.excludeFolderId)
    const folders = Array.from(state.folders.values()).filter(folder => {
      if (!excludeFolderId) {
        return true
      }

      return !isDescendantFolder(folder.id, excludeFolderId)
    })

    return {
      folders: sortFoldersByPath(folders.map(folder => cloneFolder(folder)))
    }
  })
}

export function renameUploadedFileRequest(input: { fileId: string; fileName: string }) {
  return withLatency<UploadFileRenameResponse>(() => {
    const file = renameUploadedFileInternal(input)
    return {
      file: cloneFile(file)
    }
  })
}

export function renameUploadFolderRequest(input: { folderId: string; folderName: string }) {
  return withLatency<UploadFolderRenameResponse>(() => {
    const folder = renameUploadFolderInternal(input)
    return {
      folder: cloneFolder(folder)
    }
  })
}

export function moveUploadedFileRequest(input: { fileId: string; targetFolderId: string }) {
  return withLatency<UploadFileMoveResponse>(() => {
    const file = moveUploadedFileInternal(input)
    return {
      file: cloneFile(file)
    }
  })
}

export function moveUploadFolderRequest(input: { folderId: string; targetParentId: string }) {
  return withLatency<UploadFolderMoveResponse>(() => {
    const folder = moveUploadFolderInternal(input)
    return {
      folder: cloneFolder(folder)
    }
  })
}

export function uploadBatchRequest(input: UploadBatchRequest) {
  return withLatency<UploadBatchResponse>(() => {
    if (!Array.isArray(input.requests)) {
      throw new Error('Invalid batch requests')
    }

    const responses: UploadBatchResponse['responses'] = []
    for (const request of input.requests) {
      const responseId = toNonEmptyString(request?.id) ?? createId('batch')
      try {
        if (!request || request.method !== 'POST') {
          throw new Error('Unsupported batch request method')
        }

        if (request.url === '/file/move') {
          const fileId = toNonEmptyString(request.body.fileId)
          const targetFolderId = toNonEmptyString(request.body.targetFolderId)
          if (!fileId || !targetFolderId) {
            throw new Error('fileId and targetFolderId are required')
          }

          const movedFile = moveUploadedFileInternal({
            fileId,
            targetFolderId
          })
          responses.push({
            id: responseId,
            success: true,
            data: {
              file: cloneFile(movedFile)
            }
          })
          continue
        }

        if (request.url === '/file/rename') {
          const fileId = toNonEmptyString(request.body.fileId)
          const fileName = toNonEmptyString(request.body.fileName)
          if (!fileId || !fileName) {
            throw new Error('fileId and fileName are required')
          }

          const renamedFile = renameUploadedFileInternal({
            fileId,
            fileName
          })
          responses.push({
            id: responseId,
            success: true,
            data: {
              file: cloneFile(renamedFile)
            }
          })
          continue
        }

        if (request.url === '/folder/move') {
          const folderId = toNonEmptyString(request.body.folderId)
          const targetParentId = toNonEmptyString(request.body.targetParentId)
          if (!folderId || !targetParentId) {
            throw new Error('folderId and targetParentId are required')
          }

          const movedFolder = moveUploadFolderInternal({
            folderId,
            targetParentId
          })
          responses.push({
            id: responseId,
            success: true,
            data: {
              folder: cloneFolder(movedFolder)
            }
          })
          continue
        }

        if (request.url === '/folder/rename') {
          const folderId = toNonEmptyString(request.body.folderId)
          const folderName = toNonEmptyString(request.body.folderName)
          if (!folderId || !folderName) {
            throw new Error('folderId and folderName are required')
          }

          const renamedFolder = renameUploadFolderInternal({
            folderId,
            folderName
          })
          responses.push({
            id: responseId,
            success: true,
            data: {
              folder: cloneFolder(renamedFolder)
            }
          })
          continue
        }

        throw new Error('Unsupported batch request url')
      } catch (error) {
        responses.push({
          id: responseId,
          success: false,
          error: error instanceof Error ? error.message : 'Batch request failed'
        })
      }
    }

    return {
      responses
    }
  })
}

export function instantCheckRequest(input: {
  fileHash?: string
  fileSampleHash?: string
  fileSize?: number
  fileName?: string
  contentType?: string
  folderId?: string
}) {
  return withLatency<InstantCheckResponse>(() => {
    const folderId = toNonEmptyString(input.folderId) ?? 'root'
    const targetFolder = getFolderById(folderId)
    const fileHash = toNonEmptyString(input.fileHash)
    const fileName = toNonEmptyString(input.fileName)
    const contentType = toNonEmptyString(input.contentType) ?? 'application/octet-stream'

    if (fileHash) {
      const existingFile = findFileByHash(fileHash)
      if (!existingFile) {
        return {
          instantUpload: false,
          requiresFullHash: false
        }
      }

      if (fileName) {
        const sameNameFile = findFileNameConflict(targetFolder.id, fileName)
        if (sameNameFile) {
          if (sameNameFile.fileHash === existingFile.fileHash) {
            return {
              instantUpload: true,
              requiresFullHash: false,
              file: cloneFile(sameNameFile)
            }
          }

          throw new Error('A file with the same name already exists in this folder')
        }

        const alias = createInstantAliasFile(existingFile, targetFolder, fileName, contentType)
        return {
          instantUpload: true,
          requiresFullHash: false,
          file: cloneFile(alias)
        }
      }

      return {
        instantUpload: true,
        requiresFullHash: false,
        file: cloneFile(existingFile)
      }
    }

    const fileSampleHash = toNonEmptyString(input.fileSampleHash)
    const fileSize = toPositiveNumber(input.fileSize)
    if (!fileSampleHash || !fileSize) {
      return {
        instantUpload: false,
        requiresFullHash: false
      }
    }

    const matchedFile = findFileBySampleHash(fileSampleHash, fileSize)
    return {
      instantUpload: false,
      requiresFullHash: Boolean(matchedFile)
    }
  })
}

export function initSingleUploadRequest(input: {
  fileName: string
  folderId?: string
  contentType: string
  fileSize: number
  fileSampleHash: string
  fileHash?: string
}) {
  return withLatency<SingleUploadInitResponse>(() => {
    const fileName = toNonEmptyString(input.fileName)
    const fileSize = toPositiveNumber(input.fileSize)
    const fileSampleHash = toNonEmptyString(input.fileSampleHash)
    if (!fileName || !fileSize || !fileSampleHash) {
      throw new Error('fileName, fileSize and fileSampleHash are required')
    }

    const folderId = toNonEmptyString(input.folderId) ?? 'root'
    const targetFolder = getFolderById(folderId)
    const contentType = toNonEmptyString(input.contentType) ?? 'application/octet-stream'
    const fileHash = toNonEmptyString(input.fileHash)

    const sameNameFile = findFileNameConflict(targetFolder.id, fileName)
    if (sameNameFile) {
      if (fileHash && sameNameFile.fileHash === fileHash) {
        return {
          instantUpload: true,
          file: cloneFile(sameNameFile)
        }
      }
      throw new Error('A file with the same name already exists in this folder')
    }

    if (fileHash) {
      const existingFile = findFileByHash(fileHash)
      if (existingFile) {
        const alias = createInstantAliasFile(existingFile, targetFolder, fileName, contentType)
        return {
          instantUpload: true,
          file: cloneFile(alias)
        }
      }
    }

    const sessionId = createId('single')
    const session: SingleUploadSession = {
      id: sessionId,
      objectKey: createObjectKey(targetFolder.folderPath, fileName),
      fileName,
      folderId: targetFolder.id,
      folderPath: targetFolder.folderPath,
      contentType,
      fileSize,
      fileSampleHash,
      fileHash: fileHash ?? undefined
    }

    state.singleSessions.set(session.id, session)

    return {
      instantUpload: false,
      session: {
        sessionId: session.id,
        objectKey: session.objectKey,
        uploadUrl: createMockUploadUrl('single', session.id),
        expiresInSeconds: 600
      }
    }
  })
}

export function completeSingleUploadRequest(input: { sessionId: string; fileHash?: string }) {
  return withLatency<SingleUploadCompleteResponse>(() => {
    const sessionId = toNonEmptyString(input.sessionId)
    if (!sessionId) {
      throw new Error('sessionId is required')
    }

    const session = state.singleSessions.get(sessionId)
    if (!session) {
      throw new Error('Upload session does not exist')
    }

    const resolvedHash = toNonEmptyString(input.fileHash) ?? session.fileHash ?? `pending:${session.id}`
    ensureNoNameConflict(session.folderId, session.fileName)

    const file = createStoredFileRecord({
      fileName: session.fileName,
      folderId: session.folderId,
      folderPath: session.folderPath,
      contentType: session.contentType,
      fileSize: session.fileSize,
      fileHash: resolvedHash,
      fileSampleHash: session.fileSampleHash,
      objectKey: session.objectKey,
      strategy: 'single'
    })

    state.singleSessions.delete(session.id)
    return {
      file: cloneFile(file)
    }
  })
}

export function initMultipartUploadRequest(input: {
  fileName: string
  folderId?: string
  contentType: string
  fileSize: number
  fileSampleHash: string
  fileHash?: string
  chunkSize: number
  resumeSessionId?: string
}) {
  return withLatency<MultipartUploadInitResponse>(() => {
    const fileName = toNonEmptyString(input.fileName)
    const fileSize = toPositiveNumber(input.fileSize)
    const fileSampleHash = toNonEmptyString(input.fileSampleHash)
    const chunkSize = toPositiveNumber(input.chunkSize)
    if (!fileName || !fileSize || !fileSampleHash || !chunkSize) {
      throw new Error('fileName, fileSize, fileSampleHash and chunkSize are required')
    }

    const folderId = toNonEmptyString(input.folderId) ?? 'root'
    const targetFolder = getFolderById(folderId)
    const contentType = toNonEmptyString(input.contentType) ?? 'application/octet-stream'
    const fileHash = toNonEmptyString(input.fileHash)
    const resumeSessionId = toNonEmptyString(input.resumeSessionId)

    const sameNameFile = findFileNameConflict(targetFolder.id, fileName)
    if (sameNameFile) {
      if (fileHash && sameNameFile.fileHash === fileHash) {
        return {
          instantUpload: true,
          file: cloneFile(sameNameFile)
        }
      }
      throw new Error('A file with the same name already exists in this folder')
    }

    if (fileHash) {
      const existingFile = findFileByHash(fileHash)
      if (existingFile) {
        const alias = createInstantAliasFile(existingFile, targetFolder, fileName, contentType)
        return {
          instantUpload: true,
          file: cloneFile(alias)
        }
      }
    }

    let session: MultipartUploadSession | undefined
    if (resumeSessionId) {
      session = state.multipartSessions.get(resumeSessionId)
      if (session && session.folderId !== targetFolder.id) {
        session = undefined
      }
    }

    if (!session) {
      const sessionId = createId('multipart')
      const totalParts = Math.max(1, Math.ceil(fileSize / chunkSize))
      session = {
        id: sessionId,
        objectKey: createObjectKey(targetFolder.folderPath, fileName),
        fileName,
        folderId: targetFolder.id,
        folderPath: targetFolder.folderPath,
        contentType,
        fileSize,
        fileSampleHash,
        fileHash: fileHash ?? undefined,
        chunkSize,
        totalParts,
        uploadedParts: new Map<number, MultipartUploadedPart>()
      }
      state.multipartSessions.set(session.id, session)
    }

    return {
      instantUpload: false,
      session: {
        sessionId: session.id,
        objectKey: session.objectKey,
        chunkSize: session.chunkSize,
        totalParts: session.totalParts,
        uploadedParts: cloneUploadedParts(session.uploadedParts)
      }
    }
  })
}

export function getMultipartStatusRequest(sessionId: string) {
  return withLatency<MultipartStatusResponse>(() => {
    const normalizedSessionId = toNonEmptyString(sessionId)
    if (!normalizedSessionId) {
      throw new Error('sessionId is required')
    }

    const session = state.multipartSessions.get(normalizedSessionId)
    if (!session) {
      throw new Error('Upload session does not exist')
    }

    const uploadedParts = cloneUploadedParts(session.uploadedParts)
    return {
      sessionId: session.id,
      chunkSize: session.chunkSize,
      totalParts: session.totalParts,
      uploadedParts,
      uploadedBytes: uploadedParts.reduce((total, part) => total + part.size, 0)
    }
  })
}

export function getMultipartPartUrlRequest(sessionId: string, partNumber: number) {
  return withLatency<MultipartPartUrlResponse>(() => {
    const normalizedSessionId = toNonEmptyString(sessionId)
    if (!normalizedSessionId) {
      throw new Error('sessionId is required')
    }

    const session = state.multipartSessions.get(normalizedSessionId)
    if (!session) {
      throw new Error('Upload session does not exist')
    }

    if (!Number.isInteger(partNumber) || partNumber <= 0) {
      throw new Error('partNumber must be a positive integer')
    }
    if (partNumber > session.totalParts) {
      throw new Error(`partNumber exceeds total parts (${session.totalParts})`)
    }

    return {
      partNumber,
      uploadUrl: createMockUploadUrl('multipart', session.id, partNumber),
      expiresInSeconds: 600
    }
  })
}

export function reportMultipartPartCompletedRequest(input: {
  sessionId: string
  partNumber: number
  size: number
  eTag: string
}) {
  return withLatency<{ uploadedBytes: number; uploadedParts: number }>(() => {
    const sessionId = toNonEmptyString(input.sessionId)
    const size = toPositiveNumber(input.size)
    if (!sessionId || !size) {
      throw new Error('sessionId and size are required')
    }

    const session = state.multipartSessions.get(sessionId)
    if (!session) {
      throw new Error('Upload session does not exist')
    }

    const partNumber = input.partNumber
    if (!Number.isInteger(partNumber) || partNumber <= 0 || partNumber > session.totalParts) {
      throw new Error('partNumber is invalid')
    }

    const part: MultipartUploadedPart = {
      partNumber,
      size,
      eTag: toNonEmptyString(input.eTag) ?? ''
    }
    session.uploadedParts.set(partNumber, part)

    const uploadedParts = cloneUploadedParts(session.uploadedParts)
    return {
      uploadedBytes: uploadedParts.reduce((total, current) => total + current.size, 0),
      uploadedParts: uploadedParts.length
    }
  })
}

export function completeMultipartUploadRequest(input: { sessionId: string; fileHash?: string }) {
  return withLatency<SingleUploadCompleteResponse>(() => {
    const sessionId = toNonEmptyString(input.sessionId)
    if (!sessionId) {
      throw new Error('sessionId is required')
    }

    const session = state.multipartSessions.get(sessionId)
    if (!session) {
      throw new Error('Upload session does not exist')
    }

    if (session.uploadedParts.size < session.totalParts) {
      throw new Error(`Not all parts uploaded. ${session.uploadedParts.size}/${session.totalParts}`)
    }

    const resolvedHash = toNonEmptyString(input.fileHash) ?? session.fileHash ?? `pending:${session.id}`
    ensureNoNameConflict(session.folderId, session.fileName)

    const file = createStoredFileRecord({
      fileName: session.fileName,
      folderId: session.folderId,
      folderPath: session.folderPath,
      contentType: session.contentType,
      fileSize: session.fileSize,
      fileHash: resolvedHash,
      fileSampleHash: session.fileSampleHash,
      objectKey: session.objectKey,
      strategy: 'multipart'
    })

    state.multipartSessions.delete(session.id)
    return {
      file: cloneFile(file)
    }
  })
}

export function abortMultipartUploadRequest(sessionId: string) {
  return withLatency<{ aborted: boolean }>(() => {
    const normalizedSessionId = toNonEmptyString(sessionId)
    if (!normalizedSessionId) {
      throw new Error('sessionId is required')
    }

    if (!state.multipartSessions.has(normalizedSessionId)) {
      throw new Error('Upload session does not exist')
    }

    state.multipartSessions.delete(normalizedSessionId)
    return {
      aborted: true
    }
  })
}

export function getFileAccessUrlRequest(input: { fileId: string; mode: 'preview' | 'download' }) {
  return withLatency<FileAccessUrlResponse>(() => {
    const file = getFileById(input.fileId)
    const mode = input.mode === 'preview' ? 'preview' : 'download'
    const text = [
      mode === 'preview' ? 'Preview File (Mock)' : 'Download File (Mock)',
      `Name: ${file.fileName}`,
      `Size: ${file.fileSize} bytes`,
      `Folder: /${file.folderPath}`,
      `Hash: ${file.fileHash}`
    ].join('\n')

    return {
      file: cloneFile(file),
      url: `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`,
      disposition: mode === 'preview' ? 'inline' : 'attachment',
      expiresInSeconds: 3600
    }
  })
}

export function syncUploadedFileHashRequest(input: { fileId: string; fileHash: string }) {
  return withLatency<{
    updated: boolean
    file: UploadedFileRecord
    conflictFile?: UploadedFileRecord
  }>(() => {
    const file = getFileById(input.fileId)
    const fileHash = toNonEmptyString(input.fileHash)
    if (!fileHash) {
      throw new Error('fileHash is required')
    }

    const conflictFile = Array.from(state.files.values()).find(
      current => current.id !== file.id && current.fileHash === fileHash
    )

    const updated = file.fileHash !== fileHash
    if (updated) {
      file.fileHash = fileHash
      file.updatedAt = nowIso()
    }

    return {
      updated,
      file: cloneFile(file),
      conflictFile: conflictFile ? cloneFile(conflictFile) : undefined
    }
  })
}
