import { Hono } from 'hono'

import { getParentFolderPath, isValidFolderName, joinFolderPath, normalizeFolderPath } from '@/lib/upload/path'
import {
  DEFAULT_MULTIPART_CHUNK_SIZE,
  type FileAccessUrlResponse,
  type InstantCheckResponse,
  MAX_MULTIPART_PARTS,
  type MultipartPartUrlResponse,
  type MultipartStatusResponse,
  type MultipartUploadInitResponse,
  MULTIPART_MIN_PART_SIZE,
  type SingleUploadCompleteResponse,
  type SingleUploadInitResponse,
  type UploadEntriesResponse,
  type UploadFolderCreateResponse
} from '@/lib/upload/shared'
import { createObjectKey } from '@/lib/upload/server/object-key'
import {
  abortMultipartUpload,
  assertObjectExists,
  completeMultipartUpload,
  createFileAccessUrl,
  createMultipartPartPresignedUrl,
  createMultipartUpload,
  createSingleUploadPresignedUrl,
  getUploadBucket,
  listMultipartUploadedParts as listPartsFromS3
} from '@/lib/upload/server/s3-client'
import {
  completeSingleUploadSession,
  createInstantUploadedFileAlias,
  createMultipartUploadSession,
  createSingleUploadSession,
  createUploadFolder,
  ensureUploadFolderPathExists,
  findActiveMultipartSessionByFingerprint,
  findUploadedFileByHash,
  findUploadedFileByPathAndName,
  findUploadedFileBySampleHash,
  getMultipartUploadSession,
  getSingleUploadSession,
  getUploadFolderByPath,
  getUploadedFileById,
  listMultipartUploadedParts,
  listUploadedFiles,
  listUploadFoldersByParentPath,
  registerUploadedFile,
  removeMultipartUploadSession,
  saveMultipartUploadedPart,
  syncUploadedFileHash
} from '@/lib/upload/server/upload-store'

type ApiEnvelope<T> = {
  ok: true
  data: T
}

type ApiErrorEnvelope = {
  ok: false
  error: string
}

function success<T>(data: T): ApiEnvelope<T> {
  return {
    ok: true,
    data
  }
}

function fail(error: string): ApiErrorEnvelope {
  return {
    ok: false,
    error
  }
}

function asNonEmptyString(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const text = value.trim()
  return text.length > 0 ? text : null
}

function asPositiveNumber(value: unknown) {
  if (typeof value !== 'number') {
    return null
  }

  return Number.isFinite(value) && value > 0 ? value : null
}

function asFolderPath(value: unknown) {
  return normalizeFolderPath(typeof value === 'string' ? value : '')
}

function createPendingFileHash(sourceId: string) {
  return `pending:${sourceId}`
}

function sumUploadedBytes(parts: Array<{ size: number }>) {
  return parts.reduce((total, current) => total + current.size, 0)
}

export const uploadApi = new Hono().basePath('/api')

uploadApi.get('/hello', c => {
  return c.json(
    success({
      message: 'Upload API is ready'
    })
  )
})

uploadApi.get('/uploads/files', async c => {
  const folderPathQuery = c.req.query('path')
  const folderPath = folderPathQuery ? normalizeFolderPath(folderPathQuery) : undefined
  const files = await listUploadedFiles(folderPath)
  return c.json(success(files))
})

uploadApi.get('/uploads/entries', async c => {
  const path = asFolderPath(c.req.query('path'))
  if (path) {
    const folder = await getUploadFolderByPath(path)
    if (!folder) {
      return c.json(fail('Folder does not exist'), 404)
    }
  }

  const [folders, files] = await Promise.all([listUploadFoldersByParentPath(path), listUploadedFiles(path)])

  const data: UploadEntriesResponse = {
    path,
    parentPath: getParentFolderPath(path),
    folders,
    files
  }

  return c.json(success(data))
})

