import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Loader2Icon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api/client'
import { authApi } from '@/lib/api/endpoint'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/login')({
  component: LoginPage
})

function LoginPage() {
  const router = useRouter()
  const setAuth = useAuthStore(s => s.setAuth)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    user_name: '',
    password: ''
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.user_name || !form.password) {
      toast.error('请填写用户名和密码')
      return
    }
    setLoading(true)
    try {
      const resp = await authApi.login(form)
      setAuth(resp)
      await router.navigate({ to: '/' })
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '登录失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Molly</CardTitle>
          <p className="text-sm text-muted-foreground">登录你的账户</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="user_name">用户名</Label>
              <Input
                id="user_name"
                placeholder="请输入用户名"
                autoComplete="username"
                value={form.user_name}
                onChange={e => setForm(prev => ({ ...prev, user_name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="请输入密码"
                autoComplete="current-password"
                value={form.password}
                onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2Icon className="size-4 animate-spin" />}
              {loading ? '登录中...' : '登录'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
