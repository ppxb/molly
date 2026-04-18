import { HouseIcon } from 'lucide-react'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb'
import type { UploadBreadcrumbItem } from '@/lib/upload/shared'

interface UploadBreadcrumbNavProps {
  currentFolderId: string
  breadcrumbs: UploadBreadcrumbItem[]
  onNavigate: (folderId: string) => void
}

export function UploadBreadcrumbNav({ currentFolderId, breadcrumbs, onNavigate }: UploadBreadcrumbNavProps) {
  return (
    <div className="border bg-muted/30 p-2">
      <Breadcrumb>
        <BreadcrumbList className="gap-1.5 sm:gap-1.5">
          {breadcrumbs.map((item, index) => {
            const isRoot = item.id === 'root'
            const isCurrent = item.id === currentFolderId
            const label = isRoot ? 'Home' : item.label

            return (
              <BreadcrumbItem key={item.id}>
                {isCurrent ? (
                  <BreadcrumbPage className="inline-flex items-center font-semibold">
                    <span className="inline-flex items-center gap-1.5">
                      {isRoot ? <HouseIcon className="size-4" aria-hidden="true" /> : null}
                      {label}
                    </span>
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    href="#"
                    className="inline-flex items-center gap-1.5"
                    onClick={event => {
                      event.preventDefault()
                      onNavigate(item.id)
                    }}
                  >
                    {isRoot ? <HouseIcon className="size-4" aria-hidden="true" /> : null}
                    {label}
                  </BreadcrumbLink>
                )}
                {index < breadcrumbs.length - 1 ? <BreadcrumbSeparator /> : null}
              </BreadcrumbItem>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  )
}
