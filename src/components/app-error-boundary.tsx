import type { ErrorInfo, ReactNode } from 'react'
import { Component } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  hasError: boolean
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false
  }

  static getDerivedStateFromError() {
    return {
      hasError: true
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled React render error', error, errorInfo)
  }

  private reset = () => {
    this.setState({
      hasError: false
    })
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-2">
            <CardTitle>页面发生错误</CardTitle>
            <CardDescription>我们已经拦住了这次异常，应用没有直接白屏。可以先重试，或刷新页面。</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button onClick={this.reset}>重试</Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              刷新页面
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }
}
