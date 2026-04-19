const SPEED_SAMPLE_INTERVAL_MS = 250
const SPEED_SMOOTHING_WEIGHT = 0.25

interface TaskSpeedSample {
  sampledLoadedBytes: number
  sampledAtMS: number
  speedBytesPerSecond: number
}

export interface TaskSpeedTracker {
  beginTask: (taskID: string, loadedBytes?: number) => void
  sampleTask: (taskID: string, loadedBytes: number) => number
  clearTask: (taskID: string) => void
  clearAll: () => void
}

export function createTaskSpeedTracker(): TaskSpeedTracker {
  const samples = new Map<string, TaskSpeedSample>()

  return {
    beginTask(taskID, loadedBytes = 0) {
      samples.set(taskID, {
        sampledLoadedBytes: loadedBytes,
        sampledAtMS: performance.now(),
        speedBytesPerSecond: 0
      })
    },
    sampleTask(taskID, loadedBytes) {
      const nowMS = performance.now()
      const previousSample = samples.get(taskID)

      if (!previousSample) {
        samples.set(taskID, {
          sampledLoadedBytes: loadedBytes,
          sampledAtMS: nowMS,
          speedBytesPerSecond: 0
        })
        return 0
      }

      const deltaMS = Math.max(0, nowMS - previousSample.sampledAtMS)
      const shouldResample = deltaMS >= SPEED_SAMPLE_INTERVAL_MS
      if (!shouldResample) {
        return previousSample.speedBytesPerSecond
      }

      const deltaBytes = Math.max(0, loadedBytes - previousSample.sampledLoadedBytes)
      const deltaSeconds = deltaMS / 1000
      const instantSpeed = deltaSeconds > 0 ? deltaBytes / deltaSeconds : 0
      const speedBytesPerSecond =
        previousSample.speedBytesPerSecond > 0
          ? previousSample.speedBytesPerSecond * (1 - SPEED_SMOOTHING_WEIGHT) + instantSpeed * SPEED_SMOOTHING_WEIGHT
          : instantSpeed

      samples.set(taskID, {
        sampledLoadedBytes: loadedBytes,
        sampledAtMS: nowMS,
        speedBytesPerSecond
      })

      return speedBytesPerSecond
    },
    clearTask(taskID) {
      samples.delete(taskID)
    },
    clearAll() {
      samples.clear()
    }
  }
}
