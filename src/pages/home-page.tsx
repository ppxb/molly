import { Link } from '@tanstack/react-router'
import { FolderOpenIcon, LayoutDashboardIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function HomePage() {
  return (
    <div className="min-h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-4 border border-border/70 bg-muted/20 p-6 md:grid-cols-[1.8fr_1fr]">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 border border-border/70 bg-background px-3 py-1 text-xs text-muted-foreground">
              <LayoutDashboardIcon className="size-3.5" />
              工作台首页
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">统一管理你的文件工作流</h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                这里作为应用首页，适合放全局概览、常用入口和最近操作。文件管理仍然放在独立的 `/files`
                路由里，职责会更清晰。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/files" preload="intent" viewTransition>
                  <FolderOpenIcon className="size-4" />
                  进入文件页
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3">
            <Card>
              <CardHeader>
                <CardTitle>路由职责</CardTitle>
                <CardDescription>由 TanStack Router 负责页面切换和页面级布局。</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>全局状态职责</CardTitle>
                <CardDescription>由 Zustand 负责 sidebar 这类跨页面 UI 状态。</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>当前默认路由</CardTitle>
              <CardDescription>先保持两条最基础的入口，后面扩展会更自然。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div>`/` 首页：承载概览和入口。</div>
              <div>`/files` 文件页：承载文件浏览、上传和回收站工作流。</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>下一步扩展建议</CardTitle>
              <CardDescription>后续如果再加“最近文件”“设置”等页面，可以直接在 `/src/router` 收口。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div>页面级信息继续从路由配置读取。</div>
              <div>业务级状态尽量留在 feature 内部，避免 store 过胖。</div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
