import { UploadFloatingPanel, type UploadFloatingPanelProps } from '@/components/upload-floating-panel'

interface UploadPanelSectionProps extends Omit<UploadFloatingPanelProps, 'onRequestClose'> {
  isVisible: boolean
  onClose: () => void
}

export function UploadPanelSection({
  isVisible,
  onClose,
  tasks,
  overview,
  onCancelAll,
  onPauseAll,
  onContinueAll,
  onCancelTask,
  onPauseTask,
  onContinueTask
}: UploadPanelSectionProps) {
  if (!isVisible) {
    return null
  }

  return (
    <UploadFloatingPanel
      tasks={tasks}
      overview={overview}
      onCancelAll={onCancelAll}
      onPauseAll={onPauseAll}
      onContinueAll={onContinueAll}
      onCancelTask={onCancelTask}
      onPauseTask={onPauseTask}
      onContinueTask={onContinueTask}
      onRequestClose={onClose}
    />
  )
}
