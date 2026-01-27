/* Blackbutt Session Tracker (single-file app.js)
   v0.1 scaffold: presets, athletes, groups, manual rep start, per-group timers, tap-to-record times,
   results table, share image, TSV export, offline via IndexedDB.
*/

// ---------- Tiny IndexedDB helper ----------
const DB_NAME = "br_session_tracker_v1";
const DB_STORE = "kv";

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const store = tx.objectStore(DB_STORE);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbSet(key, val) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    const store = tx.objectStore(DB_STORE);
    const req = store.put(val, key);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

// ---------- Utilities ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const uid = () => Math.random().toString(36).slice(2, 10);

function pad2(n){ return String(n).padStart(2, "0"); }
function secToTime(s){
  if (s == null || Number.isNaN(s)) return "";
  s = Math.max(0, Math.round(s));
  const m = Math.floor(s/60);
  const r = s % 60;
  return `${m}:${pad2(r)}`;
}
function msToTimeTenths(ms){
  if (ms == null || Number.isNaN(ms)) return "";
  ms = Math.max(0, ms);
  const total = Math.round(ms/100)/10; // tenths
  const m = Math.floor(total/60);
  const s = Math.floor(total % 60);
  const t = Math.round((total - Math.floor(total))*10);
  return `${m}:${pad2(s)}.${t}`;
}
function timeToSec(t){
  // accept mm:ss or ss
  const v = (t||"").trim();
  if (!v) return null;
  if (/^\d+$/.test(v)) return parseInt(v, 10);
  const m = v.match(/^(\d+):(\d{1,2})$/);
  if (!m) return null;
  return parseInt(m[1],10)*60 + parseInt(m[2],10);
}
function toast(msg){
  const el = $("#toast");
  el.textContent = msg;
  el.style.display = "block";
  clearTimeout(window.__toastT);
  window.__toastT = setTimeout(()=>{ el.style.display="none"; }, 1400);
}
function nowISO(){
  const d = new Date();
  return d.toISOString();
}
function fmtLocal(d){
  const dd = (d instanceof Date) ? d : new Date(d);
  return dd.toLocaleString(undefined, { weekday:"short", year:"numeric", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
}

// ---------- App State ----------
const DEFAULT_STATE = {
  athletes: [
    {id: uid(), first:"Josh", last:"Binks", group:"A", active:true},
    {id: uid(), first:"India", last:"Binks", group:"A", active:true},
    {id: uid(), first:"Ruby", last:"McPhillips", group:"A", active:true},
    {id: uid(), first:"Fin", last:"McPhillips", group:"A", active:true},
    {id: uid(), first:"Cate", last:"Giason", group:"A", active:true},
    {id: uid(), first:"Russell", last:"Taylor", group:"A", active:true},
    {id: uid(), first:"Gary", last:"Baker", group:"A", active:true},
    {id: uid(), first:"Amelia", last:"Harkness", group:"A", active:true},
    {id: uid(), first:"Kayden", last:"Elliot", group:"A", active:true},
    {id: uid(), first:"Macleay", last:"Kesby", group:"A", active:true},
    {id: uid(), first:"Jasmine", last:"Matthews", group:"A", active:true},
    {id: uid(), first:"Peter", last:"Maskiell", group:"A", active:true},
    {id: uid(), first:"Emily", last:"McLaren", group:"A", active:true},
    {id: uid(), first:"Hamish", last:"McLaren", group:"A", active:true},
    {id: uid(), first:"Sky", last:"Bell", group:"A", active:true},
    {id: uid(), first:"Alexis", last:"Bell", group:"A", active:true},
    {id: uid(), first:"Poppy", last:"Taylor", group:"A", active:true},
    {id: uid(), first:"Ryan", last:"Martin", group:"A", active:true},
    {id: uid(), first:"Elias", last:"Niyonkuru", group:"A", active:true},
    {id: uid(), first:"Pat", last:"Carolan", group:"A", active:true},
    {id: uid(), first:"Will", last:"Mason", group:"A", active:true},
    {id: uid(), first:"Harry", last:"Fraser", group:"A", active:true},
    {id: uid(), first:"Moses", last:"Fowler", group:"A", active:true},
    {id: uid(), first:"Jed", last:"Fowler", group:"A", active:true},
    {id: uid(), first:"Tom", last:"March", group:"A", active:true},
    {id: uid(), first:"Luke", last:"Jones", group:"A", active:true},
    {id: uid(), first:"Ally", last:"Rogers", group:"A", active:true},
    {id: uid(), first:"Ash", last:"Gard", group:"A", active:true},
    {id: uid(), first:"Bianca", last:"De Swardt", group:"A", active:true},
    {id: uid(), first:"Alex", last:"Torta", group:"A", active:true}
  ],
  presets: [
    {
      id: "preset_track",
      name: "Track Intervals",
      location: "Blackbutt Reserve",
      blocks: [
        { id: uid(), label: "800s", distanceM: 800, reps: 8, mode: "manual", cycleSec: 300, restStart: "last", nextStart: "cycle", groups: ["A","B"], notes: "" },
        { id: uid(), label: "200s", distanceM: 200, reps: 4, mode: "manual", cycleSec: 180, restStart: "last", nextStart: "cycle", groups: ["A","B"], notes: "" },
      ]
    }
  ],
  sessions: [
    // {id, name, location, startedAt, endedAt, presetId?, blocks, athletesSnapshot, results, live}
  ],
  activeSessionId: null,
  settings: {
    groups: ["A","B"],
    locations: ["Beaton Park","Blackbutt","Myimbarr","Reddall Reserve","Shellharbour SC","West Dapto KJs"],
    beep: true,
    vibrate: true
  }
};

let state = structuredClone(DEFAULT_STATE);
let activeTab = "home";
let installPrompt = null;

// ---------- Persistence ----------
async function loadState(){
  const saved = await idbGet("state");
  if (saved && typeof saved === "object") state = saved;
}
async function saveState(){
  await idbSet("state", state);
}
function getActiveSession(){
  return state.sessions.find(s => s.id === state.activeSessionId) || null;
}

function getSessionGroups(session){
  const allIn = !!session?.live?.allIn;
  return allIn ? ["All"] : (state.settings.groups || ["A","B"]);
}

// ---------- Timers ----------
function ensureLive(session){
  if (!session.live){
    session.live = {
      blockIndex: 0,
      repIndexByBlock: {}, // blockId -> current rep (0-based)
      groupClocks: {}, // group -> {running, startMs, elapsedMs, lastLapMs}
      repCapture: {}, // group -> {capturedAthleteIds:[], repStartISO, repEndISO, elapsedSec}
      restByGroup: {}, // group -> {resting, startMs, restSec}
      allIn: false
    };
  }
  const groups = getSessionGroups(session);
  for (const g of groups){
    if (!session.live.groupClocks[g]) session.live.groupClocks[g] = { running:false, startMs:0, elapsedMs:0 };
    if (!session.live.repCapture[g]) session.live.repCapture[g] = { capturedAthleteIds:[], repStartISO:null };
    if (!session.live.restByGroup[g]) session.live.restByGroup[g] = { resting:false, startMs:0, restSec:0 };
  }
  const b = session.blocks[session.live.blockIndex];
  if (b && session.live.repIndexByBlock[b.id] == null) session.live.repIndexByBlock[b.id] = 0;
}
function clockTick(){
  const s = getActiveSession();
  if (!s || !s.live) return;
  ensureLive(s);
  const groups = getSessionGroups(s);
  const b = s.blocks[s.live.blockIndex];
  let changed = false;

  for (const g of groups){
    const c = s.live.groupClocks[g];
    if (c?.running){
      const ms = Date.now() - c.startMs;
      c.elapsedMs = ms;
      changed = true;

      // Auto complete for cycle blocks when cycle duration reached
      if (b && b.mode === "cycle" && (b.cycleSec||0) > 0 && ms >= b.cycleSec*1000){
        c.running = false;
        const cap = s.live.repCapture[g];
        if (cap){
          cap.repEndISO = nowISO();
          cap.elapsedSec = Math.round(ms/100)/10;
        }
        const rest = s.live.restByGroup[g] || (s.live.restByGroup[g] = {resting:false,startMs:0,restSec:0});
        rest.resting = true;
        rest.startMs = Date.now();
        rest.restSec = 0;
        if (state.settings.beep) beep(520, 0.06);
        changed = true;
      }
    }
  }
  if (changed && activeTab === "session") render();
}
setInterval(clockTick, 200);

// ---------- UI rendering ----------
function setTab(tab){
  activeTab = tab;
  $$(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab===tab));
  render();
}
$$(".tab").forEach(b => b.addEventListener("click", () => setTab(b.dataset.tab)));

// ---------- Screens ----------
function screenHome(){
  const active = getActiveSession();
  const templates = state.presets || [];
  const recent = [...state.sessions].sort((a,b)=> (b.startedAt||"").localeCompare(a.startedAt||"")).slice(0, 12);

  return `
    <div class="grid two">
      <div class="card">
        <h3>Templates</h3>
        <div class="small muted">Start from a template session.</div>
        <div class="hr"></div>
        <div class="list">
          ${templates.map(t => `
            <div class="item">
              <div class="top">
                <div class="name">${escapeHtml(t.name)}</div>
                <span class="badge">Template</span>
              </div>
              <div class="meta">${escapeHtml(t.description || autoTemplateSummary(t))}</div>
              <div class="row" style="margin-top:10px">
                <button class="btn primary" onclick="window.__newSessionFromTemplate('${t.id}')">Start</button>
              </div>
            </div>
          `).join("") || `<div class="muted small">No templates yet.</div>`}
        </div>
      </div>

      <div class="card">
        <h3>Today</h3>
        ${active ? `
          <div class="item">
            <div class="top">
              <div class="name">${escapeHtml(active.name)}</div>
              <span class="badge">Active</span>
            </div>
            <div class="meta">${escapeHtml(active.location||"")} · started ${escapeHtml(fmtLocal(active.startedAt))}</div>
            <div class="row" style="margin-top:10px">
              <button class="btn primary" onclick="window.__resumeSession()">Resume</button>
              <button class="btn danger" onclick="window.__endSession()">End session</button>
            </div>
          </div>
        ` : `
          <div class="muted small">No active session.</div>
        `}
        <div class="hr"></div>
        <h3>Recent sessions</h3>
        <div class="list">
          ${recent.length ? recent.map(s => `
            <div class="item">
              <div class="top">
                <div class="name">${escapeHtml(s.name)}</div>
                ${s.id===state.activeSessionId ? `<span class="badge">Active</span>` : ``}
              </div>
              <div class="meta">${escapeHtml(s.location||"")} · ${s.startedAt ? escapeHtml(fmtLocal(s.startedAt)) : "Draft"}</div>
              <div class="row" style="margin-top:10px">
                <button class="btn" onclick="window.__openSession('${s.id}')">View</button>
                <button class="btn danger" onclick="window.__deleteSession('${s.id}')">Delete</button>
              </div>
            </div>
          `).join("") : `<div class="muted small">No sessions yet.</div>`}
        </div>
      </div>
    </div>
  `;
}

function screenSession(){
  const s = getActiveSession();
  if (!s){
    return `
      <div class="card">
        <h3>Session</h3>
        <div class="muted">Start a session from Home.</div>
        <div style="margin-top:10px">
          <button class="btn primary" onclick="window.__newSessionFromPreset()">+ New session</button>
        </div>
      </div>
    `;
  }
  ensureLive(s);
  const b = s.blocks[s.live.blockIndex];
  const repIndex = b ? s.live.repIndexByBlock[b.id] : 0;
  const repHuman = b ? (repIndex + 1) : 0;

  const groups = getSessionGroups(session);
  const activeAthletes = s.athletesSnapshot.filter(a => a.active);

  return `
    <div class="card">
      <h3>Session</h3>
      <div class="grid two">
        <div>
          <label>Session name</label>
          <input id="sessName" value="${escapeHtml(s.name)}" />
        </div>
        <div>
          <label>Location</label>
          ${renderLocationSelect(s)}
        </div>
      </div>
      <div class="row">
        <span class="pill">📍 ${escapeHtml(s.location || "—")}</span>
        <span class="pill">🗓 ${escapeHtml(fmtLocal(s.startedAt))}</span>
        <span class="pill">👥 ${activeAthletes.length} athletes</span>
      </div>
      <div class="hr"></div>
      <div class="row">
        <button class="btn" onclick="window.__editAthletes()">Athletes & groups</button>
        <button class="btn" onclick="window.__editBlocks()">Blocks</button>
        <button class="btn" onclick="window.__toggleAllIn()">${s.live?.allIn ? "All-in: ON" : "All-in: OFF"}</button>
        <div class="spacer"></div>
        <button class="btn danger" onclick="window.__endSession()">End session</button>
      </div>
    </div>

    ${b ? `
      <div class="card">
        <h3>Block ${s.live.blockIndex + 1} of ${s.blocks.length}</h3>
        <div class="row">
          <span class="pill">🏁 ${escapeHtml(b.label || `${b.distanceM}m`)}</span>
          <span class="pill">↻ ${b.reps} reps</span>
          <span class="pill">⏱ ${b.mode === "manual" ? "Manual start" : "Cycle"}</span>
          <span class="pill">🧘 Cycle ${secToTime(b.cycleSec) || "—"}</span>
        </div>
        <div class="hr"></div>
        <div class="row">
          <div style="font-weight:1000">Rep ${repHuman} / ${b.reps}</div>
          <div class="spacer"></div>
          <button class="btn" onclick="window.__prevRep()" ${repIndex===0 ? "disabled":""}>◀ Rep</button>
          <button class="btn primary" onclick="window.__nextRep()" ${repIndex>=b.reps-1 ? "disabled":""}>Next rep ▶</button>
        </div>
        <div class="row" style="margin-top:10px">
          <button class="btn" onclick="window.__prevBlock()" ${s.live.blockIndex===0 ? "disabled":""}>◀ Block</button>
          <button class="btn" onclick="window.__nextBlock()" ${s.live.blockIndex===s.blocks.length-1 ? "disabled":""}>Block ▶</button>
        </div>
      </div>

      <div class="grid two">
        ${groups.map(g => groupTimerCard(s, b, g)).join("")}
      </div>

      <div class="card">
        <h3>Quick capture</h3>
        <div class="muted small">After starting a rep for a group, tap athletes in finish order.</div>
        <div class="row" style="margin-top:8px">
          ${groups.map(g => `<span class="pill">${g} captured: ${(s.live.repCapture[g]?.capturedAthleteIds?.length)||0}</span>`).join("")}
        </div>
        <div class="hr"></div>
        <div class="grid two">
          ${groups.map(g => capturePanel(s, b, g)).join("")}
        </div>
      </div>
    ` : `
      <div class="card"><h3>No blocks</h3><div class="muted">Add blocks in Blocks.</div></div>
    `}
  `;
}

function groupTimerCard(session, block, group){
  const c = session.live.groupClocks[group];
  const elapsed = c.running ? Math.round(c.elapsedMs/1000) : Math.round((c.elapsedMs||0)/1000);
  const repIndex = session.live.repIndexByBlock[block.id] || 0;
  const capture = session.live.repCapture[group];
  const running = c.running;

  return `
    <div class="card">
      <h3>Group ${group}</h3>
      <div class="timerBox">
        <div class="timerNum">${msToTimeTenths(c.elapsedMs||0)}</div>
        <div class="spacer"></div>
        <span class="badge">${running ? "Running" : "Stopped"}</span>
      </div>
      ${renderRestLine(session, block, group)}
      <div class="row" style="margin-top:10px">
        <button class="btn primary" onclick="window.__startRep('${group}')" ${running ? "disabled":""}>Start rep</button>
        <button class="btn" onclick="window.__stopRep('${group}')" ${(block.mode==="manual" ? "disabled" : (!running ? "disabled":""))}>End rep</button>
      </div>
      <div class="small muted" style="margin-top:8px">
        Rep ${repIndex+1} capture started: ${capture?.repStartISO ? escapeHtml(fmtLocal(capture.repStartISO)) : "—"}
      </div>
    </div>
  `;
}

function capturePanel(session, block, group){
  const activeAthletes = session.athletesSnapshot.filter(a => a.active && (a.group||"A")===group);
  const repIndex = session.live.repIndexByBlock[block.id] || 0;
  const cap = session.live.repCapture[group];
  const captured = new Set(cap?.capturedAthleteIds || []);
  const running = session.live.groupClocks[group]?.running;

  return `
    <div class="card">
      <h3>${group} · Rep ${repIndex+1}</h3>
      <div class="row">
        <span class="pill">Athletes: ${activeAthletes.length}</span>
        ${running ? `<span class="pill">Tap to record</span>` : `<span class="pill">Start rep first</span>`}
      </div>
      <div class="athGrid" style="margin-top:10px">
        ${activeAthletes.map(a => `
          <button class="athBtn ${captured.has(a.id) ? "done":""}" onclick="window.__tapFinish('${group}','${a.id}')">
            <span>${escapeHtml(a.first)} ${escapeHtml(a.last)}</span>
            <span class="right">
              <span class="mini">${captured.has(a.id) ? "Recorded" : "Tap"}</span>
              <span class="badge">${escapeHtml(a.group||"")}</span>
            </span>
          </button>
        `).join("")}
        ${activeAthletes.length===0 ? `<div class="muted small">No athletes assigned to group ${group}.</div>` : ``}
      </div>
      <div class="row" style="margin-top:10px">
        <button class="btn" onclick="window.__undoLast('${group}')" ${(cap?.capturedAthleteIds?.length||0)===0 ? "disabled":""}>Undo last</button>
        <button class="btn" onclick="window.__manualEdit('${group}')" ${(cap?.capturedAthleteIds?.length||0)===0 ? "disabled":""}>Manual edit</button>
      </div>
    </div>
  `;
}

function screenResults(){
  const s = getActiveSession();
  const target = s || state.sessions.slice().sort((a,b)=> (b.startedAt||"").localeCompare(a.startedAt||""))[0];
  if (!target){
    return `<div class="card"><h3>Results</h3><div class="muted">No sessions yet.</div></div>`;
  }

  const rows = buildResultsRows(target);
  const tsv = buildTSV(target, rows);

  return `
    <div class="card">
      <h3>Results</h3>
      <div class="row">
        <span class="pill">🏁 ${escapeHtml(target.name)}</span>
        <span class="pill">🗓 ${escapeHtml(fmtLocal(target.startedAt || nowISO()))}</span>
        <span class="pill">📍 ${escapeHtml(target.location||"—")}</span>
      </div>
      <div class="hr"></div>
      <div class="row">
        <button class="btn primary" onclick="window.__shareImage()">Share image</button>
        <button class="btn" onclick="window.__copyTSV()">Copy table (TSV)</button>
              </div>
      <div class="small muted" style="margin-top:8px">Tip: “Share image” uses the logo and auto-fits the table for Messenger/Facebook.</div>
    </div>

    <div class="card">
      <h3>Table</h3>
      ${renderResultsTable(target, rows)}
    </div>

    <textarea id="tsvBox" style="position:absolute; left:-9999px; top:-9999px">${escapeHtml(tsv)}</textarea>
    <canvas id="shareCanvas" style="display:none"></canvas>
  `;
}

function screenSettings(){
  const gs = state.settings.groups || ["A","B"];
  return `
    <div class="card">
      <h3>Settings</h3>
      <div class="grid two">
        <div>
          <label>Groups (comma separated)</label>
          <input id="groupsInp" value="${escapeHtml(gs.join(","))}" placeholder="A,B" />
          <div class="small muted" style="margin-top:6px">Used for separate rep clocks per pace group.</div>
        </div>
        <div>
          <label>Alerts</label>
          <div class="row">
            <span class="pill"><input type="checkbox" id="beepChk" ${state.settings.beep ? "checked":""} /> Beep</span>
            <span class="pill"><input type="checkbox" id="vibChk" ${state.settings.vibrate ? "checked":""} /> Vibrate</span>
          </div>
          <div class="small muted" style="margin-top:6px">Vibration works on most Android devices; iOS is more limited.</div>
        </div>
      </div>
      <div class="hr"></div>
      <div class="row">
        <button class="btn primary" onclick="window.__saveSettings()">Save settings</button>
        <button class="btn danger" onclick="window.__factoryReset()">Factory reset</button>
      </div>
    </div>
  `;
}

// ---------- Results helpers ----------
function buildResultsRows(session){
  const athletes = session.athletesSnapshot.filter(a => a.active).slice()
    .sort((a,b)=> (a.group||"").localeCompare(b.group||"") || (a.last||"").localeCompare(b.last||"") || (a.first||"").localeCompare(b.first||""));
  const blocks = session.blocks;
  const cols = [];
  for (let bi=0; bi<blocks.length; bi++){
    const b = blocks[bi];
    for (let ri=0; ri<b.reps; ri++){
      cols.push({ bi, ri, label: `${b.distanceM}m(${ri+1})` });
    }
  }
  const rows = athletes.map(a => {
    const cells = cols.map(c => {
      const key = `${a.id}|${c.bi}|${c.ri}`;
      const sec = session.results?.[key] ?? null;
      return secToTime(sec);
    });
    return { athlete:a, cells };
  });
  return { athletes, blocks, cols, rows };
}

function renderResultsTable(session, rowsObj){
  const { cols, rows } = rowsObj;
  const head = cols.map(c => `<th>${escapeHtml(c.label)}</th>`).join("");
  const body = rows.map(r => `
    <tr>
      <td><b>${escapeHtml(r.athlete.first)} ${escapeHtml(r.athlete.last)}</b><div class="small muted">${escapeHtml(r.athlete.group||"")}</div></td>
      ${r.cells.map(v => `<td>${escapeHtml(v||"")}</td>`).join("")}
    </tr>
  `).join("");
  return `
    <div style="overflow:auto">
      <table class="stickyhead">
        <thead><tr><th>Name</th>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

function buildTSV(session, rowsObj){
  const { cols, rows } = rowsObj;
  const header = ["Name", ...cols.map(c=>c.label)].join("\t");
  const lines = [header];
  for (const r of rows){
    lines.push([`${r.athlete.first} ${r.athlete.last}`, ...r.cells].join("\t"));
  }
  return lines.join("\n");
}

// ---------- Dialogs (simple prompts) ----------
async function editAthletesDialog(session){
  // Minimal v0.1: add athlete, toggle active, set group.
  const groups = getSessionGroups(session);
  const container = document.createElement("div");
  container.innerHTML = `
    <div class="card">
      <h3>Athletes & groups</h3>
      <div class="small muted">Add athletes, assign Group, toggle active. Max 25 supported.</div>
      <div class="hr"></div>
      <div class="grid two">
        <div>
          <label>First name</label>
          <input id="fn" placeholder="First name" />
        </div>
        <div>
          <label>Last name</label>
          <input id="ln" placeholder="Last name" />
        </div>
      </div>
      <div style="margin-top:10px">
        <label>Group</label>
        <select id="grp">${groups.map(g=>`<option value="${g}">${g}</option>`).join("")}</select>
      </div>
      <div class="row" style="margin-top:10px">
        <button class="btn primary" id="addBtn">Add athlete</button>
        <button class="btn" id="closeBtn">Done</button>
      </div>
    </div>
    <div class="card">
      <h3>In this session</h3>
      <div id="list"></div>
    </div>
  `;
  const overlay = modal(container);
  const listEl = container.querySelector("#list");
  function renderList(){
    const as = session.athletesSnapshot;
    listEl.innerHTML = as.map(a=>`
      <div class="item">
        <div class="top">
          <div class="name">${escapeHtml(a.first)} ${escapeHtml(a.last)}</div>
          <span class="badge">${escapeHtml(a.group||"")}</span>
        </div>
        <div class="row" style="margin-top:8px">
          <button class="btn" data-act="toggle" data-id="${a.id}">${a.active ? "Active" : "Inactive"}</button>
          <select data-act="group" data-id="${a.id}">
            ${groups.map(g=>`<option value="${g}" ${g===(a.group||"A") ? "selected":""}>${g}</option>`).join("")}
          </select>
        </div>
      </div>
    `).join("") || `<div class="muted small">No athletes yet.</div>`;
    listEl.querySelectorAll("[data-act='toggle']").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const id = btn.dataset.id;
        const at = session.athletesSnapshot.find(x=>x.id===id);
        at.active = !at.active;
        renderList();
        saveState();
      });
    });
    listEl.querySelectorAll("select[data-act='group']").forEach(sel=>{
      sel.addEventListener("change", ()=>{
        const id = sel.dataset.id;
        const at = session.athletesSnapshot.find(x=>x.id===id);
        at.group = sel.value;
        renderList();
        saveState();
      });
    });
  }
  renderList();

  container.querySelector("#addBtn").addEventListener("click", async ()=>{
    const fn = container.querySelector("#fn").value.trim();
    const ln = container.querySelector("#ln").value.trim();
    const gp = container.querySelector("#grp").value;
    if (!fn || !ln){ toast("Enter first + last name"); return; }
    if (session.athletesSnapshot.filter(a=>a.active).length >= 25){
      toast("Max 25 athletes"); return;
    }
    session.athletesSnapshot.push({ id: uid(), first: fn, last: ln, group: gp, active:true });
    container.querySelector("#fn").value = "";
    container.querySelector("#ln").value = "";
    renderList();
    await saveState();
  });
  container.querySelector("#closeBtn").addEventListener("click", ()=> overlay.remove());
}

async function editBlocksDialog(session){
  // Minimal v0.1: add/remove blocks, edit distance/reps/cycle.
  const container = document.createElement("div");
  container.innerHTML = `
    <div class="card">
      <h3>Blocks</h3>
      <div class="small muted">Default mode: Manual start. Rest starts: last finisher. Next: fixed cycle.</div>
      <div class="hr"></div>
      <div class="row">
        <button class="btn primary" id="addBlock">+ Add block</button>
        <button class="btn" id="done">Done</button>
      </div>
    </div>
    <div id="blocks"></div>
  `;
  const overlay = modal(container);
  const blocksEl = container.querySelector("#blocks");

  function renderBlocks(){
    blocksEl.innerHTML = session.blocks.map((b, idx)=>`
      <div class="card">
        <h3>Block ${idx+1}</h3>
        <div class="grid two">
          <div>
            <label>Label</label>
            <input data-k="label" data-i="${idx}" value="${escapeHtml(b.label||"")}" placeholder="e.g. 800s" />
          </div>
          <div>
            <label>Distance (m)</label>
            <input data-k="distanceM" data-i="${idx}" value="${escapeHtml(String(b.distanceM||""))}" inputmode="numeric" />
          </div>
        </div>
        <div class="grid two" style="margin-top:10px">
          <div>
            <label>Reps</label>
            <input data-k="reps" data-i="${idx}" value="${escapeHtml(String(b.reps||""))}" inputmode="numeric" />
          </div>
          <div>
            <label>Cycle / Rest (mm:ss)</label>
            <input data-k="cycleSec" data-i="${idx}" value="${escapeHtml(secToTime(b.cycleSec)||"")}" placeholder="e.g. 5:00" />
          </div>
        </div>
        <div class="grid two" style="margin-top:10px">
          <div>
            <label>Mode</label>
            <select data-k="mode" data-i="${idx}">
              <option value="manual" ${b.mode==="manual"?"selected":""}>Manual start</option>
              <option value="cycle" ${b.mode==="cycle"?"selected":""}>Cycle (fixed)</option>
            </select>
          </div>
          <div>
            <label>Groups included</label>
            <input data-k="groups" data-i="${idx}" value="${escapeHtml((b.groups||state.settings.groups).join(","))}" />
          </div>
        </div>
        <div class="row" style="margin-top:10px">
          <button class="btn danger" data-act="del" data-i="${idx}">Delete block</button>
        </div>
      </div>
    `).join("");
    blocksEl.querySelectorAll("input,select").forEach(inp=>{
      inp.addEventListener("change", async ()=>{
        const i = parseInt(inp.dataset.i,10);
        const k = inp.dataset.k;
        const b = session.blocks[i];
        if (k==="distanceM" || k==="reps"){
          b[k] = parseInt(inp.value||"0",10) || 0;
        } else if (k==="cycleSec"){
          b.cycleSec = timeToSec(inp.value) ?? b.cycleSec;
        } else if (k==="groups"){
          b.groups = inp.value.split(",").map(x=>x.trim()).filter(Boolean);
        } else {
          b[k] = inp.value;
        }
        await saveState();
      });
    });
    blocksEl.querySelectorAll("button[data-act='del']").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        const i = parseInt(btn.dataset.i,10);
        session.blocks.splice(i,1);
        await saveState();
        renderBlocks();
      });
    });
  }

  container.querySelector("#addBlock").addEventListener("click", async ()=>{
    session.blocks.push({ id: uid(), label: "New block", distanceM: 400, reps: 6, mode: "manual", cycleSec: 120, restStart: "last", nextStart: "cycle", groups: structuredClone(state.settings.groups), notes:"" });
    await saveState();
    renderBlocks();
  });
  container.querySelector("#done").addEventListener("click", ()=> overlay.remove());
  renderBlocks();
}

function modal(contentEl){
  const ov = document.createElement("div");
  ov.style.position = "fixed";
  ov.style.inset = "0";
  ov.style.background = "rgba(0,0,0,.35)";
  ov.style.zIndex = "999";
  ov.style.overflow = "auto";
  ov.style.padding = "18px 12px";
  const inner = document.createElement("div");
  inner.style.maxWidth = "980px";
  inner.style.margin = "0 auto";
  inner.appendChild(contentEl);
  ov.appendChild(inner);
  ov.addEventListener("click", (e)=>{ if (e.target===ov) ov.remove(); });
  document.body.appendChild(ov);
  return ov;
}

function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, (c)=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

function renderRestLine(session, block, group){
  const rest = session?.live?.restByGroup?.[group];
  if (!rest || !rest.resting) return ``;
  const elapsed = (Date.now() - rest.startMs) / 1000;
  const remaining = (rest.restSec || 0) - elapsed;
  const sign = remaining < 0 ? "-" : "";
  const abs = Math.abs(remaining);
  const mm = Math.floor(abs/60);
  const ss = Math.floor(abs%60);
  const t = Math.floor((abs - Math.floor(abs))*10);
  return `
    <div class="row" style="margin-top:8px">
      <span class="pill">Rest: ${sign}${mm}:${pad2(ss)}.${t}</span>
    </div>
  `;
}

function renderLocationSelect(session){
  const opts = (state.settings.locations || []).slice().sort((a,b)=>a.localeCompare(b));
  const cur = session.location || "";
  const isCustom = cur && !opts.includes(cur);
  return `
    <select id="sessLocSel">
      <option value="">— Select —</option>
      ${opts.map(o=>`<option value="${escapeHtml(o)}" ${o===cur?"selected":""}>${escapeHtml(o)}</option>`).join("")}
      <option value="__custom__" ${isCustom?"selected":""}>Custom…</option>
    </select>
    <div id="customLocWrap" style="margin-top:8px; display:${isCustom?"block":"none"}">
      <input id="sessLocCustom" placeholder="Enter custom location" value="${escapeHtml(isCustom?cur:"")}" />
    </div>
  `;
}

function autoTemplateSummary(t){
  try{
    const blocks = t.blocks || [];
    const parts = blocks.map(b => {
      const label = (b.label || `${b.distanceM}m`);
      const reps = b.reps ? `${b.reps}×` : "";
      const mode = (b.mode==="cycle") ? `on ${secToTime(b.cycleSec)}` : `rest ${secToTime(b.cycleSec)}`;
      return `${reps}${label} (${mode})`;
    });
    return parts.join(" + ");
  }catch{
    return "";
  }
}

// ---------- Actions ----------
window.__newSessionFromPreset = async function(){
  const firstId = (state.presets && state.presets[0] && state.presets[0].id) || null;
  return window.__newSessionFromTemplate(firstId);
};

window.__resumeSession = function(){
  setTab("session");
};

window.__openSession = async function(id){
  state.activeSessionId = id;
  await saveState();
  setTab("session");
};

window.__endSession = async function(){
  const s = getActiveSession();
  if (!s) return;
  s.endedAt = nowISO();
  state.activeSessionId = null;
  await saveState();
  toast("Session ended");
  setTab("home");
};

window.__editAthletes = async function(){
  const s = getActiveSession();
  if (!s) return;
  await editAthletesDialog(s);
  render();
};

window.__editBlocks = async function(){
  const s = getActiveSession();
  if (!s) return;
  await editBlocksDialog(s);
  ensureLive(s);
  render();
};

window.__prevBlock = async function(){
  const s = getActiveSession(); if (!s) return;
  ensureLive(s);
  s.live.blockIndex = Math.max(0, s.live.blockIndex - 1);
  const b = s.blocks[s.live.blockIndex];
  if (b && s.live.repIndexByBlock[b.id] == null) s.live.repIndexByBlock[b.id] = 0;
  await saveState();
  render();
};
window.__nextBlock = async function(){
  const s = getActiveSession(); if (!s) return;
  ensureLive(s);
  s.live.blockIndex = Math.min(s.blocks.length-1, s.live.blockIndex + 1);
  const b = s.blocks[s.live.blockIndex];
  if (b && s.live.repIndexByBlock[b.id] == null) s.live.repIndexByBlock[b.id] = 0;
  await saveState();
  render();
};

window.__prevRep = async function(){
  const s = getActiveSession(); if (!s) return;
  ensureLive(s);
  const b = s.blocks[s.live.blockIndex];
  if (!b) return;
  const cur = s.live.repIndexByBlock[b.id] || 0;
  if (cur <= 0) return;

  // Stop + reset clocks and clear capture state for all groups
  for (const g of state.settings.groups){
    const c = s.live.groupClocks[g];
    if (c){ c.running = false; c.elapsedMs = 0; c.startMs = 0; }
    s.live.repCapture[g] = { capturedAthleteIds: [], repStartISO: null };
  }

  s.live.repIndexByBlock[b.id] = cur - 1;
  if (state.settings.vibrate && navigator.vibrate) navigator.vibrate(20);
  await saveState();
  render();
};

window.__nextRep = async function(){
  const s = getActiveSession(); if (!s) return;
  ensureLive(s);
  const b = s.blocks[s.live.blockIndex];
  if (!b) return;
  const cur = s.live.repIndexByBlock[b.id] || 0;
  if (cur >= b.reps - 1) return;

  // Stop + reset clocks and clear capture state for all groups
  for (const g of state.settings.groups){
    const c = s.live.groupClocks[g];
    if (c){ c.running = false; c.elapsedMs = 0; c.startMs = 0; }
    s.live.repCapture[g] = { capturedAthleteIds: [], repStartISO: null };
  }

  s.live.repIndexByBlock[b.id] = cur + 1;
  if (state.settings.vibrate && navigator.vibrate) navigator.vibrate([15, 40, 15]);
  if (state.settings.beep) beep(740, 0.05);
  await saveState();
  render();
};


window.__startRep = async function(group){
  const s = getActiveSession(); if (!s) return;
  ensureLive(s);
  const clock = s.live.groupClocks[group];
  if (!clock) return;
  clock.running = true;
  clock.startMs = Date.now();
  clock.elapsedMs = 0;
  s.live.repCapture[group] = { capturedAthleteIds: [], repStartISO: nowISO() };
  const rest = s.live.restByGroup[group];
  if (rest){ rest.resting = false; rest.startMs = 0; }

  if (state.settings.vibrate && navigator.vibrate) navigator.vibrate(35);
  if (state.settings.beep) beep();
  await saveState();
  render();
};

window.__stopRep = async function(group){
  const s = getActiveSession(); if (!s) return;
  ensureLive(s);
  const b = s.blocks[s.live.blockIndex];
  if (!b) return;

  const clock = s.live.groupClocks[group];
  if (!clock?.running) return;
  clock.running = false;
  const elapsedSec = Math.round(clock.elapsedMs/1000);

  // Record metadata only. Rep advancement is coach-controlled via Next rep.
  const cap = s.live.repCapture[group];
  cap.repEndISO = nowISO();
  cap.elapsedSec = elapsedSec;

  if (state.settings.vibrate && navigator.vibrate) navigator.vibrate(25);
  if (state.settings.beep) beep(520, 0.06);

  await saveState();
  render();
};

window.__tapFinish = async function(group, athleteId){
  const s = getActiveSession(); if (!s) return;
  ensureLive(s);
  const b = s.blocks[s.live.blockIndex];
  if (!b) return;
  const rep = s.live.repIndexByBlock[b.id] || 0;
  const clock = s.live.groupClocks[group];
  if (!clock?.running){
    toast("Start rep first");
    return;
  }
  const cap = s.live.repCapture[group];
  if (cap.capturedAthleteIds.includes(athleteId)) return;

  const elapsedSec = Math.round(clock.elapsedMs/100) / 10; // tenths
  const key = `${athleteId}|${s.live.blockIndex}|${rep}`;
  s.results[key] = elapsedSec;
  cap.capturedAthleteIds.push(athleteId);

  if (state.settings.vibrate && navigator.vibrate) navigator.vibrate(10);

  if ((b.mode || "manual") === "manual"){
    const activeIds = s.athletesSnapshot.filter(a => a.active && (a.group||"A")===group).map(a=>a.id);
    const done = activeIds.every(id => cap.capturedAthleteIds.includes(id));
    if (done){
      clock.running = false;
      cap.repEndISO = nowISO();
      cap.elapsedSec = elapsedSec;
      const rest = s.live.restByGroup[group];
      if (rest){
        rest.resting = true;
        rest.startMs = Date.now();
        rest.restSec = Math.max(0, b.cycleSec || 0);
      }
      if (state.settings.beep) beep(520, 0.06);
      if (state.settings.vibrate && navigator.vibrate) navigator.vibrate([20,30,20]);
    }
  }

  await saveState();
  render();
};

window.__undoLast = async function(group){
  const s = getActiveSession(); if (!s) return;
  ensureLive(s);
  const b = s.blocks[s.live.blockIndex]; if (!b) return;
  const rep = s.live.repIndexByBlock[b.id] || 0;
  const cap = s.live.repCapture[group];
  const last = cap.capturedAthleteIds.pop();
  if (!last) return;
  const key = `${last}|${s.live.blockIndex}|${rep}`;
  delete s.results[key];
  await saveState();
  toast("Undone");
  render();
};

window.__manualEdit = async function(group){
  const s = getActiveSession(); if (!s) return;
  ensureLive(s);
  const b = s.blocks[s.live.blockIndex]; if (!b) return;
  const rep = s.live.repIndexByBlock[b.id] || 0;
  const cap = s.live.repCapture[group];
  const lastId = cap.capturedAthleteIds[cap.capturedAthleteIds.length-1];
  if (!lastId) return;
  const at = s.athletesSnapshot.find(x=>x.id===lastId);
  const key = `${lastId}|${s.live.blockIndex}|${rep}`;
  const cur = s.results[key];
  const v = prompt(`Edit time for ${at.first} ${at.last} (mm:ss or seconds)`, secToTime(cur) || "");
  if (v == null) return;
  const sec = timeToSec(v);
  if (sec == null){ toast("Invalid time"); return; }
  s.results[key] = sec;
  await saveState();
  toast("Updated");
  render();
};

window.__saveSettings = async function(){
  const groupsRaw = ($("#groupsInp")?.value || "A,B").split(",").map(x=>x.trim()).filter(Boolean);
  if (!groupsRaw.length){ toast("Add at least one group"); return; }
  state.settings.groups = groupsRaw.slice(0, 6); // keep sane
  state.settings.beep = !!$("#beepChk")?.checked;
  state.settings.vibrate = !!$("#vibChk")?.checked;
  await saveState();
  toast("Saved");
  render();
};

window.__factoryReset = async function(){
  if (!confirm("This will erase all saved sessions and settings on this device. Continue?")) return;
  state = structuredClone(DEFAULT_STATE);
  await saveState();
  toast("Reset");
  setTab("home");
};

window.__copyTSV = async function(){
  const s = getActiveSession() || state.sessions.slice().sort((a,b)=> (b.startedAt||"").localeCompare(a.startedAt||""))[0];
  if (!s){ toast("No session"); return; }
  const rows = buildResultsRows(s);
  const tsv = buildTSV(s, rows);

  try{
    await navigator.clipboard.writeText(tsv);
    toast("Copied");
    return;
  }catch(e){}

  try{
    const ta = document.createElement("textarea");
    ta.value = tsv;
    ta.setAttribute("readonly","");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    document.execCommand("copy");
    ta.remove();
    toast("Copied");
    return;
  }catch(e){}

  prompt("Copy table (TSV):", tsv);
};


window.__shareImage = async function(){
  const s = getActiveSession() || state.sessions.slice().sort((a,b)=> (b.startedAt||"").localeCompare(a.startedAt||""))[0];
  const rows = buildResultsRows(s);
  const canvas = $("#shareCanvas");
  const pngBlob = await renderShareImageToCanvas(canvas, s, rows);

  // Share sheet if available
  const file = new File([pngBlob], "results.png", {type:"image/png"});
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files:[file], title: s.name, text: "Session results" });
      return;
    } catch(e){ /* user cancelled */ }
  }

  // Clipboard copy (desktop)
  try{
    await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
    toast("Image copied");
    return;
  }catch{}

  // Fallback: open image tab
  const url = URL.createObjectURL(pngBlob);
  window.open(url, "_blank");
};

async function renderShareImageToCanvas(canvas, session, rowsObj){
  const logo = await loadImage("./logo.jpg");
  const { cols, rows } = rowsObj;

  // Layout
  const pad = 24;
  const rowH = 38;
  const colW = 98;
  const nameW = 190;
  const maxCols = Math.min(cols.length, 10); // keep image readable; if more, we wrap blocks later (v0.2)
  const showCols = cols.slice(0, maxCols);

  const headerH = 120;
  const tableW = nameW + maxCols*colW;
  const tableH = (rows.length+1)*rowH;
  const W = tableW + pad*2;
  const H = headerH + tableH + pad;

  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0,0,W,H);

  // Header
  ctx.fillStyle = "#111111";
  ctx.font = "900 28px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText("Blackbutt Runners", pad, 46);
  ctx.font = "800 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText(session.name || "Session", pad, 78);
  ctx.font = "700 16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillStyle = "#4b5563";
  ctx.fillText(`${fmtLocal(session.startedAt)} · ${session.location||""}`, pad, 104);

  // Logo
  const logoSize = 86;
  ctx.drawImage(logo, W - pad - logoSize, 24, logoSize, logoSize);

  // Table frame
  const x0 = pad, y0 = headerH;
  ctx.fillStyle = "#111111";
  roundRect(ctx, x0, y0, tableW, tableH, 18);
  ctx.fill();

  // Inner background
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, x0+2, y0+2, tableW-4, tableH-4, 16);
  ctx.fill();

  // Header row background
  ctx.fillStyle = "#f3f4f6";
  roundRect(ctx, x0+2, y0+2, tableW-4, rowH, 16);
  ctx.fill();
  ctx.fillRect(x0+2, y0+2+16, tableW-4, rowH-16); // square bottom of header

  // Grid lines
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  for (let r=0; r<=rows.length+1; r++){
    const yy = y0 + r*rowH;
    ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0+tableW, yy); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(x0+nameW, y0); ctx.lineTo(x0+nameW, y0+tableH); ctx.stroke();
  for (let c=0; c<maxCols; c++){
    const xx = x0 + nameW + c*colW;
    ctx.beginPath(); ctx.moveTo(xx, y0); ctx.lineTo(xx, y0+tableH); ctx.stroke();
  }

  // Text
  ctx.fillStyle = "#111111";
  ctx.font = "900 14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText("Name", x0+12, y0+rowH*0.65);

  ctx.font = "800 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  showCols.forEach((c, i)=>{
    ctx.fillText(c.label, x0 + nameW + i*colW + 8, y0 + rowH*0.65);
  });

  ctx.font = "800 13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  rows.forEach((r, i)=>{
    const yy = y0 + (i+1)*rowH;
    ctx.fillStyle = "#111111";
    ctx.fillText(`${r.athlete.first} ${r.athlete.last}`, x0+12, yy+rowH*0.62);
    ctx.fillStyle = "#111111";
    const values = r.cells.slice(0, maxCols);
    values.forEach((v, ci)=>{
      ctx.fillText(v||"", x0 + nameW + ci*colW + 10, yy+rowH*0.62);
    });
  });

  // Footer note if truncated cols
  if (cols.length > maxCols){
    ctx.fillStyle = "#6b7280";
    ctx.font = "700 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(`Note: Image shows first ${maxCols} reps/columns. Full table available via TSV export.`, pad, H-10);
  }

  return new Promise((resolve)=>{
    canvas.toBlob((blob)=> resolve(blob), "image/png", 0.92);
  });
}

function roundRect(ctx, x, y, w, h, r){
  const rr = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+rr, y);
  ctx.arcTo(x+w, y, x+w, y+h, rr);
  ctx.arcTo(x+w, y+h, x, y+h, rr);
  ctx.arcTo(x, y+h, x, y, rr);
  ctx.arcTo(x, y, x+w, y, rr);
  ctx.closePath();
}

function loadImage(src){
  return new Promise((resolve, reject)=>{
    const img = new Image();
    img.onload = ()=> resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// simple beep
function beep(freq=880, dur=0.04){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine"; o.frequency.value = freq;
    g.gain.value = 0.02;
    o.connect(g); g.connect(ctx.destination);
    o.start();
    setTimeout(()=>{ o.stop(); ctx.close(); }, Math.max(25, dur*1000));
  }catch{}
}

// ---------- Render ----------
function render(){
  const el = $("#app");
  if (!el) return;
  if (activeTab === "home") el.innerHTML = screenHome();
  else if (activeTab === "session") el.innerHTML = screenSession();
  else if (activeTab === "results") el.innerHTML = screenResults();
  else el.innerHTML = screenSettings();
  $$(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab===activeTab));

  // Wire up session name/location inputs
  if (activeTab === "session"){
    const s = getActiveSession();
    if (s){
      const nameEl = $("#sessName");
      if (nameEl){
        nameEl.onchange = async () => { s.name = nameEl.value.trim() || s.name; await saveState(); toast("Saved"); };
      }
      const locSel = $("#sessLocSel");
      const customWrap = $("#customLocWrap");
      if (locSel){
        locSel.onchange = async () => {
          if (locSel.value === "__custom__"){
            if (customWrap) customWrap.style.display = "block";
            const ce = $("#sessLocCustom"); if (ce) ce.focus();
          } else {
            if (customWrap) customWrap.style.display = "none";
            s.location = locSel.value || "";
            await saveState(); toast("Saved");
          }
        };
      }
      const locCustom = $("#sessLocCustom");
      if (locCustom){
        locCustom.onchange = async () => { s.location = locCustom.value.trim(); await saveState(); toast("Saved"); };
      }
    }
  }
}
window.render = render;

// ---------- Install prompt ----------
window.addEventListener("beforeinstallprompt", (e)=>{
  e.preventDefault();
  installPrompt = e;
  const btn = $("#installBtn");
  if (btn){
    btn.style.display = "inline-block";
    btn.onclick = async ()=>{
      try{
        installPrompt.prompt();
        await installPrompt.userChoice;
      }catch{}
      installPrompt = null;
      btn.style.display = "none";
    };
  }
});

// ---------- Init ----------
(async function init(){
  await loadState();

  // If there is an active session id but no session exists, clear it.
  if (state.activeSessionId && !state.sessions.find(s=>s.id===state.activeSessionId)){
    state.activeSessionId = null;
  }

  // Ensure any existing active session has live state
  const s = getActiveSession();
  if (s) ensureLive(s);

  // Show install button if already installed is not possible to detect reliably; we show via event.
  setTab("home");
  render();
})();
