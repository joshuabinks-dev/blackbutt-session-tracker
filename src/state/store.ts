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

const LS_KEY = 'tpt_state_v0_1'

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`
}

function nowMs() {
  return Date.now()
}

export interface AppState {
  athletes: AthleteDef[]
  groups: GroupDef[]
  blocks: WorkBlockDef[]
  recoveries: RecoveryDef[]
  templates: TemplateDef[]

  activeSessionId: string | null
  sessions: Session[]
  eventsBySessionId: Record<string, SessionEvent[]>

  // actions
  startFromTemplate: (templateId: string) => void
  endSession: (sessionId: string) => void
  deleteSession: (sessionId: string) => void

  setSessionLocation: (sessionId: string, location: string) => void
  setSessionName: (sessionId: string, name: string) => void
  toggleAthleteActive: (sessionId: string, athleteId: string, isActive: boolean) => void

  startCurrentItem: (sessionId: string, groupId: GroupId) => void
  captureAthlete: (sessionId: string, groupId: GroupId, athleteId: AthleteId) => void
  nextOverride: (sessionId: string, groupId: GroupId) => void
  autoBoundary: (sessionId: string, groupId: GroupId) => void

  editCell: (sessionId: string, groupId: GroupId, athleteId: AthleteId, sequenceIndex: number, repIndex: number, newTimeMs: number | null) => void

  hydrate: () => void
  persist: () => void
}

function defaultData(): Pick<AppState, 'athletes'|'groups'|'blocks'|'recoveries'|'templates'> {
  const groups: GroupDef[] = [
    { groupId: 'A', label: 'Group A' },
    { groupId: 'B', label: 'Group B' },
  ]
  const athletes: AthleteDef[] = [
    { athleteId: 'josh_binks', firstName: 'Josh', lastName: 'Binks', defaultGroupId: 'A' },
    { athleteId: 'india_binks', firstName: 'India', lastName: 'Binks', defaultGroupId: 'A' },
    { athleteId: 'ruby_mcphillips', firstName: 'Ruby', lastName: 'McPhillips', defaultGroupId: 'B' },
    { athleteId: 'fin_mcphillips', firstName: 'Fin', lastName: 'McPhillips', defaultGroupId: 'B' },
  ]
  const blocks: WorkBlockDef[] = [
    {
      blockId: '8x800_cycle_300',
      label: '8 × 800m on 5:00 cycle',
      distanceMeters: 800,
      reps: 8,
      timingMode: 'cycle',
      cycleSeconds: 300,
      restSeconds: 0,
    },
    {
      blockId: '4x200_manual',
      label: '4 × 200m manual',
      distanceMeters: 200,
      reps: 4,
      timingMode: 'manual',
      restSeconds: 180,
    },
  ]
  const recoveries: RecoveryDef[] = [
    { recoveryId: 'recovery_180', label: 'Recovery', durationSeconds: 180 },
  ]
  const templates: TemplateDef[] = [
    {
      templateId: 'tuesday_example',
      name: 'Tuesday Track Session',
      description: '8×800 on 5:00 cycle, Recovery 3:00, then 4×200 w/ 3:00 rest',
      sequence: [
        { type: 'work', blockId: '8x800_cycle_300' },
        { type: 'recovery', recoveryId: 'recovery_180' },
        { type: 'work', blockId: '4x200_manual' },
      ],
    },
  ]
  return { athletes, groups, blocks, recoveries, templates }
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
  return {
    ...defaults,

    activeSessionId: null,
    sessions: [],
    eventsBySessionId: {},

    hydrate: () => {
      const raw = localStorage.getItem(LS_KEY)
      if (!raw) return
      try {
        const parsed = JSON.parse(raw)
        set(parsed)
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
      const participants = state.athletes.map(a => ({
        athleteId: a.athleteId,
        groupId: a.defaultGroupId,
        isActiveInSession: true,
      }))

      const groupRunState: Record<string, GroupRunState> = {}
      for (const g of state.groups) {
        groupRunState[g.groupId] = makeInitialGroupState()
      }

      const session: Session = {
        sessionId,
        name: template.name,
        templateId: template.templateId,
        location: 'Blackbutt',
        startedAtISO,
        participants,
        groupRunState,
      }

      const events: SessionEvent[] = [{ eventId: uid('evt'), type: 'SESSION_START', atMs: nowMs() }]

      set(s => ({
        sessions: [session, ...s.sessions],
        activeSessionId: sessionId,
        eventsBySessionId: { ...s.eventsBySessionId, [sessionId]: events },
      }))
      get().persist()
    },

    endSession: (sessionId) => {
      set(s => ({
        sessions: s.sessions.map(sess => (sess.sessionId === sessionId ? { ...sess, endedAtISO: new Date().toISOString() } : sess)),
        activeSessionId: s.activeSessionId === sessionId ? null : s.activeSessionId,
        eventsBySessionId: {
          ...s.eventsBySessionId,
          [sessionId]: [...(s.eventsBySessionId[sessionId] || []), { eventId: uid('evt'), type: 'SESSION_END', atMs: nowMs() }],
        },
      }))
      get().persist()
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
      get().persist()
    },

    setSessionLocation: (sessionId, location) => {
      set(s => ({ sessions: s.sessions.map(sess => (sess.sessionId === sessionId ? { ...sess, location } : sess)) }))
      get().persist()
    },

    setSessionName: (sessionId, name) => {
      set(s => ({ sessions: s.sessions.map(sess => (sess.sessionId === sessionId ? { ...sess, name } : sess)) }))
      get().persist()
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
      get().persist()
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
      get().persist()
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
      get().persist()
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
      const nextGs = advanceToNextItemOrRep(state, template, session, groupId, 'nextOverride')

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
      get().persist()
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

      // If this boundary ends a cycle work rep, lock in fastest-first order for the next rep.
      let sortOrderAthleteIds = gs.sortOrderAthleteIds
      const item = template.sequence[gs.sequenceIndex]
      if (item?.type === 'work') {
        const block = getBlock(state, item.blockId || '')
        if (block?.timingMode === 'cycle') {
          const activeIds = activeAthletesForGroup(state, session, groupId).map(a => a.athleteId)
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
      get().persist()
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
      get().persist()
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
      // next item could be recovery or work; repIndex resets
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

// Auto-boundary processing is done in the SessionRunner tick hook (to keep store deterministic).
