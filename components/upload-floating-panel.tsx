'use client'

import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { Ban, ChevronDown, ChevronUp, Pause, Play, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatBytes } from '@/components/upload/upload-format'
import type { UploadQueueOverview, UploadQueueTask } from '@/components/upload/upload-queue-types'
import { getTaskStatusText } from '@/components/upload/upload-status'

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

function IconActionButton(props: { label: string; disabled?: boolean; onClick: () => void; icon: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-xs" onClick={props.onClick} disabled={props.disabled}>
          {props.icon}
          <span className="sr-only">{props.label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent sideOffset={6}>{props.label}</TooltipContent>
    </Tooltip>
  )
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
  const canCollapse = overview.remainingTasks > 0

  const sortedTasks = useMemo(() => tasks.slice().sort((a, b) => b.createdAt - a.createdAt), [tasks])

  return (
    <div className="fixed right-6 bottom-20 z-40 w-100 max-w-[calc(100vw-24px)]">
      <div className="overflow-hidden border bg-background shadow-lg">
        <div className="border-b px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{overview.overallStatusText}</p>
              <Badge variant={overview.runningTasks > 0 ? 'warning' : 'secondary'}>
                剩余 {overview.remainingTasks} 项
              </Badge>
            </div>

            <div className="flex items-center gap-1">
              <IconActionButton label="全部取消任务" onClick={onCancelAll} icon={<Ban className="size-3.5" />} />
              <IconActionButton label="全部暂停任务" onClick={onPauseAll} icon={<Pause className="size-3.5" />} />
              <IconActionButton label="全部继续任务" onClick={onContinueAll} icon={<Play className="size-3.5" />} />
              <IconActionButton
                label={collapsed ? '展开面板' : '折叠面板'}
                disabled={!canCollapse}
                onClick={() => setCollapsed(previous => !previous)}
                icon={collapsed ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              />
              <IconActionButton
                label="关闭面板"
                disabled={!canClose}
                onClick={onRequestClose}
                icon={<X className="size-3.5" />}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">取消会从面板移除任务；暂停后可继续。全部完成后可关闭面板。</p>
        </div>

        {!collapsed ? (
          <div className="max-h-[56vh] overflow-y-auto px-4 py-3">
            <div className="space-y-3">
              {sortedTasks.map(task => {
                const canCancel = task.status !== 'done'
                const canPause = task.status === 'running' || task.status === 'queued' || task.status === 'error'
                const canContinue = task.status === 'paused' || task.status === 'error'
                const showProgress = task.status !== 'queued'

                return (
                  <div key={task.id} className="border p-3">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="truncate text-sm font-medium">{task.fileName}</p>
                        </TooltipTrigger>
                        <TooltipContent sideOffset={6}>{task.fileName}</TooltipContent>
                      </Tooltip>

                      <div className="flex items-center gap-1">
                        <IconActionButton
                          label="取消上传"
                          onClick={() => onCancelTask(task.id)}
                          disabled={!canCancel}
                          icon={<Ban className="size-3.5" />}
                        />
                        <IconActionButton
                          label="暂停上传"
                          onClick={() => onPauseTask(task.id)}
                          disabled={!canPause}
                          icon={<Pause className="size-3.5" />}
                        />
                        <IconActionButton
                          label="继续上传"
                          onClick={() => onContinueTask(task.id)}
                          disabled={!canContinue}
                          icon={<Play className="size-3.5" />}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        {formatBytes(task.loadedBytes)} / {formatBytes(task.totalBytes)}
                      </span>
                      <span className="max-w-[60%] truncate text-right">{getTaskStatusText(task)}</span>
                    </div>

                    {showProgress ? (
                      <Progress
                        value={task.percent}
                        variant={task.status === 'done' ? 'success' : 'default'}
                        className="mt-2 h-1.5"
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
