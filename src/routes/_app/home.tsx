import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/home')({
  staticData: {
    title: 'Home',
    description: '工作台'
  },
  component: HomePage
})

function HomePage() {
  return <div>Hello "/_app/home"!</div>
}
