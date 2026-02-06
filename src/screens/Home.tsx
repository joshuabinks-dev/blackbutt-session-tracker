import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../state/store'

export default function Home() {
  const nav = useNavigate()
  const templates = useAppStore(s => s.templates)
  const sessions = useAppStore(s => s.sessions)
  const activeSessionId = useAppStore(s => s.activeSessionId)
  const hydrate = useAppStore(s => s.hydrate)
  const startFromTemplate = useAppStore(s => s.startFromTemplate)
  const endSession = useAppStore(s => s.endSession)
  const deleteSession = useAppStore(s => s.deleteSession)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  const active = activeSessionId ? sessions.find(s => s.sessionId === activeSessionId) : null

  return (
    <div className="stack">
      <section className="card">
        <h2>Template Sessions</h2>
        <div className="list">
          {templates.map(t => (
            <div key={t.templateId} className="row">
              <div className="grow">
                <div className="title">{t.name}</div>
                <div className="sub">{t.description}</div>
              </div>
              <button
                className="btnPrimary"
                onClick={() => {
                  startFromTemplate(t.templateId)
                  nav('/session')
                }}
              >
                Start
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Today</h2>
        {!active && <div className="muted">No active session.</div>}
        {active && (
          <div className="row">
            <div className="grow">
              <div className="title">{active.name}</div>
              <div className="sub">{active.location} • Started {new Date(active.startedAtISO).toLocaleTimeString()}</div>
            </div>
            <button className="btn" onClick={() => nav('/session')}>Continue</button>
            <button className="btnDanger" onClick={() => endSession(active.sessionId)}>End</button>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Recent</h2>
        <div className="list">
          {sessions
            .filter(s => s.endedAtISO)
            .slice(0, 8)
            .map(s => (
              <div key={s.sessionId} className="row">
                <div className="grow">
                  <div className="title">{s.name}</div>
                  <div className="sub">Ended {s.endedAtISO ? new Date(s.endedAtISO).toLocaleString() : ''}</div>
                </div>
                <button className="btnDanger" onClick={() => deleteSession(s.sessionId)}>Delete</button>
              </div>
            ))}
          {sessions.filter(s => s.endedAtISO).length === 0 && <div className="muted">No recent sessions yet.</div>}
        </div>
      </section>
    </div>
  )
}
