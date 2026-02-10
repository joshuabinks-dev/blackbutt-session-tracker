export function formatClock(ms: number): string {
  const totalTenth = Math.floor(ms / 100)
  const tenths = totalTenth % 10
  const totalSeconds = Math.floor(totalTenth / 10)
  const seconds = totalSeconds % 60
  const minutes = Math.floor(totalSeconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`
}

// Parse time strings for results editing.
// Accepts:
//  - SS.s   (e.g., 72.4)
//  - M:SS.s (e.g., 1:12.4)
// Returns milliseconds (rounded to nearest 100ms) or null if invalid.
export function parseEditableTimeToMs(input: string): number | null {
  const t = input.trim()
  if (!t) return null

  let totalSeconds: number | null = null
  if (t.includes(':')) {
    const parts = t.split(':')
    if (parts.length !== 2) return null
    const m = Number(parts[0])
    const s = Number(parts[1])
    if (!Number.isFinite(m) || !Number.isFinite(s)) return null
    if (m < 0 || s < 0 || s >= 60) return null
    totalSeconds = m * 60 + s
  } else {
    const s = Number(t)
    if (!Number.isFinite(s) || s < 0) return null
    totalSeconds = s
  }

  // Round to nearest tenth of a second to match capture precision.
  const tenth = Math.round(totalSeconds * 10)
  return tenth * 100
}

export function msToSeconds(ms: number): number {
  return ms / 1000
}
