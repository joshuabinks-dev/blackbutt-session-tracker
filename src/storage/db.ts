import { get, set, del } from "idb-keyval";
import type { Athlete, LiveSession, TemplateSession } from "../models/types";

const KEY = {
  athletes: "bst:athletes",
  templates: "bst:templates",
  sessions: "bst:sessions",
  activeSessionId: "bst:activeSessionId",
} as const;

export async function loadAthletes(): Promise<Athlete[] | null> { return (await get(KEY.athletes)) ?? null; }
export async function saveAthletes(a: Athlete[]): Promise<void> { await set(KEY.athletes, a); }

export async function loadTemplates(): Promise<TemplateSession[] | null> { return (await get(KEY.templates)) ?? null; }
export async function saveTemplates(t: TemplateSession[]): Promise<void> { await set(KEY.templates, t); }

export async function loadSessions(): Promise<LiveSession[] | null> { return (await get(KEY.sessions)) ?? null; }
export async function saveSessions(s: LiveSession[]): Promise<void> { await set(KEY.sessions, s); }

export async function loadActiveSessionId(): Promise<string | null> { return (await get(KEY.activeSessionId)) ?? null; }
export async function saveActiveSessionId(id: string | null): Promise<void> {
  if (id === null) { await del(KEY.activeSessionId); return; }
  await set(KEY.activeSessionId, id);
}
