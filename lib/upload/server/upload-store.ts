import { randomUUID } from 'node:crypto'

import { and, asc, desc, eq } from 'drizzle-orm'

import { getDb } from '@/lib/db/client'
import {
  multipartUploadSessionsTable,
  multipartUploadedPartsTable,
  singleUploadSessionsTable,
  uploadedFilesTable,
  uploadFoldersTable
} from '@/lib/db/schema'
import { normalizeFolderPath } from '@/lib/upload/path'
import type { MultipartUploadedPart, UploadedFileRecord, UploadFolderRecord, UploadStrategy } from '@/lib/upload/shared'

interface SingleUploadSession {
  id: string
  objectKey: string
  fileName: string
  folderPath: string
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
  folderPath: string
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
    folderPath: row.folderPath,
    contentType: row.contentType,
    fileSize: row.fileSize,
    fileHash: row.fileHash,
    fileSampleHash: row.fileSampleHash,
    objectKey: row.objectKey,
    bucket: row.bucket,
    strategy: row.strategy as UploadStrategy,
    createdAt: row.createdAt.toISOString()
  }
}

function toUploadFolderRecord(row: typeof uploadFoldersTable.$inferSelect): UploadFolderRecord {
  return {
    id: row.id,
    folderName: row.folderName,
    folderPath: row.folderPath,
    parentPath: row.parentPath,
    createdAt: row.createdAt.toISOString()
  }
}

