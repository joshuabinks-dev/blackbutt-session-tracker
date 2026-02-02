import React from "react";
import type { Athlete, LiveSession, TemplateSession, GroupId, SequenceItem, GroupRuntime, ResultEntry } from "../models/types";
import { loadActiveSessionId, loadAthletes, loadSessions, loadTemplates, saveActiveSessionId, saveAthletes, saveSessions, saveTemplates } from "../storage/db";
import { seedAthletes, seedTemplates } from "./seed";
import { uid } from "../utils/id";
import { nowISO } from "../utils/time";

export type AppTab = "home" | "session" | "results" | "settings" | "builder";

export type AppState = {
  tab: AppTab;
  athletes: Athlete[];
  templates: TemplateSession[];
  sessions: LiveSession[];
  activeSessionId: string | null;
  nowMs: number;
  toast: string | null;
};

type Action =
  | { type: "SET_TAB"; tab: AppTab }
  | { type: "INIT"; athletes: Athlete[]; templates: TemplateSession[]; sessions: LiveSession[]; activeSessionId: string | null }
  | { type: "TICK"; nowMs: number }
  | { type: "TOAST"; message: string | null }
  | { type: "UPSERT_SESSION"; session: LiveSession }
  | { type: "DELETE_SESSION"; sessionId: string }
  | { type: "SET_ACTIVE_SESSION"; sessionId: string | null };

const initial: AppState = {
  tab: "home",
  athletes: [],
  templates: [],
  sessions: [],
  activeSessionId: null,
  nowMs: Date.now(),
  toast: null,
};

function getActiveSession(state: AppState): LiveSession | null {
  if (!state.activeSessionId) return null;
  return state.sessions.find(s => s.id === state.activeSessionId) || null;
}

function computeGroupsUsed(session: LiveSession): GroupId[] {
  if (session.allInMode) return ["All"];
  const groups = new Set<GroupId>();
  for (const a of session.roster) if (a.active) groups.add(a.groupId);
  const ordered: GroupId[] = ["A","B","C","D"].filter(g => groups.has(g as GroupId)) as GroupId[];
  return ordered.length ? ordered : ["A"];
}

function ensureGroupState(session: LiveSession): LiveSession {
  const groups = computeGroupsUsed(session);
  // Migrate older sessions that stored results as a flat array
  const anySess: any = session as any;
  if (Array.isArray(anySess.results)) {
    session.results = { matrices: [], log: anySess.results } as any;
  }
  if (!session.results) {
    session.results = { matrices: [], log: [] } as any;
  }

  for (const gid of groups) {
    if (!session.groupState[gid]) {
      session.groupState[gid] = {
        groupId: gid,
        sequenceIndex: 0,
        repIndex: 0,
        status: "idle",
        work: { startMs: null, elapsedMs: 0, targetSeconds: undefined },
        rest: { startMs: null, durationSeconds: 0 },
        capturedAthleteIds: [],
        lastCapture: undefined,
      };
    }
  }
  for (const key of Object.keys(session.groupState) as GroupId[]) {
    if (!groups.includes(key)) delete session.groupState[key];
  }
  return session;
}

function currentItem(session: LiveSession, gs: GroupRuntime): SequenceItem | null {
  return session.sequence[gs.sequenceIndex] || null;
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_TAB":
      return { ...state, tab: action.tab };
    case "INIT":
      return { ...state, athletes: action.athletes, templates: action.templates, sessions: action.sessions, activeSessionId: action.activeSessionId };
    case "TICK": {
      const s = getActiveSession(state);
      if (!s) return { ...state, nowMs: action.nowMs };
      const sessions = state.sessions.map(sess => {
        if (sess.id !== s.id) return sess;
        const copy: LiveSession = structuredClone(sess);
        ensureGroupState(copy);
        const nowMs = action.nowMs;

        if (copy.endedAtISO) {
          return copy;
        }

        for (const gid of computeGroupsUsed(copy)) {
          const gs = copy.groupState[gid];
          const item = currentItem(copy, gs);
          if (!item) continue;

          if (gs.status === "runningWork" && gs.work.startMs != null) {
            gs.work.elapsedMs = nowMs - gs.work.startMs;

            // cycle auto-complete
            if (item.type === "block" && item.mode === "cycle" && item.workSeconds != null) {
              if (gs.work.elapsedMs >= item.workSeconds * 1000) {
                gs.status = "resting";
                gs.rest.startMs = gs.work.startMs + item.workSeconds * 1000;
                gs.rest.durationSeconds = item.restSeconds || 0;
                gs.work.elapsedMs = item.workSeconds * 1000;
                gs.capturedAthleteIds = [];
              }
            }
          }
        }
        return copy;
      });
      return { ...state, nowMs: action.nowMs, sessions };
    }
    case "TOAST":
      return { ...state, toast: action.message };
    case "UPSERT_SESSION":
      return { ...state, sessions: state.sessions.filter(s => s.id !== action.session.id).concat(action.session) };
    case "DELETE_SESSION": {
      const sessions = state.sessions.filter(s => s.id !== action.sessionId);
      const activeSessionId = state.activeSessionId === action.sessionId ? null : state.activeSessionId;
      return { ...state, sessions, activeSessionId };
    }
    case "SET_ACTIVE_SESSION":
      return { ...state, activeSessionId: action.sessionId };
    default:
      return state;
  }
}

