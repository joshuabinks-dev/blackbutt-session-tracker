import React from "react";
import { useStore } from "../state/store";

export function BuilderScreen() {
  const { state } = useStore();
  return (
    <div className="card">
      <h2>Builder</h2>
      <div className="muted small">Phase 2 will implement Scratch-like drag/drop for Blocks + Joiners + Template Sessions.</div>
      <div className="hr" />
      {state.templates.map(t => (
        <div key={t.id} className="item">
          <div className="name">{t.name}</div>
          <div className="meta">{t.description}</div>
        </div>
      ))}
    </div>
  );
}
