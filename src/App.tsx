import { AppLayout, type AppPageKey } from '@/components/app-layout'
import { Providers } from '@/components/providers'
import { UploadDashboard } from '@/components/upload/upload-dashboard'
import { useState } from 'react'

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
