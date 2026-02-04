import React from "react";
import { useStore } from "../state/store";

export function SettingsScreen() {
  const { state } = useStore();
  return (
    <div className="card">
      <h2>Settings</h2>
      <div className="muted small">Phase 1 minimal settings. Data stored locally (IndexedDB).</div>
      <div className="hr" />
      <div className="muted small">Sessions: {state.sessions.length}</div>
    </div>
  );
}
