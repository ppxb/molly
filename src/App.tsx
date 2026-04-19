import { useState } from 'react'

import { AppLayout, type AppPageKey } from '@/components/app-layout'
import { Providers } from '@/components/providers'
import { FilesWorkspacePage } from '@/pages'

export function App() {
  const [activePage, setActivePage] = useState<AppPageKey>('files')

  return (
    <Providers>
      <AppLayout activePage={activePage} onChangePage={setActivePage}>
        {activePage === 'files' ? <FilesWorkspacePage /> : null}
      </AppLayout>
    </Providers>
  )
}
