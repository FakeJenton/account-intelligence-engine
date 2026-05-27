import { useState } from 'react'
import ExecSummary from './components/ExecSummary'
import AccountQueue from './components/AccountQueue'
import payload from './data/payload.json'
import './App.css'

const tabs = [
  { key: 'exec', label: 'Executive Summary' },
  { key: 'queue', label: 'Account Queue' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('exec')
  const [queueNav, setQueueNav] = useState(null)

  function navigateToQueue(filters) {
    setQueueNav(filters || {})
    setActiveTab('queue')
  }

  const lastScored = new Date(payload.generated_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px 56px' }}>

      {/* Page header */}
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        padding: '28px 0 18px',
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text)' }}>
            Account Intelligence Engine
          </h1>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>
            CRM health · intelligence briefs · readiness scoring
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'right' }}>
          Last scored {lastScored}
          <div style={{ marginTop: 2 }}>{payload.accounts.length} accounts</div>
        </div>
      </header>

      {/* Tab navigation */}
      <nav style={{
        display: 'flex', gap: 4, marginBottom: 22,
        borderBottom: '1px solid var(--border)',
      }}>
        {tabs.map(tab => {
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '10px 2px', marginRight: 22, fontSize: 14, background: 'none',
                border: 'none',
                borderBottom: active ? '2px solid var(--text)' : '2px solid transparent',
                color: active ? 'var(--text)' : 'var(--text-2)',
                fontWeight: active ? 600 : 500,
                marginBottom: -1,
                letterSpacing: '-0.01em',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </nav>

      {activeTab === 'exec' && <ExecSummary data={payload} onNavigate={navigateToQueue} />}
      {activeTab === 'queue' && (
        <AccountQueue
          data={payload}
          navFilters={queueNav}
          onNavConsumed={() => setQueueNav(null)}
        />
      )}
    </div>
  )
}
