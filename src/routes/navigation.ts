import { FolderIcon, HomeIcon, type LucideIcon } from 'lucide-react'

export interface NavItem {
  id: string
  to: string
  label: string
  icon: LucideIcon
}

export const appNavItems: NavItem[] = [
  { id: 'home', to: '/home', label: 'Home', icon: HomeIcon },
  { id: 'file', to: '/file', label: 'Files', icon: FolderIcon }
]
