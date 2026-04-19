import { FilesSection, FilesWorkspaceMobileNav, RecycleBinSection, useFilesWorkspace } from '@/features/files-workspace'
import { TransferPanelSection } from '@/features/upload/components/transfer-panel-section'

function FilesWorkspacePageContent() {
  const { activeView, transferPanel } = useFilesWorkspace()

  return (
    <>
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
    </>
  )
}

export function FilesWorkspacePage() {
  return <FilesWorkspacePageContent />
}
