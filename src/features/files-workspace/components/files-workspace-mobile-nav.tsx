import { FilesWorkspaceNav } from '@/features/files-workspace/components/files-workspace-nav'
import { useFilesWorkspace } from '@/features/files-workspace/files-workspace-provider'

export function FilesWorkspaceMobileNav() {
  const { activeView, setActiveView } = useFilesWorkspace()

  return <FilesWorkspaceNav activeView={activeView} onChange={setActiveView} mode="mobile" />
}
