import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/drive/_layout/home')({
  component: HomePage
})

function HomePage() {
  return <div>Welcome Home!</div>
}
