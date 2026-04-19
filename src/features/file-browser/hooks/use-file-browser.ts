import { useState } from 'react'

import { useFileBrowserEntries } from '@/features/file-browser/hooks/use-file-browser-entries'

export type FileBrowserViewMode = 'grid' | 'table'

export function useFileBrowser() {
  const browser = useFileBrowserEntries()
  const [viewMode, setViewMode] = useState<FileBrowserViewMode>('grid')

  return {
    ...browser,
    viewMode,
    setViewMode
  }
}
