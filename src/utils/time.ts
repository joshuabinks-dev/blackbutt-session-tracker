export function formatClock(ms: number): string {
  const totalTenth = Math.floor(ms / 100)
  const tenths = totalTenth % 10
  const totalSeconds = Math.floor(totalTenth / 10)
  const seconds = totalSeconds % 60
  const minutes = Math.floor(totalSeconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`
}

export function msToSeconds(ms: number): number {
  return ms / 1000
}
