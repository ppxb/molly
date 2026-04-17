import { bigint, index, integer, pgTable, primaryKey, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

export const uploadedFilesTable = pgTable(
  'uploaded_files',
  {
    id: text('id').primaryKey(),
    fileName: text('file_name').notNull(),
    folderPath: text('folder_path').notNull().default(''),
    contentType: text('content_type').notNull(),
    fileSize: bigint('file_size', { mode: 'number' }).notNull(),
    fileHash: text('file_hash').notNull(),
    fileSampleHash: text('file_sample_hash').notNull(),
    objectKey: text('object_key').notNull(),
    bucket: text('bucket').notNull(),
    strategy: text('strategy').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  table => [
    index('uploaded_files_file_hash_idx').on(table.fileHash),
    uniqueIndex('uploaded_files_folder_path_file_name_unique').on(table.folderPath, table.fileName),
    index('uploaded_files_folder_path_file_name_idx').on(table.folderPath, table.fileName),
    index('uploaded_files_sample_hash_size_idx').on(table.fileSampleHash, table.fileSize),
    index('uploaded_files_created_at_idx').on(table.createdAt)
  ]
)

export const uploadFoldersTable = pgTable(
  'upload_folders',
  {
    id: text('id').primaryKey(),
    folderName: text('folder_name').notNull(),
    folderPath: text('folder_path').notNull(),
    parentPath: text('parent_path').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  table => [
    uniqueIndex('upload_folders_folder_path_unique').on(table.folderPath),
    uniqueIndex('upload_folders_parent_path_name_unique').on(table.parentPath, table.folderName),
    index('upload_folders_parent_path_idx').on(table.parentPath),
    index('upload_folders_created_at_idx').on(table.createdAt)
  ]
)

export const singleUploadSessionsTable = pgTable(
  'single_upload_sessions',
  {
    id: text('id').primaryKey(),
    objectKey: text('object_key').notNull(),
    fileName: text('file_name').notNull(),
    folderPath: text('folder_path').notNull().default(''),
    contentType: text('content_type').notNull(),
    fileSize: bigint('file_size', { mode: 'number' }).notNull(),
    fileHash: text('file_hash'),
    fileSampleHash: text('file_sample_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  table => [index('single_upload_sessions_created_at_idx').on(table.createdAt)]
)

export const multipartUploadSessionsTable = pgTable(
  'multipart_upload_sessions',
  {
    id: text('id').primaryKey(),
    uploadId: text('upload_id').notNull(),
    objectKey: text('object_key').notNull(),
    fileName: text('file_name').notNull(),
    folderPath: text('folder_path').notNull().default(''),
    contentType: text('content_type').notNull(),
    fileSize: bigint('file_size', { mode: 'number' }).notNull(),
    fileHash: text('file_hash'),
    fileSampleHash: text('file_sample_hash').notNull(),
    fingerprintHash: text('fingerprint_hash').notNull(),
    chunkSize: integer('chunk_size').notNull(),
    totalParts: integer('total_parts').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  table => [
    uniqueIndex('multipart_upload_sessions_fingerprint_unique').on(
      table.fingerprintHash,
      table.fileSize,
      table.folderPath
    ),
    index('multipart_upload_sessions_updated_at_idx').on(table.updatedAt)
  ]
)

export const multipartUploadedPartsTable = pgTable(
  'multipart_uploaded_parts',
  {
    sessionId: text('session_id')
      .notNull()
      .references(() => multipartUploadSessionsTable.id, { onDelete: 'cascade' }),
    partNumber: integer('part_number').notNull(),
    size: bigint('size', { mode: 'number' }).notNull(),
    eTag: text('etag').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  table => [
    primaryKey({
      columns: [table.sessionId, table.partNumber],
      name: 'multipart_uploaded_parts_pk'
    }),
    index('multipart_uploaded_parts_session_idx').on(table.sessionId)
  ]
)
