import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({
  component: LoginPage
})

function LoginPage() {
  const navigate = useNavigate()

  const handleLogin = () => {
    navigate({ to: '/home' })
  }

  return (
    <div className="flex min-h-svh items-center justify-center">
      <Button onClick={handleLogin}>登录</Button>
    </div>
  )
}