type Store = {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  api: {
    init(): Promise<void>;
    setTab(tab: AppTab): void;
    toast(msg: string): void;

    startSessionFromTemplate(templateId: string): Promise<void>;
    resumeSession(sessionId: string): Promise<void>;
    endSession(): Promise<void>;
    deleteSession(sessionId: string): Promise<void>;

    toggleAllIn(): Promise<void>;
    toggleFastCaptureMode(): Promise<void>;

    startWork(groupId: GroupId): Promise<void>;
    undoLastCapture(groupId: GroupId): Promise<void>;
    next(groupId: GroupId): Promise<void>;
    tapAthlete(groupId: GroupId, athleteId: string): Promise<void>;

    setSessionName(name: string): Promise<void>;
    setSessionLocation(loc: string): Promise<void>;
    setAthleteActive(athleteId: string, active: boolean): Promise<void>;
    setAthleteGroup(athleteId: string, groupId: GroupId): Promise<void>;

    setResultCell(blockId: string, groupId: GroupId, athleteId: string, repIndex: number, timeSeconds: number | null): Promise<void>;
  };
};

const Ctx = React.createContext<Store | null>(null);

export function StoreProvider(props: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(reducer, initial);

  React.useEffect(() => {
    const id = window.setInterval(() => dispatch({ type: "TICK", nowMs: Date.now() }), 100);
    return () => window.clearInterval(id);
  }, []);

  const api: Store["api"] = React.useMemo(() => ({
    async init() {
      const athletes = (await loadAthletes()) ?? (seedAthletes as unknown as Athlete[]);
      const templates = (await loadTemplates()) ?? (seedTemplates as unknown as TemplateSession[]);
      const sessions = (await loadSessions()) ?? [];
      const activeSessionId = (await loadActiveSessionId()) ?? null;
      dispatch({ type: "INIT", athletes, templates, sessions, activeSessionId });
      await saveAthletes(athletes);
      await saveTemplates(templates);
      await saveSessions(sessions);
    },
    setTab(tab) { dispatch({ type: "SET_TAB", tab }); },
    toast(msg) {
      dispatch({ type: "TOAST", message: msg });
      window.setTimeout(() => dispatch({ type: "TOAST", message: null }), 1400);
    },

    async startSessionFromTemplate(templateId) {
      const template = state.templates.find(t => t.id === templateId);
      if (!template) { this.toast("Template not found"); return; }
      if (state.activeSessionId) { this.toast("End active session first"); return; }

      const roster = state.athletes.map(a => ({
        id: a.id,
        firstName: a.firstName,
        lastName: a.lastName,
        groupId: a.defaultGroupId,
        active: true,
      }));

      const s: LiveSession = ensureGroupState({
        id: uid("s-"),
        templateId: template.id,
        name: template.name,
        location: "",
        startedAtISO: nowISO(),
        endedAtISO: null,
        allInMode: false,
        roster,
        sequence: structuredClone(template.sequence),
        groupState: {} as any,
        fastCaptureMode: false,
        results: { matrices: [], log: [] },
      });

      const sessions = state.sessions.concat(s);
      dispatch({ type: "UPSERT_SESSION", session: s });
      dispatch({ type: "SET_ACTIVE_SESSION", sessionId: s.id });
      await saveSessions(sessions);
      await saveActiveSessionId(s.id);
      dispatch({ type: "SET_TAB", tab: "session" });
    },

    async resumeSession(sessionId) {
      dispatch({ type: "SET_ACTIVE_SESSION", sessionId });
      await saveActiveSessionId(sessionId);
      dispatch({ type: "SET_TAB", tab: "session" });
    },

    async endSession() {
      const s = getActiveSession(state);
      if (!s) return;
      const updated: LiveSession = { ...s, endedAtISO: nowISO() };
      dispatch({ type: "UPSERT_SESSION", session: updated });
      dispatch({ type: "SET_ACTIVE_SESSION", sessionId: null });
      await saveActiveSessionId(null);
      await saveSessions(state.sessions.map(x => x.id === s.id ? updated : x));
      this.toast("Session ended");
      dispatch({ type: "SET_TAB", tab: "home" });
    },

    async deleteSession(sessionId) {
      dispatch({ type: "DELETE_SESSION", sessionId });
      await saveSessions(state.sessions.filter(s => s.id !== sessionId));
      if (state.activeSessionId === sessionId) await saveActiveSessionId(null);
      this.toast("Deleted");
    },

    
async toggleAllIn() {
  const s = getActiveSession(state);
  if (!s) return;
  if (s.endedAtISO) { this.toast("Session ended"); return; }

  const updated: LiveSession = structuredClone(s);
  updated.allInMode = !updated.allInMode;

  if (updated.allInMode) {
    updated.roster = updated.roster.map(a => {
      if (!a.active) return a;
      return { ...a, savedGroupId: a.groupId, groupId: "All" };
    });
  } else {
    updated.roster = updated.roster.map(a => {
      if (!a.active) return a;
      const restored = (a as any).savedGroupId ?? a.groupId;
      const { savedGroupId, ...rest } = a as any;
      return { ...rest, groupId: restored };
    });
  }

  ensureGroupState(updated);
  dispatch({ type: "UPSERT_SESSION", session: updated });
  await saveSessions(state.sessions.map(x => x.id === updated.id ? updated : x));
},


    
async toggleFastCaptureMode() {
  const s = getActiveSession(state);
  if (!s) return;
  if (s.endedAtISO) { this.toast("Session ended"); return; }

  const updated: LiveSession = structuredClone(s);
  updated.fastCaptureMode = !updated.fastCaptureMode;
  dispatch({ type: "UPSERT_SESSION", session: updated });
  await saveSessions(state.sessions.map(x => x.id === updated.id ? updated : x));
},

async undoLastCapture(groupId) {
  const s = getActiveSession(state);
  if (!s) return;
  if (s.endedAtISO) { this.toast("Session ended"); return; }

  const updated: LiveSession = structuredClone(s);
  ensureGroupState(updated);
  const gs = updated.groupState[groupId];
  const last = gs.lastCapture;
  if (!last) { this.toast("Nothing to undo"); return; }

  const matrix = updated.results.matrices.find(m => m.blockId === last.blockId);
  if (matrix) {
    const groupMap = (matrix.data as any)[groupId] || {};
    const reps = groupMap[last.athleteId];
    if (reps && reps[last.repIndex] != null) reps[last.repIndex] = null;
    (matrix.data as any)[groupId] = groupMap;
  }

  gs.capturedAthleteIds = gs.capturedAthleteIds.filter(id => id !== last.athleteId);
  gs.lastCapture = undefined;

  for (let i = updated.results.log.length - 1; i >= 0; i--) {
    const r = updated.results.log[i];
    if (r.groupId === groupId && r.athleteId === last.athleteId && r.repIndex === last.repIndex) {
      updated.results.log.splice(i, 1);
      break;
    }
  }

  dispatch({ type: "UPSERT_SESSION", session: updated });
  await saveSessions(state.sessions.map(x => x.id === updated.id ? updated : x));
},

async startWork(groupId) {
  const s = getActiveSession(state);
  if (!s) return;
  if (s.endedAtISO) { this.toast("Session ended"); return; }

  const updated: LiveSession = structuredClone(s);
  ensureGroupState(updated);
  const gs = updated.groupState[groupId];
  const item = currentItem(updated, gs);
  if (!item) { this.toast("No item"); return; }
  const now = Date.now();

  const advanceIfNeeded = () => {
    const cur = currentItem(updated, gs);
    if (!cur || cur.type !== "block") return;
    if (gs.status === "resting") {
      if (gs.repIndex < cur.reps - 1) gs.repIndex += 1;
      else { gs.sequenceIndex = Math.min(updated.sequence.length - 1, gs.sequenceIndex + 1); gs.repIndex = 0; }
      gs.capturedAthleteIds = [];
      gs.lastCapture = undefined;
      gs.status = "idle";
    }
  };

  if (item.type === "joiner") {
    gs.status = "resting";
    gs.rest.startMs = now;
    gs.rest.durationSeconds = item.joinerType === "rest" ? (item.durationSeconds || 0) : 0;
    gs.work.startMs = null;
    gs.work.elapsedMs = 0;
    gs.capturedAthleteIds = [];
    gs.lastCapture = undefined;
  } else {
    advanceIfNeeded();
    const cur = currentItem(updated, gs);
    if (!cur || cur.type !== "block") { this.toast("No block"); return; }

    gs.status = "runningWork";
    gs.work.startMs = now;
    gs.work.elapsedMs = 0;
    gs.work.targetSeconds = cur.mode === "cycle" ? (cur.workSeconds || 0) : undefined;
    gs.rest.startMs = null;
    gs.rest.durationSeconds = cur.restSeconds || 0;
    gs.capturedAthleteIds = [];
    gs.lastCapture = undefined;
  }

  dispatch({ type: "UPSERT_SESSION", session: updated });
  await saveSessions(state.sessions.map(x => x.id === updated.id ? updated : x));
},

    
async next(groupId) {
  const s = getActiveSession(state);
  if (!s) return;
  if (s.endedAtISO) { this.toast("Session ended"); return; }

  const updated: LiveSession = structuredClone(s);
  ensureGroupState(updated);
  const gs = updated.groupState[groupId];
  const item = currentItem(updated, gs);
  if (!item) return;

  if (item.type === "joiner") {
    gs.sequenceIndex = Math.min(updated.sequence.length - 1, gs.sequenceIndex + 1);
    gs.repIndex = 0;
  } else {
    if (gs.repIndex < item.reps - 1) gs.repIndex += 1;
    else { gs.sequenceIndex = Math.min(updated.sequence.length - 1, gs.sequenceIndex + 1); gs.repIndex = 0; }
  }

  gs.status = "idle";
  gs.work = { startMs: null, elapsedMs: 0, targetSeconds: undefined };
  gs.rest = { startMs: null, durationSeconds: 0 };
  gs.capturedAthleteIds = [];
  gs.lastCapture = undefined;

  dispatch({ type: "UPSERT_SESSION", session: updated });
  await saveSessions(state.sessions.map(x => x.id === updated.id ? updated : x));
},


    
async tapAthlete(groupId, athleteId) {
  const s = getActiveSession(state);
  if (!s) return;
  if (s.endedAtISO) { this.toast("Session ended"); return; }

  const updated: LiveSession = structuredClone(s);
  ensureGroupState(updated);
  const gs = updated.groupState[groupId];
  const item = currentItem(updated, gs);
  if (!item || item.type !== "block") return;
  if (gs.status !== "runningWork" || gs.work.startMs == null) { this.toast("Start rep first"); return; }
  if (gs.capturedAthleteIds.includes(athleteId)) return;

  const timeSeconds = Math.round(gs.work.elapsedMs / 100) / 10;
  const athlete = updated.roster.find(a => a.id === athleteId);
  if (!athlete) return;

  let matrix = updated.results.matrices.find(m => m.blockId === item.id);
  if (!matrix) {
    matrix = {
      blockId: item.id,
      blockLabel: item.label,
      distanceM: item.distanceM,
      reps: item.reps,
      data: { A: {}, B: {}, C: {}, D: {}, All: {} } as any,
    };
    updated.results.matrices.push(matrix);
  }
  if (!(matrix.data as any)[groupId]) (matrix.data as any)[groupId] = {};
  if (!(matrix.data as any)[groupId][athleteId]) (matrix.data as any)[groupId][athleteId] = Array.from({ length: item.reps }, () => null);

  (matrix.data as any)[groupId][athleteId][gs.repIndex] = { timeSeconds, capturedAtISO: nowISO() };
  gs.capturedAthleteIds.push(athleteId);
  gs.lastCapture = { athleteId, blockId: item.id, repIndex: gs.repIndex };

  updated.results.log.push({
    id: uid("r-"),
    sessionId: updated.id,
    athleteId,
    athleteName: `${athlete.firstName} ${athlete.lastName}`.trim(),
    groupId,
    sequenceIndex: gs.sequenceIndex,
    itemLabel: item.label,
    repIndex: gs.repIndex,
    timeSeconds,
    capturedAtISO: nowISO(),
  });

  if (item.mode === "manual") {
    const activeIds = updated.roster.filter(a => a.active && a.groupId === groupId).map(a => a.id);
    const done = activeIds.length > 0 && activeIds.every(id => gs.capturedAthleteIds.includes(id));
    if (done) {
      gs.status = "resting";
      gs.rest.startMs = Date.now();
      gs.rest.durationSeconds = item.restSeconds || 0;
    }
  }

  dispatch({ type: "UPSERT_SESSION", session: updated });
  await saveSessions(state.sessions.map(x => x.id === updated.id ? updated : x));
},


    async setSessionName(name) {
      const s = getActiveSession(state); if (!s) return;
      const updated = { ...s, name: name.trim() || s.name };
      dispatch({ type: "UPSERT_SESSION", session: updated });
      await saveSessions(state.sessions.map(x => x.id === updated.id ? updated : x));
    },

    async setSessionLocation(loc) {
      const s = getActiveSession(state); if (!s) return;
      const updated = { ...s, location: loc.trim() };
      dispatch({ type: "UPSERT_SESSION", session: updated });
      await saveSessions(state.sessions.map(x => x.id === updated.id ? updated : x));
    },

    async setAthleteActive(athleteId, active) {
      const s = getActiveSession(state); if (!s) return;
      const updated: LiveSession = structuredClone(s);
      updated.roster = updated.roster.map(a => a.id === athleteId ? { ...a, active } : a);
      ensureGroupState(updated);
      dispatch({ type: "UPSERT_SESSION", session: updated });
      await saveSessions(state.sessions.map(x => x.id === updated.id ? updated : x));
    },

    async setAthleteGroup(athleteId, groupId) {
      const s = getActiveSession(state); if (!s) return;
      const updated: LiveSession = structuredClone(s);
      updated.roster = updated.roster.map(a => a.id === athleteId ? { ...a, groupId } : a);
      ensureGroupState(updated);
      dispatch({ type: "UPSERT_SESSION", session: updated });
      await saveSessions(state.sessions.map(x => x.id === updated.id ? updated : x));
    },

    async setResultCell(blockId, groupId, athleteId, repIndex, timeSeconds) {
      const s = getActiveSession(state); if (!s) return;
      const updated: LiveSession = structuredClone(s);
      ensureGroupState(updated);

      let matrix = updated.results.matrices.find(m => m.blockId === blockId);
      if (!matrix) {
        const blk = updated.sequence.find(i => i.type === "block" && i.id === blockId) as any;
        matrix = {
          blockId,
          blockLabel: blk?.label ?? "Block",
          distanceM: blk?.distanceM ?? 0,
          reps: blk?.reps ?? (repIndex + 1),
          data: { A: {}, B: {}, C: {}, D: {}, All: {} } as any,
        };
        updated.results.matrices.push(matrix);
      }
      if (!(matrix.data as any)[groupId]) (matrix.data as any)[groupId] = {};
      if (!(matrix.data as any)[groupId][athleteId]) (matrix.data as any)[groupId][athleteId] = Array.from({ length: matrix.reps }, () => null);
      const arr = (matrix.data as any)[groupId][athleteId];
      while (arr.length <= repIndex) arr.push(null);

      if (timeSeconds == null) {
        arr[repIndex] = null;
      } else {
        arr[repIndex] = { timeSeconds, capturedAtISO: nowISO(), edited: true };
      }

      dispatch({ type: "UPSERT_SESSION", session: updated });
      await saveSessions(state.sessions.map(x => x.id === updated.id ? updated : x));
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [state]);

  React.useEffect(() => { api.init(); }, []);

  const value = React.useMemo(() => ({ state, dispatch, api }), [state, api]);
  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
}

export function useStore(): Store {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("StoreProvider missing");
  return ctx;
}