function toSingleUploadSession(row: typeof singleUploadSessionsTable.$inferSelect): SingleUploadSession {
  return {
    id: row.id,
    objectKey: row.objectKey,
    fileName: row.fileName,
    folderPath: row.folderPath,
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
    folderPath: row.folderPath,
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
  const [row] = await db()
    .select()
    .from(uploadedFilesTable)
    .where(eq(uploadedFilesTable.fileHash, fileHash))
    .orderBy(desc(uploadedFilesTable.createdAt))
    .limit(1)

  return row ? toUploadedFileRecord(row) : null
}

export async function findUploadedFileByPathAndName(folderPath: string, fileName: string) {
  const normalizedPath = normalizeFolderPath(folderPath)
  const [row] = await db()
    .select()
    .from(uploadedFilesTable)
    .where(and(eq(uploadedFilesTable.folderPath, normalizedPath), eq(uploadedFilesTable.fileName, fileName)))
    .limit(1)

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

export async function listUploadedFiles(folderPath?: string) {
  if (typeof folderPath === 'string') {
    const normalizedPath = normalizeFolderPath(folderPath)
    const rows = await db()
      .select()
      .from(uploadedFilesTable)
      .where(eq(uploadedFilesTable.folderPath, normalizedPath))
      .orderBy(asc(uploadedFilesTable.fileName))
    return rows.map(toUploadedFileRecord)
  }

  const rows = await db().select().from(uploadedFilesTable).orderBy(desc(uploadedFilesTable.createdAt))
  return rows.map(toUploadedFileRecord)
}

export async function listUploadFoldersByParentPath(parentPath: string) {
  const normalizedParentPath = normalizeFolderPath(parentPath)
  const rows = await db()
    .select()
    .from(uploadFoldersTable)
    .where(eq(uploadFoldersTable.parentPath, normalizedParentPath))
    .orderBy(asc(uploadFoldersTable.folderName))

  return rows.map(toUploadFolderRecord)
}

export async function getUploadFolderByPath(folderPath: string) {
  const normalizedPath = normalizeFolderPath(folderPath)
  if (!normalizedPath) {
    return null
  }

  const [row] = await db()
    .select()
    .from(uploadFoldersTable)
    .where(eq(uploadFoldersTable.folderPath, normalizedPath))
    .limit(1)
  return row ? toUploadFolderRecord(row) : null
}

export async function createUploadFolder(input: { folderName: string; folderPath: string; parentPath: string }) {
  const normalizedPath = normalizeFolderPath(input.folderPath)
  const normalizedParentPath = normalizeFolderPath(input.parentPath)

  const [inserted] = await db()
    .insert(uploadFoldersTable)
    .values({
      id: randomUUID(),
      folderName: input.folderName,
      folderPath: normalizedPath,
      parentPath: normalizedParentPath
    })
    .onConflictDoNothing({
      target: uploadFoldersTable.folderPath
    })
    .returning()

  if (inserted) {
    return {
      folder: toUploadFolderRecord(inserted),
      created: true
    }
  }

  const existing = await getUploadFolderByPath(normalizedPath)
  if (!existing) {
    throw new Error('Failed to create folder')
  }

  return {
    folder: existing,
    created: false
  }
}

export async function ensureUploadFolderPathExists(folderPath: string) {
  const normalizedPath = normalizeFolderPath(folderPath)
  if (!normalizedPath) {
    return
  }

  const segments = normalizedPath.split('/')
  let currentPath = ''

  for (const folderName of segments) {
    const parentPath = currentPath
    currentPath = currentPath ? `${currentPath}/${folderName}` : folderName

    await db()
      .insert(uploadFoldersTable)
      .values({
        id: randomUUID(),
        folderName,
        folderPath: currentPath,
        parentPath
      })
      .onConflictDoNothing({
        target: uploadFoldersTable.folderPath
      })
  }
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

export async function createInstantUploadedFileAlias(input: {
  sourceFile: UploadedFileRecord
  fileName: string
  folderPath: string
  contentType: string
}) {
  const normalizedFolderPath = normalizeFolderPath(input.folderPath)
  const existingAtTarget = await findUploadedFileByPathAndName(normalizedFolderPath, input.fileName)
  if (existingAtTarget) {
    if (existingAtTarget.fileHash === input.sourceFile.fileHash) {
      return {
        file: existingAtTarget,
        created: false
      }
    }

    throw new Error('A file with the same name already exists in this folder')
  }

  await ensureUploadFolderPathExists(normalizedFolderPath)

  const [inserted] = await db()
    .insert(uploadedFilesTable)
    .values({
      id: randomUUID(),
      fileName: input.fileName,
      folderPath: normalizedFolderPath,
      contentType: input.contentType || input.sourceFile.contentType,
      fileSize: input.sourceFile.fileSize,
      fileHash: input.sourceFile.fileHash,
      fileSampleHash: input.sourceFile.fileSampleHash,
      objectKey: input.sourceFile.objectKey,
      bucket: input.sourceFile.bucket,
      strategy: 'instant'
    })
    .onConflictDoNothing({
      target: [uploadedFilesTable.folderPath, uploadedFilesTable.fileName]
    })
    .returning()

  if (inserted) {
    return {
      file: toUploadedFileRecord(inserted),
      created: true
    }
  }

  const conflict = await findUploadedFileByPathAndName(normalizedFolderPath, input.fileName)
  if (conflict && conflict.fileHash === input.sourceFile.fileHash) {
    return {
      file: conflict,
      created: false
    }
  }

  throw new Error('A file with the same name already exists in this folder')
}

export async function registerUploadedFile(input: {
  fileName: string
  folderPath: string
  contentType: string
  fileSize: number
  fileHash: string
  fileSampleHash: string
  objectKey: string
  bucket: string
  strategy: UploadStrategy
}) {
  const normalizedFolderPath = normalizeFolderPath(input.folderPath)
  const existingAtTarget = await findUploadedFileByPathAndName(normalizedFolderPath, input.fileName)
  if (existingAtTarget) {
    if (existingAtTarget.fileHash === input.fileHash) {
      return {
        file: existingAtTarget,
        isInstantUpload: true
      }
    }

    throw new Error('A file with the same name already exists in this folder')
  }

  await ensureUploadFolderPathExists(normalizedFolderPath)

  const [inserted] = await db()
    .insert(uploadedFilesTable)
    .values({
      id: randomUUID(),
      fileName: input.fileName,
      folderPath: normalizedFolderPath,
      contentType: input.contentType,
      fileSize: input.fileSize,
      fileHash: input.fileHash,
      fileSampleHash: input.fileSampleHash,
      objectKey: input.objectKey,
      bucket: input.bucket,
      strategy: input.strategy
    })
    .onConflictDoNothing({
      target: [uploadedFilesTable.folderPath, uploadedFilesTable.fileName]
    })
    .returning()

  if (inserted) {
    return {
      file: toUploadedFileRecord(inserted),
      isInstantUpload: false
    }
  }

  const conflictFile = await findUploadedFileByPathAndName(normalizedFolderPath, input.fileName)
  if (!conflictFile) {
    throw new Error('Failed to register uploaded file')
  }

  if (conflictFile.fileHash === input.fileHash) {
    return {
      file: conflictFile,
      isInstantUpload: true
    }
  }

  throw new Error('A file with the same name already exists in this folder')
}

export async function createSingleUploadSession(input: {
  objectKey: string
  fileName: string
  folderPath: string
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
      folderPath: normalizeFolderPath(input.folderPath),
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

export async function findActiveMultipartSessionByFingerprint(
  fingerprintHash: string,
  fileSize: number,
  folderPath: string
) {
  const normalizedFolderPath = normalizeFolderPath(folderPath)
  const [row] = await db()
    .select()
    .from(multipartUploadSessionsTable)
    .where(
      and(
        eq(multipartUploadSessionsTable.fingerprintHash, fingerprintHash),
        eq(multipartUploadSessionsTable.fileSize, fileSize),
        eq(multipartUploadSessionsTable.folderPath, normalizedFolderPath)
      )
    )
    .limit(1)

  return row ? toMultipartUploadSession(row) : null
}

export async function createMultipartUploadSession(input: {
  uploadId: string
  objectKey: string
  fileName: string
  folderPath: string
  contentType: string
  fileSize: number
  fileHash?: string | null
  fileSampleHash: string
  fingerprintHash: string
  chunkSize: number
  totalParts: number
}) {
  const now = new Date()
  const normalizedFolderPath = normalizeFolderPath(input.folderPath)
  const [inserted] = await db()
    .insert(multipartUploadSessionsTable)
    .values({
      id: randomUUID(),
      uploadId: input.uploadId,
      objectKey: input.objectKey,
      fileName: input.fileName,
      folderPath: normalizedFolderPath,
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
      target: [
        multipartUploadSessionsTable.fingerprintHash,
        multipartUploadSessionsTable.fileSize,
        multipartUploadSessionsTable.folderPath
      ]
    })
    .returning()

  if (inserted) {
    return toMultipartUploadSession(inserted)
  }

  const reused = await findActiveMultipartSessionByFingerprint(
    input.fingerprintHash,
    input.fileSize,
    normalizedFolderPath
  )
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
