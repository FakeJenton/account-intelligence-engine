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
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 var(--space-6) var(--space-8)' }}>

      {/* Page header */}
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        padding: 'var(--space-8) 0 var(--space-5)',
      }}>
        <div>
          <h1 style={{
            fontSize: 'var(--text-xl)',
            fontWeight: 600,
            letterSpacing: 'var(--track-display)',
            color: 'var(--text)',
            lineHeight: 1.1,
          }}>
            Account Intelligence Engine
          </h1>
          <div style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-2)',
            marginTop: 'var(--space-2)',
          }}>
            CRM health, intelligence briefs, readiness scoring
          </div>
        </div>
        <div style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--text-3)',
          textAlign: 'right',
          lineHeight: 1.6,
        }}>
          <div>Last scored {lastScored}</div>
          <div>{payload.accounts.length} accounts</div>
        </div>
      </header>

      {/* Tab nav */}
      <nav style={{
        display: 'flex',
        gap: 'var(--space-5)',
        marginBottom: 'var(--space-5)',
        borderBottom: '1px solid var(--border)',
      }}>
        {tabs.map(tab => {
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: 'var(--space-3) 2px',
                fontSize: 'var(--text-sm)',
                background: 'none',
                border: 'none',
                borderBottom: active ? '2px solid var(--text)' : '2px solid transparent',
                color: active ? 'var(--text)' : 'var(--text-2)',
                fontWeight: active ? 600 : 500,
                marginBottom: -1,
                letterSpacing: 'var(--track-tight)',
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
