import { useFileBrowserStore } from '@/features/file-browser/store/file-browser-store'

import { useCreateFolderAction } from './item-actions/use-create-folder-action'
import { useItemDetailsAction } from './item-actions/use-item-details-action'
import { useMoveItemAction } from './item-actions/use-move-item-action'
import { useRenameItemAction } from './item-actions/use-rename-item-action'
import { useTrashItemAction } from './item-actions/use-trash-item-action'
import type { UseItemActionsInput } from './item-actions/types'

export function useItemActions({ currentFolderId, currentFolderIdRef, loadEntries }: UseItemActionsInput) {
  const currentPath = useFileBrowserStore(state => state.currentPath)
  const breadcrumbs = useFileBrowserStore(state => state.breadcrumbs)
  const files = useFileBrowserStore(state => state.files)
  const folders = useFileBrowserStore(state => state.folders)
  const setEntries = useFileBrowserStore(state => state.setEntries)

  const createFolderAction = useCreateFolderAction({
    currentFolderId,
    loadEntries
  })

  const renameItemAction = useRenameItemAction({
    currentFolderIdRef,
    loadEntries
  })

  const moveItemAction = useMoveItemAction({
    currentFolderIdRef,
    loadEntries
  })

  const trashItemAction = useTrashItemAction({
    currentFolderIdRef,
    loadEntries,
    currentPath,
    breadcrumbs,
    folders,
    files,
    setEntries
  })

  const detailsItemAction = useItemDetailsAction()

  return {
    ...createFolderAction,
    ...renameItemAction,
    ...moveItemAction,
    ...trashItemAction,
    ...detailsItemAction
  }
}
