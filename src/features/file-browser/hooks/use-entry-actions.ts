import { useUploadBrowserStore } from '@/features/file-browser/store/file-browser-store'

import { useCreateFolderAction } from './entry-actions/use-create-folder-action'
import { useEntryDetailsAction } from './entry-actions/use-entry-details-action'
import { useMoveEntryAction } from './entry-actions/use-move-entry-action'
import { useRenameEntryAction } from './entry-actions/use-rename-entry-action'
import { useTrashEntryAction } from './entry-actions/use-trash-entry-action'
import type { UseEntryActionsInput } from './entry-actions/types'

export function useEntryActions({ currentFolderId, currentFolderIdRef, loadEntries }: UseEntryActionsInput) {
  const currentPath = useUploadBrowserStore(state => state.currentPath)
  const breadcrumbs = useUploadBrowserStore(state => state.breadcrumbs)
  const files = useUploadBrowserStore(state => state.files)
  const folders = useUploadBrowserStore(state => state.folders)
  const setEntries = useUploadBrowserStore(state => state.setEntries)

  const createFolderAction = useCreateFolderAction({
    currentFolderId,
    loadEntries
  })

  const renameEntryAction = useRenameEntryAction({
    currentFolderIdRef,
    loadEntries
  })

  const moveEntryAction = useMoveEntryAction({
    currentFolderIdRef,
    loadEntries
  })

  const trashEntryAction = useTrashEntryAction({
    currentFolderIdRef,
    loadEntries,
    currentPath,
    breadcrumbs,
    folders,
    files,
    setEntries
  })

  const detailsEntryAction = useEntryDetailsAction()

  return {
    ...createFolderAction,
    ...renameEntryAction,
    ...moveEntryAction,
    ...trashEntryAction,
    ...detailsEntryAction
  }
}
