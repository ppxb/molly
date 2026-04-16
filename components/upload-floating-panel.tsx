'use client'

import { useMemo, useState } from 'react'
import { CircleOffIcon, PauseIcon, PlayIcon, XIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatBytes } from '@/components/upload/upload-format'
import type { UploadQueueOverview, UploadQueueTask } from '@/components/upload/upload-queue-types'
import { getTaskStatusText } from '@/components/upload/upload-status'
import { IconActionButton } from '@/components/icon-action-button'

interface UploadFloatingPanelProps {
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

  const sortedTasks = useMemo(() => tasks.slice().sort((a, b) => b.createdAt - a.createdAt), [tasks])

  return (
    <div className="fixed right-6 bottom-20 z-40 w-100 max-w-[calc(100vw-24px)]">
      <div
        className="overflow-hidden border bg-background shadow-md"
        onClick={() => setCollapsed(previous => !previous)}
      >
        <div className="border-b p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{overview.overallStatusText}</p>
              <Badge variant={overview.runningTasks > 0 ? 'warning' : 'secondary'}>
                剩余 {overview.remainingTasks} 项
              </Badge>
            </div>

            <div className="flex items-center gap-1">
              <IconActionButton
                label="取消全部任务"
                onClick={onCancelAll}
                icon={<CircleOffIcon className="size-4" />}
              />
              <IconActionButton label="暂停全部任务" onClick={onPauseAll} icon={<PauseIcon className="size-4" />} />
              <IconActionButton label="继续全部任务" onClick={onContinueAll} icon={<PlayIcon className="size-4" />} />
              <IconActionButton
                label="关闭面板"
                disabled={!canClose}
                onClick={onRequestClose}
                icon={<XIcon className="size-4" />}
              />
            </div>
          </div>
        </div>

        {!collapsed ? (
          <div className="max-h-[56vh] overflow-y-auto p-3">
            <div className="space-y-3">
              {sortedTasks.map(task => {
                const canCancel = task.status !== 'done'
                const canPause = task.status === 'running' || task.status === 'queued' || task.status === 'error'
                const canContinue = task.status === 'paused' || task.status === 'error'
                const showProgress = task.status !== 'queued'

                return (
                  <div key={task.id} className="border p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="truncate text-sm">{task.fileName}</p>
                        </TooltipTrigger>
                        <TooltipContent sideOffset={6}>{task.fileName}</TooltipContent>
                      </Tooltip>

                      <div className="flex items-center gap-1">
                        <IconActionButton
                          label="取消上传"
                          onClick={() => onCancelTask(task.id)}
                          disabled={!canCancel}
                          icon={<CircleOffIcon className="size-4" />}
                        />
                        <IconActionButton
                          label="暂停上传"
                          onClick={() => onPauseTask(task.id)}
                          disabled={!canPause}
                          icon={<PauseIcon className="size-4" />}
                        />
                        <IconActionButton
                          label="继续上传"
                          onClick={() => onContinueTask(task.id)}
                          disabled={!canContinue}
                          icon={<PlayIcon className="size-4" />}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        {formatBytes(task.loadedBytes)} / {formatBytes(task.totalBytes)}
                      </span>
                      <div className="max-w-[60%] truncate">{getTaskStatusText(task)}</div>
                    </div>

                    {showProgress ? (
                      <Progress
                        value={task.percent}
                        variant={task.status === 'done' ? 'success' : 'default'}
                        className="mt-2 h-2"
                      />
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
