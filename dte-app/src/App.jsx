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

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 20px 40px' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        padding: '16px 0 10px', borderBottom: '0.5px solid var(--border)', marginBottom: 14,
      }}>
        <div>
          <span style={{ fontSize: 16, fontWeight: 500 }}>Account Intelligence Engine</span>
          <span style={{ fontSize: 12, color: 'var(--text-2)', marginLeft: 10 }}>
            CRM health · intelligence briefs · readiness scoring
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
          Last scored: {new Date(payload.generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          &nbsp;·&nbsp;{payload.accounts.length} accounts
        </span>
      </div>

      <div style={{ display: 'flex', gap: 2, borderBottom: '0.5px solid var(--border)', marginBottom: 16 }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 14px', fontSize: 13, background: 'none',
              border: 'none', borderBottom: activeTab === tab.key ? '2px solid var(--text)' : '2px solid transparent',
              color: activeTab === tab.key ? 'var(--text)' : 'var(--text-2)',
              fontWeight: activeTab === tab.key ? 500 : 400, cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

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
