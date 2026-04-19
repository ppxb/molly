import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'

import type { EntryDetailsTarget, FolderDetailsSummary } from '@/features/file-browser/components/item-details-dialog'
import { getErrorMessage, getFolderSizeInfoRequest } from '@/lib/upload/client/api'
import type { UploadFolderRecord, UploadedFileRecord } from '@/lib/upload/shared'

import { toRootLocation } from './types'

export function useEntryDetailsAction() {
  const [detailsTarget, setDetailsTarget] = useState<EntryDetailsTarget | null>(null)
  const [isLoadingDetailsSummary, setIsLoadingDetailsSummary] = useState(false)
  const [folderDetailsSummary, setFolderDetailsSummary] = useState<FolderDetailsSummary | null>(null)
  const detailsSummaryRequestIdRef = useRef(0)

  const onViewDetailsFile = useCallback((file: UploadedFileRecord) => {
    detailsSummaryRequestIdRef.current += 1
    setFolderDetailsSummary(null)
    setIsLoadingDetailsSummary(false)
    setDetailsTarget({
      id: file.id,
      type: 'file',
      hash: file.fileHash,
      name: file.fileName,
      location: toRootLocation(file.folderPath),
      createdAt: file.createdAt,
      updatedAt: file.updatedAt
    })
  }, [])

  const onViewDetailsFolder = useCallback((folder: UploadFolderRecord) => {
    const requestId = detailsSummaryRequestIdRef.current + 1
    detailsSummaryRequestIdRef.current = requestId

    setFolderDetailsSummary(null)
    setIsLoadingDetailsSummary(true)
    setDetailsTarget({
      id: folder.id,
      type: 'folder',
      name: folder.folderName,
      location: toRootLocation(folder.parentPath),
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt
    })

    void (async () => {
      try {
        const summary = await getFolderSizeInfoRequest({
          file_id: folder.id
        })
        if (detailsSummaryRequestIdRef.current !== requestId) {
          return
        }
        setFolderDetailsSummary({
          size: summary.size,
          fileCount: summary.file_count,
          folderCount: summary.folder_count,
          displaySummary: summary.display_summary
        })
      } catch (error) {
        if (detailsSummaryRequestIdRef.current !== requestId) {
          return
        }
        toast.error(getErrorMessage(error, 'Failed to load folder details'))
      } finally {
        if (detailsSummaryRequestIdRef.current === requestId) {
          setIsLoadingDetailsSummary(false)
        }
      }
    })()
  }, [])

  const onDetailsDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      detailsSummaryRequestIdRef.current += 1
      setDetailsTarget(null)
      setFolderDetailsSummary(null)
      setIsLoadingDetailsSummary(false)
    }
  }, [])

  return {
    detailsTarget,
    isLoadingDetailsSummary,
    folderDetailsSummary,
    onDetailsDialogOpenChange,
    onViewDetailsFile,
    onViewDetailsFolder
  }
}
