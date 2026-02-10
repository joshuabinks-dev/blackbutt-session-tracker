import React, { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../state/store'
import type { GroupId, TemplateDef } from '../state/types'
import { formatClock } from '../utils/time'
 

export default function SessionRunner() {
  const sessions = useAppStore(s => s.sessions)
  const activeSessionId = useAppStore(s => s.activeSessionId)
  const viewingSessionId = useAppStore(s => s.viewingSessionId)
  const templates = useAppStore(s => s.templates)
  const groups = useAppStore(s => s.groups)
  const athletes = useAppStore(s => s.athletes)
  const blocks = useAppStore(s => s.blocks)
  const recoveries = useAppStore(s => s.recoveries)
  const locations = useAppStore(s => s.locations)

  const hydrate = useAppStore(s => s.hydrate)
  const persist = useAppStore(s => s.persist)
  const setSessionLocation = useAppStore(s => s.setSessionLocation)
  const setSessionName = useAppStore(s => s.setSessionName)
  const toggleAthleteActive = useAppStore(s => s.toggleAthleteActive)
  const setSessionParticipants = useAppStore(s => s.setSessionParticipants)

  const startCurrentItem = useAppStore(s => s.startCurrentItem)
  const nextOverride = useAppStore(s => s.nextOverride)
  const backOverride = useAppStore(s => s.backOverride)
  const autoBoundary = useAppStore(s => s.autoBoundary)
  const captureAthlete = useAppStore(s => s.captureAthlete)
  const clearViewedSession = useAppStore(s => s.clearViewedSession)

  useEffect(() => hydrate(), [hydrate])

  const sessionId = viewingSessionId || activeSessionId
  const session = sessionId ? sessions.find(s => s.sessionId === sessionId) : null
  const template: TemplateDef | null = useMemo(() => {
    if (!session?.templateId) return null
    return templates.find(t => t.templateId === session.templateId) || null
  }, [session, templates])

  const [now, setNow] = useState<number>(() => Date.now())
  // v0.3.5: hide Athletes & Groups by default; coach can show when needed.
  const [showAthletes, setShowAthletes] = useState<boolean>(false)
  const [athleteSearch, setAthleteSearch] = useState<string>('')

  // Re-hide when session changes (or when navigating away and back)
  useEffect(() => {
    setShowAthletes(false)
  }, [sessionId])

  // Tick timer and apply auto-boundaries for running cycle/recovery and manual rest
  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now())
      const s = useAppStore.getState()
      const sid = s.activeSessionId
      if (!sid) return
      const sess = s.sessions.find(x => x.sessionId === sid)
      if (!sess || sess.endedAtISO) return
      const tpl = sess.templateId ? s.templates.find(t => t.templateId === sess.templateId) : null
      if (!tpl) return

      for (const g of s.groups) {
        const gs = sess.groupRunState[g.groupId]
        if (!gs || (gs.status !== 'running' && gs.status !== 'resting')) continue
        const item = tpl.sequence[gs.sequenceIndex]
        if (!item) continue
        const startMs = gs.timer.startMs
        const durMs = gs.timer.durationMs
        if (!startMs || !durMs) continue
        const elapsed = Date.now() - startMs
        if (elapsed >= durMs) {
          // Auto boundary for cycle work, recovery, or manual rest
          autoBoundary(sid, g.groupId)
        }
      }
    }, 100)
    return () => window.clearInterval(id)
  }, [autoBoundary])

  useEffect(() => {
    // Persist changes opportunistically (keeps localStorage in sync)
    persist()
  }, [persist, session])

  if (!session || !template) {
    return <div className="card"><div className="muted">Select a session from Home to begin.</div></div>
  }

  const isReadOnly = !!session.endedAtISO

  const maxSessionNameLen = useMemo(() => {
    let max = 0
    for (const p of session.participants) {
      const a = athletes.find(x => x.athleteId === p.athleteId)
      if (!a) continue
      const len = `${a.firstName} ${a.lastName}`.length
      if (len > max) max = len
    }
    return Math.max(8, max)
  }, [session.participants, athletes])

  const groupsInSession = useMemo(() => {
    const present = new Set(session.participants.filter(p => p.isActiveInSession).map(p => p.groupId))
    return groups.filter(g => g.groupId !== 'ALL' && present.has(g.groupId))
  }, [groups, session.participants])

  return (
    <div className="stack">
      <section className="card">
        <div className="row">
          <div className="grow">
            {viewingSessionId && (
              <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <div className="tag">Viewing ended session</div>
              </div>
            )}
            {!isReadOnly ? (
              <input
                className="titleInput"
                value={session.name}
                onChange={(e) => setSessionName(session.sessionId, e.target.value)}
              />
            ) : (
              <h2 style={{ marginBottom: 4 }}>{session.name}</h2>
            )}
            <div className="sub">Started {new Date(session.startedAtISO).toLocaleString()}</div>
          </div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <div className="grow">
            <label className="label">Location</label>
            <select
              disabled={isReadOnly}
              value={locations.includes(session.location) ? session.location : '__custom__'}
              onChange={(e) => {
                const v = e.target.value
                if (v !== '__custom__') setSessionLocation(session.sessionId, v)
                else setSessionLocation(session.sessionId, '')
              }}
            >
              {locations.slice().sort().map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
              <option value="__custom__">Custom…</option>
            </select>
            {!locations.includes(session.location) && (
              <input
                disabled={isReadOnly}
                placeholder="Enter custom location"
                value={session.location}
                onChange={(e) => setSessionLocation(session.sessionId, e.target.value)}
              />
            )}
          </div>
        </div>
      </section>

      
      <section className="card">
        <div className="row" style={{ alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0 }}>Athletes & Groups</h2>
          <div className="grow" />
          <button
            className="btnSmall"
            onClick={() => setShowAthletes(v => !v)}
            title={showAthletes ? 'Hide this panel' : 'Show this panel'}
          >
            {showAthletes ? 'Hide' : 'Show'}
          </button>
        </div>

        {!showAthletes && (
          <div className="muted" style={{ marginTop: 8 }}>
            Hidden during capture. Tap <b>Show</b> to edit athletes/groups.
          </div>
        )}

        {showAthletes && (
          <>
            <div className="muted" style={{ marginTop: 6 }}>
              Tick attending athletes for this session (most sessions use 5–15). Deactivate an attending athlete if they drop out mid-session (prior results remain; future reps blank).
            </div>

            <div className="row" style={{ gap: 10, marginTop: 10, alignItems: 'center' }}>
              <input
                disabled={isReadOnly}
                className="input"
                placeholder="Search athletes…"
                value={athleteSearch}
                onChange={(e) => setAthleteSearch(e.target.value)}
                style={{ flex: '1 1 auto' }}
              />
              <div className="muted" style={{ whiteSpace: 'nowrap' }}>
                Selected: <b>{session.participants.length}</b>
              </div>
            </div>

            <div className="grid2" style={{ marginTop: 12 }}>
              {athletes
                .slice()
                .sort((a1, a2) => (`${a1.lastName} ${a1.firstName}`).localeCompare(`${a2.lastName} ${a2.firstName}`))
                .filter(a => {
                  const q = athleteSearch.trim().toLowerCase()
                  if (!q) return true
                  return (`${a.firstName} ${a.lastName}`).toLowerCase().includes(q)
                })
                .map(a => {
                  const p = session.participants.find((pp: any) => pp.athleteId === a.athleteId)
                  const isInSession = !!p
                  const isActive = p?.isActiveInSession ?? false

                  return (
                    <div key={a.athleteId} className="attendRow">
                      <input
                        type="checkbox"
                        checked={isInSession}
                        disabled={isReadOnly}
                        onChange={(e) => {
                          const checked = e.target.checked
                          if (checked) {
                            const updated = [...session.participants, { athleteId: a.athleteId, groupId: a.defaultGroupId, isActiveInSession: true }]
                            setSessionParticipants(session.sessionId, updated)
                          } else {
                            const updated = session.participants.filter((pp: any) => pp.athleteId !== a.athleteId)
                            setSessionParticipants(session.sessionId, updated)
                          }
                        }}
                        aria-label="Attend"
                      />

                      <button
                        className={!isInSession ? 'btn' : (isActive ? 'btnActive' : 'btnInactive')}
                        disabled={isReadOnly || !isInSession}
                        onClick={() => {
                          if (!isInSession) return
                          toggleAthleteActive(session.sessionId, a.athleteId, !isActive)
                        }}
                        title={!isInSession ? 'Not attending' : (isActive ? 'Tap to deactivate for remainder of session' : 'Tap to re-activate')}
                        style={{
                          width: `${maxSessionNameLen + 2}ch`,
                          flex: '1 1 0',
                          minWidth: 0,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          textAlign: 'left',
                          lineHeight: 1.15,
                        }}
                      >
                        {a.firstName} {a.lastName}
                      </button>

                      <select
                        disabled={isReadOnly || !isInSession || session.participants.every((pp: any) => pp.groupId === 'ALL')}
                        value={p?.groupId || a.defaultGroupId}
                        onChange={(e) => {
                          if (!isInSession) return
                          const gid = e.target.value
                          const updated = session.participants.map((pp: any) => (pp.athleteId === a.athleteId ? { ...pp, groupId: gid } : pp))
                          setSessionParticipants(session.sessionId, updated)
                        }}
                        style={{ width: 64, minWidth: 64, paddingLeft: 10, paddingRight: 10, textAlign: 'center' }}
                      >
                        {groups.filter(g => g.groupId !== 'ALL').map(g => (
                          <option key={g.groupId} value={g.groupId}>{g.groupId}</option>
                        ))}
                      </select>
                    </div>
                  )
                })}
            </div>
          </>
        )}
      </section>


      <section className="card">
        <div className="row" style={{ alignItems: 'baseline', gap: 10 }}>
          <h2 style={{ margin: 0 }}>Groups</h2>
          <div className="grow" />
        </div>
        <div className="muted" style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>
          {template.description || '—'}
        </div>
        <div className="grid">
          {groupsInSession.map(g => (
            <GroupCard
              key={g.groupId}
              nowMs={now}
              groupId={g.groupId}
              groupLabel={g.groupId}
              sessionId={session.sessionId}
              template={template}
              session={session}
              athletes={athletes}
              blocks={blocks}
              recoveries={recoveries}
              onStart={() => startCurrentItem(session.sessionId, g.groupId)}
              onBack={() => backOverride(session.sessionId, g.groupId)}
              onNext={() => nextOverride(session.sessionId, g.groupId)}
              onCapture={(aid) => captureAthlete(session.sessionId, g.groupId, aid)}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function GroupCard(props: {
  nowMs: number
  groupId: GroupId
  groupLabel: string
  sessionId: string
  template: TemplateDef
  session: any
  athletes: any[]
  blocks: any[]
  recoveries: any[]
  onStart: () => void
  onBack: () => void
  onNext: () => void
  onCapture: (athleteId: string) => void
}) {
  const { nowMs, groupId, groupLabel, template, session, athletes, blocks, recoveries } = props
  const events = useAppStore(s => s.eventsBySessionId[props.sessionId] || [])
  const gs = session.groupRunState[groupId]
  const item = template.sequence[gs.sequenceIndex]

  let title = '—'
  let sub = ''
  let timerLine = ''

  if (item?.type === 'work') {
    const block = blocks.find(b => b.blockId === item.blockId)
    title = block ? block.label : 'Work'
    sub = `Step ${gs.sequenceIndex + 1} • Rep ${gs.repIndex + 1}`

    const startMs = gs.timer.startMs
    const durMs = gs.timer.durationMs
    const elapsed = startMs ? nowMs - startMs : 0

    if (gs.status === 'running') {
      if (block?.timingMode === 'cycle' && durMs) {
        timerLine = `${formatClock(elapsed)} / ${formatClock(durMs)}`
      } else {
        timerLine = `${formatClock(elapsed)}`
      }
    } else if (gs.status === 'resting') {
      // Manual rest countdown (rep already fully captured)
      const remaining = durMs ? Math.max(0, durMs - elapsed) : 0
      timerLine = formatClock(remaining)
    } else if (gs.status === 'ready') {
      const sinceReady = gs.timer.startMs ? nowMs - gs.timer.startMs : 0
      // v0.3.5: READY counts up from 0 in the same mm:ss.s format
      timerLine = `${formatClock(sinceReady)}`
    } else {
      timerLine = '—'
    }
  } else if (item?.type === 'recovery') {
    const rec = recoveries.find(r => r.recoveryId === item.recoveryId)
    title = rec ? `${rec.label} (${Math.round(rec.durationSeconds / 60)}:${String(rec.durationSeconds % 60).padStart(2, '0')})` : 'Recovery'
    sub = `Step ${gs.sequenceIndex + 1}`

    const startMs = gs.timer.startMs
    const durMs = gs.timer.durationMs
    const elapsed = startMs ? nowMs - startMs : 0
    const remaining = durMs ? Math.max(0, durMs - elapsed) : 0

    if (gs.status === 'running') {
      timerLine = formatClock(remaining)
    } else if (gs.status === 'resting') {
      // Should not happen for recovery, but handle gracefully
      timerLine = formatClock(remaining)
    } else if (gs.status === 'ready') {
      const sinceReady = gs.timer.startMs ? nowMs - gs.timer.startMs : 0
      timerLine = `${formatClock(sinceReady)}`
    } else {
      timerLine = '—'
    }
  }

  let activeAthletes = session.participants
    .filter((p: any) => p.groupId === groupId && p.isActiveInSession)
    .map((p: any) => athletes.find(a => a.athleteId === p.athleteId))
    .filter(Boolean)

  // Capture UI ordering: fastest-first (based on prior rep) when available
  if (gs.sortOrderAthleteIds && gs.sortOrderAthleteIds.length) {
    const rank = new Map<string, number>()
    gs.sortOrderAthleteIds.forEach((id: string, idx: number) => rank.set(id, idx))
    activeAthletes = activeAthletes.slice().sort((a: any, b: any) => {
      const ra = rank.get(a.athleteId)
      const rb = rank.get(b.athleteId)
      if (ra == null && rb == null) return 0
      if (ra == null) return 1
      if (rb == null) return -1
      return ra - rb
    })
  }

  const canStart = gs.status === 'idle' || gs.status === 'ready'
  const canBack = gs.status === 'ready' || gs.status === 'resting'
  const canCapture = gs.status === 'running' && item?.type === 'work'

  // v0.3.5: rep time display (current rep), shown after last active athlete is captured.
  const activeIds = activeAthletes.map((a: any) => a.athleteId)
  const allCaptured = activeIds.length > 0 && activeIds.every((id: string) => gs.capturedThisRep.includes(id))
  const repTimes = useMemo(() => {
    const m = new Map<string, number | null>()
    for (const e of events as any[]) {
      if (e.groupId !== groupId) continue
      if (e.sequenceIndex !== gs.sequenceIndex) continue
      if (e.repIndex !== gs.repIndex) continue
      if (!e.athleteId) continue
      if (e.type === 'CAPTURE') m.set(e.athleteId, e.timeMs)
      if (e.type === 'EDIT') m.set(e.athleteId, e.newTimeMs)
      if (e.type === 'FORCE_ADVANCE_BLANK') m.set(e.athleteId, null)
    }
    return m
  }, [events, groupId, gs.sequenceIndex, gs.repIndex])

  // Column-major ordering for capture buttons (top-to-bottom priority)
  // v0.3.5.1: show 2 columns earlier (>=4 athletes) to reduce scrolling on mobile.
  const columns = activeAthletes.length >= 4 ? 2 : 1
  const rowsPerCol = Math.ceil(activeAthletes.length / columns)
  const cols: any[][] = []
  for (let c = 0; c < columns; c++) {
    cols.push(activeAthletes.slice(c * rowsPerCol, (c + 1) * rowsPerCol))
  }

  return (
    <div className={`groupCard groupAccent groupAccent_${groupId}`}>
      <div className="row">
        <div className="grow">
          <div className="title">{groupLabel}</div>
          <div className="sub">{title}</div>
          <div className="muted">{sub}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className={`pill pill_${gs.status}`}>{gs.status.toUpperCase()}</div>
          <div className={`timer timer_${gs.status}`}><span className="timerDigits">{timerLine}</span></div>
        </div>
      </div>

      <div className="row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
        <button className={canStart ? 'btnPrimary' : 'btn'} disabled={!canStart} onClick={props.onStart}>Start</button>
        <div className="grow" />
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" disabled={!canBack} onClick={props.onBack}>Back</button>
          <button className="btn" onClick={props.onNext}>Next</button>
        </div>
      </div>

      {(item?.type === 'work') && (
        <div className={canCapture ? "captureCols" : "captureCols captureGridDisabled"}>
          {cols.map((col, idx) => (
            <div key={idx} className={`captureCol ${idx === 0 && cols.length > 1 ? 'captureCol_divider' : ''}`}>
              {col.map((a: any) => {
                const done = gs.capturedThisRep.includes(a.athleteId)
                const t = repTimes.get(a.athleteId)
                const showTime = allCaptured && t != null
                return (
                  <button
                    key={a.athleteId}
                    className={done ? 'btnDone' : 'btn'}
                    disabled={!canCapture}
                    onClick={() => props.onCapture(a.athleteId)}
                  >
                    <div className="btnLine1">{a.firstName}{a.lastName ? ` ${a.lastName[0]}.` : ''}</div>
                    <div className="btnLine2">{showTime ? formatClock(t as number) : ''}</div>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}