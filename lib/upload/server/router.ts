import { Hono } from 'hono'

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
  type SingleUploadInitResponse
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
  createMultipartUploadSession,
  createSingleUploadSession,
  findActiveMultipartSessionByFingerprint,
  findUploadedFileByHash,
  findUploadedFileBySampleHash,
  getMultipartUploadSession,
  getSingleUploadSession,
  getUploadedFileById,
  listMultipartUploadedParts,
  listUploadedFiles,
  registerUploadedFile,
  removeMultipartUploadSession,
  saveMultipartUploadedPart
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
  const files = await listUploadedFiles()
  return c.json(success(files))
})

// 秒传预检：
// 1) 提供 fileHash 时做精确匹配
// 2) 仅提供 sampleHash + fileSize 时，只判断是否需要全量 hash
uploadApi.post('/uploads/instant-check', async c => {
  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return c.json(fail('Invalid request body'), 400)
  }

  const fileHash = asNonEmptyString(body.fileHash)
  const fileSampleHash = asNonEmptyString(body.fileSampleHash)
  const fileSize = asPositiveNumber(body.fileSize)

  if (fileHash) {
    const existingFile = await findUploadedFileByHash(fileHash)
    const data: InstantCheckResponse = existingFile
      ? {
          instantUpload: true,
          requiresFullHash: false,
          file: existingFile
        }
      : {
          instantUpload: false,
          requiresFullHash: false
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

  if (!fileName || !fileSize || !fileSampleHash) {
    return c.json(fail('fileName, fileSize and fileSampleHash are required'), 400)
  }

  if (fileHash) {
    const existingFile = await findUploadedFileByHash(fileHash)
    if (existingFile) {
      const data: SingleUploadInitResponse = {
        instantUpload: true,
        file: existingFile
      }

      return c.json(success(data))
    }
  }

  const objectKey = createObjectKey(fileName)
  const uploadUrl = await createSingleUploadPresignedUrl({
    objectKey,
    contentType
  })

  const session = await createSingleUploadSession({
    objectKey,
    fileName,
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

  const resolvedFileHash = asNonEmptyString(body.fileHash) ?? session.fileHash
  if (!resolvedFileHash) {
    return c.json(fail('fileHash is required before completion'), 400)
  }

  await assertObjectExists(session.objectKey)
  await completeSingleUploadSession(sessionId)

  const registered = await registerUploadedFile({
    fileName: session.fileName,
    contentType: session.contentType,
    fileSize: session.fileSize,
    fileHash: resolvedFileHash,
    fileSampleHash: session.fileSampleHash,
    objectKey: session.objectKey,
    bucket: getUploadBucket(),
    strategy: 'single'
  })

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

  if (!fileName || !fileSize || !fileSampleHash) {
    return c.json(fail('fileName, fileSize and fileSampleHash are required'), 400)
  }

  if (fileHash) {
    const existingFile = await findUploadedFileByHash(fileHash)
    if (existingFile) {
      const data: MultipartUploadInitResponse = {
        instantUpload: true,
        file: existingFile
      }

      return c.json(success(data))
    }
  }

  const chunkSize = Math.max(requestedChunkSize ?? DEFAULT_MULTIPART_CHUNK_SIZE, MULTIPART_MIN_PART_SIZE)
  const totalParts = Math.ceil(fileSize / chunkSize)

  if (totalParts > MAX_MULTIPART_PARTS) {
    return c.json(fail(`File is too large for multipart upload. Parts: ${totalParts}`), 400)
  }

  const fingerprintHash = fileHash ?? fileSampleHash
  let session = resumeSessionId ? await getMultipartUploadSession(resumeSessionId) : null
  if (!session) {
    session = await findActiveMultipartSessionByFingerprint(fingerprintHash, fileSize)
  }

  if (!session) {
    const objectKey = createObjectKey(fileName)
    const uploadId = await createMultipartUpload({
      objectKey,
      contentType
    })

    session = await createMultipartUploadSession({
      uploadId,
      objectKey,
      fileName,
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
  const resolvedFileHash = (body ? asNonEmptyString(body.fileHash) : null) ?? session.fileHash
  if (!resolvedFileHash) {
    return c.json(fail('fileHash is required before completion'), 400)
  }

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

  const registered = await registerUploadedFile({
    fileName: session.fileName,
    contentType: session.contentType,
    fileSize: session.fileSize,
    fileHash: resolvedFileHash,
    fileSampleHash: session.fileSampleHash,
    objectKey: session.objectKey,
    bucket: getUploadBucket(),
    strategy: 'multipart'
  })

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

uploadApi.onError((error, c) => {
  console.error('[upload-api-error]', error)
  return c.json(fail(error.message || 'Unexpected upload error'), 500)
})

uploadApi.notFound(c => c.json(fail('Route not found'), 404))
