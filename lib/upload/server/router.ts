import { Hono } from 'hono'

import {
  DEFAULT_MULTIPART_CHUNK_SIZE,
  FileAccessUrlResponse,
  InstantCheckResponse,
  MAX_MULTIPART_PARTS,
  MultipartPartUrlResponse,
  MultipartStatusResponse,
  MultipartUploadInitResponse,
  MULTIPART_MIN_PART_SIZE,
  SingleUploadCompleteResponse,
  SingleUploadInitResponse
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

// 健康检查接口：用于快速确认 Hono 路由是否挂载成功
uploadApi.get('/hello', c => {
  return c.json(
    success({
      message: 'Upload API is ready'
    })
  )
})

uploadApi.get('/uploads/files', c => {
  return c.json(success(listUploadedFiles()))
})

// 秒传检测：仅根据 hash 判断是否已有可复用对象（MVP 阶段未加租户维度）
uploadApi.post('/uploads/instant-check', async c => {
  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return c.json(fail('Invalid request body'), 400)
  }

  const fileHash = asNonEmptyString(body.fileHash)
  if (!fileHash) {
    return c.json(fail('fileHash is required'), 400)
  }

  const existingFile = findUploadedFileByHash(fileHash)
  const data: InstantCheckResponse = existingFile
    ? {
        instantUpload: true,
        file: existingFile
      }
    : {
        instantUpload: false
      }

  return c.json(success(data))
})

