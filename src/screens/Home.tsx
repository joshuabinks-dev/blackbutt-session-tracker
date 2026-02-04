import React from "react";
import { useStore } from "../state/store";

export function HomeScreen() {
  const { state, api } = useStore();
  const active = state.activeSessionId ? state.sessions.find(s => s.id === state.activeSessionId && !s.endedAtISO) : null;
  const recent = [...state.sessions].sort((a,b)=> (b.startedAtISO||"").localeCompare(a.startedAtISO||"")).slice(0, 12);

  return (
    <div className="grid two">
      <div className="card">
        <div className="hrow">
          <h2>Templates</h2>
          <span className="pill">{state.templates.length} templates</span>
        </div>
        <div className="muted small" style={{ marginTop: 6 }}>
          Phase 1 ships the Session Runner with a seeded template. Builder arrives next.
        </div>
        <div className="hr" />
        {state.templates.map(t => (
          <div className="item" key={t.id}>
            <div className="name">{t.name}</div>
            <div className="meta">{t.description}</div>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn primary" onClick={() => api.startSessionFromTemplate(t.id)}>Start</button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="hrow">
          <h2>Today</h2>
          {active ? <span className="pill">Active</span> : <span className="pill">No active</span>}
        </div>
        <div className="hr" />

        {active ? (
          <div className="item">
            <div className="name">{active.name}</div>
            <div className="meta">{active.location || "—"} · started {new Date(active.startedAtISO).toLocaleString()}</div>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn primary" onClick={() => api.resumeSession(active.id)}>Resume</button>
              <button className="btn danger" onClick={() => api.endSession()}>End session</button>
            </div>
          </div>
        ) : (
          <div className="muted small">Start a session from Templates.</div>
        )}

        <div className="hr" />
        <h3>Recent sessions</h3>
        {recent.length === 0 ? <div className="muted small">None yet.</div> : recent.map(s => (
          <div className="item" key={s.id}>
            <div className="name">{s.name}</div>
            <div className="meta">{s.location || "—"} · {new Date(s.startedAtISO).toLocaleString()}</div>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn" onClick={() => api.viewSession(s.id)}>View</button>
              <button className="btn danger" onClick={() => api.deleteSession(s.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
