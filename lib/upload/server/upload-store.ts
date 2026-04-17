import { randomUUID } from 'node:crypto'

import { and, desc, eq } from 'drizzle-orm'

import { getDb } from '@/lib/db/client'
import {
  multipartUploadSessionsTable,
  multipartUploadedPartsTable,
  singleUploadSessionsTable,
  uploadedFilesTable
} from '@/lib/db/schema'
import type { MultipartUploadedPart, UploadedFileRecord, UploadStrategy } from '@/lib/upload/shared'

interface SingleUploadSession {
  id: string
  objectKey: string
  fileName: string
  contentType: string
  fileSize: number
  fileHash: string | null
  fileSampleHash: string
  createdAt: string
}

interface MultipartUploadSession {
  id: string
  uploadId: string
  objectKey: string
  fileName: string
  contentType: string
  fileSize: number
  fileHash: string | null
  fileSampleHash: string
  fingerprintHash: string
  chunkSize: number
  totalParts: number
  createdAt: string
  updatedAt: string
}

function db() {
  return getDb()
}

function toUploadedFileRecord(row: typeof uploadedFilesTable.$inferSelect): UploadedFileRecord {
  return {
    id: row.id,
    fileName: row.fileName,
    contentType: row.contentType,
    fileSize: row.fileSize,
    fileHash: row.fileHash,
    objectKey: row.objectKey,
    bucket: row.bucket,
    strategy: row.strategy as UploadStrategy,
    createdAt: row.createdAt.toISOString()
  }
}

function toSingleUploadSession(row: typeof singleUploadSessionsTable.$inferSelect): SingleUploadSession {
  return {
    id: row.id,
    objectKey: row.objectKey,
    fileName: row.fileName,
    contentType: row.contentType,
    fileSize: row.fileSize,
    fileHash: row.fileHash,
    fileSampleHash: row.fileSampleHash,
    createdAt: row.createdAt.toISOString()
  }
}

function toMultipartUploadSession(row: typeof multipartUploadSessionsTable.$inferSelect): MultipartUploadSession {
  return {
    id: row.id,
    uploadId: row.uploadId,
    objectKey: row.objectKey,
    fileName: row.fileName,
    contentType: row.contentType,
    fileSize: row.fileSize,
    fileHash: row.fileHash,
    fileSampleHash: row.fileSampleHash,
    fingerprintHash: row.fingerprintHash,
    chunkSize: row.chunkSize,
    totalParts: row.totalParts,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }
}

function toMultipartUploadedPart(row: typeof multipartUploadedPartsTable.$inferSelect): MultipartUploadedPart {
  return {
    partNumber: row.partNumber,
    size: row.size,
    eTag: row.eTag
  }
}

export async function findUploadedFileByHash(fileHash: string) {
  const [row] = await db().select().from(uploadedFilesTable).where(eq(uploadedFilesTable.fileHash, fileHash)).limit(1)
  return row ? toUploadedFileRecord(row) : null
}

export async function findUploadedFileBySampleHash(fileSampleHash: string, fileSize: number) {
  const [row] = await db()
    .select()
    .from(uploadedFilesTable)
    .where(and(eq(uploadedFilesTable.fileSampleHash, fileSampleHash), eq(uploadedFilesTable.fileSize, fileSize)))
    .limit(1)

  return row ? toUploadedFileRecord(row) : null
}

export async function listUploadedFiles() {
  const rows = await db().select().from(uploadedFilesTable).orderBy(desc(uploadedFilesTable.createdAt))
  return rows.map(toUploadedFileRecord)
}

export async function getUploadedFileById(id: string) {
  const [row] = await db().select().from(uploadedFilesTable).where(eq(uploadedFilesTable.id, id)).limit(1)
  return row ? toUploadedFileRecord(row) : null
}

export async function syncUploadedFileHash(fileId: string, fileHash: string) {
  const currentFile = await getUploadedFileById(fileId)
  if (!currentFile) {
    return null
  }

  if (currentFile.fileHash === fileHash) {
    return {
      updated: false,
      file: currentFile,
      conflictFile: null
    }
  }

  const conflictFile = await findUploadedFileByHash(fileHash)
  if (conflictFile && conflictFile.id !== fileId) {
    return {
      updated: false,
      file: currentFile,
      conflictFile
    }
  }

  const [updatedRow] = await db()
    .update(uploadedFilesTable)
    .set({
      fileHash
    })
    .where(eq(uploadedFilesTable.id, fileId))
    .returning()

  if (!updatedRow) {
    return null
  }

  return {
    updated: true,
    file: toUploadedFileRecord(updatedRow),
    conflictFile: null
  }
}

export async function registerUploadedFile(input: {
  fileName: string
  contentType: string
  fileSize: number
  fileHash: string
  fileSampleHash: string
  objectKey: string
  bucket: string
  strategy: UploadStrategy
}) {
  // 全量 hash 一致时直接复用，避免重复登记同一文件。
  const existing = await findUploadedFileByHash(input.fileHash)
  if (existing) {
    return {
      file: existing,
      isInstantUpload: true
    }
  }

  const [inserted] = await db()
    .insert(uploadedFilesTable)
    .values({
      id: randomUUID(),
      fileName: input.fileName,
      contentType: input.contentType,
      fileSize: input.fileSize,
      fileHash: input.fileHash,
      fileSampleHash: input.fileSampleHash,
      objectKey: input.objectKey,
      bucket: input.bucket,
      strategy: input.strategy
    })
    .onConflictDoNothing({
      target: uploadedFilesTable.fileHash
    })
    .returning()

  if (inserted) {
    return {
      file: toUploadedFileRecord(inserted),
      isInstantUpload: false
    }
  }

  const conflictFile = await findUploadedFileByHash(input.fileHash)
  if (!conflictFile) {
    throw new Error('Failed to register uploaded file')
  }

  return {
    file: conflictFile,
    isInstantUpload: true
  }
}