uploadApi.post('/uploads/folders', async c => {
  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return c.json(fail('Invalid request body'), 400)
  }

  const parentPath = asFolderPath(body.parentPath)
  const folderName = asNonEmptyString(body.folderName)

  if (!folderName) {
    return c.json(fail('folderName is required'), 400)
  }

  if (!isValidFolderName(folderName)) {
    return c.json(fail('Invalid folder name'), 400)
  }

  if (parentPath) {
    const parent = await getUploadFolderByPath(parentPath)
    if (!parent) {
      return c.json(fail('Parent folder does not exist'), 404)
    }
  }

  const existingFile = await findUploadedFileByPathAndName(parentPath, folderName)
  if (existingFile) {
    return c.json(fail('A file with the same name already exists in this folder'), 409)
  }

  const folderPath = joinFolderPath(parentPath, folderName)
  const created = await createUploadFolder({
    folderName,
    folderPath,
    parentPath
  })

  const data: UploadFolderCreateResponse = {
    folder: created.folder
  }

  return c.json(success(data))
})

uploadApi.post('/uploads/instant-check', async c => {
  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return c.json(fail('Invalid request body'), 400)
  }

  const fileHash = asNonEmptyString(body.fileHash)
  const fileSampleHash = asNonEmptyString(body.fileSampleHash)
  const fileSize = asPositiveNumber(body.fileSize)
  const fileName = asNonEmptyString(body.fileName)
  const contentType = asNonEmptyString(body.contentType) ?? 'application/octet-stream'
  const folderPath = asFolderPath(body.folderPath)

  if (fileHash) {
    const existingFile = await findUploadedFileByHash(fileHash)
    if (!existingFile) {
      const data: InstantCheckResponse = {
        instantUpload: false,
        requiresFullHash: false
      }

      return c.json(success(data))
    }

    if (fileName) {
      try {
        const alias = await createInstantUploadedFileAlias({
          sourceFile: existingFile,
          fileName,
          folderPath,
          contentType
        })
        const data: InstantCheckResponse = {
          instantUpload: true,
          requiresFullHash: false,
          file: alias.file
        }
        return c.json(success(data))
      } catch (error) {
        return c.json(fail(error instanceof Error ? error.message : 'Failed to create instant upload file'), 409)
      }
    }

    const data: InstantCheckResponse = {
      instantUpload: true,
      requiresFullHash: false,
      file: existingFile
    }

    return c.json(success(data))
  }

  if (!fileSampleHash || !fileSize) {
    return c.json(fail('fileHash or (fileSampleHash and fileSize) is required'), 400)
  }

  const sampleMatched = await findUploadedFileBySampleHash(fileSampleHash, fileSize)
  const data: InstantCheckResponse = sampleMatched
    ? {
        instantUpload: false,
        requiresFullHash: true
      }
    : {
        instantUpload: false,
        requiresFullHash: false
      }

  return c.json(success(data))
})

uploadApi.post('/uploads/single/init', async c => {
  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return c.json(fail('Invalid request body'), 400)
  }

  const fileName = asNonEmptyString(body.fileName)
  const contentType = asNonEmptyString(body.contentType) ?? 'application/octet-stream'
  const fileSize = asPositiveNumber(body.fileSize)
  const fileHash = asNonEmptyString(body.fileHash)
  const fileSampleHash = asNonEmptyString(body.fileSampleHash) ?? fileHash
  const folderPath = asFolderPath(body.folderPath)

  if (!fileName || !fileSize || !fileSampleHash) {
    return c.json(fail('fileName, fileSize and fileSampleHash are required'), 400)
  }

  const existingAtTarget = await findUploadedFileByPathAndName(folderPath, fileName)
  if (existingAtTarget) {
    if (fileHash && existingAtTarget.fileHash === fileHash) {
      const data: SingleUploadInitResponse = {
        instantUpload: true,
        file: existingAtTarget
      }
      return c.json(success(data))
    }

    return c.json(fail('A file with the same name already exists in this folder'), 409)
  }

  if (fileHash) {
    const existingFile = await findUploadedFileByHash(fileHash)
    if (existingFile) {
      let alias: Awaited<ReturnType<typeof createInstantUploadedFileAlias>>
      try {
        alias = await createInstantUploadedFileAlias({
          sourceFile: existingFile,
          fileName,
          folderPath,
          contentType
        })
      } catch (error) {
        return c.json(fail(error instanceof Error ? error.message : 'Failed to create instant upload file'), 409)
      }

      const data: SingleUploadInitResponse = {
        instantUpload: true,
        file: alias.file
      }

      return c.json(success(data))
    }
  }

  await ensureUploadFolderPathExists(folderPath)
  const objectKey = createObjectKey(fileName, folderPath)
  const uploadUrl = await createSingleUploadPresignedUrl({
    objectKey,
    contentType
  })

  const session = await createSingleUploadSession({
    objectKey,
    fileName,
    folderPath,
    contentType,
    fileSize,
    fileHash,
    fileSampleHash
  })

  const data: SingleUploadInitResponse = {
    instantUpload: false,
    session: {
      sessionId: session.id,
      objectKey: session.objectKey,
      uploadUrl,
      expiresInSeconds: 600
    }
  }

  return c.json(success(data))
})

