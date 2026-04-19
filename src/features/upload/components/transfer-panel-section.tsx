import {
  TransferFloatingPanel,
  type TransferFloatingPanelProps
} from '@/features/upload/components/transfer-floating-panel'

interface TransferPanelSectionProps extends Omit<TransferFloatingPanelProps, 'onRequestClose'> {
  isVisible: boolean
  onClose: () => void
}

export function TransferPanelSection({
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
}: TransferPanelSectionProps) {
  if (!isVisible) {
    return null
  }

  return (
    <TransferFloatingPanel
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
