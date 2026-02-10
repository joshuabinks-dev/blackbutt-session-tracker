import React, { useMemo, useRef, useState } from 'react'
import { useAppStore } from '../state/store'
import type { SessionEvent } from '../state/types'
import { formatClock, parseEditableTimeToMs } from '../utils/time'
import { shareElementAsPng } from '../utils/sharePng'
import * as XLSX from 'xlsx'

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
  const viewingSessionId = useAppStore(s => s.viewingSessionId)
  const templates = useAppStore(s => s.templates)
  const athletes = useAppStore(s => s.athletes)
  const eventsBySessionId = useAppStore(s => s.eventsBySessionId)

  const sessionId = viewingSessionId || activeSessionId
  const session = sessionId ? sessions.find(s => s.sessionId === sessionId) : null
  const [toast, setToast] = useState<string>('')
  const [editMode, setEditMode] = useState(false)
  const tableWrapRef = useRef<HTMLDivElement | null>(null)
  const shareWrapRef = useRef<HTMLDivElement | null>(null)

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
      const dist = block?.distanceMeters ?? 0
      cols.push({ label: `${dist} R${r + 1}`, sIdx, rep: r })
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


  const buildTSV = () => {
    // v0.3.2: include session metadata header (session name only) above the table.
    const lines: string[] = []
    lines.push(`Session\t${session.name}`)
    lines.push(`Started\t${new Date(session.startedAtISO).toLocaleString()}`)
    lines.push(`Location\t${session.location}`)
    lines.push('')

    // Header row: Athlete, Group, then each column label
    const header = ['Athlete', 'Group', ...cols.map(c => c.label)]
    lines.push(header.join('\t'))
    for (const { p, a } of rows) {
      const row: string[] = [`${a!.firstName} ${a!.lastName}`, String(p.groupId)]
      for (const c of cols) {
        const k = key(String(p.groupId), c.sIdx, c.rep, p.athleteId)
        const v = cellMap.get(k)
        row.push(typeof v === 'number' ? formatClock(v) : '')
      }
      lines.push(row.join('\t'))
    }
    return lines.join('\n')
  }

  const fileStamp = (iso: string) => {
    // YYYY-MM-DD_HHMM
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`
  }

  const doShareXlsx = async () => {
    try {
      const tsv = buildTSV()
      const rows = tsv.split('\n').map(l => l.split('\t'))

      const ws = XLSX.utils.aoa_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Results')

      const arr = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([arr], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

      const finishedIso = session.endedAtISO || new Date().toISOString()
      const filenameBase = `Train_Plan_Track_${fileStamp(finishedIso)}`
      const file = new File([blob], `${filenameBase}.xlsx`, { type: blob.type })

      const nav: any = navigator as any
      if (!nav.share) {
        setToast('Share failed')
        window.setTimeout(() => setToast(''), 1500)
        return
      }
      if (nav.canShare && !nav.canShare({ files: [file] })) {
        setToast('Share failed')
        window.setTimeout(() => setToast(''), 1500)
        return
      }
      await nav.share({ title: `${session.name} results`, files: [file] })
      setToast('Shared XLSX')
      window.setTimeout(() => setToast(''), 1500)
    } catch {
      setToast('Share failed')
      window.setTimeout(() => setToast(''), 1500)
    }
  }

  const doShareImage = async () => {
    const el = shareWrapRef.current || tableWrapRef.current
    if (!el) return
    const finishedIso = session.endedAtISO || new Date().toISOString()
    const ok = await shareElementAsPng(el, `Train_Plan_Track_${fileStamp(finishedIso)}`, `${session.name} results`)
    setToast(ok ? 'Shared image' : 'Share failed')
    window.setTimeout(() => setToast(''), 1500)
  }

  const editCellPrompt = (groupId: string, sIdx: number, rep: number, athleteId: string, currentMs: number | null | undefined) => {
    const cur = typeof currentMs === 'number' ? formatClock(currentMs) : ''
    const input = window.prompt('Enter time (SS.s or M:SS.s). Leave blank to clear.', cur)
    if (input === null) return
    const t = input.trim()
    if (!t) {
      useAppStore.getState().editCell(session.sessionId, groupId, athleteId, sIdx, rep, null)
      return
    }
    const ms = parseEditableTimeToMs(t)
    if (ms === null) {
      window.alert('Invalid time format. Use SS.s (e.g. 72.4) or M:SS.s (e.g. 1:12.4).')
      return
    }
    useAppStore.getState().editCell(session.sessionId, groupId, athleteId, sIdx, rep, ms)
  }

  const renderTable = (filteredRows: typeof rows) => (
    <div style={{ marginTop: 16 }}>
      <div className="tableWrap">
        <table className="table">
          <thead>
            <tr>
              <th className="sticky">Name</th>
              <th>Group</th>
              {cols.map(c => (
                <th key={`${c.sIdx}-${c.rep}`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map(({ p, a }) => (
              <tr key={`${p.groupId}-${p.athleteId}`} className={!p.isActiveInSession ? 'inactiveRow' : ''}>
                <td className="sticky">
                  <div className="nameCell">
                    <div className="nameMain">{a!.firstName} {a!.lastName}</div>
                    <div className="nameSub">{!p.isActiveInSession ? 'inactive' : ''}</div>
                  </div>
                </td>
                <td>{String(p.groupId)}</td>
                {cols.map(c => {
                  const cellKey = key(String(p.groupId), c.sIdx, c.rep, p.athleteId)
                  const v = cellMap.get(cellKey)
                  const txt = typeof v === 'number' ? formatClock(v) : ''
                  return (
                    <td
                      key={cellKey}
                      onClick={() => editMode && editCellPrompt(String(p.groupId), c.sIdx, c.rep, p.athleteId, v)}
                      style={editMode ? { cursor: 'pointer' } : undefined}
                      title={editMode ? 'Tap to edit' : undefined}
                    >
                      {txt}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <div className="card">
      <h2>Results</h2>
      {toast && <div className="toast">{toast}</div>}
      <div className="muted">Alphabetical view. Blanks indicate no capture / forced advance.</div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <button className="btn" onClick={doShareXlsx}>Share XLSX</button>
        <button className="btn" onClick={doShareImage}>Share Table Image</button>
        <button className={editMode ? 'btnActive' : 'btn'} onClick={() => setEditMode(v => !v)}>
          {editMode ? 'Editing On' : 'Edit Mode'}
        </button>
      </div>
      {/* Share wrapper: hidden build of metadata + table so PNG includes session name/start/location */}
      <div ref={shareWrapRef} style={{ position: 'absolute', left: '-10000px', top: 0, width: 'max-content' }} aria-hidden="true">
        <table className="table">
          <tbody>
            <tr>
              <th colSpan={2 + cols.length} style={{ textAlign: 'left', fontSize: 16, padding: '10px 12px' }}>{session.name}</th>
            </tr>
            <tr>
              <th colSpan={2 + cols.length} style={{ textAlign: 'left', fontSize: 12, fontWeight: 400, padding: '0 12px 10px 12px' }}>
                {new Date(session.startedAtISO).toLocaleString()} • {session.location}
              </th>
            </tr>
            <tr>
              <th>Name</th>
              <th>Group</th>
              {cols.map(c => (
                <th key={`sh-${c.sIdx}-${c.rep}`}>{c.label}</th>
              ))}
            </tr>
            {rows.map(({ p, a }) => (
              <tr key={`sh-${p.groupId}-${p.athleteId}`}>
                <td>{a!.firstName} {a!.lastName}</td>
                <td>{String(p.groupId)}</td>
                {cols.map(c => {
                  const cellKey = key(String(p.groupId), c.sIdx, c.rep, p.athleteId)
                  const v = cellMap.get(cellKey)
                  const txt = typeof v === 'number' ? formatClock(v) : ''
                  return <td key={`sh-${cellKey}`}>{txt}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div ref={tableWrapRef}>
        {renderTable(rows)}
      </div>
    </div>
  )
}