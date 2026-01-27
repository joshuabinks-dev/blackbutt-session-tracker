import React from "react";
import type { GroupId, LiveSession, SequenceItem } from "../models/types";
import { formatMsTenths, formatRestCountdown } from "../utils/time";
import { useStore } from "../state/store";

function title(g: GroupId) { return g === "All" ? "All-in" : `Group ${g}`; }

export function GroupCard(props: { session: LiveSession; groupId: GroupId; nowMs: number }) {
  const { api } = useStore();
  const { session, groupId, nowMs } = props;
  const gs = session.groupState[groupId];
  const item: SequenceItem | null = session.sequence[gs.sequenceIndex] || null;

  const isJoiner = item?.type === "joiner";
  const isBlock = item?.type === "block";

  const resting = gs.status === "resting" && gs.rest.startMs != null;
  const restInfo = resting ? formatRestCountdown(gs.rest.startMs!, gs.rest.durationSeconds, nowMs) : null;

  const canStart = !!item && (gs.status === "idle" || gs.status === "resting");

  const roster = session.roster.filter(a => a.active && a.groupId === groupId);
  const captured = gs.capturedAthleteIds.length;

  return (
    <div className="card">
      <div className="hrow">
        <h3>{title(groupId)}</h3>
        <div className="row">
          {isBlock && <span className="pill">Rep {gs.repIndex + 1}/{item.reps}</span>}
          <span className="pill">{isJoiner ? "Joiner" : isBlock ? item.mode.toUpperCase() : "—"}</span>
        </div>
      </div>

      <div className="hr" />

      <div className="row">
        <span className="pill">Step {gs.sequenceIndex + 1}/{session.sequence.length}</span>
        <span className="pill">{item ? item.label : "Complete"}</span>
        {isJoiner && item.joinerType === "rest" && <span className="pill">Rest {item.durationSeconds ?? 0}s</span>}
      </div>

      <div style={{ height: 10 }} />

      <div className="timerBox">
        <div>
          <div className="timerNum">{formatMsTenths(gs.work.elapsedMs)}</div>
          {restInfo && (
            <div className={restInfo.negative ? "badgeDanger" : "badgeOk"}>Rest: {restInfo.label} {restInfo.negative ? "(over)" : ""}</div>
          )}
          {!restInfo && gs.status === "idle" && <div className="muted small">Ready</div>}
        </div>
        <div className="row" style={{ justifyContent:"flex-end" }}>
          <button className="btn primary" disabled={!canStart} onClick={() => api.startWork(groupId)}>
            {isJoiner ? "Start / Resume" : "Start rep"}
          </button>
          <button className="btn" disabled={!item?.skippable} onClick={() => api.skipItem(groupId)}>Skip</button>
          <button className="btn" disabled={!item} onClick={() => api.next(groupId)}>Next</button>
        </div>
      </div>

      {isBlock && (
        <>
          <div className="hr" />
          <div className="row">
            <span className="pill">{roster.length} athletes</span>
            <span className="pill">{captured} captured</span>
            {gs.status !== "runningWork" && <span className="pill muted">Start rep to capture</span>}
          </div>
          <div style={{ height: 10 }} />
          <div className="athGrid">
            {roster.map(a => {
              const done = gs.capturedAthleteIds.includes(a.id);
              return (
                <button
                  key={a.id}
                  className={"athBtn " + (done ? "done" : "")}
                  onClick={() => api.tapAthlete(groupId, a.id)}
                  disabled={gs.status !== "runningWork"}
                >
                  {a.name}
                  {done ? <div className="small badgeOk">Captured</div> : <div className="small muted">Tap when finished</div>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
