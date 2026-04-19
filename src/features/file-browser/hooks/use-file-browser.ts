import { useState } from 'react'

import { useUploadBrowserEntries } from '@/components/upload/hooks/use-upload-browser-entries'

export type FileBrowserViewMode = 'grid' | 'table'

export function useFileBrowser() {
  const browser = useUploadBrowserEntries()
  const [viewMode, setViewMode] = useState<FileBrowserViewMode>('grid')

  return {
    ...browser,
    viewMode,
    setViewMode
  }
}
