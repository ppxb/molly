import { useState } from 'react'

import { AppLayout, type AppPageKey } from '@/components/app-layout'
import { Providers } from '@/components/providers'
import { UploadDashboard } from '@/features/upload'

export function App() {
  const [activePage, setActivePage] = useState<AppPageKey>('files')

  return (
    <Providers>
      <AppLayout activePage={activePage} onChangePage={setActivePage}>
        {activePage === 'files' ? <UploadDashboard /> : null}
      </AppLayout>
    </Providers>
  )
}