export async function createSingleUploadSession(input: {
  objectKey: string
  fileName: string
  contentType: string
  fileSize: number
  fileHash?: string | null
  fileSampleHash: string
}) {
  const [row] = await db()
    .insert(singleUploadSessionsTable)
    .values({
      id: randomUUID(),
      objectKey: input.objectKey,
      fileName: input.fileName,
      contentType: input.contentType,
      fileSize: input.fileSize,
      fileHash: input.fileHash ?? null,
      fileSampleHash: input.fileSampleHash
    })
    .returning()

  if (!row) {
    throw new Error('Failed to create single upload session')
  }

  return toSingleUploadSession(row)
}

export async function getSingleUploadSession(sessionId: string) {
  const [row] = await db()
    .select()
    .from(singleUploadSessionsTable)
    .where(eq(singleUploadSessionsTable.id, sessionId))
    .limit(1)

  return row ? toSingleUploadSession(row) : null
}

export async function completeSingleUploadSession(sessionId: string) {
  const [row] = await db()
    .delete(singleUploadSessionsTable)
    .where(eq(singleUploadSessionsTable.id, sessionId))
    .returning()

  return row ? toSingleUploadSession(row) : null
}

export async function findActiveMultipartSessionByFingerprint(fingerprintHash: string, fileSize: number) {
  const [row] = await db()
    .select()
    .from(multipartUploadSessionsTable)
    .where(
      and(
        eq(multipartUploadSessionsTable.fingerprintHash, fingerprintHash),
        eq(multipartUploadSessionsTable.fileSize, fileSize)
      )
    )
    .limit(1)

  return row ? toMultipartUploadSession(row) : null
}

export async function createMultipartUploadSession(input: {
  uploadId: string
  objectKey: string
  fileName: string
  contentType: string
  fileSize: number
  fileHash?: string | null
  fileSampleHash: string
  fingerprintHash: string
  chunkSize: number
  totalParts: number
}) {
  const now = new Date()
  const [inserted] = await db()
    .insert(multipartUploadSessionsTable)
    .values({
      id: randomUUID(),
      uploadId: input.uploadId,
      objectKey: input.objectKey,
      fileName: input.fileName,
      contentType: input.contentType,
      fileSize: input.fileSize,
      fileHash: input.fileHash ?? null,
      fileSampleHash: input.fileSampleHash,
      fingerprintHash: input.fingerprintHash,
      chunkSize: input.chunkSize,
      totalParts: input.totalParts,
      createdAt: now,
      updatedAt: now
    })
    .onConflictDoNothing({
      target: [multipartUploadSessionsTable.fingerprintHash, multipartUploadSessionsTable.fileSize]
    })
    .returning()

  if (inserted) {
    return toMultipartUploadSession(inserted)
  }

  const reused = await findActiveMultipartSessionByFingerprint(input.fingerprintHash, input.fileSize)
  if (!reused) {
    throw new Error('Failed to create multipart upload session')
  }

  return reused
}

export async function getMultipartUploadSession(sessionId: string) {
  const [row] = await db()
    .select()
    .from(multipartUploadSessionsTable)
    .where(eq(multipartUploadSessionsTable.id, sessionId))
    .limit(1)

  return row ? toMultipartUploadSession(row) : null
}

export async function listMultipartUploadedParts(sessionId: string) {
  const session = await getMultipartUploadSession(sessionId)
  if (!session) {
    return null
  }

  const rows = await db()
    .select()
    .from(multipartUploadedPartsTable)
    .where(eq(multipartUploadedPartsTable.sessionId, sessionId))
    .orderBy(multipartUploadedPartsTable.partNumber)

  return rows.map(toMultipartUploadedPart)
}

export async function saveMultipartUploadedPart(sessionId: string, part: MultipartUploadedPart) {
  return db().transaction(async tx => {
    const [currentSession] = await tx
      .select()
      .from(multipartUploadSessionsTable)
      .where(eq(multipartUploadSessionsTable.id, sessionId))
      .limit(1)

    if (!currentSession) {
      return null
    }

    const now = new Date()
    await tx
      .insert(multipartUploadedPartsTable)
      .values({
        sessionId,
        partNumber: part.partNumber,
        size: part.size,
        eTag: part.eTag,
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: [multipartUploadedPartsTable.sessionId, multipartUploadedPartsTable.partNumber],
        set: {
          size: part.size,
          eTag: part.eTag,
          updatedAt: now
        }
      })

    const [updatedSession] = await tx
      .update(multipartUploadSessionsTable)
      .set({
        updatedAt: now
      })
      .where(eq(multipartUploadSessionsTable.id, sessionId))
      .returning()

    return updatedSession ? toMultipartUploadSession(updatedSession) : toMultipartUploadSession(currentSession)
  })
}

export async function removeMultipartUploadSession(sessionId: string) {
  const [row] = await db()
    .delete(multipartUploadSessionsTable)
    .where(eq(multipartUploadSessionsTable.id, sessionId))
    .returning()

  return row ? toMultipartUploadSession(row) : null
}