uploadApi.post('/uploads/single/complete', async c => {
  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return c.json(fail('Invalid request body'), 400)
  }

  const sessionId = asNonEmptyString(body.sessionId)
  if (!sessionId) {
    return c.json(fail('sessionId is required'), 400)
  }

  const session = await getSingleUploadSession(sessionId)
  if (!session) {
    return c.json(fail('Upload session does not exist'), 404)
  }

  const resolvedFileHash = asNonEmptyString(body.fileHash) ?? session.fileHash ?? createPendingFileHash(session.id)

  await assertObjectExists(session.objectKey)
  await completeSingleUploadSession(sessionId)

  let registered: Awaited<ReturnType<typeof registerUploadedFile>>
  try {
    registered = await registerUploadedFile({
      fileName: session.fileName,
      folderPath: session.folderPath,
      contentType: session.contentType,
      fileSize: session.fileSize,
      fileHash: resolvedFileHash,
      fileSampleHash: session.fileSampleHash,
      objectKey: session.objectKey,
      bucket: getUploadBucket(),
      strategy: 'single'
    })
  } catch (error) {
    return c.json(fail(error instanceof Error ? error.message : 'Failed to register uploaded file'), 409)
  }

  const data: SingleUploadCompleteResponse = {
    file: registered.file
  }

  return c.json(success(data))
})

uploadApi.post('/uploads/multipart/init', async c => {
  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return c.json(fail('Invalid request body'), 400)
  }

  const fileName = asNonEmptyString(body.fileName)
  const contentType = asNonEmptyString(body.contentType) ?? 'application/octet-stream'
  const fileSize = asPositiveNumber(body.fileSize)
  const fileHash = asNonEmptyString(body.fileHash)
  const fileSampleHash = asNonEmptyString(body.fileSampleHash) ?? fileHash
  const resumeSessionId = asNonEmptyString(body.resumeSessionId)
  const requestedChunkSize = asPositiveNumber(body.chunkSize)
  const folderPath = asFolderPath(body.folderPath)

  if (!fileName || !fileSize || !fileSampleHash) {
    return c.json(fail('fileName, fileSize and fileSampleHash are required'), 400)
  }

  const existingAtTarget = await findUploadedFileByPathAndName(folderPath, fileName)
  if (existingAtTarget) {
    if (fileHash && existingAtTarget.fileHash === fileHash) {
      const data: MultipartUploadInitResponse = {
        instantUpload: true,
        file: existingAtTarget
      }
      return c.json(success(data))
    }

    return c.json(fail('A file with the same name already exists in this folder'), 409)
  }

  if (fileHash) {
    const existingFile = await findUploadedFileByHash(fileHash)
    if (existingFile) {
      let alias: Awaited<ReturnType<typeof createInstantUploadedFileAlias>>
      try {
        alias = await createInstantUploadedFileAlias({
          sourceFile: existingFile,
          fileName,
          folderPath,
          contentType
        })
      } catch (error) {
        return c.json(fail(error instanceof Error ? error.message : 'Failed to create instant upload file'), 409)
      }

      const data: MultipartUploadInitResponse = {
        instantUpload: true,
        file: alias.file
      }

      return c.json(success(data))
    }
  }

  const chunkSize = Math.max(requestedChunkSize ?? DEFAULT_MULTIPART_CHUNK_SIZE, MULTIPART_MIN_PART_SIZE)
  const totalParts = Math.ceil(fileSize / chunkSize)

  if (totalParts > MAX_MULTIPART_PARTS) {
    return c.json(fail(`File is too large for multipart upload. Parts: ${totalParts}`), 400)
  }

  await ensureUploadFolderPathExists(folderPath)
  const fingerprintHash = fileHash ?? fileSampleHash
  let session = resumeSessionId ? await getMultipartUploadSession(resumeSessionId) : null
  if (session && session.folderPath !== folderPath) {
    session = null
  }
  if (!session) {
    session = await findActiveMultipartSessionByFingerprint(fingerprintHash, fileSize, folderPath)
  }

  if (!session) {
    const objectKey = createObjectKey(fileName, folderPath)
    const uploadId = await createMultipartUpload({
      objectKey,
      contentType
    })

    session = await createMultipartUploadSession({
      uploadId,
      objectKey,
      fileName,
      folderPath,
      contentType,
      fileSize,
      fileHash,
      fileSampleHash,
      fingerprintHash,
      chunkSize,
      totalParts
    })
  }

  const uploadedParts = (await listMultipartUploadedParts(session.id)) ?? []

  const data: MultipartUploadInitResponse = {
    instantUpload: false,
    session: {
      sessionId: session.id,
      objectKey: session.objectKey,
      chunkSize: session.chunkSize,
      totalParts: session.totalParts,
      uploadedParts
    }
  }

  return c.json(success(data))
})

