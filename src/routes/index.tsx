import { createFileRoute, useNavigate } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: LoginPage
})

function LoginPage() {
  const navigate = useNavigate()

  const handleLogin = () => {
    navigate({ to: '/drive/home' })
  }

  return (
    <div className="flex min-h-svh items-center justify-center">
      <button onClick={handleLogin}>登录</button>
    </div>
  )
}
