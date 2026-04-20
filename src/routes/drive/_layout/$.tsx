import { createFileRoute, notFound } from '@tanstack/react-router'

export const Route = createFileRoute('/drive/_layout/$')({
  loader: () => {
    throw notFound()
  },
  component: () => null
})
