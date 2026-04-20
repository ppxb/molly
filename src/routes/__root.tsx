import { createRootRoute, Outlet, useRouter } from '@tanstack/react-router'
import { ArrowLeftIcon, HomeIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export const Route = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent
})

function notFoundComponent() {
  const router = useRouter()

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted">
      <div className="w-full max-w-md">
        <Card>
          <CardContent className="grid gap-6 p-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="font-mono text-8xl font-bold text-primary">404</div>
              <h1 className="text-2xl font-bold">Page Not Found</h1>
              <p className="text-sm text-muted-foreground">
                Sorry, the page you're looking for doesn't exist or has been removed
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => router.history.back()}>
                <ArrowLeftIcon className="size-4" />
                Go Back
              </Button>
              <Button className="flex-1" onClick={() => router.navigate({ to: '/' })}>
                <HomeIcon className="size-4" />
                Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
