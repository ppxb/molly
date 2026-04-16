import {
  completeMultipartUploadRequest,
  completeSingleUploadRequest,
  getMultipartPartUrlRequest,
  initMultipartUploadRequest,
  initSingleUploadRequest,
  instantCheckRequest,
  reportMultipartPartCompletedRequest
} from '@/lib/upload/client/api'
import { hashFileSHA256 } from '@/lib/upload/client/hash'
import { clearResumeSessionId, getResumeSessionId, setResumeSessionId } from '@/lib/upload/client/resume-storage'
import { uploadBlobWithProgress } from '@/lib/upload/client/transport'
import {
  DEFAULT_MULTIPART_CHUNK_SIZE,
  DEFAULT_MULTIPART_THRESHOLD,
  type UploadedFileRecord,
  type UploadStage,
  type UploadStrategy
} from '@/lib/upload/shared'

/**
 * 上传引擎职责说明：
 * 1. 输入单个 File，输出统一 UploadFileResult
 * 2. 内部自动选择上传策略（小文件直传 / 大文件分片）
 * 3. 通过回调暴露阶段与进度，供 UI 层做可视化
 * 4. 分片上传阶段支持断点续传（基于 fileHash + fileSize 的本地会话记录）
 */
interface UploadProgressPayload {
  loaded: number
  total: number
  percent: number
}

interface UploadCallbacks {
  onStageChange?: (stage: UploadStage, message: string) => void
  onProgress?: (progress: UploadProgressPayload) => void
}

interface UploadFileInput extends UploadCallbacks {
  file: File
  signal?: AbortSignal
  multipartThreshold?: number
  chunkSize?: number
  multipartConcurrency?: number
}

export interface UploadFileResult {
  file: UploadedFileRecord
  strategy: UploadStrategy
  instantUpload: boolean
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

function raiseIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException('上传已中断', 'AbortError')
  }
}

async function runWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  const taskCount = Math.max(1, Math.min(concurrency, items.length))
  let currentIndex = 0

  await Promise.all(
    Array.from({
      length: taskCount
    }).map(async () => {
      while (currentIndex < items.length) {
        const nextItem = items[currentIndex]
        currentIndex += 1
        await worker(nextItem)
      }
    })
  )
}

function emitProgress(callbacks: UploadCallbacks, loaded: number, total: number) {
  const safeTotal = Math.max(1, total)
  callbacks.onProgress?.({
    loaded,
    total,
    percent: (loaded / safeTotal) * 100
  })
}

function formatUploadSpeed(bytesPerSecond: number) {
  const kbPerSecond = Math.max(0, bytesPerSecond) / 1024
  if (kbPerSecond < 1024) {
    return `${kbPerSecond.toFixed(kbPerSecond >= 100 ? 0 : kbPerSecond >= 10 ? 1 : 2)} KB/s`
  }

  const mbPerSecond = kbPerSecond / 1024
  return `${mbPerSecond.toFixed(mbPerSecond >= 100 ? 0 : mbPerSecond >= 10 ? 1 : 2)} MB/s`
}

