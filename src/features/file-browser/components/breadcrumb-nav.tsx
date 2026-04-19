import { HouseIcon } from 'lucide-react'
import { Fragment } from 'react'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb'
import type { UploadBreadcrumbItem } from '@/lib/upload/shared'

interface BreadcrumbNavProps {
  currentFolderId: string
  breadcrumbs: UploadBreadcrumbItem[]
  onNavigate: (folderId: string) => void
}

export function BreadcrumbNav({ currentFolderId, breadcrumbs, onNavigate }: BreadcrumbNavProps) {
  return (
    <div className="border bg-muted/30 p-2">
      <Breadcrumb>
        <BreadcrumbList className="gap-1.5 sm:gap-1.5">
          {breadcrumbs.map((item, index) => {
            const isRoot = item.id === 'root'
            const isCurrent = item.id === currentFolderId
            const label = isRoot ? 'Home' : item.label

            return (
              <Fragment key={item.id}>
                <BreadcrumbItem>
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
                </BreadcrumbItem>
                {index < breadcrumbs.length - 1 ? <BreadcrumbSeparator /> : null}
              </Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  )
}
