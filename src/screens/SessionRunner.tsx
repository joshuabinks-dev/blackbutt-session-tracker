import React from "react";
import { useStore } from "../state/store";
import type { GroupId } from "../models/types";
import { GroupCard } from "../components/GroupCard";

const locations = ["Beaton Park","Blackbutt","Myimbarr","Reddall Reserve","Shellharbour SC","West Dapto KJs"] as const;

export function SessionScreen() {
  const { state, api } = useStore();
  const sessionId = state.activeSessionId ?? state.viewSessionId;
  const session = sessionId ? state.sessions.find(s => s.id === sessionId) : null;
  const isReadOnly = !!session?.endedAtISO || !state.activeSessionId;
  const [locSelect, setLocSelect] = React.useState<string>("");
  const [customLoc, setCustomLoc] = React.useState<string>("");

  React.useEffect(() => {
    if (!session) return;
    const preset = locations.includes(session.location as any) ? session.location : "";
    if (preset) {
      setLocSelect(preset);
      setCustomLoc("");
    } else if (session.location) {
      setLocSelect("__custom__");
      setCustomLoc(session.location);
    } else {
      setLocSelect("");
      setCustomLoc("");
    }
  }, [session?.id, session?.location]);

  if (!session) {
    return (
      <div className="card">
        <h2>Session</h2>
        <div className="muted">No session selected. Start one from Home → Templates, or View a recent session from Home.</div>
      </div>
    );
  }

  const groupsUsed = computeGroupsUsed(session);

  return (
    <div className="grid two">
      <div className="card">
        <div className="hrow">
          <h2>Session setup</h2>
          <div className="row">
            <button className={"btn " + (session.allInMode ? "primary" : "")} disabled={isReadOnly} onClick={() => api.toggleAllIn()}>
              All-in: {session.allInMode ? "ON" : "OFF"}
            </button>
            <button className="btn" disabled={isReadOnly} onClick={() => api.toggleFastCaptureMode()}>
              Fast capture: {session.fastCaptureMode ? "ON" : "OFF"}
            </button>
            <button className="btn danger" disabled={isReadOnly} onClick={() => api.endSession()}>End</button>
          </div>
        </div>

        <div className="hr" />

        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <label>Session name</label>
            <input defaultValue={session.name} disabled={!!session.endedAtISO} onChange={(e) => api.setSessionName(e.target.value)} />
          </div>
          <div>
            <label>Location</label>
            <select disabled={isReadOnly || !!session.endedAtISO} value={locSelect} onChange={(e) => { const v = e.target.value; setLocSelect(v); if (v !== "__custom__") { api.setSessionLocation(v); } }}>
              <option value="">— Select —</option>
              {locations.slice().sort((a,b)=>a.localeCompare(b)).map(l => <option key={l} value={l}>{l}</option>)}
              <option value="__custom__">Custom…</option>
            </select>
            {locSelect === "__custom__" && (
              <div style={{ marginTop: 8 }}>
                <input disabled={isReadOnly || !!session.endedAtISO} value={customLoc} placeholder="Enter custom location" onChange={(e)=>{ setCustomLoc(e.target.value); api.setSessionLocation(e.target.value); }} />
              </div>
            )}
          </div>
        </div>

        <div className="hr" />

        <h3>Athletes</h3>
        <div className="muted small">Deactivate/activate athletes anytime. Groups used are derived from active roster.</div>
        <div style={{ height: 10 }} />
        <div className="item">
          <div className="row">
            <span className="pill">{session.roster.filter(a=>a.active).length} active</span>
            <span className="pill">{groupsUsed.join(", ")} groups</span>
          </div>
          <div className="hr" />
          <div className="athGrid">
            {session.roster.map(a => (
              <div key={a.id} className="athBtn" style={{ cursor:"default" }}>
                <div style={{ display:"flex", justifyContent:"space-between", gap:8 }}>
                  <div>
                    <div style={{ fontWeight: 900 }}>{a.lastName}, {a.firstName}</div>
                    <div className="small muted">Group</div>
                  </div>
                  <div style={{ minWidth: 110 }}>
                    <select value={a.groupId} onChange={(e)=>api.setAthleteGroup(a.id, e.target.value as GroupId)}>
                      {(["A","B","C","D","All"] as GroupId[]).map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ height: 8 }} />
                <div className="row">
                  <button className={"btn " + (a.active ? "primary" : "")} onClick={()=>api.setAthleteActive(a.id, !a.active)}>
                    {a.active ? "Active" : "Inactive"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="groupCards">
        {groupsUsed.map(g => <GroupCard key={g} session={session} groupId={g} nowMs={state.nowMs} />)}
      </div>
    </div>
  );
}

function computeGroupsUsed(session: { allInMode: boolean; roster: { groupId: GroupId; active: boolean }[] }): GroupId[] {
  if (session.allInMode) return ["All"];
  const set = new Set<GroupId>();
  for (const a of session.roster) if (a.active) set.add(a.groupId);
  const order: GroupId[] = ["A","B","C","D"];
  const used = order.filter(g => set.has(g));
  return used.length ? used : ["A"];
}
