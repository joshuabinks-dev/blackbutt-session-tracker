import React, { useMemo } from 'react'
import { useAppStore } from '../state/store'
import type { SessionEvent } from '../state/types'
import { formatClock } from '../utils/time'

type CellKey = string

function key(g: string, s: number, r: number, a: string) {
  return `${g}|${s}|${r}|${a}`
}

function fold(events: SessionEvent[]) {
  // last-wins: EDIT overrides CAPTURE; FORCE_ADVANCE_BLANK just ensures blank
  const map = new Map<CellKey, number | null | undefined>()
  for (const e of events) {
    if (e.type === 'CAPTURE') {
      const k = key((e as any).groupId, (e as any).sequenceIndex, (e as any).repIndex, (e as any).athleteId)
      if (!map.has(k)) map.set(k, (e as any).timeMs)
      else {
        // allow multiple captures; keep last capture
        map.set(k, (e as any).timeMs)
      }
    }
    if (e.type === 'EDIT') {
      const k = key((e as any).groupId, (e as any).sequenceIndex, (e as any).repIndex, (e as any).athleteId)
      map.set(k, (e as any).newTimeMs)
    }
    if (e.type === 'FORCE_ADVANCE_BLANK') {
      const k = key((e as any).groupId, (e as any).sequenceIndex, (e as any).repIndex, (e as any).athleteId)
      if (!map.has(k)) map.set(k, null)
    }
  }
  return map
}

export default function Results() {
  const sessions = useAppStore(s => s.sessions)
  const activeSessionId = useAppStore(s => s.activeSessionId)
  const templates = useAppStore(s => s.templates)
  const athletes = useAppStore(s => s.athletes)
  const eventsBySessionId = useAppStore(s => s.eventsBySessionId)

  const session = activeSessionId ? sessions.find(s => s.sessionId === activeSessionId) : null
  const tpl = useMemo(() => {
    if (!session?.templateId) return null
    return templates.find(t => t.templateId === session.templateId) || null
  }, [session, templates])

  const events = session ? (eventsBySessionId[session.sessionId] || []) : []
  const cellMap = useMemo(() => fold(events), [events])

  if (!session || !tpl) {
    return <div className="card"><div className="muted">No active session results to show.</div></div>
  }

  // build headers: work items only, expand reps
  const cols: { label: string; sIdx: number; rep: number }[] = []
  tpl.sequence.forEach((it, sIdx) => {
    if (it.type !== 'work') return
    const block = useAppStore.getState().blocks.find(b => b.blockId === it.blockId)
    const reps = block?.reps || 0
    for (let r = 0; r < reps; r++) {
      cols.push({ label: `S${sIdx + 1} R${r + 1}`, sIdx, rep: r })
    }
  })

  // stable alphabetical sort
  const rows = session.participants
    .map(p => ({ p, a: athletes.find(a => a.athleteId === p.athleteId) }))
    .filter(x => x.a)
    .sort((x, y) => {
      const g = String(x.p.groupId).localeCompare(String(y.p.groupId))
      if (g !== 0) return g
      return `${x.a!.lastName} ${x.a!.firstName}`.localeCompare(`${y.a!.lastName} ${y.a!.firstName}`)
    })

  return (
    <div className="card">
      <h2>Results</h2>
      <div className="muted">Alphabetical view. Blanks indicate no capture / forced advance.</div>
      <div className="tableWrap">
        <table className="table">
          <thead>
            <tr>
              <th className="sticky">Name</th>
              {cols.map(c => (
                <th key={`${c.sIdx}-${c.rep}`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, a }) => (
              <tr key={p.athleteId} className={!p.isActiveInSession ? 'inactiveRow' : ''}>
                <td className="sticky">
                  <div className="nameCell">
                    <div className="nameMain">{a!.firstName} {a!.lastName}</div>
                    <div className="nameSub">Group {p.groupId}{!p.isActiveInSession ? ' • inactive' : ''}</div>
                  </div>
                </td>
                {cols.map(c => {
                  const k = key(String(p.groupId), c.sIdx, c.rep, p.athleteId)
                  const v = cellMap.get(k)
                  return <td key={k}>{typeof v === 'number' ? formatClock(v) : ''}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
