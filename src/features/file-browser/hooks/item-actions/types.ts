import type { DriveBreadcrumbItem, DriveFolderRecord, DriveFileRecord } from '@/lib/drive/types'

export interface RenameTarget {
  id: string
  type: 'file' | 'folder'
  name: string
}

export interface MoveTarget {
  id: string
  type: 'file' | 'folder'
  name: string
  initialTargetFolderId: string
  excludeFolderId?: string
}

export interface TrashTarget {
  id: string
  type: 'file' | 'folder'
  name: string
}

export interface UseItemActionsInput {
  loadEntries: (folderId: string) => Promise<void>
}

export interface BrowserEntriesSnapshot {
  currentPath: string
  breadcrumbs: DriveBreadcrumbItem[]
  folders: DriveFolderRecord[]
  files: DriveFileRecord[]
  setEntries: (input: {
    folderId: string
    path: string
    breadcrumbs: DriveBreadcrumbItem[]
    folders: DriveFolderRecord[]
    files: DriveFileRecord[]
  }) => void
}

export function toRootLocation(path: string) {
  const normalized = path.trim().replace(/^\/+|\/+$/g, '')
  return normalized ? `root/${normalized}` : 'root'
}
