import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type {
  TransferTask,
  TransferQueueOverview,
  NameConflictPayload,
  NameConflictAction
} from '@/features/upload/types'
import { uploadFile } from '@/features/upload/uploader'
import { uploadConfig } from '@/features/upload/config'
import { normalizeFolderPath } from '@/lib/path'
import type { DriveFileRecord } from '@/types/drive'

// ─── 内部工具 ─────────────────────────────────────────────────────────────────

type AbortIntent = 'pause' | 'cancel'
type UpdatePatch = Partial<Omit<TransferTask, 'id' | 'file' | 'createdAt'>>

function clampPercent(v: number) {
  return Math.min(100, Math.max(0, Number.isFinite(v) ? v : 0))
}

function applyPatch(task: TransferTask, patch: UpdatePatch): TransferTask {
  const totalBytes = patch.totalBytes ?? task.totalBytes
  const rawLoaded = patch.loadedBytes ?? task.loadedBytes
  const loadedBytes = totalBytes > 0 ? Math.min(Math.max(0, rawLoaded), totalBytes) : Math.max(0, rawLoaded)
  const percent = clampPercent(totalBytes > 0 ? (loadedBytes / totalBytes) * 100 : 0)
  return { ...task, ...patch, loadedBytes, totalBytes, percent }
}

function fingerprint(file: File, folderId: string) {
  return `${folderId}:${file.name}:${file.size}:${file.lastModified}`
}

function createTask(file: File, folderId: string, folderPath: string): TransferTask {
  return {
    id: crypto.randomUUID(),
    file,
    fileName: file.name,
    fileSize: file.size,
    fileFingerprint: fingerprint(file, folderId),
    folderId,
    folderPath: normalizeFolderPath(folderPath),
    createdAt: Date.now(),
    status: 'queued',
    stage: 'idle',
    stageMessage: '等待上传',
    loadedBytes: 0,
    totalBytes: file.size,
    speedBytesPerSecond: 0,
    percent: 0,
    strategy: 'pending',
    instantUpload: false,
    uploadedFile: null,
    errorMessage: null,
    resumeState: null
  }
}

function toQueued(task: TransferTask): TransferTask {
  const hasResume = task.resumeState != null
  return {
    ...task,
    status: 'queued',
    stage: 'idle',
    stageMessage: '等待上传',
    loadedBytes: hasResume ? task.loadedBytes : 0,
    totalBytes: task.fileSize,
    speedBytesPerSecond: 0,
    strategy: 'pending',
    instantUpload: false,
    uploadedFile: null,
    errorMessage: null
  }
}

function toPaused(task: TransferTask): TransferTask {
  return {
    ...task,
    status: 'paused',
    stage: 'idle',
    stageMessage: '已暂停',
    speedBytesPerSecond: 0,
    errorMessage: null
  }
}

// ─── 速度追踪 ─────────────────────────────────────────────────────────────────

const SPEED_INTERVAL = 250
const SPEED_SMOOTH = 0.25

interface SpeedSample {
  bytes: number
  time: number
  speed: number
}

function createSpeedTracker() {
  const map = new Map<string, SpeedSample>()
  return {
    begin(id: string, bytes = 0) {
      map.set(id, { bytes, time: performance.now(), speed: 0 })
    },
    sample(id: string, bytes: number): number {
      const now = performance.now()
      const prev = map.get(id)
      if (!prev) {
        map.set(id, { bytes, time: now, speed: 0 })
        return 0
      }
      const dt = Math.max(0, now - prev.time)
      if (dt < SPEED_INTERVAL) return prev.speed
      const instant = dt > 0 ? Math.max(0, bytes - prev.bytes) / (dt / 1000) : 0
      const speed = prev.speed > 0 ? prev.speed * (1 - SPEED_SMOOTH) + instant * SPEED_SMOOTH : instant
      map.set(id, { bytes, time: now, speed })
      return speed
    },
    clear(id: string) {
      map.delete(id)
    },
    clearAll() {
      map.clear()
    }
  }
}

// ─── 冲突队列 ─────────────────────────────────────────────────────────────────