// 小文件上传初始化：返回单个 PUT 预签名 URL
uploadApi.post('/uploads/single/init', async c => {
  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return c.json(fail('Invalid request body'), 400)
  }

  const fileName = asNonEmptyString(body.fileName)
  const contentType = asNonEmptyString(body.contentType) ?? 'application/octet-stream'
  const fileSize = asPositiveNumber(body.fileSize)
  const fileHash = asNonEmptyString(body.fileHash)

  if (!fileName || !fileSize || !fileHash) {
    return c.json(fail('fileName, fileSize and fileHash are required'), 400)
  }

  const existingFile = findUploadedFileByHash(fileHash)
  if (existingFile) {
    const data: SingleUploadInitResponse = {
      instantUpload: true,
      file: existingFile
    }

    return c.json(success(data))
  }

  const objectKey = createObjectKey(fileName)
  const uploadUrl = await createSingleUploadPresignedUrl({
    objectKey,
    contentType
  })

  const session = createSingleUploadSession({
    objectKey,
    fileName,
    contentType,
    fileSize,
    fileHash
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

// 小文件上传完成：后端校验对象确实存在后再落业务记录
uploadApi.post('/uploads/single/complete', async c => {
  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return c.json(fail('Invalid request body'), 400)
  }

  const sessionId = asNonEmptyString(body.sessionId)
  if (!sessionId) {
    return c.json(fail('sessionId is required'), 400)
  }

  const session = getSingleUploadSession(sessionId)
  if (!session) {
    return c.json(fail('Upload session does not exist'), 404)
  }

  await assertObjectExists(session.objectKey)
  completeSingleUploadSession(sessionId)

  const registered = registerUploadedFile({
    fileName: session.fileName,
    contentType: session.contentType,
    fileSize: session.fileSize,
    fileHash: session.fileHash,
    objectKey: session.objectKey,
    bucket: getUploadBucket(),
    strategy: 'single'
  })

  const data: SingleUploadCompleteResponse = {
    file: registered.file
  }

  return c.json(success(data))
})

// 分片上传初始化：支持续传（resumeSessionId）和自动命中同 hash 的活跃会话
uploadApi.post('/uploads/multipart/init', async c => {
  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return c.json(fail('Invalid request body'), 400)
  }

  const fileName = asNonEmptyString(body.fileName)
  const contentType = asNonEmptyString(body.contentType) ?? 'application/octet-stream'
  const fileSize = asPositiveNumber(body.fileSize)
  const fileHash = asNonEmptyString(body.fileHash)
  const resumeSessionId = asNonEmptyString(body.resumeSessionId)
  const requestedChunkSize = asPositiveNumber(body.chunkSize)

  if (!fileName || !fileSize || !fileHash) {
    return c.json(fail('fileName, fileSize and fileHash are required'), 400)
  }

  const existingFile = findUploadedFileByHash(fileHash)
  if (existingFile) {
    const data: MultipartUploadInitResponse = {
      instantUpload: true,
      file: existingFile
    }

    return c.json(success(data))
  }

  const chunkSize = Math.max(requestedChunkSize ?? DEFAULT_MULTIPART_CHUNK_SIZE, MULTIPART_MIN_PART_SIZE)
  const totalParts = Math.ceil(fileSize / chunkSize)

  if (totalParts > MAX_MULTIPART_PARTS) {
    return c.json(fail(`File is too large for multipart upload. Parts: ${totalParts}`), 400)
  }

  let session = resumeSessionId ? getMultipartUploadSession(resumeSessionId) : null
  if (!session) {
    session = findActiveMultipartSessionByFingerprint(fileHash, fileSize)
  }

  if (!session) {
    const objectKey = createObjectKey(fileName)
    const uploadId = await createMultipartUpload({
      objectKey,
      contentType
    })

    session = createMultipartUploadSession({
      uploadId,
      objectKey,
      fileName,
      contentType,
      fileSize,
      fileHash,
      chunkSize,
      totalParts
    })
  }

  const uploadedParts = listMultipartUploadedParts(session.id) ?? []

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

// 查询分片状态：前端可据此恢复进度显示
uploadApi.get('/uploads/multipart/:sessionId/status', c => {
  const sessionId = c.req.param('sessionId')
  const session = getMultipartUploadSession(sessionId)
  if (!session) {
    return c.json(fail('Upload session does not exist'), 404)
  }

  const uploadedParts = listMultipartUploadedParts(session.id) ?? []
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

// 获取某个分片的 PUT 预签名 URL
uploadApi.post('/uploads/multipart/:sessionId/part-url', async c => {
  const sessionId = c.req.param('sessionId')
  const session = getMultipartUploadSession(sessionId)
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

// 前端分片上传完成后回调，登记 partNumber / size / eTag
uploadApi.post('/uploads/multipart/:sessionId/part-complete', async c => {
  const sessionId = c.req.param('sessionId')
  const session = getMultipartUploadSession(sessionId)
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

  saveMultipartUploadedPart(session.id, {
    partNumber,
    size,
    eTag
  })

  const uploadedParts = listMultipartUploadedParts(session.id) ?? []
  const uploadedBytes = sumUploadedBytes(uploadedParts)

  return c.json(
    success({
      uploadedBytes,
      uploadedParts: uploadedParts.length
    })
  )
})

// 合并分片：会在必要时向对象存储回查 ETag，避免浏览器无法读取响应头导致合并失败
uploadApi.post('/uploads/multipart/:sessionId/complete', async c => {
  const sessionId = c.req.param('sessionId')
  const session = getMultipartUploadSession(sessionId)
  if (!session) {
    return c.json(fail('Upload session does not exist'), 404)
  }

  let uploadedParts = listMultipartUploadedParts(session.id) ?? []
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

  removeMultipartUploadSession(session.id)

  const registered = registerUploadedFile({
    fileName: session.fileName,
    contentType: session.contentType,
    fileSize: session.fileSize,
    fileHash: session.fileHash,
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

// 终止分片会话：用于彻底放弃该上传任务
uploadApi.post('/uploads/multipart/:sessionId/abort', async c => {
  const sessionId = c.req.param('sessionId')
  const session = getMultipartUploadSession(sessionId)
  if (!session) {
    return c.json(fail('Upload session does not exist'), 404)
  }

  await abortMultipartUpload({
    objectKey: session.objectKey,
    uploadId: session.uploadId
  })
  removeMultipartUploadSession(session.id)

  return c.json(
    success({
      aborted: true
    })
  )
})

// 下载/预览 URL：返回短时效预签名地址，避免暴露长期密钥
uploadApi.get('/uploads/files/:fileId/url', async c => {
  const fileId = c.req.param('fileId')
  const mode = c.req.query('mode') === 'preview' ? 'inline' : 'attachment'
  const file = getUploadedFileById(fileId)

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
