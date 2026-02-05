import React from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import Home from './screens/Home'
import SessionRunner from './screens/SessionRunner'
import Results from './screens/Results'

function Tab({ to, label }: { to: string; label: string }) {
  return (
    <NavLink to={to} className={({ isActive }) => `tab ${isActive ? 'tabActive' : ''}`}>
      {label}
    </NavLink>
  )
}

export default function App() {
  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="brandTitle">Train Plan & Track</div>
          <div className="brandSub">Plan sessions • Run groups • Capture results</div>
        </div>
        <nav className="tabs">
          <Tab to="/" label="Home" />
          <Tab to="/session" label="Session" />
          <Tab to="/results" label="Results" />
        </nav>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/session" element={<SessionRunner />} />
          <Route path="/results" element={<Results />} />
        </Routes>
      </main>
    </div>
  )
}
