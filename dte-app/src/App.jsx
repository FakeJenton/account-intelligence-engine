import { useState } from 'react'
import ExecSummary from './components/ExecSummary'
import AccountQueue from './components/AccountQueue'
import { DownloadIcon } from './components/ui'
import payload from './data/payload.json'
import './App.css'

const tabs = [
  { key: 'exec', label: 'Executive Summary' },
  { key: 'queue', label: 'Account Queue' },
]

const CSV_COLUMNS = [
  ['account_id',        a => a.account_id],
  ['company_name',      a => a.company_name],
  ['rep_name',          a => a.rep_name],
  ['segment',           a => a.segment],
  ['industry',          a => a.industry || ''],
  ['current_stage',     a => a.current_stage],
  ['acv_usd',           a => a.acv_usd],
  ['forecast_category', a => a.forecast_category],
  ['priority_score',    a => a.priority_score],
  ['health_score',      a => a.health.overall_score],
  ['health_label',      a => a.health.label],
  ['completeness_pct',  a => Math.round((a.health.completeness || 0) * 100)],
  ['freshness_pct',     a => Math.round((a.health.freshness    || 0) * 100)],
  ['consistency_pct',   a => Math.round((a.health.consistency  || 0) * 100)],
  ['reliability_pct',   a => Math.round((a.health.reliability  || 0) * 100)],
  ['reliability_tag',   a => a.health.reliability_tag],
  ['critical_gaps',     a => a.gaps?.critical || 0],
  ['contradictions',    a => a.gaps?.contradictions || 0],
  ['intel_readiness',   a => a.intelligence?.readiness_score || 0],
  ['funding_detected',  a => a.intelligence?.timing?.funding_detected ? 'yes' : ''],
  ['urgency_signals',   a => (a.intelligence?.timing?.urgency_signals || []).length],
]

function escapeCSV(value) {
  if (value == null) return ''
  const s = String(value)
  return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function downloadCSV() {
  const headers = CSV_COLUMNS.map(([h]) => h)
  const rows = payload.accounts.map(a => CSV_COLUMNS.map(([, fn]) => escapeCSV(fn(a))).join(','))
  // Prepend UTF-8 BOM so Excel opens the file with the correct encoding.
  const csv = '﻿' + [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const today = new Date().toISOString().slice(0, 10)
  link.href = url
  link.download = `account-intelligence-${today}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

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
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: 'var(--space-8) 0 var(--space-5)',
        gap: 'var(--space-4)',
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

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--space-3)' }}>
          <button
            onClick={downloadCSV}
            className="card-interactive"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: '8px 14px',
              fontSize: 'var(--text-xs)',
              fontWeight: 500,
              background: 'var(--bg)',
              border: '1px solid var(--border-2)',
              borderRadius: 'var(--radius)',
              color: 'var(--text)',
              boxShadow: 'var(--shadow-sm)',
              cursor: 'pointer',
              letterSpacing: 'var(--track-tight)',
            }}
            title="Download source data as CSV"
          >
            <DownloadIcon size={13} />
            Download CSV
          </button>
          <div style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-3)',
            textAlign: 'right',
            lineHeight: 1.6,
          }}>
            <div>Last scored {lastScored}</div>
            <div>{payload.accounts.length} accounts</div>
          </div>
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
