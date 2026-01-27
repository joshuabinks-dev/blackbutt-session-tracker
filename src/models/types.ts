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
  name: string;
  groupId: GroupId;
  active: boolean;
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

export type GroupStatus = "idle" | "runningWork" | "resting";

export type GroupRuntime = {
  groupId: GroupId;
  sequenceIndex: number;
  repIndex: number;
  status: GroupStatus;
  work: { startMs: number | null; elapsedMs: number; targetSeconds?: number };
  rest: { startMs: number | null; durationSeconds: number };
  capturedAthleteIds: string[];
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

  groupState: Record<GroupId, GroupRuntime>;
  results: ResultEntry[];
};
