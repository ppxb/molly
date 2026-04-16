import { randomUUID } from 'node:crypto'

import type { MultipartUploadedPart, UploadedFileRecord, UploadStrategy } from '@/lib/upload/shared'

interface SingleUploadSession {
  id: string
  objectKey: string
  fileName: string
  contentType: string
  fileSize: number
  fileHash: string
  createdAt: string
  completedAt?: string
}

interface MultipartUploadSession {
  id: string
  uploadId: string
  objectKey: string
  fileName: string
  contentType: string
  fileSize: number
  fileHash: string
  chunkSize: number
  totalParts: number
  createdAt: string
  updatedAt: string
  completedParts: Map<number, MultipartUploadedPart>
}

/**
 * 说明：
 * 当前 Store 仅用于 MVP 演示，全部在内存中维护。
 * 生产落地时建议替换为数据库持久化（如 Drizzle + PostgreSQL）。
 */
const uploadedFiles = new Map<string, UploadedFileRecord>()
const fileHashIndex = new Map<string, string>()
const singleUploadSessions = new Map<string, SingleUploadSession>()
const multipartUploadSessions = new Map<string, MultipartUploadSession>()
const multipartFingerprintIndex = new Map<string, string>()

function createFingerprint(fileHash: string, fileSize: number) {
  return `${fileHash}:${fileSize}`
}

export function findUploadedFileByHash(fileHash: string) {
  const fileId = fileHashIndex.get(fileHash)
  if (!fileId) {
    return null
  }

  return uploadedFiles.get(fileId) ?? null
}

export function listUploadedFiles() {
  return Array.from(uploadedFiles.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

export function getUploadedFileById(id: string) {
  return uploadedFiles.get(id) ?? null
}

export function registerUploadedFile(input: {
  fileName: string
  contentType: string
  fileSize: number
  fileHash: string
  objectKey: string
  bucket: string
  strategy: UploadStrategy
}) {
  // 秒传核心：hash 已存在时直接复用已登记文件记录
  const existing = findUploadedFileByHash(input.fileHash)
  if (existing) {
    return {
      file: existing,
      isInstantUpload: true
    }
  }

  const file: UploadedFileRecord = {
    id: randomUUID(),
    fileName: input.fileName,
    contentType: input.contentType,
    fileSize: input.fileSize,
    fileHash: input.fileHash,
    objectKey: input.objectKey,
    bucket: input.bucket,
    strategy: input.strategy,
    createdAt: new Date().toISOString()
  }

  uploadedFiles.set(file.id, file)
  fileHashIndex.set(file.fileHash, file.id)

  return {
    file,
    isInstantUpload: false
  }
}

export function createSingleUploadSession(input: {
  objectKey: string
  fileName: string
  contentType: string
  fileSize: number
  fileHash: string
}) {
  const session: SingleUploadSession = {
    id: randomUUID(),
    objectKey: input.objectKey,
    fileName: input.fileName,
    contentType: input.contentType,
    fileSize: input.fileSize,
    fileHash: input.fileHash,
    createdAt: new Date().toISOString()
  }

  singleUploadSessions.set(session.id, session)
  return session
}

export function getSingleUploadSession(sessionId: string) {
  return singleUploadSessions.get(sessionId) ?? null
}

export function completeSingleUploadSession(sessionId: string) {
  const session = singleUploadSessions.get(sessionId)
  if (!session) {
    return null
  }

  session.completedAt = new Date().toISOString()
  singleUploadSessions.delete(sessionId)
  return session
}

export function findActiveMultipartSessionByFingerprint(fileHash: string, fileSize: number) {
  const fingerprint = createFingerprint(fileHash, fileSize)
  const sessionId = multipartFingerprintIndex.get(fingerprint)
  if (!sessionId) {
    return null
  }

  return multipartUploadSessions.get(sessionId) ?? null
}

export function createMultipartUploadSession(input: {
  uploadId: string
  objectKey: string
  fileName: string
  contentType: string
  fileSize: number
  fileHash: string
  chunkSize: number
  totalParts: number
}) {
  // fingerprint 索引用于“同一个文件再次上传时”快速命中可续传会话
  const session: MultipartUploadSession = {
    id: randomUUID(),
    uploadId: input.uploadId,
    objectKey: input.objectKey,
    fileName: input.fileName,
    contentType: input.contentType,
    fileSize: input.fileSize,
    fileHash: input.fileHash,
    chunkSize: input.chunkSize,
    totalParts: input.totalParts,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedParts: new Map()
  }

  multipartUploadSessions.set(session.id, session)
  multipartFingerprintIndex.set(createFingerprint(session.fileHash, session.fileSize), session.id)

  return session
}

export function getMultipartUploadSession(sessionId: string) {
  return multipartUploadSessions.get(sessionId) ?? null
}

export function listMultipartUploadedParts(sessionId: string) {
  const session = multipartUploadSessions.get(sessionId)
  if (!session) {
    return null
  }

  return Array.from(session.completedParts.values()).sort((a, b) => a.partNumber - b.partNumber)
}

export function saveMultipartUploadedPart(sessionId: string, part: MultipartUploadedPart) {
  const session = multipartUploadSessions.get(sessionId)
  if (!session) {
    return null
  }

  session.completedParts.set(part.partNumber, part)
  session.updatedAt = new Date().toISOString()

  return session
}

export function removeMultipartUploadSession(sessionId: string) {
  const session = multipartUploadSessions.get(sessionId)
  if (!session) {
    return null
  }

  multipartUploadSessions.delete(sessionId)
  multipartFingerprintIndex.delete(createFingerprint(session.fileHash, session.fileSize))
  return session
}
