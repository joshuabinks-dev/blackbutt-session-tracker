import React from "react";
import { useStore } from "../state/store";
import { copyText } from "../utils/clipboard";
import { shareElementAsPng } from "../utils/shareImage";
import type { GroupId, ResultEntry } from "../models/types";

function buildTSV(results: ResultEntry[]): string {
  const header = ["Athlete","Group","Item","Rep","Time"].join("\t");
  const lines = results.map(r => [r.athleteName, r.groupId, r.itemLabel, String(r.repIndex+1), r.timeSeconds.toFixed(1)].join("\t"));
  return [header, ...lines].join("\n");
}

export function ResultsScreen() {
  const { state, api } = useStore();
  const session = state.activeSessionId ? state.sessions.find(s => s.id === state.activeSessionId) : null;
  const mostRecent = [...state.sessions].sort((a,b)=> (b.startedAtISO||"").localeCompare(a.startedAtISO||""))[0] || null;
  const s = session || mostRecent;
  const ref = React.useRef<HTMLDivElement>(null);

  if (!s) return <div className="card"><h2>Results</h2><div className="muted">No sessions yet.</div></div>;

  const grouped = groupByBlockThenGroup(s.results);

  return (
    <div className="grid two">
      <div className="card">
        <div className="hrow">
          <h2>Results</h2>
          <span className="pill">{s.results.length} entries</span>
        </div>
        <div className="muted small" style={{ marginTop: 6 }}>
          Share as image for Messenger/Facebook, or copy TSV for Excel.
        </div>
        <div className="hr" />
        <div className="row">
          <button className="btn primary" onClick={async () => {
            if (!ref.current) return;
            const out = await shareElementAsPng(ref.current, "blackbutt-results.png");
            api.toast(out.ok ? out.message : out.message);
          }}>Share image</button>
          <button className="btn" onClick={async () => {
            const ok = await copyText(buildTSV(s.results));
            api.toast(ok ? "Copied" : "Copy blocked");
          }}>Copy TSV</button>
        </div>

        <div className="hr" />

        <div ref={ref} style={{ padding: 12, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, background:"rgba(17,26,47,0.92)" }}>
          <div className="row" style={{ justifyContent:"space-between" }}>
            <div>
              <div style={{ fontWeight: 1000, fontSize: 16 }}>{s.name}</div>
              <div className="muted small">{s.location || "—"} · {new Date(s.startedAtISO).toLocaleString()}</div>
            </div>
            <img src="/logo.svg" alt="logo" style={{ width: 42, height: 42 }} />
          </div>
          <div className="hr" />

          {grouped.map(section => (
            <div key={section.key} style={{ marginBottom: 14 }}>
              <div className="row" style={{ justifyContent:"space-between" }}>
                <span className="pill">{section.blockLabel}</span>
                <span className="pill">Group {section.groupId}</span>
              </div>
              <div style={{ height: 8 }} />
              <table className="table">
                <thead>
                  <tr>
                    <th>Athlete</th>
                    <th>Rep</th>
                    <th>Time (s)</th>
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map(r => (
                    <tr key={r.id}>
                      <td>{r.athleteName}</td>
                      <td>{r.repIndex + 1}</td>
                      <td>{r.timeSeconds.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Phase 1 Notes</h3>
        <div className="muted small">
          Builder (Scratch-like drag/drop) comes in Phase 2. This build prioritises correctness of timing + group independence.
        </div>
      </div>
    </div>
  );
}

function groupByBlockThenGroup(results: ResultEntry[]): { key: string; blockLabel: string; groupId: GroupId; rows: ResultEntry[] }[] {
  const map = new Map<string, ResultEntry[]>();
  for (const r of results) {
    const key = `${r.itemLabel}||${r.groupId}`;
    const arr = map.get(key) || [];
    arr.push(r);
    map.set(key, arr);
  }
  const out = [...map.entries()].map(([key, rows]) => {
    rows.sort((a,b) => a.repIndex - b.repIndex || a.athleteName.localeCompare(b.athleteName));
    const [blockLabel, groupId] = key.split("||") as [string, GroupId];
    return { key, blockLabel, groupId, rows };
  });
  out.sort((a,b)=> a.blockLabel.localeCompare(b.blockLabel) || a.groupId.localeCompare(b.groupId));
  return out;
}
