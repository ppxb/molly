import { createFileRoute } from '@tanstack/react-router'

import {
  FilesSection,
  FilesWorkspaceMobileNav,
  FilesWorkspaceProvider,
  FilesWorkspaceSecondarySidebar,
  RecycleBinSection,
  useFilesWorkspace
} from '@/features/files-workspace'
import { TransferPanelSection } from '@/features/upload/components/transfer-panel-section'

export const Route = createFileRoute('/_app/file')({
  component: FilePage
})

function FilePage() {
  const { activeView, transferPanel } = useFilesWorkspace()

  return (
    <FilesWorkspaceProvider>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden w-72 shrink-0 border-r border-border/70 bg-muted/20 md:block">
          <FilesWorkspaceSecondarySidebar />
        </aside>
        <div className="min-w-0 flex-1">
          <div className="min-w-0 flex-1 overflow-y-auto">
            <div className="flex w-full min-w-0 flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
              <FilesWorkspaceMobileNav />
              {activeView === 'files' ? <FilesSection /> : <RecycleBinSection />}
            </div>
          </div>

          <TransferPanelSection
            isVisible={transferPanel.isVisible}
            tasks={transferPanel.tasks}
            overview={transferPanel.overview}
            onCancelAll={transferPanel.onCancelAll}
            onPauseAll={transferPanel.onPauseAll}
            onContinueAll={transferPanel.onContinueAll}
            onCancelTask={transferPanel.onCancelTask}
            onPauseTask={transferPanel.onPauseTask}
            onContinueTask={transferPanel.onContinueTask}
            onClose={transferPanel.onClose}
          />
        </div>
      </div>
    </FilesWorkspaceProvider>
  )
}
