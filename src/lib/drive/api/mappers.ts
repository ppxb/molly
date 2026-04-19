import type {
  FileGetPathItem,
  FileListItem,
  DriveBreadcrumbItem,
  DriveFolderRecord,
  DriveFileRecord
} from '@/lib/drive/api/types'

function inferFileExtension(fileName: string) {
  const dot = fileName.lastIndexOf('.')
  if (dot <= 0 || dot + 1 >= fileName.length) {
    return ''
  }

  return fileName.slice(dot + 1).toLowerCase()
}

function joinFolderPath(parentPath: string, childName: string) {
  const safeParent = parentPath.trim().replace(/^\/+|\/+$/g, '')
  const safeChild = childName.trim().replace(/^\/+|\/+$/g, '')

  if (!safeParent) {
    return safeChild
  }

  if (!safeChild) {
    return safeParent
  }

  return `${safeParent}/${safeChild}`
}

export function buildBreadcrumbs(pathItems: FileGetPathItem[]): DriveBreadcrumbItem[] {
  const breadcrumbs: DriveBreadcrumbItem[] = [
    {
      id: 'root',
      label: 'root',
      path: ''
    }
  ]

  let currentPath = ''
  for (const item of pathItems) {
    currentPath = joinFolderPath(currentPath, item.name)
    breadcrumbs.push({
      id: item.file_id,
      label: item.name,
      path: currentPath
    })
  }

  return breadcrumbs
}

export function mapFolderItem(item: FileListItem, currentPath: string): DriveFolderRecord {
  const folderPath = joinFolderPath(currentPath, item.name)

  return {
    id: item.file_id,
    folderName: item.name,
    parentId: item.parent_file_id || null,
    folderPath,
    parentPath: currentPath,
    createdAt: item.created_at,
    updatedAt: item.updated_at
  }
}

export function mapFileItem(item: FileListItem, currentPath: string): DriveFileRecord {
  const fileName = item.name

  return {
    id: item.file_id,
    fileName,
    fileExtension: item.file_extension || inferFileExtension(fileName),
    folderId: item.parent_file_id,
    folderPath: currentPath,
    contentType: item.mime_type || 'application/octet-stream',
    fileSize: item.size ?? 0,
    fileHash: item.content_hash || '',
    fileSampleHash: '',
    objectKey: '',
    bucket: '',
    strategy: 'single',
    createdAt: item.created_at,
    updatedAt: item.updated_at
  }
}