uploadApi.get('/uploads/multipart/:sessionId/status', async c => {
  const sessionId = c.req.param('sessionId')
  const session = await getMultipartUploadSession(sessionId)
  if (!session) {
    return c.json(fail('Upload session does not exist'), 404)
  }

  const uploadedParts = (await listMultipartUploadedParts(session.id)) ?? []
  const uploadedBytes = sumUploadedBytes(uploadedParts)

  const data: MultipartStatusResponse = {
    sessionId: session.id,
    chunkSize: session.chunkSize,
    totalParts: session.totalParts,
    uploadedParts,
    uploadedBytes
  }

  return c.json(success(data))
})

uploadApi.post('/uploads/multipart/:sessionId/part-url', async c => {
  const sessionId = c.req.param('sessionId')
  const session = await getMultipartUploadSession(sessionId)
  if (!session) {
    return c.json(fail('Upload session does not exist'), 404)
  }

  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return c.json(fail('Invalid request body'), 400)
  }

  const partNumber = asPositiveNumber(body.partNumber)
  if (!partNumber || !Number.isInteger(partNumber)) {
    return c.json(fail('partNumber must be a positive integer'), 400)
  }

  if (partNumber > session.totalParts) {
    return c.json(fail(`partNumber exceeds total parts (${session.totalParts})`), 400)
  }

  const uploadUrl = await createMultipartPartPresignedUrl({
    objectKey: session.objectKey,
    uploadId: session.uploadId,
    partNumber
  })

  const data: MultipartPartUrlResponse = {
    uploadUrl,
    expiresInSeconds: 600,
    partNumber
  }

  return c.json(success(data))
})

uploadApi.post('/uploads/multipart/:sessionId/part-complete', async c => {
  const sessionId = c.req.param('sessionId')
  const session = await getMultipartUploadSession(sessionId)
  if (!session) {
    return c.json(fail('Upload session does not exist'), 404)
  }

  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return c.json(fail('Invalid request body'), 400)
  }

  const partNumber = asPositiveNumber(body.partNumber)
  const size = asPositiveNumber(body.size)
  const eTag = asNonEmptyString(body.eTag) ?? ''

  if (!partNumber || !size || !Number.isInteger(partNumber)) {
    return c.json(fail('partNumber and size are required'), 400)
  }

  await saveMultipartUploadedPart(session.id, {
    partNumber,
    size,
    eTag
  })

  const uploadedParts = (await listMultipartUploadedParts(session.id)) ?? []
  const uploadedBytes = sumUploadedBytes(uploadedParts)

  return c.json(
    success({
      uploadedBytes,
      uploadedParts: uploadedParts.length
    })
  )
})

