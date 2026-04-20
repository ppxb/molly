import type { FileOrderBy, FileOrderDirection } from '@/stores/file-store'

export const fileKeys = {
  all: ['drive'] as const,

  // 文件列表
  entries: (folderId: string, orderBy: FileOrderBy, direction: FileOrderDirection) =>
    [...fileKeys.all, 'entries', folderId, orderBy, direction] as const,

  // 回收站
  recycleBin: () => [...fileKeys.all, 'recyclebin'] as const,

  // 文件夹大小信息（详情弹窗用）
  folderSize: (folderId: string) => [...fileKeys.all, 'folderSize', folderId] as const,

  // 移动目标文件夹列表
  moveTargets: (excludeId?: string) => [...fileKeys.all, 'moveTargets', excludeId ?? ''] as const
}
