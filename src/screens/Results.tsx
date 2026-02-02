import React from "react";
import { useStore } from "../state/store";
import { copyText } from "../utils/clipboard";
import { shareElementAsPng } from "../utils/shareImage";
import type { GroupId, BlockResultMatrix, AthleteSnapshot } from "../models/types";

function fmtTime(sec: number | null): string {
  if (sec == null) return "—";
  const mins = Math.floor(sec / 60);
  const rem = sec - mins * 60;
  const s = rem.toFixed(1).padStart(4, "0");
  return `${mins}:${s}`;
}

function parseTime(input: string): number | null {
  const t = input.trim();
  if (!t) return null;
  const m = t.match(/^([0-9]+):([0-5]?[0-9](?:\.[0-9])?)$/);
  if (m) return Math.round((Number(m[1]) * 60 + Number(m[2])) * 10) / 10;
  const s = Number(t);
  return Number.isFinite(s) ? Math.round(s * 10) / 10 : null;
}

function fullName(a: AthleteSnapshot): string {
  const ln = (a.lastName || "").trim();
  const fn = (a.firstName || "").trim();
  return ln ? `${ln}, ${fn}`.trim() : fn;
}

function ensureMatricesForBlocks(session: any): BlockResultMatrix[] {
  const mats: BlockResultMatrix[] = session.results?.matrices ?? [];
  for (const it of session.sequence) {
    if (it.type !== "block") continue;
    if (!mats.find(m => m.blockId === it.id)) {
      mats.push({ blockId: it.id, blockLabel: it.label, distanceM: it.distanceM, reps: it.reps, data: { A:{},B:{},C:{},D:{},All:{} } as any });
    }
  }
  const byId = new Map(mats.map(m => [m.blockId, m]));
  return session.sequence.filter((it: any) => it.type === "block").map((it: any) => byId.get(it.id)!).filter(Boolean);
}

export function ResultsScreen() {
  const { state, api } = useStore();
  const session = state.activeSessionId ? state.sessions.find(s => s.id === state.activeSessionId) : null;
  const [editMode, setEditMode] = React.useState(false);
  const shareRef = React.useRef<HTMLDivElement | null>(null);

  if (!session) {
    return <div className="panel"><h2>Results</h2><p className="muted">Select a session from Home.</p></div>;
  }

  const groupsUsed: GroupId[] = session.allInMode ? ["All"] : (["A","B","C","D"] as GroupId[]).filter(g => session.roster.some((a: AthleteSnapshot) => a.active && a.groupId === g));
  const matrices = ensureMatricesForBlocks(session);

  const buildTSV = () => {
    const lines: string[] = [];
    for (const m of matrices) {
      lines.push(m.blockLabel);
      lines.push(["Athlete", ...Array.from({ length: m.reps }, (_, i) => `${m.distanceM}_${i+1}`)].join("\t"));
      for (const gid of groupsUsed) {
        const athletes = session.roster.filter((a: AthleteSnapshot) => a.active && a.groupId === gid)
          .slice().sort((a: AthleteSnapshot, b: AthleteSnapshot) => (a.lastName||"").localeCompare(b.lastName||"") || (a.firstName||"").localeCompare(b.firstName||""));
        for (const a of athletes) {
          const arr = (m.data as any)?.[gid]?.[a.id] ?? Array.from({ length: m.reps }, () => null);
          lines.push([fullName(a), ...Array.from({ length: m.reps }, (_, ri) => arr[ri]?.timeSeconds != null ? fmtTime(arr[ri].timeSeconds) : "—")].join("\t"));
        }
        lines.push("");
      }
      lines.push("");
    }
    return lines.join("\n").trim();
  };

  return (
    <div className="panel">
      <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <h2>Results</h2>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={() => copyText(buildTSV()).then(()=>api.toast("Copied TSV"))}>Copy TSV</button>
          <button className="btn" onClick={() => shareRef.current && shareElementAsPng(shareRef.current, { title: session.name || "Results" })
            .then(r => api.toast(r.message)).catch(()=>api.toast("Share failed"))}>Share image</button>
          <button className={"btn " + (editMode ? "btnOn" : "")} onClick={() => setEditMode(v => !v)}>{editMode ? "Exit edit" : "Edit"}</button>
        </div>
      </div>

      <div ref={shareRef} className="resultsShare">
        <div className="small muted" style={{ marginBottom: 8 }}>
          {session.name} • {session.location || "Location not set"} • {new Date(session.startedAtISO).toLocaleDateString()} {session.endedAtISO ? " • Ended" : ""}
        </div>

        {matrices.map((m) => (
          <div key={m.blockId} style={{ marginBottom: 18 }}>
            <h3 style={{ marginBottom: 6 }}>{m.blockLabel}</h3>
            {groupsUsed.map((gid) => {
              const athletes = session.roster.filter((a: AthleteSnapshot) => a.active && a.groupId === gid)
                .slice().sort((a: AthleteSnapshot, b: AthleteSnapshot) => (a.lastName||"").localeCompare(b.lastName||"") || (a.firstName||"").localeCompare(b.firstName||""));
              if (!athletes.length) return null;
              return (
                <div key={gid} style={{ marginBottom: 12 }}>
                  <div className="small muted" style={{ marginBottom: 4 }}>Group {gid}</div>
                  <div className="tableWrap">
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>Athlete</th>
                          {Array.from({ length: m.reps }, (_, i) => <th key={i}>{m.distanceM}_{i+1}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {athletes.map((a) => {
                          const arr = (m.data as any)?.[gid]?.[a.id] ?? Array.from({ length: m.reps }, () => null);
                          return (
                            <tr key={a.id}>
                              <td className="sticky">{fullName(a)}</td>
                              {Array.from({ length: m.reps }, (_, repIndex) => {
                                const cell = arr[repIndex];
                                return (
                                  <td key={repIndex}>
                                    {editMode ? (
                                      <input className="cellInput"
                                        defaultValue={cell?.timeSeconds != null ? fmtTime(cell.timeSeconds) : ""}
                                        placeholder="—"
                                        onBlur={(e) => api.setResultCell(m.blockId, gid, a.id, repIndex, parseTime(e.target.value))}
                                      />
                                    ) : (
                                      cell?.timeSeconds != null ? fmtTime(cell.timeSeconds) : "—"
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
