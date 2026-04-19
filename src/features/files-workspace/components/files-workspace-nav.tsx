import { FolderIcon, Trash2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'

import type { FilesWorkspaceView } from '@/features/files-workspace/files-workspace-provider'

interface FilesWorkspaceNavProps {
  activeView: FilesWorkspaceView
  onChange: (view: FilesWorkspaceView) => void
  mode: 'desktop' | 'mobile'
}

const workspaceNavItems: Array<{
  id: FilesWorkspaceView
  label: string
  description: string
  icon: typeof FolderIcon
}> = [
  {
    id: 'files',
    label: '全部文件',
    description: '浏览、上传和整理当前网盘内容',
    icon: FolderIcon
  },
  {
    id: 'recyclebin',
    label: '回收站',
    description: '恢复或彻底删除已移入回收站的内容',
    icon: Trash2Icon
  }
]

export function FilesWorkspaceNav({ activeView, onChange, mode }: FilesWorkspaceNavProps) {
  if (mode === 'mobile') {
    return (
      <div className="flex gap-2 md:hidden">
        {workspaceNavItems.map(item => {
          const Icon = item.icon

          return (
            <Button
              key={item.id}
              type="button"
              variant={activeView === item.id ? 'default' : 'outline'}
              onClick={() => onChange(item.id)}
            >
              <Icon className="size-4" />
              {item.label}
            </Button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="h-full px-4 py-6">
      <div className="space-y-1 px-2 pb-4">
        <div className="text-sm font-semibold">文件工作区</div>
        <div className="text-xs text-muted-foreground">切换全部文件与回收站视图。</div>
      </div>

      <div className="space-y-2">
        {workspaceNavItems.map(item => {
          const Icon = item.icon
          const isActive = activeView === item.id

          return (
            <button
              key={item.id}
              type="button"
              className={`flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition ${
                isActive ? 'border-foreground/20 bg-muted' : 'border-border/70 hover:bg-muted/50'
              }`}
              onClick={() => onChange(item.id)}
            >
              <Icon className={`mt-0.5 size-4 shrink-0 ${isActive ? 'text-foreground' : 'text-muted-foreground'}`} />
              <div className="min-w-0 space-y-1">
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.description}</div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
