import { useState } from 'react'

import { AppErrorBoundary } from '@/components/app-error-boundary'
import { AppLayout, type AppPageKey } from '@/components/layout/app-layout'
import { Providers } from '@/components/providers'
import { FilesWorkspaceProvider, FilesWorkspaceSecondarySidebar } from '@/features/files-workspace'
import { FilesWorkspacePage } from '@/pages'

export function App() {
  const [activePage, setActivePage] = useState<AppPageKey>('files')

  return (
    <Providers>
      <AppErrorBoundary>
        <FilesWorkspaceProvider>
          <AppLayout
            activePage={activePage}
            onChangePage={setActivePage}
            secondarySidebar={activePage === 'files' ? <FilesWorkspaceSecondarySidebar /> : null}
          >
            {activePage === 'files' ? <FilesWorkspacePage /> : null}
          </AppLayout>
        </FilesWorkspaceProvider>
      </AppErrorBoundary>
    </Providers>
  )
}