uploadApi.post('/uploads/multipart/:sessionId/complete', async c => {
  const sessionId = c.req.param('sessionId')
  const session = await getMultipartUploadSession(sessionId)
  if (!session) {
    return c.json(fail('Upload session does not exist'), 404)
  }

  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  const resolvedFileHash =
    (body ? asNonEmptyString(body.fileHash) : null) ?? session.fileHash ?? createPendingFileHash(session.id)

  let uploadedParts = (await listMultipartUploadedParts(session.id)) ?? []
  if (uploadedParts.length < session.totalParts) {
    return c.json(fail(`Not all parts uploaded. ${uploadedParts.length}/${session.totalParts}`), 400)
  }

  const hasMissingETag = uploadedParts.some(part => !part.eTag)
  if (hasMissingETag) {
    const partsFromStorage = await listPartsFromS3({
      objectKey: session.objectKey,
      uploadId: session.uploadId
    })

    const s3PartMap = new Map(partsFromStorage.map(part => [part.partNumber, part]))
    uploadedParts = uploadedParts.map(part => ({
      ...part,
      eTag: part.eTag || s3PartMap.get(part.partNumber)?.eTag || ''
    }))
  }

  const missingETagPart = uploadedParts.find(part => !part.eTag)
  if (missingETagPart) {
    return c.json(fail(`Part ${missingETagPart.partNumber} does not have ETag`), 400)
  }

  await completeMultipartUpload({
    objectKey: session.objectKey,
    uploadId: session.uploadId,
    parts: uploadedParts.map(part => ({
      partNumber: part.partNumber,
      eTag: part.eTag
    }))
  })

  await removeMultipartUploadSession(session.id)

  let registered: Awaited<ReturnType<typeof registerUploadedFile>>
  try {
    registered = await registerUploadedFile({
      fileName: session.fileName,
      folderPath: session.folderPath,
      contentType: session.contentType,
      fileSize: session.fileSize,
      fileHash: resolvedFileHash,
      fileSampleHash: session.fileSampleHash,
      objectKey: session.objectKey,
      bucket: getUploadBucket(),
      strategy: 'multipart'
    })
  } catch (error) {
    return c.json(fail(error instanceof Error ? error.message : 'Failed to register uploaded file'), 409)
  }

  return c.json(
    success({
      file: registered.file
    })
  )
})

uploadApi.post('/uploads/multipart/:sessionId/abort', async c => {
  const sessionId = c.req.param('sessionId')
  const session = await getMultipartUploadSession(sessionId)
  if (!session) {
    return c.json(fail('Upload session does not exist'), 404)
  }

  await abortMultipartUpload({
    objectKey: session.objectKey,
    uploadId: session.uploadId
  })
  await removeMultipartUploadSession(session.id)

  return c.json(
    success({
      aborted: true
    })
  )
})

uploadApi.get('/uploads/files/:fileId/url', async c => {
  const fileId = c.req.param('fileId')
  const mode = c.req.query('mode') === 'preview' ? 'inline' : 'attachment'
  const file = await getUploadedFileById(fileId)

  if (!file) {
    return c.json(fail('File does not exist'), 404)
  }

  const url = await createFileAccessUrl({
    objectKey: file.objectKey,
    fileName: file.fileName,
    inline: mode === 'inline'
  })

  const data: FileAccessUrlResponse = {
    file,
    url,
    disposition: mode,
    expiresInSeconds: 600
  }

  return c.json(success(data))
})

uploadApi.post('/uploads/files/:fileId/hash-sync', async c => {
  const fileId = c.req.param('fileId')
  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return c.json(fail('Invalid request body'), 400)
  }

  const fileHash = asNonEmptyString(body.fileHash)
  if (!fileHash) {
    return c.json(fail('fileHash is required'), 400)
  }

  const result = await syncUploadedFileHash(fileId, fileHash)
  if (!result) {
    return c.json(fail('File does not exist'), 404)
  }

  return c.json(
    success({
      updated: result.updated,
      file: result.file,
      conflictFile: result.conflictFile ?? undefined
    })
  )
})

uploadApi.onError((error, c) => {
  console.error('[upload-api-error]', error)
  return c.json(fail(error.message || 'Unexpected upload error'), 500)
})

uploadApi.notFound(c => c.json(fail('Route not found'), 404))