function createConflictQueue() {
  type Pending = { taskId: string; payload: NameConflictPayload; resolve: (a: NameConflictAction) => void }
  const queue: Pending[] = []
  let active: Pending | null = null
  let setActive: ((p: NameConflictPayload | null) => void) | null = null

  const next = () => {
    if (active) return
    const item = queue.shift()
    if (!item) {
      setActive?.(null)
      return
    }
    active = item
    setActive?.(item.payload)
  }

  return {
    init(setter: (p: NameConflictPayload | null) => void) {
      setActive = setter
    },
    enqueue(taskId: string, payload: NameConflictPayload): Promise<NameConflictAction> {
      return new Promise(resolve => {
        queue.push({ taskId, payload, resolve })
        next()
      })
    },
    resolve(action: NameConflictAction) {
      if (!active) return
      const a = active
      active = null
      a.resolve(action)
      next()
    },
    removeForTask(taskId: string) {
      if (active?.taskId === taskId) {
        this.resolve('skip')
        return
      }
      const i = queue.findIndex(p => p.taskId === taskId)
      if (i >= 0) {
        queue[i].resolve('skip')
        queue.splice(i, 1)
      }
    },
    clearAll() {
      active?.resolve('skip')
      active = null
      queue.forEach(p => p.resolve('skip'))
      queue.length = 0
      setActive?.(null)
    }
  }
}

// ─── 队列概览 ─────────────────────────────────────────────────────────────────

function buildOverview(tasks: TransferTask[], isActive: boolean): TransferQueueOverview {
  let running = 0,
    queued = 0,
    done = 0,
    paused = 0,
    speed = 0
  for (const t of tasks) {
    if (t.status === 'running') {
      running++
      speed += Math.max(0, t.speedBytesPerSecond)
    }
    if (t.status === 'queued') queued++
    if (t.status === 'done') done++
    if (t.status === 'paused') paused++
  }
  const error = tasks.filter(t => t.status === 'error').length
  const remaining = queued + running + paused + error
  let text = '暂无上传任务'
  if (tasks.length > 0) {
    if (running > 0) text = '正在上传'
    else if (remaining === 0) text = '上传完成'
    else if (!isActive || paused > 0) text = '上传已暂停'
    else if (error > 0 && queued === 0) text = '上传错误'
    else if (queued > 0) text = '等待上传'
    else text = '上传已暂停'
  }
  return {
    totalTasks: tasks.length,
    remainingTasks: remaining,
    runningTasks: running,
    queuedTasks: queued,
    doneTasks: done,
    pausedTasks: paused,
    totalSpeedBytesPerSecond: speed,
    overallStatusText: text
  }
}

// ─── useLatestRef ─────────────────────────────────────────────────────────────

