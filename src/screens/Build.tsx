import React, { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../state/store'
import type { RecoveryDef, SequenceItemDef, TemplateDef, WorkBlockDef } from '../state/types'
import defaultDefinitions from '../data/defaultDefinitions.json'

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`
}

type SubTab = 'templates' | 'blocks' | 'lists' | 'data'

function fmtMMSS(sec: number): string {
  const s = Math.max(0, Math.round(sec || 0))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

function parseMMSS(text: string): number | null {
  const t = text.trim()
  if (!t) return null
  const parts = t.split(':')
  if (parts.length !== 2) return null
  const m = Number(parts[0])
  const s = Number(parts[1])
  if (!Number.isFinite(m) || !Number.isFinite(s)) return null
  if (m < 0 || s < 0 || s >= 60) return null
  return Math.round(m * 60 + s)
}

function toInputMMSS(seconds?: number): string {
  const s = seconds || 0
  return s > 0 ? fmtMMSS(s) : ''
}

export default function Build() {
  const blocks = useAppStore(s => s.blocks)
  const recoveries = useAppStore(s => s.recoveries)
  const templates = useAppStore(s => s.templates)
  const athletes = useAppStore(s => s.athletes)
  const groups = useAppStore(s => s.groups)
  const locations = useAppStore(s => s.locations)

  const upsertBlock = useAppStore(s => s.upsertBlock)
  const deleteBlock = useAppStore(s => s.deleteBlock)
  const upsertRecovery = useAppStore(s => s.upsertRecovery)
  const deleteRecovery = useAppStore(s => s.deleteRecovery)
  const upsertTemplate = useAppStore(s => s.upsertTemplate)
  const deleteTemplate = useAppStore(s => s.deleteTemplate)
  const upsertAthlete = useAppStore(s => s.upsertAthlete)
  const deleteAthlete = useAppStore(s => s.deleteAthlete)
  const upsertLocation = useAppStore(s => s.upsertLocation)
  const deleteLocation = useAppStore(s => s.deleteLocation)
  const replaceDefinitions = useAppStore(s => s.replaceDefinitions)

  const [tab, setTab] = useState<SubTab>('templates')

  // ---- Time input UX (v0.3.1): allow empty fields + placeholders; commit on blur ----
  // We keep local text state so new items don't show 00:00 and users can freely delete/edit.
  const [cycleText, setCycleText] = useState<string>('')
  const [restText, setRestText] = useState<string>('')
  const [recText, setRecText] = useState<string>('')

  // ---- Blocks tab: select-and-edit ----
  const [selectedWorkId, setSelectedWorkId] = useState<string>(() => blocks[0]?.blockId || '')
  const [selectedRecId, setSelectedRecId] = useState<string>(() => recoveries[0]?.recoveryId || '')

  // Search filters (v0.3.4)
  const [workSearch, setWorkSearch] = useState('')
  const [recSearch, setRecSearch] = useState('')
  const [tplSearch, setTplSearch] = useState('')
  const [paletteWorkSearch, setPaletteWorkSearch] = useState('')
  const [paletteRecSearch, setPaletteRecSearch] = useState('')

  const selectedWork = useMemo(() => blocks.find(b => b.blockId === selectedWorkId) || null, [blocks, selectedWorkId])
  const selectedRec = useMemo(() => recoveries.find(r => r.recoveryId === selectedRecId) || null, [recoveries, selectedRecId])

  // Keep local time text in sync with selection.
  useEffect(() => {
    setCycleText(selectedWork?.timingMode === 'cycle' ? toInputMMSS(selectedWork.cycleSeconds) : '')
    setRestText(selectedWork?.timingMode === 'manual' ? toInputMMSS(selectedWork.restSeconds) : '')
  }, [selectedWorkId, selectedWork?.timingMode])

  useEffect(() => {
    setRecText(toInputMMSS(selectedRec?.durationSeconds))
  }, [selectedRecId])

  // ---- Templates tab ----
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => templates[0]?.templateId || '')
  const selectedTemplate: TemplateDef | null = useMemo(
    () => templates.find(t => t.templateId === selectedTemplateId) || null,
    [templates, selectedTemplateId]
  )

  const updateTemplate = (patch: Partial<TemplateDef>) => {
    if (!selectedTemplate) return
    upsertTemplate({ ...selectedTemplate, ...patch })
  }

  const addItemToTemplate = (item: SequenceItemDef) => {
    if (!selectedTemplate) return
    updateTemplate({ sequence: [...selectedTemplate.sequence, item] })
  }

  const moveItem = (from: number, to: number) => {
    if (!selectedTemplate) return
    const seq = [...selectedTemplate.sequence]
    const [it] = seq.splice(from, 1)
    seq.splice(to, 0, it)
    updateTemplate({ sequence: seq })
  }

  const removeItem = (idx: number) => {
    if (!selectedTemplate) return
    const seq = selectedTemplate.sequence.filter((_, i) => i !== idx)
    updateTemplate({ sequence: seq })
  }

  const [dragIndex, setDragIndex] = useState<number | null>(null)

  // ---- Data tab (Import/Export JSON) ----
  const [dataText, setDataText] = useState<string>('')
  const [dataMsg, setDataMsg] = useState<string>('')

  const exportJson = () => {
    const payload = {
      version: 'tpt_defs_v1',
      exportedAtISO: new Date().toISOString(),
      athletes,
      groups,
      locations,
      blocks,
      recoveries,
      templates,
    }
    setDataText(JSON.stringify(payload, null, 2))
    setDataMsg('Exported to text area')
    window.setTimeout(() => setDataMsg(''), 1400)
  }

  const importJson = () => {
    try {
      const obj = JSON.parse(dataText)
      if (!obj || obj.version !== 'tpt_defs_v1') {
        alert('Invalid import file: missing version=tpt_defs_v1')
        return
      }
      const ok = window.confirm('Import will overwrite athletes/locations/blocks/recoveries/templates. Continue?')
      if (!ok) return
      replaceDefinitions({
        athletes: Array.isArray(obj.athletes) ? obj.athletes : [],
        groups: Array.isArray(obj.groups) ? obj.groups : [],
        locations: Array.isArray(obj.locations) ? obj.locations : [],
        blocks: Array.isArray(obj.blocks) ? obj.blocks : [],
        recoveries: Array.isArray(obj.recoveries) ? obj.recoveries : [],
        templates: Array.isArray(obj.templates) ? obj.templates : [],
      })
      setDataMsg('Imported definitions')
      window.setTimeout(() => setDataMsg(''), 1400)
    } catch (e) {
      alert('Invalid JSON')
    }
  }

  const resetToDefaults = () => {
    const ok = window.confirm(
      'Reset to Defaults will overwrite your Athletes, Locations, Blocks, Recoveries, and Templates with the built-in defaults.\n\nTip: Export first if you want a backup.\n\nContinue?'
    )
    if (!ok) return
    replaceDefinitions({
      athletes: Array.isArray((defaultDefinitions as any).athletes) ? (defaultDefinitions as any).athletes : [],
      groups: Array.isArray((defaultDefinitions as any).groups) ? (defaultDefinitions as any).groups : [],
      locations: Array.isArray((defaultDefinitions as any).locations) ? (defaultDefinitions as any).locations : [],
      blocks: Array.isArray((defaultDefinitions as any).blocks) ? (defaultDefinitions as any).blocks : [],
      recoveries: Array.isArray((defaultDefinitions as any).recoveries) ? (defaultDefinitions as any).recoveries : [],
      templates: Array.isArray((defaultDefinitions as any).templates) ? (defaultDefinitions as any).templates : [],
    })
    setDataMsg('Reset to built-in defaults')
    window.setTimeout(() => setDataMsg(''), 1400)
  }

  return (
    <div className="stack">
      <section className="card">
        <div className="row" style={{ alignItems: 'center', gap: 10 }}>
          <h2 style={{ margin: 0 }}>Build</h2>
          <div className="grow" />
          <div className="seg">
            <button className={tab === 'templates' ? 'segOn' : 'segOff'} onClick={() => setTab('templates')}>Templates</button>
            <button className={tab === 'blocks' ? 'segOn' : 'segOff'} onClick={() => setTab('blocks')}>Blocks</button>
            <button className={tab === 'lists' ? 'segOn' : 'segOff'} onClick={() => setTab('lists')}>Lists</button>
            <button className={tab === 'data' ? 'segOn' : 'segOff'} onClick={() => setTab('data')}>Data</button>
          </div>
        </div>
        <div className="muted" style={{ marginTop: 6 }}>
          Manage blocks/recoveries, templates, lists, and export/import definitions.
        </div>
      </section>

      {tab === 'blocks' && (
        <div className="stack">
          <div className="grid2">
            <section className="card">
              <div className="row" style={{ alignItems: 'center', gap: 10 }}>
                <h2 style={{ margin: 0 }}>Work Blocks</h2>
                <div className="grow" />
                <button
                  className="btn"
                  onClick={() => {
                    const b: WorkBlockDef = { blockId: uid('blk'), label: '', distanceMeters: 0, reps: 0, timingMode: 'manual', restSeconds: 0, cycleSeconds: 0 }
                    upsertBlock(b)
                    setSelectedWorkId(b.blockId)
                  }}
                >
                  + New block
                </button>
              </div>

              <input
                className="searchInput"
                style={{ marginTop: 10 }}
                placeholder="Search work blocks…"
                value={workSearch}
                onChange={(e) => setWorkSearch(e.target.value)}
              />

              <div className="stack" style={{ marginTop: 12 }}>
                {blocks
                  .filter(b => (b.label + ' ' + b.distanceMeters + ' ' + b.reps).toLowerCase().includes(workSearch.trim().toLowerCase()))
                  .map(b => (
                    <button
                      key={b.blockId}
                      className={b.blockId === selectedWorkId ? 'listItemActive' : 'listItem'}
                      onClick={() => setSelectedWorkId(b.blockId)}
                    >
                      <div style={{ fontWeight: 800 }}>{b.label}</div>
                      <div className="muted" style={{ marginTop: 2 }}>
                        {b.timingMode === 'cycle' ? `Cycle ${fmtMMSS(b.cycleSeconds || 0)}` : `Rest ${fmtMMSS(b.restSeconds || 0)}`}
                      </div>
                    </button>
                  ))}
                {blocks.length === 0 && <div className="muted">No blocks yet.</div>}
              </div>
            </section>

            <section className="card">
              <h2>Edit Work Block</h2>
              {!selectedWork ? (
                <div className="muted">Select a work block to edit.</div>
              ) : (
                <div className="stack">
                  <div className="row" style={{ alignItems: 'center', gap: 10 }}>
                    <div className="grow" style={{ fontWeight: 900 }}>{selectedWork.label}</div>
                    <button className="btnDanger" onClick={() => { deleteBlock(selectedWork.blockId); setSelectedWorkId(blocks[0]?.blockId || '') }}>Delete</button>
                  </div>

                  <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
                    <div className="field">
                      <label className="label">Distance (m)</label>
                      <input
                        type="number"
                        placeholder="e.g., 800"
                        value={selectedWork.distanceMeters || ''}
                        onChange={(e) => upsertBlock({ ...selectedWork, distanceMeters: Number(e.target.value) || 0 })}
                      />
                    </div>

                    <div className="field">
                      <label className="label">Reps</label>
                      <input
                        type="number"
                        placeholder="e.g., 6"
                        value={selectedWork.reps || ''}
                        onChange={(e) => upsertBlock({ ...selectedWork, reps: Number(e.target.value) || 0 })}
                      />
                    </div>

                    <div className="field">
                      <label className="label">Mode</label>
                      <select
                        value={selectedWork.timingMode}
                        onChange={(e) => upsertBlock({ ...selectedWork, timingMode: e.target.value as any })}
                      >
                        <option value="manual">Manual</option>
                        <option value="cycle">Cycle</option>
                      </select>
                    </div>

                    {selectedWork.timingMode === 'cycle' && (
                      <div className="field">
                        <label className="label">Cycle (mm:ss)</label>
                        <input
                          placeholder="e.g., 05:00"
                          value={cycleText}
                          onChange={(e) => setCycleText(e.target.value)}
                          onBlur={() => {
                            const v = parseMMSS(cycleText)
                            upsertBlock({ ...selectedWork, cycleSeconds: v ?? 0 })
                            setCycleText(toInputMMSS(v ?? 0))
                          }}
                        />
                      </div>
                    )}

                    {selectedWork.timingMode === 'manual' && (
                      <div className="field">
                        <label className="label">Rest (mm:ss)</label>
                        <input
                          placeholder="e.g., 03:00"
                          value={restText}
                          onChange={(e) => setRestText(e.target.value)}
                          onBlur={() => {
                            const v = parseMMSS(restText)
                            upsertBlock({ ...selectedWork, restSeconds: v ?? 0 })
                            setRestText(toInputMMSS(v ?? 0))
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>

          <div className="grid2">
            <section className="card">
              <div className="row" style={{ alignItems: 'center', gap: 10 }}>
                <h2 style={{ margin: 0 }}>Recoveries</h2>
                <div className="grow" />
                <button
                  className="btn"
                  onClick={() => {
                    const r: RecoveryDef = { recoveryId: uid('rec'), label: '', durationSeconds: 0 }
                    upsertRecovery(r)
                    setSelectedRecId(r.recoveryId)
                  }}
                >
                  + New recovery
                </button>
              </div>

              <input
                className="searchInput"
                style={{ marginTop: 10 }}
                placeholder="Search recoveries…"
                value={recSearch}
                onChange={(e) => setRecSearch(e.target.value)}
              />

              <div className="stack" style={{ marginTop: 12 }}>
                {recoveries
                  .filter(r => (r.label + ' ' + fmtMMSS(r.durationSeconds || 0)).toLowerCase().includes(recSearch.trim().toLowerCase()))
                  .map(r => (
                    <button
                      key={r.recoveryId}
                      className={r.recoveryId === selectedRecId ? 'listItemActive' : 'listItem'}
                      onClick={() => setSelectedRecId(r.recoveryId)}
                    >
                      <div style={{ fontWeight: 800 }}>{r.label}</div>
                      <div className="muted" style={{ marginTop: 2 }}>{fmtMMSS(r.durationSeconds || 0)}</div>
                    </button>
                  ))}
                {recoveries.length === 0 && <div className="muted">No recovery items yet.</div>}
              </div>
            </section>

            <section className="card">
              <h2>Edit Recovery</h2>
              {!selectedRec ? (
                <div className="muted">Select a recovery to edit.</div>
              ) : (
                <div className="stack">
                  <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                    <div className="grow" style={{ fontWeight: 900 }}>{selectedRec.label}</div>
                    <button className="btnDanger" onClick={() => { deleteRecovery(selectedRec.recoveryId); setSelectedRecId(recoveries[0]?.recoveryId || '') }}>Delete</button>
                  </div>

                  <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
                    <div className="field">
                      <label className="label">Duration (mm:ss)</label>
                      <input
                        placeholder="e.g., 03:00"
                        value={recText}
                        onChange={(e) => setRecText(e.target.value)}
                        onBlur={() => {
                          const v = parseMMSS(recText)
                          upsertRecovery({ ...selectedRec, durationSeconds: v ?? 0 })
                          setRecText(toInputMMSS(v ?? 0))
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {tab === 'templates' && (
        <div className="grid2">
          <section className="card">
            <div className="row" style={{ alignItems: 'center', gap: 10 }}>
              <h2 style={{ margin: 0 }}>Templates</h2>
              <div className="grow" />
              <button
                className="btn"
                onClick={() => {
                  const tpl: TemplateDef = { templateId: uid('tpl'), name: '', description: '', sequence: [] }
                  upsertTemplate(tpl)
                  setSelectedTemplateId(tpl.templateId)
                }}
              >
                + New template
              </button>
            </div>

            <input
              className="searchInput"
              style={{ marginTop: 12 }}
              placeholder="Search templates…"
              value={tplSearch}
              onChange={(e) => setTplSearch(e.target.value)}
            />

            <div className="stack" style={{ marginTop: 12 }}>
              {templates.filter(t => (t.name + ' ' + t.description).toLowerCase().includes(tplSearch.trim().toLowerCase())).map(t => (
                <button
                  key={t.templateId}
                  className={t.templateId === selectedTemplateId ? 'listItemActive' : 'listItem'}
                  onClick={() => setSelectedTemplateId(t.templateId)}
                >
                  <div style={{ fontWeight: 800 }}>{t.name}</div>
                  <div className="muted" style={{ marginTop: 2, whiteSpace: 'pre-wrap' }}>{t.description || '—'}</div>
                </button>
              ))}
              {templates.length === 0 && <div className="muted">No templates yet.</div>}
            </div>
          </section>

          <section className="card">
            {!selectedTemplate ? (
              <div className="muted">Create or select a template to edit.</div>
            ) : (
              <>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <div className="grow" style={{ fontSize: 18, fontWeight: 900 }}>{selectedTemplate.name}</div>
                  <button className="btnDanger" onClick={() => { deleteTemplate(selectedTemplate.templateId); setSelectedTemplateId(templates[0]?.templateId || '') }}>Delete</button>
                </div>
                <div className="miniCard" style={{ marginTop: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {selectedTemplate.description || '—'}
                </div>

                <div className="row" style={{ marginTop: 12, gap: 10, flexWrap: 'wrap' }}>
                  <div className="miniCard grow">
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Palette: Work Blocks</div>
                    <input className="searchInput" placeholder="Search…" value={paletteWorkSearch} onChange={(e)=>setPaletteWorkSearch(e.target.value)} />
                    {blocks.filter(b => (b.label + ' ' + b.distanceMeters).toLowerCase().includes(paletteWorkSearch.trim().toLowerCase())).map(b => (
                      <button key={b.blockId} className="btnSmall" onClick={() => addItemToTemplate({ type: 'work', blockId: b.blockId })}>
                        + {b.label}
                      </button>
                    ))}
                    {blocks.length === 0 && <div className="muted">Create blocks in the Blocks tab.</div>}
                  </div>
                  <div className="miniCard grow">
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Palette: Recoveries</div>
                    <input className="searchInput" placeholder="Search…" value={paletteRecSearch} onChange={(e)=>setPaletteRecSearch(e.target.value)} />
                    {recoveries.filter(r => r.label.toLowerCase().includes(paletteRecSearch.trim().toLowerCase())).map(r => (
                      <button key={r.recoveryId} className="btnSmall" onClick={() => addItemToTemplate({ type: 'recovery', recoveryId: r.recoveryId })}>
                        + {r.label}
                      </button>
                    ))}
                    {recoveries.length === 0 && <div className="muted">Create recovery items in the Blocks tab.</div>}
                  </div>
                </div>

                <h3 style={{ marginTop: 12 }}>Sequence (drag or use arrows)</h3>
                <div className="stack">
                  {selectedTemplate.sequence.map((si, idx) => {
                    const title =
                      si.type === 'work'
                        ? `Work: ${blocks.find(b => b.blockId === si.blockId)?.label || 'Missing block'}`
                        : `Recovery: ${recoveries.find(r => r.recoveryId === si.recoveryId)?.label || 'Missing recovery'}`
                    return (
                      <div
                        key={`${si.type}_${si.blockId || si.recoveryId || idx}_${idx}`}
                        className="sequenceItem"
                        draggable
                        onDragStart={() => setDragIndex(idx)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (dragIndex === null) return
                          if (dragIndex === idx) return
                          moveItem(dragIndex, idx)
                          setDragIndex(null)
                        }}
                      >
                        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                          <div style={{ fontWeight: 800 }}>{idx + 1}.</div>
                          <div className="grow">{title}</div>
                          <button className="btnSmall" disabled={idx === 0} onClick={() => moveItem(idx, idx - 1)}>↑</button>
                          <button className="btnSmall" disabled={idx === selectedTemplate.sequence.length - 1} onClick={() => moveItem(idx, idx + 1)}>↓</button>
                          <button className="btnDanger" onClick={() => removeItem(idx)}>Remove</button>
                        </div>
                      </div>
                    )
                  })}
                  {selectedTemplate.sequence.length === 0 && <div className="muted">Add blocks/recoveries to build the sequence.</div>}
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {tab === 'lists' && (
        <div className="grid2">
          <section className="card">
            <h2>Athletes</h2>
            <div className="muted">Edits affect future sessions only.</div>
            <div style={{ marginTop: 12 }}>
              <button
                className="btn"
                onClick={() => {
                  const athleteId = uid('ath')
                  upsertAthlete({ athleteId, firstName: '', lastName: '', defaultGroupId: 'A' })
                }}
              >
                + New athlete
              </button>
            </div>

            <div className="stack" style={{ marginTop: 12 }}>
              {athletes
                .slice()
                .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`))
                .map(a => (
                  <div key={a.athleteId} className="miniCard">
                    <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                      <input placeholder="First name" value={a.firstName} onChange={(e) => upsertAthlete({ ...a, firstName: e.target.value })} />
                      <input placeholder="Surname" value={a.lastName} onChange={(e) => upsertAthlete({ ...a, lastName: e.target.value })} />
                      <select value={a.defaultGroupId} onChange={(e) => upsertAthlete({ ...a, defaultGroupId: e.target.value })}>
                        {groups.map(g => (
                          <option key={g.groupId} value={g.groupId}>{g.groupId}</option>
                        ))}
                      </select>
                      <button className="btnDanger" onClick={() => deleteAthlete(a.athleteId)}>Delete</button>
                    </div>
                  </div>
                ))}
            </div>
          </section>

          <section className="card">
            <h2>Locations</h2>
            <div className="muted">Alphabetical list used during session setup.</div>

            <div className="row" style={{ marginTop: 12, gap: 8 }}>
              <input id="newLoc" placeholder="Add location…" onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = (e.target as HTMLInputElement).value
                  upsertLocation(v)
                  ;(e.target as HTMLInputElement).value = ''
                }
              }} />
              <button className="btn" onClick={() => {
                const el = document.getElementById('newLoc') as HTMLInputElement | null
                if (!el) return
                upsertLocation(el.value)
                el.value = ''
              }}>Add</button>
            </div>

            <div className="stack" style={{ marginTop: 12 }}>
              {locations.map(l => (
                <div key={l} className="row miniCard" style={{ alignItems: 'center', gap: 8 }}>
                  <div className="grow" style={{ fontWeight: 800 }}>{l}</div>
                  <button className="btnDanger" onClick={() => deleteLocation(l)}>Delete</button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === 'data' && (
        <section className="card">
          <h2>Import / Export Definitions</h2>
          <div className="muted">Export athletes/locations/blocks/templates to JSON. Import overwrites current definitions.</div>
          {dataMsg && <div className="toast">{dataMsg}</div>}

          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <button className="btn" onClick={exportJson}>Export to text</button>
            <button className="btnPrimary" onClick={importJson}>Import from text</button>
            <button className="btnDanger" onClick={resetToDefaults}>Reset to Defaults</button>
          </div>

          <textarea
            value={dataText}
            onChange={(e) => setDataText(e.target.value)}
            placeholder="Click Export to populate, or paste JSON here to import..."
            style={{ width: '100%', minHeight: 320, marginTop: 12, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}
          />
        </section>
      )}
    </div>
  )
}
