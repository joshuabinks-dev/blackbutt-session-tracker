import { create } from 'zustand'
import type {
  AthleteDef,
  GroupDef,
  TemplateDef,
  WorkBlockDef,
  RecoveryDef,
  Session,
  GroupId,
  AthleteId,
  SessionEvent,
  GroupRunState,
  TimerState,
  TimingMode,
} from './types'

// Embedded club defaults (bulk-replace dataset).
// Loaded on first run when no persisted state exists.
import embeddedDefaults from '../data/defaultDefinitions.json'

const LS_KEY = 'tpt_state_v0_2'

function ensureDefaultGroups(existing: GroupDef[] | undefined | null): GroupDef[] {
  // Groups are fixed A–D (not user-editable). Ensure older persisted states
  // (e.g. A/B only) are migrated forward.
  const wanted: GroupDef[] = [
    { groupId: 'A', label: 'Group A' },
    { groupId: 'B', label: 'Group B' },
    { groupId: 'C', label: 'Group C' },
    { groupId: 'D', label: 'Group D' },
  ]
  const have = new Set((existing || []).map(g => g.groupId))
  if (have.size === 4 && have.has('A') && have.has('B') && have.has('C') && have.has('D')) return wanted
  return wanted
}

function normalizeLocations(input: any): string[] {
  const arr = Array.isArray(input) ? input : []
  // v0.3.3 embedded defaults store locations as objects: { locationId, name }
  // Older versions store as string[]
  const out: string[] = []
  for (const item of arr) {
    if (typeof item === 'string') {
      const s = item.trim()
      if (s) out.push(s)
    } else if (item && typeof item === 'object' && typeof (item as any).name === 'string') {
      const s = String((item as any).name).trim()
      if (s) out.push(s)
    }
  }

  // de-dupe case-insensitively
  const seen = new Set<string>()
  const dedup: string[] = []
  for (const s of out) {
    const k = s.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    dedup.push(s)
  }
  dedup.sort((a, b) => a.localeCompare(b))
  return dedup
}

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`
}

function nowMs() {
  return Date.now()
}


function fmtMMSS(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
  const s = Math.floor(totalSeconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function autoBlockLabel(b: WorkBlockDef) {
  const reps = b.reps ?? 0
  const dist = b.distanceMeters ?? 0
  // v0.3: brand-new blocks start as "New Work Block" until fields are entered.
  if (!reps || !dist) return 'New Work Block'
  if (b.timingMode === 'cycle') {
    const cyc = b.cycleSeconds ?? 0
    if (!cyc) return 'New Work Block'
    return `${reps} x ${dist}m on ${fmtMMSS(cyc)} Cycle`
  }
  const rest = b.restSeconds ?? 0
  return rest > 0 ? `${reps} x ${dist}m w/${fmtMMSS(rest)} Rest` : `${reps} x ${dist}m`
}

function autoRecoveryLabel(r: RecoveryDef) {
  const dur = r.durationSeconds ?? 0
  // v0.3: brand-new recoveries start as "New Recovery Block" until duration entered.
  if (!dur) return 'New Recovery Block'
  return `Recovery ${fmtMMSS(dur)}`
}

// Compress consecutive repeated subsequences anywhere in the list.
// Example: A+B+C+A+B+C+A+B => 2 x (A+B+C) + A + B
function compressConsecutive(parts: string[], innerJoin: string, outerJoin: string): string {
  const out: string[] = []
  const n = parts.length
  let i = 0

  while (i < n) {
    let bestLen = 0
    let bestRepeats = 0

    // Find the best (longest total coverage) consecutive repetition starting at i.
    for (let len = 1; i + len * 2 <= n; len++) {
      const chunk = parts.slice(i, i + len)
      let rep = 1
      while (i + (rep + 1) * len <= n) {
        let ok = true
        for (let j = 0; j < len; j++) {
          if (parts[i + rep * len + j] !== chunk[j]) { ok = false; break }
        }
        if (!ok) break
        rep++
      }
      if (rep >= 2) {
        const covered = rep * len
        const bestCovered = bestRepeats * bestLen
        if (covered > bestCovered || (covered === bestCovered && len > bestLen)) {
          bestLen = len
          bestRepeats = rep
        }
      }
    }

    if (bestRepeats >= 2 && bestLen > 0) {
      const chunk = parts.slice(i, i + bestLen)
      out.push(`${bestRepeats} x (${chunk.join(innerJoin)})`)
      i += bestRepeats * bestLen
    } else {
      out.push(parts[i])
      i++
    }
  }

  return out.join(outerJoin)
}

function autoTemplateNameFromSequence(tpl: TemplateDef, blocksById: Record<string, WorkBlockDef>) {
  const parts: string[] = []
  for (const it of tpl.sequence) {
    if (it.type !== 'work' || !it.blockId) continue
    const b = blocksById[it.blockId]
    if (!b) continue
    parts.push(`${b.reps} x ${b.distanceMeters}m`)
  }
  if (!parts.length) return 'New Template'

  // v0.3.2: compress consecutive repeated work patterns anywhere in the list.
  return compressConsecutive(parts, ' + ', ' + ')
}

function autoTemplateDescription(tpl: TemplateDef, blocksById: Record<string, WorkBlockDef>, recById: Record<string, RecoveryDef>) {
  const parts: string[] = []
  for (const it of tpl.sequence) {
    if (it.type === 'work' && it.blockId) {
      const b = blocksById[it.blockId]
      if (b) parts.push(autoBlockLabel(b))
    } else if (it.type === 'recovery' && it.recoveryId) {
      const r = recById[it.recoveryId]
      if (r) parts.push(autoRecoveryLabel(r))
    }
  }
  if (!parts.length) return ''

  // v0.3.2.1: compress consecutive repeated subsequences anywhere in the list.
  // Description keeps full timings + recoveries.
  // Example: A,B,C,A,B,C,A,B => 2 x (A, B, C), A, B
  return compressConsecutive(parts, ', ', ', ')
}


export interface AppState {
  athletes: AthleteDef[]
  groups: GroupDef[]
  blocks: WorkBlockDef[]
  recoveries: RecoveryDef[]
  templates: TemplateDef[]
  locations: string[]

  activeSessionId: string | null
  // View an ended session without interrupting any active session
  viewingSessionId: string | null
  sessions: Session[]
  eventsBySessionId: Record<string, SessionEvent[]>

  // actions
  startFromTemplate: (templateId: string) => void
  endSession: (sessionId: string) => void
  deleteSession: (sessionId: string) => void

  viewSession: (sessionId: string) => void
  clearViewedSession: () => void

  setSessionLocation: (sessionId: string, location: string) => void
  setSessionName: (sessionId: string, name: string) => void
  toggleAthleteActive: (sessionId: string, athleteId: string, isActive: boolean) => void

  // definition data CRUD (v0.2)
  upsertAthlete: (athlete: AthleteDef) => void
  deleteAthlete: (athleteId: AthleteId) => void
  upsertLocation: (name: string) => void
  deleteLocation: (name: string) => void
  upsertBlock: (block: WorkBlockDef) => void
  deleteBlock: (blockId: string) => void
  upsertRecovery: (rec: RecoveryDef) => void
  deleteRecovery: (recoveryId: string) => void
  upsertTemplate: (tpl: TemplateDef) => void
  deleteTemplate: (templateId: string) => void

  setSessionParticipants: (sessionId: string, participants: Session['participants']) => void

  startCurrentItem: (sessionId: string, groupId: GroupId) => void
  captureAthlete: (sessionId: string, groupId: GroupId, athleteId: AthleteId) => void
  nextOverride: (sessionId: string, groupId: GroupId) => void
  backOverride: (sessionId: string, groupId: GroupId) => void
  autoBoundary: (sessionId: string, groupId: GroupId) => void

  editCell: (sessionId: string, groupId: GroupId, athleteId: AthleteId, sequenceIndex: number, repIndex: number, newTimeMs: number | null) => void

  // v0.3 data safety
  replaceDefinitions: (defs: Pick<AppState, 'athletes'|'locations'|'blocks'|'recoveries'|'templates'|'groups'>) => void

  hydrate: () => void
  persist: () => void
}

function defaultData(): Pick<AppState, 'athletes'|'groups'|'blocks'|'recoveries'|'templates'|'locations'> {
  // NOTE: groups are always A–D, ensure older embedded/persisted forms
  // are normalized.
  const groups = ensureDefaultGroups((embeddedDefaults as any).groups)
  return {
    groups,
    athletes: (embeddedDefaults as any).athletes,
    locations: normalizeLocations((embeddedDefaults as any).locations),
    blocks: (embeddedDefaults as any).blocks,
    recoveries: (embeddedDefaults as any).recoveries,
    templates: (embeddedDefaults as any).templates,
  }
}

function makeInitialGroupState(): GroupRunState {
  return {
    status: 'idle',
    sequenceIndex: 0,
    repIndex: 0,
    timer: { mode: 'work', startMs: null },
    capturedThisRep: [],
  }
}

function resolveTimerModeForItem(itemType: 'work' | 'recovery'): TimerState {
  return { mode: itemType === 'recovery' ? 'recovery' : 'work', startMs: null }
}

function computeSortOrderForRep(
  state: AppState,
  sessionId: string,
  groupId: GroupId,
  sequenceIndex: number,
  repIndex: number,
  activeIds: AthleteId[],
  pendingCapture?: { athleteId: AthleteId; timeMs: number },
): AthleteId[] {
  const evts = state.eventsBySessionId[sessionId] || []
  const timeByAthlete = new Map<AthleteId, number>()
  for (const e of evts) {
    if (e.type === 'CAPTURE' && (e as any).groupId === groupId && (e as any).sequenceIndex === sequenceIndex && (e as any).repIndex === repIndex) {
      timeByAthlete.set((e as any).athleteId, (e as any).timeMs)
    }
  }
  if (pendingCapture) timeByAthlete.set(pendingCapture.athleteId, pendingCapture.timeMs)

  return activeIds
    .slice()
    .sort((a, b) => {
      const ta = timeByAthlete.get(a)
      const tb = timeByAthlete.get(b)
      if (ta == null && tb == null) return 0
      if (ta == null) return 1
      if (tb == null) return -1
      return ta - tb
    })
}

function getTemplate(state: AppState, templateId: string) {
  return state.templates.find(t => t.templateId === templateId) || null
}

function getBlock(state: AppState, blockId: string) {
  return state.blocks.find(b => b.blockId === blockId) || null
}

function getRecovery(state: AppState, recoveryId: string) {
  return state.recoveries.find(r => r.recoveryId === recoveryId) || null
}

function activeAthletesForGroup(state: AppState, session: Session, groupId: GroupId): AthleteDef[] {
  const activeIds = session.participants
    .filter(p => p.groupId === groupId && p.isActiveInSession)
    .map(p => p.athleteId)
  const map = new Map(state.athletes.map(a => [a.athleteId, a] as const))
  return activeIds.map(id => map.get(id)).filter(Boolean) as AthleteDef[]
}

export const useAppStore = create<AppState>((set, get) => {
  const defaults = defaultData()
  const persistNow = () => { try { get().persist() } catch {} }
  return {
    ...defaults,

    activeSessionId: null,
    viewingSessionId: null,
    sessions: [],
    eventsBySessionId: {},

    hydrate: () => {
      const raw = localStorage.getItem(LS_KEY)
      if (!raw) return
      try {
        const parsed = JSON.parse(raw)
        set(parsed)
        // Migrations / invariants
        set(s => ({
          groups: ensureDefaultGroups(s.groups),
          locations: normalizeLocations((s as any).locations),
          athletes: s.athletes.map(a => ({
            ...a,
            defaultGroupId: (['A','B','C','D'] as const).includes(a.defaultGroupId as any) ? a.defaultGroupId : 'A',
          })),
        }))
      } catch {
        // ignore
      }
    },

    persist: () => {
      const state = get()
      const { hydrate, persist, ...serial } = state
      localStorage.setItem(LS_KEY, JSON.stringify(serial))
    },

    startFromTemplate: (templateId) => {
      const state = get()
      const template = getTemplate(state, templateId)
      if (!template) return

      const sessionId = uid('sess')
      const startedAtISO = new Date().toISOString()
      // v0.3.5+: sessions start with no athletes assigned.
      // Coaches select attending athletes (session-scoped) from the roster.
      const participants: Session['participants'] = []

      const groupRunState: Record<string, GroupRunState> = {}
      for (const g of state.groups) {
        groupRunState[g.groupId] = makeInitialGroupState()
      }

      const session: Session = {
        sessionId,
        name: template.name,
        templateId: template.templateId,
        location: state.locations[0] || 'Blackbutt',
        startedAtISO,
        participants,
        groupRunState,
      }

      const events: SessionEvent[] = [{ eventId: uid('evt'), type: 'SESSION_START', atMs: nowMs() }]

      set(s => ({
        sessions: [session, ...s.sessions],
        activeSessionId: sessionId,
        viewingSessionId: null,
        eventsBySessionId: { ...s.eventsBySessionId, [sessionId]: events },
      }))
          
      persistNow()
},

    endSession: (sessionId) => {
      const endedAtISO = new Date().toISOString()
      set(s => ({
        sessions: s.sessions.map(sess => {
          if (sess.sessionId !== sessionId) return sess
          // Freeze timers and mark group states as ended so any UI tick loops become inert.
          const frozen: Record<string, GroupRunState> = {}
          for (const [gid, gs] of Object.entries(sess.groupRunState)) {
            frozen[gid] = {
              ...gs,
              status: 'ended',
              timer: { ...gs.timer, startMs: null },
            }
          }
          return { ...sess, endedAtISO, groupRunState: frozen }
        }),
        activeSessionId: s.activeSessionId === sessionId ? null : s.activeSessionId,
        eventsBySessionId: {
          ...s.eventsBySessionId,
          [sessionId]: [...(s.eventsBySessionId[sessionId] || []), { eventId: uid('evt'), type: 'SESSION_END', atMs: nowMs() }],
        },
      }))
          
      persistNow()
},

    deleteSession: (sessionId) => {
      set(s => {
        const { [sessionId]: _, ...rest } = s.eventsBySessionId
        return {
          sessions: s.sessions.filter(ss => ss.sessionId !== sessionId),
          eventsBySessionId: rest,
          activeSessionId: s.activeSessionId === sessionId ? null : s.activeSessionId,
        }
      })
          
      persistNow()
},

    setSessionLocation: (sessionId, location) => {
      set(s => ({ sessions: s.sessions.map(sess => (sess.sessionId === sessionId ? { ...sess, location } : sess)) }))
          
      persistNow()
},

    setSessionName: (sessionId, name) => {
      set(s => ({ sessions: s.sessions.map(sess => (sess.sessionId === sessionId ? { ...sess, name } : sess)) }))
          
      persistNow()
},

    toggleAthleteActive: (sessionId, athleteId, isActive) => {
      set(s => ({
        sessions: s.sessions.map(sess => {
          if (sess.sessionId !== sessionId) return sess
          return {
            ...sess,
            participants: sess.participants.map(p => (p.athleteId === athleteId ? { ...p, isActiveInSession: isActive } : p)),
          }
        }),
        eventsBySessionId: {
          ...s.eventsBySessionId,
          [sessionId]: [...(s.eventsBySessionId[sessionId] || []), { eventId: uid('evt'), type: 'ATHLETE_ACTIVE_SET', atMs: nowMs() }],
        },
      }))
          
      persistNow()
},

    // --- Definition data CRUD (v0.2) ---
    upsertAthlete: (athlete) => {
      set(s => {
        const exists = s.athletes.some(a => a.athleteId === athlete.athleteId)
        const athletes = exists ? s.athletes.map(a => (a.athleteId === athlete.athleteId ? athlete : a)) : [...s.athletes, athlete]
        return { athletes }
      })
          
      persistNow()
},
    deleteAthlete: (athleteId) => {
      set(s => {
        const athletes = s.athletes.filter(a => a.athleteId !== athleteId)
        // Remove from future sessions only (historical sessions preserved via snapshot)
        const sessions = s.sessions.map(sess => ({
          ...sess,
          participants: sess.participants.filter(p => p.athleteId !== athleteId),
        }))
        return { athletes, sessions }
      })
          
      persistNow()
},
    upsertLocation: (name) => {
      const trimmed = name.trim()
      if (!trimmed) return
      set(s => {
        const exists = s.locations.some(l => l.toLowerCase() === trimmed.toLowerCase())
        const locations = exists ? s.locations.map(l => (l.toLowerCase() === trimmed.toLowerCase() ? trimmed : l)) : [...s.locations, trimmed]
        locations.sort((a, b) => a.localeCompare(b))
        return { locations }
      })
          
      persistNow()
},
    deleteLocation: (name) => {
      set(s => ({ locations: s.locations.filter(l => l !== name) }))
          
      persistNow()
},
        upsertBlock: (block) => {
      const withLabel = { ...block, label: autoBlockLabel(block) }
      set(s => {
        const exists = s.blocks.some(b => b.blockId === withLabel.blockId)
        const blocks = exists ? s.blocks.map(b => (b.blockId === withLabel.blockId ? withLabel : b)) : [...s.blocks, withLabel]
        return { blocks }
      })
      persistNow()
    },

    viewSession: (sessionId) => {
      set(() => ({ viewingSessionId: sessionId }))
      persistNow()
    },

    clearViewedSession: () => {
      set(() => ({ viewingSessionId: null }))
      persistNow()
    },

    deleteBlock: (blockId) => {
      set(s => ({
        blocks: s.blocks.filter(b => b.blockId !== blockId),
        templates: s.templates.map(t => ({ ...t, sequence: t.sequence.filter(si => si.blockId !== blockId) })),
      }))
          
      persistNow()
},
        upsertRecovery: (rec) => {
      const withLabel = { ...rec, label: autoRecoveryLabel(rec) }
      set(s => {
        const exists = s.recoveries.some(r => r.recoveryId === withLabel.recoveryId)
        const recoveries = exists ? s.recoveries.map(r => (r.recoveryId === withLabel.recoveryId ? withLabel : r)) : [...s.recoveries, withLabel]
        return { recoveries }
      })
      persistNow()
    },

    deleteRecovery: (recoveryId) => {
      set(s => ({
        recoveries: s.recoveries.filter(r => r.recoveryId !== recoveryId),
        templates: s.templates.map(t => ({ ...t, sequence: t.sequence.filter(si => si.recoveryId !== recoveryId) })),
      }))
          
      persistNow()
},
        upsertTemplate: (tpl) => {
      const state = get()
      const blocksById = Object.fromEntries(state.blocks.map(b => [b.blockId, b]))
      const recById = Object.fromEntries(state.recoveries.map(r => [r.recoveryId, r]))
      const withAuto: TemplateDef = {
        ...tpl,
        // v0.2.2: Template name/description are always auto-generated (not manually editable)
        name: autoTemplateNameFromSequence(tpl, blocksById),
        description: autoTemplateDescription(tpl, blocksById, recById),
      }
      set(s => {
        const exists = s.templates.some(t => t.templateId === withAuto.templateId)
        const templates = exists ? s.templates.map(t => (t.templateId === withAuto.templateId ? withAuto : t)) : [...s.templates, withAuto]
        return { templates }
      })
      persistNow()
    },

    deleteTemplate: (templateId) => {
      set(s => ({ templates: s.templates.filter(t => t.templateId !== templateId) }))
          
      persistNow()
},

    replaceDefinitions: (defs) => {
      // Overwrite definition data only (sessions/results remain).
      set(s => {
        return {
          groups: defs.groups || s.groups,
          athletes: defs.athletes || s.athletes,
          locations: normalizeLocations(defs.locations ?? s.locations),
          blocks: defs.blocks || s.blocks,
          recoveries: defs.recoveries || s.recoveries,
          templates: defs.templates || s.templates,
        }
      })
      persistNow()
    },

    setSessionParticipants: (sessionId, participants) => {
      set(s => ({
        sessions: s.sessions.map(sess => (sess.sessionId === sessionId ? { ...sess, participants } : sess)),
      }))
          
      persistNow()
},

    startCurrentItem: (sessionId, groupId) => {
      const state = get()
      const session = state.sessions.find(s => s.sessionId === sessionId)
      if (!session) return
      if (session.endedAtISO) return

      const template = session.templateId ? getTemplate(state, session.templateId) : null
      if (!template) return
      const gs = session.groupRunState[groupId]
      if (!gs || gs.status === 'complete') return

      const item = template.sequence[gs.sequenceIndex]
      if (!item) return

      let timer: TimerState = resolveTimerModeForItem(item.type)
      const start = nowMs()
      timer.startMs = start

      // Determine duration for cycle/recovery; manual has no duration
      if (item.type === 'recovery') {
        const rec = getRecovery(state, item.recoveryId || '')
        if (rec) timer.durationMs = rec.durationSeconds * 1000
      } else {
        const block = getBlock(state, item.blockId || '')
        if (block?.timingMode === 'cycle' && block.cycleSeconds != null) {
          timer.durationMs = block.cycleSeconds * 1000
        }
      }

      set(s => ({
        sessions: s.sessions.map(sess => {
          if (sess.sessionId !== sessionId) return sess
          return {
            ...sess,
            groupRunState: {
              ...sess.groupRunState,
              [groupId]: { ...sess.groupRunState[groupId], status: 'running', timer, capturedThisRep: [] },
            },
          }
        }),
      }))
          
      persistNow()
},

    captureAthlete: (sessionId, groupId, athleteId) => {
      const state = get()
      const session = state.sessions.find(s => s.sessionId === sessionId)
      if (!session) return
      if (session.endedAtISO) return

      const gs = session.groupRunState[groupId]
      if (!gs || gs.status !== 'running') return

      const template = session.templateId ? getTemplate(state, session.templateId) : null
      if (!template) return
      const item = template.sequence[gs.sequenceIndex]
      if (!item || item.type !== 'work') return

      const block = getBlock(state, item.blockId || '')
      if (!block) return

      const start = gs.timer.startMs
      if (!start) return
      const elapsedMs = nowMs() - start

      // v0.3.5: Tap-again undo (within the current rep only).
      // If the athlete was already captured this rep, clear their time and remove from the captured list.
      if (gs.capturedThisRep.includes(athleteId)) {
        const evt: SessionEvent = {
          eventId: uid('evt'),
          type: 'EDIT',
          atMs: nowMs(),
          athleteId,
          groupId,
          sequenceIndex: gs.sequenceIndex,
          repIndex: gs.repIndex,
          newTimeMs: null,
        } as any

        const nextCaptured = gs.capturedThisRep.filter(id => id !== athleteId)
        set(s => ({
          eventsBySessionId: {
            ...s.eventsBySessionId,
            [sessionId]: [...(s.eventsBySessionId[sessionId] || []), evt],
          },
          sessions: s.sessions.map(sess => (sess.sessionId === sessionId ? { ...sess, groupRunState: { ...sess.groupRunState, [groupId]: { ...gs, capturedThisRep: nextCaptured } } } : sess)),
        }))
        persistNow()
        return
      }

      // Create capture event, time is running time (elapsed)
      const evt: SessionEvent = {
        eventId: uid('evt'),
        type: 'CAPTURE',
        atMs: nowMs(),
        athleteId,
        groupId,
        sequenceIndex: gs.sequenceIndex,
        repIndex: gs.repIndex,
        timeMs: elapsedMs,
      } as any

      // Update captured list
      const nextCaptured = gs.capturedThisRep.includes(athleteId) ? gs.capturedThisRep : [...gs.capturedThisRep, athleteId]

      // Manual completion: when ALL active athletes are captured, start REST.
      // IMPORTANT: We do NOT advance to the next rep/item until the rest duration completes.
      let nextGs: GroupRunState = { ...gs, capturedThisRep: nextCaptured }
      if (block.timingMode === 'manual') {
        const actives = activeAthletesForGroup(state, session, groupId)
        const allActiveIds = actives.map(a => a.athleteId)
        const done = allActiveIds.every(id => nextCaptured.includes(id))
        if (done) {
          // Lock in fastest-first order for the *next* rep (based on this rep's times)
          const activeIds = allActiveIds
          const sortOrderAthleteIds = computeSortOrderForRep(
            state,
            sessionId,
            groupId,
            gs.sequenceIndex,
            gs.repIndex,
            activeIds,
            { athleteId, timeMs: elapsedMs },
          )

          // Start rest timer
          nextGs = {
            ...gs,
            status: 'resting',
            timer: { mode: 'rest', startMs: nowMs(), durationMs: block.restSeconds * 1000 },
            capturedThisRep: nextCaptured,
            sortOrderAthleteIds,
          }
        }
      }

      set(s => ({
        eventsBySessionId: {
          ...s.eventsBySessionId,
          [sessionId]: [...(s.eventsBySessionId[sessionId] || []), evt],
        },
        sessions: s.sessions.map(sess => {
          if (sess.sessionId !== sessionId) return sess
          return {
            ...sess,
            groupRunState: { ...sess.groupRunState, [groupId]: nextGs },
          }
        }),
      }))
          
      persistNow()
},

    nextOverride: (sessionId, groupId) => {
      const state = get()
      const session = state.sessions.find(s => s.sessionId === sessionId)
      if (!session) return
      if (session.endedAtISO) return

      const template = session.templateId ? getTemplate(state, session.templateId) : null
      if (!template) return
      const gs = session.groupRunState[groupId]
      if (!gs || gs.status === 'complete') return

      const item = template.sequence[gs.sequenceIndex]
      if (!item) return

      const events: SessionEvent[] = []

      // If we're forcing advancement while a WORK rep/rest is in progress, lock in fastest-first order
      // for the *next* rep based on the most recent rep's captured times.
      // This is important because coaches often use Next (rather than waiting for cycle/rest boundary),
      // and sorting still needs to update.
      let forcedSortOrder: AthleteId[] | undefined
      if (item.type === 'work' && (gs.status === 'running' || gs.status === 'resting')) {
        const activeIds = activeAthletesForGroup(state, session, groupId).map(a => a.athleteId)
        forcedSortOrder = computeSortOrderForRep(state, sessionId, groupId, gs.sequenceIndex, gs.repIndex, activeIds)
      }

      // If running a work item, assign blanks for any active athletes not captured
      if (gs.status === 'running' && item.type === 'work') {
        const actives = activeAthletesForGroup(state, session, groupId).map(a => a.athleteId)
        for (const aid of actives) {
          if (!gs.capturedThisRep.includes(aid)) {
            events.push({
              eventId: uid('evt'),
              type: 'FORCE_ADVANCE_BLANK',
              atMs: nowMs(),
              athleteId: aid,
              groupId,
              sequenceIndex: gs.sequenceIndex,
              repIndex: gs.repIndex,
            } as any)
          }
        }
      }

      // Advance rules:
      // - If READY: advance again, do NOT start
      // - If RUNNING: end now, advance, enter READY
      // - If IDLE: treat as READY for advance
      const nextGsBase = advanceToNextItemOrRep(state, template, session, groupId, 'nextOverride')
      const nextGs = forcedSortOrder ? { ...nextGsBase, sortOrderAthleteIds: forcedSortOrder } : nextGsBase

      set(s => ({
        eventsBySessionId: {
          ...s.eventsBySessionId,
          [sessionId]: [...(s.eventsBySessionId[sessionId] || []), ...events],
        },
        sessions: s.sessions.map(sess => {
          if (sess.sessionId !== sessionId) return sess
          return {
            ...sess,
            groupRunState: { ...sess.groupRunState, [groupId]: nextGs },
          }
        }),
      }))
          
      persistNow()
},

    backOverride: (sessionId, groupId) => {
      const state = get()
      const session = state.sessions.find(s => s.sessionId === sessionId)
      if (!session) return
      if (session.endedAtISO) return

      const template = session.templateId ? getTemplate(state, session.templateId) : null
      if (!template) return

      const gs = session.groupRunState[groupId]
      if (!gs) return

      // v0.3.5: Back is only allowed when NOT actively capturing/running.
      if (gs.status !== 'ready' && gs.status !== 'resting') return

      const events: SessionEvent[] = []

      // Clear any captured/blank times for the target rep we are returning to.
      // (They can be re-captured; this avoids stale times in Results.)
      const clearRep = (seqIdx: number, repIdx: number) => {
        const actives = activeAthletesForGroup(state as any, session, groupId).map(a => a.athleteId)
        for (const aid of actives) {
          events.push({
            eventId: uid('evt'),
            type: 'EDIT',
            atMs: nowMs(),
            athleteId: aid,
            groupId,
            sequenceIndex: seqIdx,
            repIndex: repIdx,
            newTimeMs: null,
          } as any)
        }
      }

      const prev = computePrevPointer(state as any, template, gs)
      if (!prev) return
      clearRep(prev.sequenceIndex, prev.repIndex)

      const nextGs: GroupRunState = {
        ...gs,
        status: 'ready',
        sequenceIndex: prev.sequenceIndex,
        repIndex: prev.repIndex,
        timer: { mode: prev.itemType === 'recovery' ? 'recovery' : 'work', startMs: nowMs() },
        capturedThisRep: [],
      }

      set(s => ({
        eventsBySessionId: {
          ...s.eventsBySessionId,
          [sessionId]: [...(s.eventsBySessionId[sessionId] || []), ...events],
        },
        sessions: s.sessions.map(sess => (sess.sessionId === sessionId ? { ...sess, groupRunState: { ...sess.groupRunState, [groupId]: nextGs } } : sess)),
      }))
      persistNow()
    },

    autoBoundary: (sessionId, groupId) => {
      const state = get()
      const session = state.sessions.find(s => s.sessionId === sessionId)
      if (!session) return
      if (session.endedAtISO) return

      const template = session.templateId ? getTemplate(state, session.templateId) : null
      if (!template) return

      const gs = session.groupRunState[groupId]
      if (!gs || (gs.status !== 'running' && gs.status !== 'resting')) return

      // Lock in fastest-first order for the *next* rep at boundaries.
      // - Cycle: boundary ends the running rep.
      // - Manual: boundary ends the REST period (rep already fully captured).
      let sortOrderAthleteIds = gs.sortOrderAthleteIds
      const item = template.sequence[gs.sequenceIndex]
      if (item?.type === 'work') {
        const block = getBlock(state, item.blockId || '')
        const activeIds = activeAthletesForGroup(state, session, groupId).map(a => a.athleteId)
        if (block?.timingMode === 'cycle') {
          sortOrderAthleteIds = computeSortOrderForRep(state, sessionId, groupId, gs.sequenceIndex, gs.repIndex, activeIds)
        }
        if (block?.timingMode === 'manual' && gs.status === 'resting') {
          // Recompute at REST boundary to ensure ordering is present going into the next rep.
          sortOrderAthleteIds = computeSortOrderForRep(state, sessionId, groupId, gs.sequenceIndex, gs.repIndex, activeIds)
        }
      }

      const nextGsBase = advanceToNextItemOrRep(state, template, session, groupId, 'autoBoundary')
      const nextGs = { ...nextGsBase, sortOrderAthleteIds }

      set(s => ({
        sessions: s.sessions.map(sess => {
          if (sess.sessionId !== sessionId) return sess
          return { ...sess, groupRunState: { ...sess.groupRunState, [groupId]: nextGs } }
        }),
      }))
          
      persistNow()
},

    editCell: (sessionId, groupId, athleteId, sequenceIndex, repIndex, newTimeMs) => {
      const evt: SessionEvent = {
        eventId: uid('evt'),
        type: 'EDIT',
        atMs: nowMs(),
        athleteId,
        groupId,
        sequenceIndex,
        repIndex,
        newTimeMs,
      } as any
      set(s => ({
        eventsBySessionId: {
          ...s.eventsBySessionId,
          [sessionId]: [...(s.eventsBySessionId[sessionId] || []), evt],
        },
      }))
          
      persistNow()
},
  }
})

function advanceAfterWorkCompletion(state: AppState, session: Session, groupId: GroupId, reason: 'autoBoundary' | 'nextOverride'): GroupRunState {
  const template = session.templateId ? getTemplate(state as any, session.templateId) : null
  if (!template) return session.groupRunState[groupId]
  const gs = session.groupRunState[groupId]
  return advanceToNextItemOrRep(state, template, session, groupId, reason)
}

function advanceToNextItemOrRep(
  state: AppState,
  template: TemplateDef,
  session: Session,
  groupId: GroupId,
  reason: 'autoBoundary' | 'nextOverride',
): GroupRunState {
  const gs = session.groupRunState[groupId]
  const item = template.sequence[gs.sequenceIndex]
  if (!item) return { ...gs, status: 'complete' }

  // READY advances again but does not start
  const advanceFromReady = gs.status === 'ready' || gs.status === 'idle'

  if (item.type === 'work') {
    const block = getBlock(state as any, item.blockId || '')
    if (!block) return { ...gs, status: 'complete' }

    const isLastRep = gs.repIndex >= block.reps - 1
    if (!advanceFromReady) {
      // if running, we still end this rep now and advance
    }

    if (isLastRep) {
      // move to next sequence item
      const nextSeq = gs.sequenceIndex + 1
      const nextItem = template.sequence[nextSeq]
      if (!nextItem) {
        return { ...gs, status: 'complete', sequenceIndex: nextSeq, repIndex: 0, timer: { mode: 'work', startMs: null }, capturedThisRep: [] }
      }

      // v0.3.5: Recovery items auto-start immediately when a work rep finishes.
      if (nextItem.type === 'recovery') {
        const rec = getRecovery(state as any, nextItem.recoveryId || '')
        const dur = rec ? rec.durationSeconds * 1000 : 0
        return {
          ...gs,
          status: 'running',
          sequenceIndex: nextSeq,
          repIndex: 0,
          timer: { mode: 'recovery', startMs: nowMs(), durationMs: dur },
          capturedThisRep: [],
        }
      }

      // Next is another work item; enter READY and wait for coach Start.
      const nextTimer: TimerState = { ...resolveTimerModeForItem(nextItem.type), startMs: nowMs() }
      return {
        ...gs,
        status: 'ready',
        sequenceIndex: nextSeq,
        repIndex: 0,
        timer: nextTimer,
        capturedThisRep: [],
      }
    }

    // advance to next rep within same block
    return {
      ...gs,
      status: 'ready',
      repIndex: gs.repIndex + 1,
      timer: { mode: 'work', startMs: nowMs() },
      capturedThisRep: [],
    }
  }

  // Recovery: always standalone, auto-advances to next item when boundary hits 0; Next can also force advance.
  const nextSeq = gs.sequenceIndex + 1
  const nextItem = template.sequence[nextSeq]
  if (!nextItem) {
    return { ...gs, status: 'complete', sequenceIndex: nextSeq, repIndex: 0, timer: { mode: 'work', startMs: null }, capturedThisRep: [] }
  }
  return {
    ...gs,
    status: 'ready',
    sequenceIndex: nextSeq,
    repIndex: 0,
    timer: { ...resolveTimerModeForItem(nextItem.type), startMs: nowMs() },
    capturedThisRep: [],
  }
}

function computePrevPointer(state: AppState, template: TemplateDef, gs: GroupRunState): { sequenceIndex: number; repIndex: number; itemType: 'work' | 'recovery' } | null {
  // If we are at the start of everything, nothing to do
  if (gs.sequenceIndex === 0 && gs.repIndex === 0) return null

  const curItem = template.sequence[gs.sequenceIndex]
  if (!curItem) return null

  if (curItem.type === 'work') {
    const block = getBlock(state as any, curItem.blockId || '')
    const reps = block ? block.reps : 0
    if (gs.repIndex > 0) {
      return { sequenceIndex: gs.sequenceIndex, repIndex: gs.repIndex - 1, itemType: 'work' }
    }
    // repIndex == 0: go to previous sequence item
    const prevSeq = gs.sequenceIndex - 1
    const prevItem = template.sequence[prevSeq]
    if (!prevItem) return null
    if (prevItem.type === 'recovery') {
      return { sequenceIndex: prevSeq, repIndex: 0, itemType: 'recovery' }
    }
    const prevBlock = getBlock(state as any, prevItem.blockId || '')
    const prevReps = prevBlock ? prevBlock.reps : 0
    return { sequenceIndex: prevSeq, repIndex: Math.max(0, prevReps - 1), itemType: 'work' }
  }

  // Current item is recovery: previous is always the prior sequence item
  const prevSeq = gs.sequenceIndex - 1
  const prevItem = template.sequence[prevSeq]
  if (!prevItem) return null
  if (prevItem.type === 'recovery') {
    return { sequenceIndex: prevSeq, repIndex: 0, itemType: 'recovery' }
  }
  const prevBlock = getBlock(state as any, prevItem.blockId || '')
  const prevReps = prevBlock ? prevBlock.reps : 0
  return { sequenceIndex: prevSeq, repIndex: Math.max(0, prevReps - 1), itemType: 'work' }
}

// Auto-boundary processing is done in the SessionRunner tick hook (to keep store deterministic).