async function uploadSingleFile(input: UploadFileInput & { fileHash: string }): Promise<UploadFileResult> {
  // 单文件上传也先做秒传检查，命中则直接返回，避免重复传输
  input.onStageChange?.('checking', '检查秒传索引...')
  const singleInit = await initSingleUploadRequest({
    fileName: input.file.name,
    contentType: input.file.type || 'application/octet-stream',
    fileSize: input.file.size,
    fileHash: input.fileHash
  })

  if (singleInit.instantUpload && singleInit.file) {
    emitProgress(input, input.file.size, input.file.size)
    input.onStageChange?.('done', '秒传命中，复用已有对象')
    return {
      file: singleInit.file,
      strategy: 'instant',
      instantUpload: true
    }
  }

  if (!singleInit.session) {
    throw new Error('缺少单文件上传会话')
  }

  // 使用 XHR 而不是 fetch，是为了得到更细粒度、兼容性更好的上传进度事件
  input.onStageChange?.('uploading', '上传文件中...')
  await uploadBlobWithProgress({
    uploadUrl: singleInit.session.uploadUrl,
    blob: input.file,
    contentType: input.file.type || 'application/octet-stream',
    signal: input.signal,
    onProgress: (loaded, total) => {
      emitProgress(input, loaded, total)
    }
  })

  raiseIfAborted(input.signal)
  input.onStageChange?.('finalizing', '提交文件元数据...')
  const complete = await completeSingleUploadRequest({
    sessionId: singleInit.session.sessionId
  })

  emitProgress(input, input.file.size, input.file.size)
  input.onStageChange?.('done', '上传完成')
  return {
    file: complete.file,
    strategy: 'single',
    instantUpload: false
  }
}

async function uploadMultipartFile(input: UploadFileInput & { fileHash: string }): Promise<UploadFileResult> {
  // 分片参数做安全兜底：至少 5MB，避免触发 S3 Multipart 约束
  const chunkSize = Math.max(input.chunkSize ?? DEFAULT_MULTIPART_CHUNK_SIZE, 5 * 1024 * 1024)
  const concurrency = Math.max(1, Math.min(input.multipartConcurrency ?? 3, 6))
  const resumeSessionId = getResumeSessionId(input.fileHash, input.file.size) ?? undefined

  // 如果存在本地缓存的 sessionId，优先尝试续传
  input.onStageChange?.('checking', resumeSessionId ? '检测到历史任务，准备断点续传...' : '创建分片上传会话...')
  const init = await initMultipartUploadRequest({
    fileName: input.file.name,
    contentType: input.file.type || 'application/octet-stream',
    fileSize: input.file.size,
    fileHash: input.fileHash,
    chunkSize,
    resumeSessionId
  })

  if (init.instantUpload && init.file) {
    emitProgress(input, input.file.size, input.file.size)
    input.onStageChange?.('done', '秒传命中，复用已有对象')
    clearResumeSessionId(input.fileHash, input.file.size)
    return {
      file: init.file,
      strategy: 'instant',
      instantUpload: true
    }
  }

  const session = init.session
  if (!session) {
    throw new Error('缺少分片上传会话')
  }

  // 将会话 ID 落到本地，浏览器刷新后重新选择同文件仍可续传
  setResumeSessionId(input.fileHash, input.file.size, session.sessionId)

  const completedPartSizes = new Map<number, number>()
  for (const part of session.uploadedParts) {
    completedPartSizes.set(part.partNumber, part.size)
  }

  const totalParts = session.totalParts
  const pendingPartNumbers: number[] = []
  for (let partNumber = 1; partNumber <= totalParts; partNumber += 1) {
    if (!completedPartSizes.has(partNumber)) {
      pendingPartNumbers.push(partNumber)
    }
  }

  let committedLoaded = Array.from(completedPartSizes.values()).reduce((sum, size) => sum + size, 0)
  const inFlightLoaded = new Map<number, number>()
  emitProgress(input, committedLoaded, input.file.size)
  input.onStageChange?.('uploading', '分片上传中（0 KB/s）')

  // 速度统计窗口：以“整体已上传字节”做滑动估算，并做指数平滑，避免数值抖动
  let speedWindowStartAt = Date.now()
  let speedWindowStartBytes = committedLoaded
  let smoothedSpeedBytesPerSecond = 0

  try {
    // 并发上传时，进度分成两部分：
    // - committedLoaded: 已确认完成的分片
    // - inFlightLoaded: 正在传输中的临时字节
    // 两者相加后可得到平滑、真实的整体进度
    await runWithConcurrency(pendingPartNumbers, concurrency, async partNumber => {
      raiseIfAborted(input.signal)
      const start = (partNumber - 1) * session.chunkSize
      const end = Math.min(start + session.chunkSize, input.file.size)
      const blob = input.file.slice(start, end)

      const partUrl = await getMultipartPartUrlRequest(session.sessionId, partNumber)
      const uploadResult = await uploadBlobWithProgress({
        uploadUrl: partUrl.uploadUrl,
        blob,
        contentType: input.file.type || 'application/octet-stream',
        signal: input.signal,
        onProgress: loaded => {
          inFlightLoaded.set(partNumber, loaded)
          const transientBytes = Array.from(inFlightLoaded.values()).reduce((sum, size) => sum + size, 0)
          const totalUploadedBytes = Math.min(input.file.size, committedLoaded + transientBytes)
          emitProgress(input, totalUploadedBytes, input.file.size)

          const now = Date.now()
          const elapsedMs = now - speedWindowStartAt
          if (elapsedMs >= 450) {
            const deltaBytes = Math.max(0, totalUploadedBytes - speedWindowStartBytes)
            const instantSpeed = (deltaBytes * 1000) / Math.max(1, elapsedMs)

            smoothedSpeedBytesPerSecond =
              smoothedSpeedBytesPerSecond <= 0 ? instantSpeed : smoothedSpeedBytesPerSecond * 0.7 + instantSpeed * 0.3

            speedWindowStartAt = now
            speedWindowStartBytes = totalUploadedBytes
            input.onStageChange?.('uploading', `分片上传中（${formatUploadSpeed(smoothedSpeedBytesPerSecond)}）`)
          }
        }
      })

      await reportMultipartPartCompletedRequest({
        sessionId: session.sessionId,
        partNumber,
        size: blob.size,
        eTag: uploadResult.eTag
      })

      committedLoaded += blob.size
      inFlightLoaded.delete(partNumber)
      emitProgress(input, Math.min(input.file.size, committedLoaded), input.file.size)
    })

    raiseIfAborted(input.signal)
    input.onStageChange?.('finalizing', '合并分片并完成上传...')
    const complete = await completeMultipartUploadRequest(session.sessionId)
    emitProgress(input, input.file.size, input.file.size)
    input.onStageChange?.('done', '上传完成')
    clearResumeSessionId(input.fileHash, input.file.size)

    return {
      file: complete.file,
      strategy: 'multipart',
      instantUpload: false
    }
  } catch (error) {
    if (isAbortError(error)) {
      // 主动中断时不调用 abort 接口，保留服务端 multipart 会话以便后续续传
      throw error
    }

    throw error
  }
}

