import React from "react";
import { StoreProvider, useStore } from "../state/store";
import { HomeScreen } from "../screens/Home";
import { SessionScreen } from "../screens/SessionRunner";
import { ResultsScreen } from "../screens/Results";
import { SettingsScreen } from "../screens/Settings";
import { BuilderScreen } from "../screens/Builder";

function Shell() {
  const { state, api } = useStore();
  const tab = state.tab;

  return (
    <div className="container">
      <div className="topbar">
        <div className="brand">
          <img src="/logo.svg" alt="logo" />
          <div>
            <div className="title">Blackbutt Session Tracker</div>
            <div className="sub">Vite + React rebuild (Phase 1)</div>
          </div>
        </div>

        <div className="tabs">
          <button className={"btn " + (tab==="home"?"primary":"")} onClick={() => api.setTab("home")}>Home</button>
          <button className={"btn " + (tab==="session"?"primary":"")} onClick={() => api.setTab("session")}>Session</button>
          <button className={"btn " + (tab==="results"?"primary":"")} onClick={() => api.setTab("results")}>Results</button>
          <button className={"btn " + (tab==="builder"?"primary":"")} onClick={() => api.setTab("builder")}>Builder</button>
          <button className={"btn " + (tab==="settings"?"primary":"")} onClick={() => api.setTab("settings")}>Settings</button>
        </div>
      </div>

      <div style={{ height: 12 }} />

      {tab === "home" && <HomeScreen />}
      {tab === "session" && <SessionScreen />}
      {tab === "results" && <ResultsScreen />}
      {tab === "builder" && <BuilderScreen />}
      {tab === "settings" && <SettingsScreen />}

      {state.toast && <div className="toast">{state.toast}</div>}
    </div>
  );
}

export function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
