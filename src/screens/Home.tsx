import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../state/store'

type RichOption = {
  id: string
  title: string
  subtitle: string
}

function RichDropdown(props: {
  label: string
  placeholder: string
  options: RichOption[]
  selectedId: string | null
  onSelect: (id: string) => void
  searchPlaceholder?: string
}) {
  const { label, placeholder, options, selectedId, onSelect } = props
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const wrapRef = useRef<HTMLDivElement | null>(null)

  const selected = useMemo(() => options.find(o => o.id === selectedId) || null, [options, selectedId])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return options
    return options.filter(o => (o.title + ' ' + o.subtitle).toLowerCase().includes(t))
  }, [q, options])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!open) return
      const el = wrapRef.current
      if (!el) return
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className="richSelect" ref={wrapRef}>
      <label className="label">{label}</label>
      <button
        type="button"
        className="richSelectBtn"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        <div className="richSelectBtnText">
          {!selected && <div className="richSelectPlaceholder">{placeholder}</div>}
          {selected && (
            <>
              <div className="richSelectTitle">{selected.title}</div>
              <div className="richSelectSub">{selected.subtitle || '—'}</div>
            </>
          )}
        </div>
        <div className="richSelectChevron">▾</div>
      </button>

      {open && (
        <div className="richSelectPanel">
          <input
            placeholder={props.searchPlaceholder || 'Search…'}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="richSelectSearch"
          />
          <div className="richSelectList" role="listbox">
            {filtered.map(o => (
              <button
                type="button"
                key={o.id}
                className={o.id === selectedId ? 'richSelectItem richSelectItemActive' : 'richSelectItem'}
                onClick={() => { onSelect(o.id); setOpen(false); setQ('') }}
              >
                <div className="richSelectTitle">{o.title}</div>
                <div className="richSelectSub">{o.subtitle || '—'}</div>
              </button>
            ))}
            {filtered.length === 0 && <div className="muted" style={{ padding: 10 }}>No matches.</div>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Home() {
  const nav = useNavigate()
  const templates = useAppStore(s => s.templates)
  const sessions = useAppStore(s => s.sessions)
  const activeSessionId = useAppStore(s => s.activeSessionId)
  const hydrate = useAppStore(s => s.hydrate)
  const startFromTemplate = useAppStore(s => s.startFromTemplate)
  const endSession = useAppStore(s => s.endSession)
  const deleteSession = useAppStore(s => s.deleteSession)
  const viewSession = useAppStore(s => s.viewSession)

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [selectedRecentId, setSelectedRecentId] = useState<string | null>(null)

  useEffect(() => { hydrate() }, [hydrate])

  const active = activeSessionId ? sessions.find(s => s.sessionId === activeSessionId) : null

  const templateOptions: RichOption[] = useMemo(() => {
    return templates.map(t => ({ id: t.templateId, title: t.name, subtitle: t.description }))
  }, [templates])

  const selectedTemplate = useMemo(
    () => (selectedTemplateId ? templates.find(t => t.templateId === selectedTemplateId) || null : null),
    [templates, selectedTemplateId]
  )

  const recentEnded = useMemo(() => {
    return sessions
      .filter(s => !!s.endedAtISO)
      .slice()
      .sort((a, b) => (b.endedAtISO || '').localeCompare(a.endedAtISO || ''))
  }, [sessions])

  const recentOptions: RichOption[] = useMemo(() => {
    return recentEnded.map(s => ({
      id: s.sessionId,
      title: s.name,
      subtitle: `${s.location || '—'} • ${new Date(s.startedAtISO).toLocaleString()}`
    }))
  }, [recentEnded])

  const selectedRecent = useMemo(
    () => (selectedRecentId ? recentEnded.find(s => s.sessionId === selectedRecentId) || null : null),
    [recentEnded, selectedRecentId]
  )

  return (
    <div className="stack">
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Template Sessions</h2>

        <RichDropdown
          label="Select template"
          placeholder="Choose a template…"
          options={templateOptions}
          selectedId={selectedTemplateId}
          onSelect={(id) => setSelectedTemplateId(id)}
          searchPlaceholder="Search templates…"
        />

        {selectedTemplate && (
          <div className="miniCard" style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 900 }}>{selectedTemplate.name}</div>
            <div className="muted" style={{ marginTop: 2, whiteSpace: 'pre-wrap' }}>{selectedTemplate.description || '—'}</div>
          </div>
        )}

        <div className="row" style={{ marginTop: 12 }}>
          <button
            className={selectedTemplateId ? 'btnPrimary' : 'btn'}
            disabled={!selectedTemplateId}
            onClick={() => {
              if (!selectedTemplateId) return
              startFromTemplate(selectedTemplateId)
              nav('/session')
            }}
          >
            Start Session
          </button>
          <div className="muted">Start is enabled after you select a template.</div>
        </div>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Today</h2>
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
        <h2 style={{ marginTop: 0 }}>Recent</h2>

        <RichDropdown
          label="Select a closed session"
          placeholder={recentOptions.length ? 'Choose a session…' : 'No closed sessions yet'}
          options={recentOptions}
          selectedId={selectedRecentId}
          onSelect={(id) => setSelectedRecentId(id)}
          searchPlaceholder="Search closed sessions…"
        />

        {selectedRecent && (
          <div className="miniCard" style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 900 }}>{selectedRecent.name}</div>
            <div className="muted" style={{ marginTop: 2 }}>
              {selectedRecent.location || '—'} • Ended {selectedRecent.endedAtISO ? new Date(selectedRecent.endedAtISO).toLocaleString() : '—'}
            </div>
          </div>
        )}

        <div className="row" style={{ marginTop: 12 }}>
          <button
            className="btn"
            disabled={!selectedRecentId}
            onClick={() => {
              if (!selectedRecentId) return
              viewSession(selectedRecentId)
              nav('/session')
            }}
          >
            View
          </button>
          <button
            className="btnDanger"
            disabled={!selectedRecentId}
            onClick={() => {
              if (!selectedRecentId) return
              const ok = window.confirm('Delete this closed session? This cannot be undone.')
              if (!ok) return
              deleteSession(selectedRecentId)
              setSelectedRecentId(null)
            }}
          >
            Delete
          </button>
          {!recentOptions.length && <div className="muted">No recent sessions yet.</div>}
        </div>
      </section>
    </div>
  )
}
