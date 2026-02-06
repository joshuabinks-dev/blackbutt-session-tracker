export type TimingMode = 'manual' | 'cycle'

export type SequenceItemType = 'work' | 'recovery'

export type AthleteId = string
export type GroupId = string

export interface AthleteDef {
  athleteId: AthleteId
  firstName: string
  lastName: string
  defaultGroupId: GroupId
}

export interface GroupDef {
  groupId: GroupId
  label: string
}

export interface WorkBlockDef {
  blockId: string
  label: string
  distanceMeters: number
  reps: number
  timingMode: TimingMode
  cycleSeconds?: number
  restSeconds: number
}

export interface RecoveryDef {
  recoveryId: string
  label: string
  durationSeconds: number
}

export interface SequenceItemDef {
  type: SequenceItemType
  blockId?: string
  recoveryId?: string
}

export interface TemplateDef {
  templateId: string
  name: string
  description: string
  sequence: SequenceItemDef[]
}

export type GroupStatus = 'idle' | 'running' | 'resting' | 'ready' | 'complete' | 'ended'

export type TimerMode = 'work' | 'recovery' | 'rest'

export interface TimerState {
  mode: TimerMode
  startMs: number | null
  durationMs?: number
  // Derived display comes from nowMs
}

export interface AthleteParticipation {
  athleteId: AthleteId
  groupId: GroupId
  isActiveInSession: boolean
}

export interface GroupRunState {
  status: GroupStatus
  sequenceIndex: number
  repIndex: number
  timer: TimerState
  capturedThisRep: AthleteId[]
  sortOrderAthleteIds?: AthleteId[]
}

export interface Session {
  sessionId: string
  name: string
  templateId?: string
  location: string
  startedAtISO: string
  endedAtISO?: string
  participants: AthleteParticipation[]
  groupRunState: Record<GroupId, GroupRunState>
}

export type EventType = 'CAPTURE' | 'EDIT' | 'FORCE_ADVANCE_BLANK' | 'ATHLETE_ACTIVE_SET' | 'GROUP_ADVANCE' | 'SESSION_START' | 'SESSION_END'

export interface BaseEvent {
  eventId: string
  type: EventType
  atMs: number
}

export interface CaptureEvent extends BaseEvent {
  type: 'CAPTURE'
  athleteId: AthleteId
  groupId: GroupId
  sequenceIndex: number
  repIndex: number
  timeMs: number
}

export interface ForceBlankEvent extends BaseEvent {
  type: 'FORCE_ADVANCE_BLANK'
  athleteId: AthleteId
  groupId: GroupId
  sequenceIndex: number
  repIndex: number
}

export interface EditEvent extends BaseEvent {
  type: 'EDIT'
  athleteId: AthleteId
  groupId: GroupId
  sequenceIndex: number
  repIndex: number
  newTimeMs: number | null
}

export type SessionEvent = CaptureEvent | ForceBlankEvent | EditEvent | BaseEvent
