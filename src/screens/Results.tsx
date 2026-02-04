import React from "react";
import { useStore } from "../state/store";
import { copyText } from "../utils/clipboard";
import { shareElementAsPng } from "../utils/shareImage";
import type { AthleteSnapshot, GroupId, SequenceItem, BlockResultMatrix } from "../models/types";

function fmtTime(sec: number | null): string {
  if (sec == null) return "";
  const mins = Math.floor(sec / 60);
  const rem = sec - mins * 60;
  const s = rem.toFixed(1).padStart(4, "0");
  return `${mins}:${s}`;
}

function parseTime(input: string): { ok: true; value: number | null } | { ok: false; message: string } {
  const t = input.trim();
  if (!t) return { ok: true, value: null };
  const m = t.match(/^([0-9]+):([0-5]?[0-9](?:\.[0-9])?)$/);
  if (m) return { ok: true, value: Math.round((Number(m[1]) * 60 + Number(m[2])) * 10) / 10 };
  const s = Number(t);
  if (Number.isFinite(s)) return { ok: true, value: Math.round(s * 10) / 10 };
  return { ok: false, message: "Invalid time. Use m:ss.t (e.g. 2:34.5) or seconds (e.g. 94.5)." };
}

function fullName(a: AthleteSnapshot): string {
  const ln = (a.lastName || "").trim();
  const fn = (a.firstName || "").trim();
  return ln ? `${ln}, ${fn}`.trim() : fn;
}

type Column = { key: string; blockId: string; repIndex: number; label: string; distanceM: number; blockLabel: string };

function ensureMatricesForBlocks(session: any): BlockResultMatrix[] {
  const mats: BlockResultMatrix[] = session.results?.matrices ?? [];
  for (const it of session.sequence as SequenceItem[]) {
    if (it.type !== "block") continue;
    if (!mats.find(m => m.blockId === it.id)) {
      mats.push({ blockId: it.id, blockLabel: it.label, distanceM: it.distanceM, reps: it.reps, data: { A:{},B:{},C:{},D:{},All:{} } as any });
    }
  }
  return mats;
}

export function ResultsScreen() {
  const { state, api } = useStore();
  const sessionId = state.activeSessionId ?? state.viewSessionId;
  const session = sessionId ? state.sessions.find(s => s.id === sessionId) : null;

  const isReadOnly = !session || !!session.endedAtISO || !state.activeSessionId;
  const [editMode, setEditMode] = React.useState(false);
  const shareRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (isReadOnly) setEditMode(false);
  }, [isReadOnly, session?.id]);

  if (!session) {
    return <div className="panel"><h2>Results</h2><p className="muted">Select a session from Home.</p></div>;
  }

  const matrices = ensureMatricesForBlocks(session);
  const matrixById = new Map(matrices.map(m => [m.blockId, m] as const));

  const columns: Column[] = [];
  for (const it of session.sequence as SequenceItem[]) {
    if (it.type !== "block") continue;
    for (let r = 0; r < it.reps; r++) {
      columns.push({
        key: `${it.id}__${r}`,
        blockId: it.id,
        repIndex: r,
        distanceM: it.distanceM,
        blockLabel: it.label,
        label: `${it.distanceM}m R${r + 1}`,
      });
    }
  }

  const athletes = session.roster
    .filter((a: AthleteSnapshot) => a.active)
    .slice()
    .sort((a: AthleteSnapshot, b: AthleteSnapshot) => fullName(a).localeCompare(fullName(b)));

  const cellFor = (a: AthleteSnapshot, col: Column) => {
    const gid: GroupId = (a.groupId as any) as GroupId;
    const m = matrixById.get(col.blockId);
    const groupData = (m?.data as any)?.[gid] ?? {};
    const arr = groupData[a.id] ?? [];
    return arr[col.repIndex] ?? null;
  };

  const buildTSV = () => {
    const header = ["Athlete", "Group", ...columns.map(c => `${c.blockLabel} - ${c.label}`)];
    const lines = [header.join("\t")];
    for (const a of athletes) {
      const row: string[] = [fullName(a), String(a.groupId)];
      for (const c of columns) {
        const cell = cellFor(a, c);
        row.push(cell?.timeSeconds != null ? fmtTime(cell.timeSeconds) : "");
      }
      lines.push(row.join("\t"));
    }
    return lines.join("\n");
  };

  const onCopyTable = async () => {
    const ok = await copyText(buildTSV());
    api.toast(ok ? "Copied table (TSV)" : "Copy failed");
  };

  const onShareImage = async () => {
    if (!shareRef.current) return;
    const res = await shareElementAsPng(shareRef.current, { filename: `${session.name.replace(/\s+/g, "_")}_results.png` });
    api.toast(res.message);
  };

  return (
    <div className="panel">
      <div className="hrow">
        <h2>Results</h2>
        <div className="row">
          <button className="btn" onClick={onCopyTable}>Copy table (TSV)</button>
          <button className="btn" onClick={onShareImage}>Share image</button>
          <button className={"btn " + (editMode ? "primary" : "")} disabled={isReadOnly} onClick={() => setEditMode(!editMode)}>
            Edit: {editMode ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      <div className="muted small" style={{ marginTop: 6 }}>
        {session.name} · {session.location || "—"} · {new Date(session.startedAtISO).toLocaleString()}
        {session.endedAtISO ? ` · Ended ${new Date(session.endedAtISO).toLocaleString()}` : ""}
      </div>

      <div style={{ height: 10 }} />

      {/* Visible scroll wrapper */}
      <div className="card" style={{ overflowX: "auto" }}>
        {/* Capture element */}
        <div ref={shareRef} style={{ overflow: "visible" }}>
          <table className="tbl" style={{ width: "max-content", minWidth: "100%" }}>
            <thead>
              <tr>
                <th style={{ position: "sticky", left: 0, background: "var(--card)", zIndex: 2 }}>Athlete</th>
                <th style={{ position: "sticky", left: 160, background: "var(--card)", zIndex: 2 }}>Group</th>
                {columns.map(c => (
                  <th key={c.key} title={c.blockLabel}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {athletes.map(a => (
                <tr key={a.id}>
                  <td style={{ position: "sticky", left: 0, background: "var(--card)", zIndex: 1, width: 160, maxWidth: 160, whiteSpace: "normal" }}>
                    {fullName(a)}
                  </td>
                  <td style={{ position: "sticky", left: 160, background: "var(--card)", zIndex: 1 }}>{a.groupId}</td>
                  {columns.map(c => {
                    const cell = cellFor(a, c);
                    const value = cell?.timeSeconds != null ? fmtTime(cell.timeSeconds) : "";
                    return (
                      <td key={c.key + a.id}>
                        {editMode ? (
                          <input
                            className="cellInput"
                            defaultValue={value}
                            placeholder="—"
                            onBlur={(e) => {
                              const raw = e.target.value;
                              const parsed = parseTime(raw);
                              if (!parsed.ok) {
                                api.toast(parsed.message);
                                e.target.value = value;
                                return;
                              }
                              api.setResultCell(c.blockId, a.groupId as any, a.id, c.repIndex, parsed.value);
                            }}
                          />
                        ) : (
                          value || "—"
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="muted small" style={{ marginTop: 10 }}>
        Notes: Copy table exports tab-separated values (TSV) suitable for Excel/Sheets. Share image captures the full table width (all reps).
      </div>
    </div>
  );
}
