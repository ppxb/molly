import {
  FileBrowserDialogs,
  type FileBrowserDialogsProps
} from '@/features/file-browser/components/file-browser-dialogs'
import { FileBrowserView, type FileBrowserViewProps } from '@/features/file-browser/components/file-browser-view'

export interface FileBrowserProps {
  view: FileBrowserViewProps
  dialogs?: FileBrowserDialogsProps
}

export function FileBrowser({ view, dialogs }: FileBrowserProps) {
  return (
    <>
      <FileBrowserView {...view} />
      {dialogs ? <FileBrowserDialogs {...dialogs} /> : null}
    </>
  )
}
