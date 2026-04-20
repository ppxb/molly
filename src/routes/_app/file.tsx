import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/file')({
  staticData: {
    title: 'Files',
    description: '管理你的云端文件'
  },
  component: FilePage
})

function FilePage() {
  return <div>Files</div>
}
