import {
  ArrowDownWideNarrow,
  FilePlusCornerIcon,
  FolderPlusIcon,
  FolderUpIcon,
  Grid2X2,
  List,
  Loader2,
  RefreshCcw
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ContextMenuContent, ContextMenuItem } from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import type { FileListOrderBy } from '@/lib/drive/client/api'

interface FileBrowserToolbarProps {
  totalCount: number
  isLoading: boolean
  orderBy: FileListOrderBy
  orderDirection: 'ASC' | 'DESC'
  viewMode: 'grid' | 'table'
  onRefresh: () => void
  onChangeOrderBy: (value: FileListOrderBy) => void
  onChangeOrderDirection: (value: 'ASC' | 'DESC') => void
  onChangeViewMode: (value: 'grid' | 'table') => void
}

interface FileBrowserContextMenuActionsProps {
  onUploadFiles?: () => void
  onCreateFolder: () => void
}

const orderByLabelMap: Record<FileListOrderBy, string> = {
  name: '名称',
  created_at: '创建时间',
  updated_at: '更新时间',
  size: '文件大小'
}

const orderDirectionLabelMap: Record<'ASC' | 'DESC', string> = {
  ASC: '升序',
  DESC: '降序'
}

export function FileBrowserToolbar({
  totalCount,
  isLoading,
  orderBy,
  orderDirection,
  viewMode,
  onRefresh,
  onChangeOrderBy,
  onChangeOrderDirection,
  onChangeViewMode
}: FileBrowserToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="text-xl font-semibold">{`共 ${totalCount} 项`}</div>

      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" disabled={isLoading}>
              <ArrowDownWideNarrow className="size-4" />
              {`Sort: ${orderByLabelMap[orderBy]}`}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup value={orderBy} onValueChange={value => onChangeOrderBy(value as FileListOrderBy)}>
              <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="created_at">Created Time</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="updated_at">Updated Time</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="size">File Size</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" disabled={isLoading}>
              {orderDirectionLabelMap[orderDirection]}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              value={orderDirection}
              onValueChange={value => onChangeOrderDirection(value as 'ASC' | 'DESC')}
            >
              <DropdownMenuRadioItem value="ASC">Ascending</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="DESC">Descending</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            onClick={() => onChangeViewMode('grid')}
            disabled={isLoading}
          >
            <Grid2X2 className="size-4" />
            Grid
          </Button>
          <Button
            type="button"
            variant={viewMode === 'table' ? 'default' : 'outline'}
            onClick={() => onChangeViewMode('table')}
            disabled={isLoading}
          >
            <List className="size-4" />
            Table
          </Button>
        </div>

        <Button variant="outline" onClick={onRefresh} disabled={isLoading}>
          {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
          Refresh
        </Button>
      </div>
    </div>
  )
}

export function FileBrowserContextMenuActions({ onUploadFiles, onCreateFolder }: FileBrowserContextMenuActionsProps) {
  return (
    <ContextMenuContent>
      <ContextMenuItem onSelect={() => onUploadFiles?.()}>
        <FilePlusCornerIcon className="size-3.5" />
        Upload Files
      </ContextMenuItem>
      <ContextMenuItem disabled>
        <FolderUpIcon className="size-3.5" />
        Upload Folder (Coming Soon)
      </ContextMenuItem>
      <ContextMenuItem onSelect={onCreateFolder}>
        <FolderPlusIcon className="size-3.5" />
        New Folder
      </ContextMenuItem>
    </ContextMenuContent>
  )
}
