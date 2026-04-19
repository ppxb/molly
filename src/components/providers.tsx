import { useEffect, type ReactNode } from 'react'
import { ThemeProvider } from 'next-themes'
import { Toaster, toast } from 'sonner'

import { TooltipProvider } from '@/components/ui/tooltip'

function resolveRuntimeErrorMessage(reason: unknown) {
  if (reason instanceof Error) {
    const message = reason.message.trim()
    return message.length > 0 ? message : 'Unexpected application error'
  }

  if (typeof reason === 'string') {
    const message = reason.trim()
    return message.length > 0 ? message : 'Unexpected application error'
  }

  return 'Unexpected application error'
}

function GlobalErrorListeners() {
  useEffect(() => {
    const onWindowError = (event: ErrorEvent) => {
      toast.error(resolveRuntimeErrorMessage(event.error ?? event.message))
    }

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      toast.error(resolveRuntimeErrorMessage(event.reason))
    }

    window.addEventListener('error', onWindowError)
    window.addEventListener('unhandledrejection', onUnhandledRejection)

    return () => {
      window.removeEventListener('error', onWindowError)
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
    }
  }, [])

  return null
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" enableSystem={true} disableTransitionOnChange>
      <GlobalErrorListeners />
      <TooltipProvider>{children}</TooltipProvider>
      <Toaster
        toastOptions={{
          classNames: {
            toast: 'rounded-none! font-sans'
          }
        }}
      />
    </ThemeProvider>
  )
}