export async function uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
  if (!input.file) {
    throw new Error('未选择文件')
  }

  raiseIfAborted(input.signal)
  // 秒传需要稳定 hash，本实现使用浏览器原生 SubtleCrypto 计算 SHA-256
  input.onStageChange?.('hashing', '文件校验中 0%')
  const fileHash = await hashFileSHA256(input.file, (loaded, total) => {
    const safeTotal = Math.max(1, total)
    const percent = (loaded / safeTotal) * 100
    emitProgress(input, loaded, total)
    input.onStageChange?.('hashing', `文件校验中 ${percent.toFixed(1)}%`)
  })
  raiseIfAborted(input.signal)

  input.onStageChange?.('checking', '检查是否可秒传...')
  const instantCheck = await instantCheckRequest({
    fileHash
  })

  if (instantCheck.instantUpload && instantCheck.file) {
    emitProgress(input, input.file.size, input.file.size)
    input.onStageChange?.('done', '秒传命中，复用已有对象')
    return {
      file: instantCheck.file,
      strategy: 'instant',
      instantUpload: true
    }
  }

  const multipartThreshold = input.multipartThreshold ?? DEFAULT_MULTIPART_THRESHOLD
  // 小于阈值走单文件上传；否则走分片上传
  if (input.file.size < multipartThreshold) {
    return uploadSingleFile({
      ...input,
      fileHash
    })
  }

  return uploadMultipartFile({
    ...input,
    fileHash
  })
}
