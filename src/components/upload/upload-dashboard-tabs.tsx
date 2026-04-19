import { FolderIcon, Trash2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'

export type UploadDashboardView = 'files' | 'recyclebin'

interface UploadDashboardTabsProps {
  activeView: UploadDashboardView
  onChange: (view: UploadDashboardView) => void
}

export function UploadDashboardTabs({ activeView, onChange }: UploadDashboardTabsProps) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <Button type="button" variant={activeView === 'files' ? 'default' : 'outline'} onClick={() => onChange('files')}>
        <FolderIcon className="size-4" />
        閸忋劑鍎撮弬鍥︽
      </Button>
      <Button
        type="button"
        variant={activeView === 'recyclebin' ? 'default' : 'outline'}
        onClick={() => onChange('recyclebin')}
      >
        <Trash2Icon className="size-4" />
        閸ョ偞鏁圭粩?
      </Button>
    </div>
  )
}
