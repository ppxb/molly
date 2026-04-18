import React, { useRef } from 'react'
import { FilePlusCornerIcon, FolderPlusIcon, FolderUpIcon, PlusIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

interface UploadFabMenuProps {
  currentPath: string
  onSelectFiles: (files: File[]) => void
  onCreateFolder: () => void
}

function formatPathLabel(path: string) {
  return path ? `/${path}` : '/'
}

export function UploadFabMenu({ currentPath, onSelectFiles, onCreateFolder }: UploadFabMenuProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length > 0) {
      onSelectFiles(files)
    }
    event.target.value = ''
  }

  return (
    <>
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
      <div className="fixed right-12 bottom-12 z-40">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-lg" className="shadow-md hover:cursor-pointer">
              <PlusIcon className="size-5" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Add To {formatPathLabel(currentPath)}</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
              <FilePlusCornerIcon className="size-4" />
              Upload files
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onCreateFolder}>
              <FolderPlusIcon className="size-4" />
              New folder
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <FolderUpIcon className="size-4" />
              Upload folder (soon)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  )
}