function useLatestRef<T>(v: T) {
  const ref = useRef(v)
  useEffect(() => {
    ref.current = v
  }, [v])
  return ref
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseTransferQueueOptions {
  initialConcurrency?: number
  onTaskFinalizeStart?: (file: DriveFileRecord) => Promise<void> | void
  onTaskFinalizeAbort?: (file: DriveFileRecord) => Promise<void> | void
  onTaskDone?: (file: DriveFileRecord) => Promise<void> | void
}

export function useTransferQueue(options: UseTransferQueueOptions = {}) {
  const [tasks, setTasks] = useState<TransferTask[]>([])
  const [isActive, setIsActive] = useState(false)
  const [activeConflict, setActiveConflict] = useState<NameConflictPayload | null>(null)
  const concurrency = Math.max(1, options.initialConcurrency ?? 3)

  const tasksRef = useLatestRef(tasks)
  const onStartRef = useLatestRef(options.onTaskFinalizeStart)
  const onAbortRef = useLatestRef(options.onTaskFinalizeAbort)
  const onDoneRef = useLatestRef(options.onTaskDone)

  const controllers = useRef(new Map<string, AbortController>())
  const intents = useRef(new Map<string, AbortIntent>())
  const launching = useRef(new Set<string>())
  const speedTracker = useRef(createSpeedTracker())
  const conflicts = useRef(createConflictQueue())

  useEffect(() => {
    conflicts.current.init(setActiveConflict)
  }, [])

  const patch = useCallback((id: string, p: UpdatePatch) => {
    setTasks(prev => prev.map(t => (t.id === id ? applyPatch(t, p) : t)))
  }, [])

  const getTask = useCallback((id: string) => tasksRef.current.find(t => t.id === id) ?? null, [tasksRef])

  // ─── 运行单个任务 ──────────────────────────────────────────────────────────

  const runTask = useCallback(
    async (id: string) => {
      const task = getTask(id)
      if (!task || task.status !== 'queued') {
        launching.current.delete(id)
        return
      }

      const ctrl = new AbortController()
      controllers.current.set(id, ctrl)
      speedTracker.current.begin(id, task.resumeState ? task.loadedBytes : 0)
      patch(id, {
        status: 'running',
        stage: 'checking',
        stageMessage: '准备上传...',
        loadedBytes: task.resumeState ? task.loadedBytes : 0,
        totalBytes: task.fileSize,
        speedBytesPerSecond: 0,
        errorMessage: null
      })

      let optimistic: DriveFileRecord | null = null
      try {
        const result = await uploadFile({
          file: task.file,
          folderId: task.folderId,
          folderPath: task.folderPath,
          signal: ctrl.signal,
          multipartThreshold: uploadConfig.multipartThreshold,
          chunkSize: uploadConfig.chunkSize,
          multipartConcurrency: uploadConfig.multipartConcurrency,
          resumeState: task.resumeState,
          onResumeStateChange: s => patch(id, { resumeState: s }),
          onNameConflict: p => conflicts.current.enqueue(id, p),
          onBeforeComplete: file => {
            optimistic = file
            patch(id, { uploadedFile: file })
            void onStartRef.current?.(file)
          },
          onStageChange: (stage, stageMessage) => {
            patch(id, { stage, stageMessage, ...(stage !== 'uploading' ? { speedBytesPerSecond: 0 } : {}) })
          },
          onProgress: ({ loaded, total }) => {
            patch(id, {
              loadedBytes: loaded,
              totalBytes: total,
              speedBytesPerSecond: speedTracker.current.sample(id, loaded)
            })
          }
        })

        patch(id, {
          status: 'done',
          stage: 'done',
          stageMessage: result.instantUpload ? '秒传完成' : '上传完成',
          strategy: result.strategy,
          instantUpload: result.instantUpload,
          uploadedFile: result.file,
          loadedBytes: task.fileSize,
          totalBytes: task.fileSize,
          speedBytesPerSecond: 0,
          errorMessage: null,
          resumeState: null
        })
        await onDoneRef.current?.(result.file)
      } catch (error) {
        if (optimistic) {
          void onAbortRef.current?.(optimistic)
          optimistic = null
        }

        const isAbort = error instanceof DOMException && error.name === 'AbortError'
        const intent = intents.current.get(id)
        const resume = (error as { resumeState?: typeof task.resumeState }).resumeState

        if (isAbort && intent === 'cancel') return

        if (isAbort && intent === 'pause') {
          patch(id, {
            status: 'paused',
            stage: 'idle',
            stageMessage: '已暂停',
            speedBytesPerSecond: 0,
            errorMessage: null,
            resumeState: resume ?? task.resumeState
          })
          return
        }

        const msg = error instanceof Error ? error.message : '上传失败'
        patch(id, {
          status: isAbort ? 'paused' : 'error',
          stage: isAbort ? 'idle' : 'error',
          stageMessage: isAbort ? '已暂停' : msg,
          speedBytesPerSecond: 0,
          errorMessage: isAbort ? null : msg,
          resumeState: resume ?? task.resumeState
        })
      } finally {
        controllers.current.delete(id)
        intents.current.delete(id)
        speedTracker.current.clear(id)
        launching.current.delete(id)
      }
    },
    [getTask, onAbortRef, onDoneRef, onStartRef, patch]
  )

  // ─── 调度 ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isActive) return
    const running = tasks.filter(t => t.status === 'running').length
    const slots = concurrency - running - launching.current.size
    if (slots <= 0) return
    const toStart = tasks.filter(t => t.status === 'queued' && !launching.current.has(t.id)).slice(0, slots)
    for (const t of toStart) {
      launching.current.add(t.id)
      void runTask(t.id)
    }
  }, [concurrency, isActive, runTask, tasks])

  useEffect(() => {
    if (!isActive) return
    const hasPending = tasks.some(t => t.status === 'queued' || t.status === 'running') || launching.current.size > 0
    if (!hasPending) setIsActive(false)
  }, [isActive, tasks])

  // ─── 公开操作 ──────────────────────────────────────────────────────────────

  const addFiles = useCallback(
    (files: File[], opts: { folderId?: string; folderPath?: string } = {}) => {
      const list = Array.isArray(files) ? files : Array.from(files)
      if (!list.length) return
      const targetId = opts.folderId?.trim() || 'root'
      const targetPath = normalizeFolderPath(opts.folderPath ?? '')
      const existing = new Set(tasksRef.current.map(t => t.fileFingerprint))
      const newTasks = list
        .filter(f => {
          const fp = fingerprint(f, targetId)
          if (existing.has(fp)) return false
          existing.add(fp)
          return true
        })
        .map(f => createTask(f, targetId, targetPath))
      if (!newTasks.length) return
      setTasks(prev => [...prev, ...newTasks])
      setIsActive(true)
    },
    [tasksRef]
  )

  const continueTask = useCallback(
    (id: string) => {
      const t = getTask(id)
      if (!t || t.status === 'running' || t.status === 'done') return
      setTasks(prev => prev.map(task => (task.id === id ? toQueued(task) : task)))
      setIsActive(true)
    },
    [getTask]
  )

  const pauseTask = useCallback(
    (id: string) => {
      const t = getTask(id)
      if (!t || t.status === 'done') return
      if (t.status === 'running') {
        const ctrl = controllers.current.get(id)
        if (ctrl) {
          intents.current.set(id, 'pause')
          ctrl.abort()
          return
        }
      }
      patch(id, { status: 'paused', stage: 'idle', stageMessage: '已暂停', errorMessage: null })
    },
    [getTask, patch]
  )

  const cancelTask = useCallback(
    (id: string) => {
      const t = getTask(id)
      if (!t) return
      if (t.status === 'running') {
        const ctrl = controllers.current.get(id)
        if (ctrl) {
          intents.current.set(id, 'cancel')
          ctrl.abort()
        }
      }
      conflicts.current.removeForTask(id)
      speedTracker.current.clear(id)
      setTasks(prev => prev.filter(task => task.id !== id))
    },
    [getTask]
  )

  const continueAll = useCallback(() => {
    setTasks(prev => prev.map(t => (t.status === 'done' ? t : toQueued(t))))
    setIsActive(true)
  }, [])

  const pauseAll = useCallback(() => {
    setIsActive(false)
    controllers.current.forEach((ctrl, id) => {
      intents.current.set(id, 'pause')
      ctrl.abort()
    })
    setTasks(prev => prev.map(t => (t.status === 'done' || t.status === 'running' ? t : toPaused(t))))
  }, [])

  const cancelAll = useCallback(() => {
    setIsActive(false)
    controllers.current.forEach((ctrl, id) => {
      intents.current.set(id, 'cancel')
      ctrl.abort()
    })
    launching.current.clear()
    controllers.current.clear()
    intents.current.clear()
    conflicts.current.clearAll()
    speedTracker.current.clearAll()
    setTasks([])
  }, [])

  const resolveConflict = useCallback((action: NameConflictAction) => {
    conflicts.current.resolve(action)
  }, [])

  const overview = useMemo(() => buildOverview(tasks, isActive), [tasks, isActive])

  return {
    tasks,
    overview,
    activeConflict,
    addFiles,
    cancelTask,
    pauseTask,
    continueTask,
    cancelAll,
    pauseAll,
    continueAll,
    resolveConflict
  }
}
