export type GroupId = "A" | "B" | "C" | "D" | "All";
export type BlockMode = "manual" | "cycle";

export type Block = {
  id: string;
  type: "block";
  label: string;
  distanceM: number;
  reps: number;
  mode: BlockMode;
  workSeconds?: number; // cycle duration
  restSeconds: number; // after each rep
};

export type Joiner = {
  id: string;
  type: "joiner";
  joinerType: "rest" | "note";
  label: string;
  durationSeconds?: number;
  text?: string;
  skippable: true;
};

export type SequenceItem = Block | Joiner;

export type TemplateSession = {
  id: string;
  name: string;
  description: string;
  sequence: SequenceItem[];
};

export type Athlete = {
  id: string;
  firstName: string;
  lastName: string;
  defaultGroupId: GroupId;
  active: boolean;
};

export type AthleteSnapshot = {
  id: string;
  firstName: string;
  lastName: string;
  groupId: GroupId;
  active: boolean;
  savedGroupId?: GroupId; // used to restore after All-in mode
};

export type ResultEntry = {
  id: string;
  sessionId: string;
  athleteId: string;
  athleteName: string;
  groupId: GroupId;
  sequenceIndex: number;
  itemLabel: string;
  repIndex: number;
  timeSeconds: number;
  capturedAtISO: string;
};

export type ResultCell = {
  timeSeconds: number;
  capturedAtISO: string;
  edited?: boolean;
};

export type BlockResultMatrix = {
  blockId: string;
  blockLabel: string;
  distanceM: number;
  reps: number;
  // groupId -> athleteId -> repIndex -> cell
  data: Record<GroupId, Record<string, (ResultCell | null)[]>>;
};

export type SessionResults = {
  matrices: BlockResultMatrix[];
  // Optional audit log (append-only)
  log: ResultEntry[];
};



export type GroupStatus = "idle" | "runningWork" | "resting" | "complete";

export type GroupRuntime = {
groupId: GroupId;
  sequenceIndex: number;
  repIndex: number;
  status: GroupStatus;
  work: { startMs: number | null; elapsedMs: number; targetSeconds?: number };
  rest: { startMs: number | null; durationSeconds: number };
  capturedAthleteIds: string[];
  sortOrderAthleteIds?: string[]; // fastest->slowest from most recent rep
  lastCapture?: { athleteId: string; blockId: string; repIndex: number };
};

export type LiveSession = {
id: string;
  templateId: string;
  name: string;
  location: string;
  startedAtISO: string;
  endedAtISO: string | null;

  allInMode: boolean;

  roster: AthleteSnapshot[];
  sequence: SequenceItem[];

  fastCaptureMode: boolean;

  groupState: Record<GroupId, GroupRuntime>;
  results: SessionResults;
};
