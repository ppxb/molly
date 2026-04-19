import { useEffect, useState } from 'react'
import { CircleOffIcon, CloudUploadIcon, PauseIcon, PlayIcon, XIcon } from 'lucide-react'

import { IconActionButton } from '@/components/icon-action-button'
import type { UploadQueueOverview, UploadQueueTask } from '@/features/upload/upload-queue-types'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatBytes, getTaskStatusText } from '@/lib/utils'

interface TaskItemProps {
  task: UploadQueueTask
  onCancel: (taskId: string) => void
  onPause: (taskId: string) => void
  onContinue: (taskId: string) => void
}

function TaskItem({ task, onCancel, onPause, onContinue }: TaskItemProps) {
  const canCancel = task.status !== 'done'
  const shouldPause = task.status === 'running' || task.status === 'queued'
  const canToggle = shouldPause || task.status === 'paused' || task.status === 'error'
  const showProgress = task.status !== 'queued'
  const statusText =
    task.status === 'running' && task.stage === 'uploading' && task.speedBytesPerSecond > 0
      ? `${formatBytes(task.speedBytesPerSecond)}/s`
      : getTaskStatusText(task)

  return (
    <div className="border border-dashed border-foreground/12 p-3 hover:bg-foreground/2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="truncate text-sm">{task.fileName}</p>
          </TooltipTrigger>
          <TooltipContent>{task.fileName}</TooltipContent>
        </Tooltip>

        <div className="flex items-center gap-1">
          <IconActionButton
            label="Cancel upload"
            onClick={() => onCancel(task.id)}
            disabled={!canCancel}
            icon={<CircleOffIcon className="size-4" />}
          />
          <IconActionButton
            label={shouldPause ? 'Pause upload' : 'Resume upload'}
            onClick={() => (shouldPause ? onPause(task.id) : onContinue(task.id))}
            disabled={!canToggle}
            icon={shouldPause ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 font-mix text-xs text-muted-foreground">
        <span>
          {formatBytes(task.loadedBytes)} / {formatBytes(task.totalBytes)}
        </span>
        <div className="max-w-[60%] truncate">{statusText}</div>
      </div>

      {showProgress && (
        <Progress value={task.percent} variant={task.status === 'done' ? 'success' : 'default'} className="mt-2 h-1" />
      )}
    </div>
  )
}

export interface UploadFloatingPanelProps {
  tasks: UploadQueueTask[]
  overview: UploadQueueOverview
  onCancelAll: () => void
  onPauseAll: () => void
  onContinueAll: () => void
  onCancelTask: (taskId: string) => void
  onPauseTask: (taskId: string) => void
  onContinueTask: (taskId: string) => void
  onRequestClose: () => void
}

export function UploadFloatingPanel({
  tasks,
  overview,
  onCancelAll,
  onPauseAll,
  onContinueAll,
  onCancelTask,
  onPauseTask,
  onContinueTask,
  onRequestClose
}: UploadFloatingPanelProps) {
  const [collapsed, setCollapsed] = useState(false)

  const canClose = overview.remainingTasks === 0
  const hasActiveTasks = tasks.some(task => task.status === 'running' || task.status === 'queued')
  const shouldPauseAll = hasActiveTasks

  useEffect(() => {
    if (canClose) {
      setCollapsed(false)
    }
  }, [canClose])

  const sortedTasks = tasks.toSorted((a, b) => a.createdAt - b.createdAt)

  return (
    <div className="fixed right-12 bottom-24 z-40 w-100 max-w-[calc(100vw-24px)]">
      <div className="overflow-hidden border bg-background shadow-md">
        <div className="p-3" onClick={() => setCollapsed(previous => !previous)}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <CloudUploadIcon className="size-4" />
              <p className="">{overview.overallStatusText}</p>
              <div className="h-1 w-1 bg-foreground"></div>
              <span>剩余 {overview.remainingTasks} 项</span>
            </div>

            <div className="flex items-center gap-1" onClick={event => event.stopPropagation()}>
              <IconActionButton
                label="Cancel all"
                onClick={onCancelAll}
                disabled={canClose}
                icon={<CircleOffIcon className="size-4" />}
              />
              <IconActionButton
                label={shouldPauseAll ? 'Pause all' : 'Resume all'}
                onClick={shouldPauseAll ? onPauseAll : onContinueAll}
                disabled={canClose}
                icon={shouldPauseAll ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
              />
              <IconActionButton
                label="Close panel"
                disabled={!canClose}
                onClick={onRequestClose}
                icon={<XIcon className="size-4" />}
              />
            </div>
          </div>
        </div>

        {!collapsed && (
          <div className="max-h-[56vh] overflow-y-auto p-3">
            <div className="space-y-3">
              {sortedTasks.map(task => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onCancel={onCancelTask}
                  onPause={onPauseTask}
                  onContinue={onContinueTask}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
