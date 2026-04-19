import type { MutableRefObject } from 'react'

import type { UploadBreadcrumbItem, UploadFolderRecord, UploadedFileRecord } from '@/lib/drive/shared'

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
  currentFolderId: string
  currentFolderIdRef: MutableRefObject<string>
  loadEntries: (folderId: string) => Promise<void>
}

export interface BrowserEntriesSnapshot {
  currentPath: string
  breadcrumbs: UploadBreadcrumbItem[]
  folders: UploadFolderRecord[]
  files: UploadedFileRecord[]
  setEntries: (input: {
    folderId: string
    path: string
    breadcrumbs: UploadBreadcrumbItem[]
    folders: UploadFolderRecord[]
    files: UploadedFileRecord[]
  }) => void
}

export function toRootLocation(path: string) {
  const normalized = path.trim().replace(/^\/+|\/+$/g, '')
  return normalized ? `root/${normalized}` : 'root'
}
