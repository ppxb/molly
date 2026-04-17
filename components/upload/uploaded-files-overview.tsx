'use client'

import { ArrowDownToLine, Eye, Loader2, RefreshCcw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatBytes } from '@/lib/utils'
import type { UploadedFileRecord } from '@/lib/upload/shared'

interface UploadedFilesOverviewProps {
  files: UploadedFileRecord[]
  isLoading: boolean
  onRefresh: () => void
  onOpenFile: (fileId: string, mode: 'preview' | 'download') => void
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString()
}

export function UploadedFilesOverview({ files, isLoading, onRefresh, onOpenFile }: UploadedFilesOverviewProps) {
  return (
    <Card className="border-border/70">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>已上传文件总览</CardTitle>
            <CardDescription>上传成功后会自动刷新，支持预览和下载。</CardDescription>
          </div>
          <Button variant="outline" onClick={onRefresh} disabled={isLoading}>
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
            刷新
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {files.length === 0 ? (
          <div className="rounded-none border border-dashed p-8 text-center text-sm text-muted-foreground">
            暂无已上传文件
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs text-muted-foreground uppercase">
                <tr className="border-b">
                  <th className="py-2 pr-4 font-medium">文件名</th>
                  <th className="py-2 pr-4 font-medium">大小</th>
                  <th className="py-2 pr-4 font-medium">上传策略</th>
                  <th className="py-2 pr-4 font-medium">上传时间</th>
                  <th className="py-2 pr-4 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {files.map(file => (
                  <tr key={file.id} className="border-b last:border-b-0">
                    <td className="max-w-65 py-2 pr-4">
                      <p className="truncate font-medium">{file.fileName}</p>
                      <p className="truncate text-xs text-muted-foreground">{file.fileHash.slice(0, 20)}...</p>
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">{formatBytes(file.fileSize)}</td>
                    <td className="py-2 pr-4">
                      <Badge variant={file.strategy === 'instant' ? 'success' : 'secondary'}>{file.strategy}</Badge>
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">{formatDateTime(file.createdAt)}</td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => onOpenFile(file.id, 'preview')}>
                          <Eye className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => onOpenFile(file.id, 'download')}>
                          <ArrowDownToLine className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
