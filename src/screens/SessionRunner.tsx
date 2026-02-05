import React, { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../state/store'
import type { GroupId, TemplateDef } from '../state/types'
import { formatClock } from '../utils/time'

const LOCATIONS = ['Beaton Park', 'Blackbutt', 'Myimbarr', 'Reddall Reserve', 'Shellharbour SC', 'West Dapto KJs']

export default function SessionRunner() {
  const sessions = useAppStore(s => s.sessions)
  const activeSessionId = useAppStore(s => s.activeSessionId)
  const templates = useAppStore(s => s.templates)
  const groups = useAppStore(s => s.groups)
  const athletes = useAppStore(s => s.athletes)
  const blocks = useAppStore(s => s.blocks)
  const recoveries = useAppStore(s => s.recoveries)

  const hydrate = useAppStore(s => s.hydrate)
  const persist = useAppStore(s => s.persist)
  const setSessionLocation = useAppStore(s => s.setSessionLocation)
  const setSessionName = useAppStore(s => s.setSessionName)
  const toggleAthleteActive = useAppStore(s => s.toggleAthleteActive)
  const startCurrentItem = useAppStore(s => s.startCurrentItem)
  const nextOverride = useAppStore(s => s.nextOverride)
  const autoBoundary = useAppStore(s => s.autoBoundary)
  const captureAthlete = useAppStore(s => s.captureAthlete)

  useEffect(() => hydrate(), [hydrate])

  const session = activeSessionId ? sessions.find(s => s.sessionId === activeSessionId) : null
  const template: TemplateDef | null = useMemo(() => {
    if (!session?.templateId) return null
    return templates.find(t => t.templateId === session.templateId) || null
  }, [session, templates])

  const [now, setNow] = useState<number>(() => Date.now())

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

  return (
    <div className="stack">
      <section className="card">
        <div className="row">
          <div className="grow">
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
              value={LOCATIONS.includes(session.location) ? session.location : '__custom__'}
              onChange={(e) => {
                const v = e.target.value
                if (v !== '__custom__') setSessionLocation(session.sessionId, v)
                else setSessionLocation(session.sessionId, '')
              }}
            >
              {LOCATIONS.slice().sort().map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
              <option value="__custom__">Custom…</option>
            </select>
            {!LOCATIONS.includes(session.location) && (
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
        <h2>Athletes (tap to activate/deactivate)</h2>
        <div className="muted" style={{ marginBottom: 8 }}>
          Deactivated athletes remain visible and retain prior results; future reps are blank.
        </div>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {groups.map(g => {
            const rows = session.participants
              .filter((p: any) => p.groupId === g.groupId)
              .map((p: any) => ({
                ...p,
                athlete: athletes.find(a => a.athleteId === p.athleteId),
              }))
              .filter((x: any) => !!x.athlete)
              .sort((a: any, b: any) => (a.athlete.lastName + a.athlete.firstName).localeCompare(b.athlete.lastName + b.athlete.firstName))

            return (
              <div key={g.groupId} className="card" style={{ padding: 12 }}>
                <div className="title" style={{ marginBottom: 8 }}>{g.label}</div>
                <div className="stack" style={{ gap: 6 }}>
                  {rows.map((r: any) => (
                    <button
                      key={r.athleteId}
                      className={r.isActiveInSession ? 'btn' : 'btnInactive'}
                      disabled={isReadOnly}
                      onClick={() => toggleAthleteActive(session.sessionId, r.athleteId, !r.isActiveInSession)}
                    >
                      {r.athlete.lastName}, {r.athlete.firstName}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="card">
        <h2>Groups</h2>
        <div className="grid">
          {groups.map(g => (
            <GroupCard
              key={g.groupId}
              nowMs={now}
              groupId={g.groupId}
              groupLabel={g.label}
              sessionId={session.sessionId}
              template={template}
              session={session}
              athletes={athletes}
              blocks={blocks}
              recoveries={recoveries}
              onStart={() => startCurrentItem(session.sessionId, g.groupId)}
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
  onNext: () => void
  onCapture: (athleteId: string) => void
}) {
  const { nowMs, groupId, groupLabel, template, session, athletes, blocks, recoveries } = props
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
      timerLine = `−${(sinceReady / 1000).toFixed(1)} s`
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
      timerLine = `−${(sinceReady / 1000).toFixed(1)} s`
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
  const canCapture = gs.status === 'running' && item?.type === 'work'

  return (
    <div className="groupCard">
      <div className="row">
        <div className="grow">
          <div className="title">{groupLabel}</div>
          <div className="sub">{title}</div>
          <div className="muted">{sub}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="pill">{gs.status.toUpperCase()}</div>
          <div className="timer">{timerLine}</div>
        </div>
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn" onClick={props.onNext}>Next</button>
        <button className={canStart ? 'btnPrimary' : 'btn'} disabled={!canStart} onClick={props.onStart}>Start</button>
      </div>

      {canCapture && (
        <div className="captureGrid">
          {activeAthletes.map((a: any) => (
            <button
              key={a.athleteId}
              className={gs.capturedThisRep.includes(a.athleteId) ? 'btnDone' : 'btn'}
              onClick={() => props.onCapture(a.athleteId)}
            >
              {a.firstName}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
