import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/drive/_layout/file')({
  component: FilePage
})

function FilePage() {
  return <div>Cloud Drive Files</div>
}
