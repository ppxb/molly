/**
 * 上传策略
 * - single: 单文件上传，适用于小文件
 * - multipart: 分片上传，适用于大文件
 * - instant: 秒传，适用于已上传过的文件
 */
export type UploadStrategy = 'single' | 'multipart' | 'instant'

/**
 * 上传阶段
 * - idle: 空闲状态
 * - hashing: 计算文件哈希值
 * - checking: 检查文件是否已存在
 * - uploading: 上传中
 * - finalizing: 最终处理
 * - done: 上传完成
 * - error: 上传出错
 * - aborted: 上传被取消
 */
export type UploadStage = 'idle' | 'hashing' | 'checking' | 'uploading' | 'finalizing' | 'done' | 'error' | 'aborted'

/**
 * 上传文件记录
 */
export interface UploadedFileRecord {
  /**
   * ID
   */
  id: string
  /**
   * 文件名称
   */
  fileName: string
  /**
   * 文件扩展名
   */
  fileExtension: string
  /**
   * 文件夹 ID
   */
  folderId: string
  /**
   * 文件夹路径
   */
  folderPath: string
  /**
   * 文件内容类型
   */
  contentType: string
  /**
   * 文件大小
   */
  fileSize: number
  /**
   * 文件哈希值
   */
  fileHash: string
  /**
   * 文件简单哈希值
   */
  fileSimpleHash: string
  /**
   * 对象键
   */
  objectKey: string
  /**
   * 存储桶
   */
  bucket: string
  /**
   * 上传策略
   */
  strategy: UploadStrategy
  /**
   * 创建时间
   */
  createdAt: string
  /**
   * 更新时间
   */
  updatedAt: string
}

/**
 * 上传文件夹记录
 */
export interface UploadFolderRecord {
  /**
   * ID
   */
  id: string
  /**
   * 文件夹名称
   */
  folderName: string
  /**
   * 父文件夹 ID
   */
  parentId: string | null
  /**
   * 文件夹路径
   */
  folderPath: string
  /**
   * 父文件夹路径
   */
  parentPath: string
  /**
   * 创建时间
   */
  createdAt: string
  /**
   * 更新时间
   */
  updatedAt: string
}

/**
 * 回收站文件夹记录
 */
export interface RecycleBinFolderRecord extends UploadFolderRecord {
  /**
   *  删除时间
   */
  trashedAt: string
  /**
   * 过期时间
   */
  expiresAt: string
}

/**
 * 回收站文件记录
 */
export interface RecycleBinFileRecord extends UploadedFileRecord {
  /**
   * 删除时间
   */

  trashedAt: string
  /**
   * 过期时间
   */
  expiresAt: string
  /**
   * 回收站文件夹路径
   */
  recycleURL: string
}

/**
 * 上传面包屑项
 */
export interface UploadBreadcrumbItem {
  /**
   * ID
   */
  id: string
  /**
   * 标签
   */
  label: string
  /**
   * 路径
   */
  path: string
}

/**
 * 文件访问 URL 响应
 */
export interface FileAccessUrlResponse {
  /**
   * 文件记录
   */
  file: UploadedFileRecord
  /**
   * 访问 URL
   */
  url: string
  /**
   * 内容处置方式
   */
  disposition: 'inline' | 'attachment'
  /**
   * URL 过期时间（秒）
   */
  expiresInSeconds: number
}

export type UploadQueueTaskStatus = 'queued' | 'running' | 'paused' | 'done' | 'error' | 'canceled'

export interface UploadResumeState {
  uploadId: string
  fileId: string
  chunkSize: number
  totalParts: number
  completedPartNumbers: number[]
}

export interface UploadQueueTask {
  id: string
  file: File
  fileName: string
  fileSize: number
  fileFingerprint: string
  folderId: string
  folderPath: string
  createdAt: number
  status: UploadQueueTaskStatus
  stage: UploadStage
  stageMessage: string
  loadedBytes: number
  totalBytes: number
  speedBytesPerSecond: number
  percent: number
  strategy: UploadStrategy | 'pending'
  instantUpload: boolean
  uploadedFile: UploadedFileRecord | null
  errorMessage: string | null
  resumeState: UploadResumeState | null
}

export interface UploadQueueOverview {
  totalTasks: number
  remainingTasks: number
  runningTasks: number
  queuedTasks: number
  doneTasks: number
  pausedTasks: number
  totalSpeedBytesPerSecond: number
  overallStatusText: string
}

export type UploadNameConflictAction = 'skip' | 'overwrite' | 'keep_both'

export interface UploadNameConflictPayload {
  fileName: string
  folderId: string
  existingFileId: string
  existingFileName: string
}

export interface UploadBatchRequestItem {
  id: string
  method: 'POST'
  url: '/file/move'
  body: {
    file_id: string
    file_name?: string
    type: 'file' | 'folder'
    to_drive_id?: string
    to_parent_file_id: string
  }
  headers?: Record<string, string>
}

export interface UploadBatchRequest {
  resource?: 'file'
  requests: UploadBatchRequestItem[]
}

export interface UploadBatchResponseItem {
  id: string
  status: number
  body?: Record<string, unknown>
}

export interface UploadBatchResponse {
  responses: UploadBatchResponseItem[]
}
