import { FileBrowser } from '@/features/file-browser'
import { FileFabMenu } from '@/features/upload/components/file-fab-menu'
import { useFilesWorkspace } from '@/features/files-workspace/files-workspace-provider'

export function FilesSection() {
  const { filesSection } = useFilesWorkspace()

  return (
    <>
      <FileBrowser view={filesSection.browser} dialogs={filesSection.dialogs} />

      <FileFabMenu onSelectFiles={filesSection.onSelectFiles} onCreateFolder={filesSection.onCreateFolder} />
    </>
  )
}
