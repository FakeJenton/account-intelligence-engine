import { useState, useMemo } from 'react'
import AccountDetail from './AccountDetail'
import { fmtACV, HEALTH_COLORS, SEGMENT_COLORS } from '../utils'

const s = {
  statsStrip: { display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 14 },
  stat: { background: 'var(--bg-2)', borderRadius: 8, padding: '10px 12px' },
  statLbl: { fontSize: 11, color: 'var(--text-2)', marginBottom: 3 },
  statVal: { fontSize: 18, fontWeight: 500 },
  controls: { display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' },
  searchWrap: { position: 'relative', flex: 1, minWidth: 160 },
  searchInput: {
    width: '100%', padding: '5px 28px 5px 10px', fontSize: 12,
    border: '0.5px solid var(--border-2)', borderRadius: 8,
    background: 'var(--bg-2)', color: 'var(--text)', outline: 'none',
  },
  clearBtn: {
    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', color: 'var(--text-2)', fontSize: 14, padding: 0,
  },
  filterBtn: {
    fontSize: 11, padding: '4px 10px', borderRadius: 20,
    border: '0.5px solid var(--border-2)', background: 'var(--bg-2)',
    color: 'var(--text-2)',
  },
  queue: { display: 'flex', flexDirection: 'column', gap: 5 },
  row: {
    background: 'var(--bg)', border: '0.5px solid var(--border)',
    borderRadius: 8, padding: '9px 12px', cursor: 'pointer',
    display: 'grid', gridTemplateColumns: '8px 1fr auto auto auto',
    gap: 8, alignItems: 'center',
  },
  dot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  company: { fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rep: { fontSize: 11, color: 'var(--text-2)', marginTop: 1 },
  segPill: {
    fontSize: 10, padding: '2px 7px', borderRadius: 10,
    border: '0.5px solid var(--border)', color: 'var(--text-2)', whiteSpace: 'nowrap',
  },
  acv: { fontSize: 12, fontWeight: 500, textAlign: 'right', whiteSpace: 'nowrap' },
  stage: { fontSize: 10, color: 'var(--text-2)', textAlign: 'right', whiteSpace: 'nowrap' },
  showMore: {
    fontSize: 11, textAlign: 'center', padding: 8, cursor: 'pointer',
    border: '0.5px solid var(--border)', borderRadius: 8,
    background: 'var(--bg-2)', color: 'var(--text-2)', marginTop: 6, width: '100%',
  },
}

const FILTERS = [
  { key: 'all', label: 'All', activeColor: '#1a1917' },
  { key: 'critical', label: 'Critical', activeColor: '#dc2626' },
  { key: 'at-risk', label: 'At-risk', activeColor: '#d97706' },
  { key: 'needs-attention', label: 'Needs attention', activeColor: '#2563eb' },
  { key: 'healthy', label: 'Healthy', activeColor: '#16a34a' },
]

export default function AccountQueue({ data }) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [shown, setShown] = useState(10)
  const [selectedId, setSelectedId] = useState(null)

  const es = data.executive_summary
  const accounts = data.accounts || []

  const filtered = useMemo(() => {
    return accounts.filter(a => {
      const labelOk = filter === 'all' || a.health.label === filter
      const q = search.toLowerCase()
      const searchOk = !q || a.company_name.toLowerCase().includes(q) || a.rep_name.toLowerCase().includes(q) || a.account_id.toLowerCase().includes(q)
      return labelOk && searchOk
    })
  }, [accounts, filter, search])

  const visible = filtered.slice(0, shown)

  function toggleRow(id) {
    setSelectedId(prev => prev === id ? null : id)
  }

  function handleFilter(f) {
    setFilter(f)
    setShown(10)
    setSelectedId(null)
  }

  return (
    <div>
      {/* Stats */}
      <div style={s.statsStrip}>
        <div style={s.stat}><div style={s.statLbl}>Total ACV</div><div style={s.statVal}>{fmtACV(es.total_acv)}</div></div>
        <div style={s.stat}><div style={s.statLbl}>ACV at risk</div><div style={{ ...s.statVal, color: '#dc2626' }}>{fmtACV(es.acv_at_risk)}</div></div>
        <div style={s.stat}><div style={s.statLbl}>Critical / at-risk</div><div style={{ ...s.statVal, color: '#d97706' }}>{(es.health_distribution?.critical || 0) + (es.health_distribution?.['at-risk'] || 0)}</div></div>
        <div style={s.stat}><div style={s.statLbl}>Unreliable commits</div><div style={{ ...s.statVal, color: '#dc2626' }}>{es.unreliable_commit_count}</div></div>
        <div style={s.stat}><div style={s.statLbl}>Avg intel readiness</div><div style={{ ...s.statVal, color: '#2563eb' }}>{es.avg_intelligence_readiness}/100</div></div>
      </div>

      {/* Controls */}
      <div style={s.controls}>
        <div style={s.searchWrap}>
          <input
            style={s.searchInput}
            placeholder="Search by company, rep, or account ID..."
            value={search}
            onChange={e => { setSearch(e.target.value); setShown(10); setSelectedId(null) }}
          />
          {search && (
            <button style={s.clearBtn} onClick={() => { setSearch(''); setShown(10) }}>×</button>
          )}
        </div>
        {FILTERS.map(f => (
          <button
            key={f.key}
            style={{
              ...s.filterBtn,
              ...(filter === f.key ? { background: f.activeColor, color: '#fff', borderColor: f.activeColor } : {}),
            }}
            onClick={() => handleFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 8 }}>
        {filtered.length} account{filtered.length !== 1 ? 's' : ''} · sorted by priority
      </div>

      {/* Queue */}
      <div style={s.queue}>
        {visible.length === 0 && (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-2)' }}>No accounts match this filter.</div>
        )}
        {visible.map(a => {
          const isSel = selectedId === a.account_id
          const hc = HEALTH_COLORS[a.health.label] || '#888'
          const hasFunding = a.intelligence?.timing?.funding_detected
          const hasCont = a.gaps?.critical_contradictions > 0
          return (
            <div key={a.account_id}>
              <div
                style={{
                  ...s.row,
                  ...(isSel ? { borderColor: 'var(--text)', borderWidth: 1 } : {}),
                }}
                onClick={() => toggleRow(a.account_id)}
              >
                <div style={{ ...s.dot, background: hc }} />
                <div>
                  <div style={s.company}>
                    {a.company_name}
                    {hasFunding && <span style={{ fontSize: 9, marginLeft: 5, color: '#854d0e', background: '#fef9c3', padding: '1px 5px', borderRadius: 6 }}>💰</span>}
                    {hasCont && <span style={{ fontSize: 9, marginLeft: 4, color: '#5b21b6' }}>⚑</span>}
                  </div>
                  <div style={s.rep}>{a.rep_name}</div>
                </div>
                <div style={{ ...s.segPill, borderColor: SEGMENT_COLORS[a.segment] || 'var(--border)', color: SEGMENT_COLORS[a.segment] || 'var(--text-2)' }}>
                  {a.segment}
                </div>
                <div>
                  <div style={s.acv}>{fmtACV(a.acv_usd)}</div>
                  <div style={s.stage}>{a.current_stage}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-2)', minWidth: 44, textAlign: 'right' }}>
                  {a.health.overall_score}/100
                </div>
              </div>
              {isSel && <AccountDetail account={a} />}
            </div>
          )
        })}
      </div>

      {filtered.length > shown && (
        <button style={s.showMore} onClick={() => setShown(n => Math.min(n + 10, filtered.length))}>
          Show more ({filtered.length - shown} remaining)
        </button>
      )}
    </div>
  )
}
