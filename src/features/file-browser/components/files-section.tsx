import { UploadFabMenu } from '@/features/upload/components/upload-fab-menu'
import { FileBrowser, type FileBrowserDialogsProps, type FileBrowserViewProps } from '@/features/file-browser'

interface FilesSectionProps {
  currentPath: string
  onSelectFiles: (files: File[]) => void
  onCreateFolder: () => void
  browser: FileBrowserViewProps
  dialogs: FileBrowserDialogsProps
}

export function FilesSection({ currentPath, onSelectFiles, onCreateFolder, browser, dialogs }: FilesSectionProps) {
  return (
    <>
      <FileBrowser view={browser} dialogs={dialogs} />

      <UploadFabMenu currentPath={currentPath} onSelectFiles={onSelectFiles} onCreateFolder={onCreateFolder} />
    </>
  )
}
