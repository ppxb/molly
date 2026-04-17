import { Providers } from '@/components/providers'
import { UploadDashboard } from '@/components/upload/upload-dashboard'

export function App() {
  return (
    <Providers>
      <div className="relative min-h-dvh">
        <UploadDashboard />
      </div>
    </Providers>
  )
}
