import { useState, useMemo, useEffect } from 'react'
import AccountDetail from './AccountDetail'
import { fmtACV, HEALTH_COLORS, HEALTH_LABELS, SEGMENT_COLORS } from '../utils'

const s = {
  statsStrip: { display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 14 },
  stat: { background: 'var(--bg-2)', borderRadius: 8, padding: '10px 12px' },
  statLbl: { fontSize: 11, color: 'var(--text-2)', marginBottom: 3 },
  statVal: { fontSize: 18, fontWeight: 500 },
  searchWrap: { position: 'relative', flex: 1, minWidth: 160 },
  searchInput: {
    width: '100%', padding: '5px 28px 5px 10px', fontSize: 12,
    border: '0.5px solid var(--border-2)', borderRadius: 8,
    background: 'var(--bg-2)', color: 'var(--text)', outline: 'none',
    boxSizing: 'border-box',
  },
  clearBtn: {
    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', color: 'var(--text-2)', fontSize: 14, padding: 0, cursor: 'pointer',
  },
  filterBtn: {
    fontSize: 11, padding: '4px 10px', borderRadius: 20,
    border: '0.5px solid var(--border-2)', background: 'var(--bg-2)',
    color: 'var(--text-2)', cursor: 'pointer',
  },
  select: {
    fontSize: 11, padding: '4px 8px', borderRadius: 8,
    border: '0.5px solid var(--border-2)', background: 'var(--bg-2)',
    color: 'var(--text)', cursor: 'pointer', outline: 'none',
  },
  queue: { display: 'flex', flexDirection: 'column', gap: 5 },
  row: {
    background: 'var(--bg)', border: '0.5px solid var(--border)',
    borderRadius: 8, padding: '9px 12px', cursor: 'pointer',
    display: 'grid', gridTemplateColumns: '1fr auto auto auto',
    gap: 8, alignItems: 'center',
    transition: 'border-color 0.1s',
  },
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
  { key: 'all',              label: 'All',             activeColor: '#1a1917' },
  { key: 'critical',         label: 'Critical',        activeColor: '#dc2626' },
  { key: 'at-risk',          label: 'At Risk',         activeColor: '#d97706' },
  { key: 'needs-attention',  label: 'Needs Attention', activeColor: '#2563eb' },
  { key: 'healthy',          label: 'Healthy',         activeColor: '#16a34a' },
]

const SORT_OPTIONS = [
  { key: 'priority',      label: 'Priority score' },
  { key: 'acv-desc',      label: 'ACV (high to low)' },
  { key: 'health-asc',    label: 'Health (worst first)' },
  { key: 'freshness-asc', label: 'Staleness (least active first)' },
]

function sortAccounts(accounts, sortBy) {
  if (sortBy === 'acv-desc')      return [...accounts].sort((a, b) => (b.acv_usd || 0) - (a.acv_usd || 0))
  if (sortBy === 'health-asc')    return [...accounts].sort((a, b) => a.health.overall_score - b.health.overall_score)
  if (sortBy === 'freshness-asc') return [...accounts].sort((a, b) => a.health.freshness - b.health.freshness)
  return [...accounts].sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0))
}

export default function AccountQueue({ data, navFilters, onNavConsumed }) {
  const [filter, setFilter] = useState('all')
  const [repFilter, setRepFilter] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [sortBy, setSortBy] = useState('priority')
  const [search, setSearch] = useState('')
  const [shown, setShown] = useState(25)
  const [selectedId, setSelectedId] = useState(null)

  const es = data.executive_summary
  const accounts = data.accounts || []

  const reps   = useMemo(() => [...new Set(accounts.map(a => a.rep_name))].sort(), [accounts])
  const stages = useMemo(() => [...new Set(accounts.map(a => a.current_stage))].sort(), [accounts])

  // Apply filters pushed from Exec Summary
  useEffect(() => {
    if (navFilters === null) return
    setFilter(navFilters.health || 'all')
    setRepFilter(navFilters.rep || '')
    setStageFilter(navFilters.stage || '')
    setSearch('')
    setShown(25)
    setSelectedId(null)
    onNavConsumed?.()
  }, [navFilters])  // eslint-disable-line react-hooks/exhaustive-deps

  const isFiltered = filter !== 'all' || repFilter !== '' || stageFilter !== '' || search !== ''

  const filtered = useMemo(() => {
    const base = accounts.filter(a => {
      const healthOk  = filter === 'all' || a.health.label === filter
      const repOk     = !repFilter   || a.rep_name === repFilter
      const stageOk   = !stageFilter || a.current_stage === stageFilter
      const q         = search.toLowerCase()
      const searchOk  = !q || a.company_name.toLowerCase().includes(q)
                            || a.rep_name.toLowerCase().includes(q)
                            || a.account_id.toLowerCase().includes(q)
      return healthOk && repOk && stageOk && searchOk
    })
    return sortAccounts(base, sortBy)
  }, [accounts, filter, repFilter, stageFilter, search, sortBy])

  const filteredStats = useMemo(() => {
    const totalACV   = filtered.reduce((sum, a) => sum + (a.acv_usd || 0), 0)
    const atRisk     = filtered.filter(a => a.health.label === 'critical' || a.health.label === 'at-risk').length
    const avgHealth  = filtered.length
      ? Math.round(filtered.reduce((sum, a) => sum + a.health.overall_score, 0) / filtered.length)
      : 0
    const unreliable = filtered.filter(a => a.health.reliability_tag === 'unreliable').length
    return { totalACV, atRisk, avgHealth, unreliable }
  }, [filtered])

  const visible = filtered.slice(0, shown)

  function toggleRow(id) {
    setSelectedId(prev => prev === id ? null : id)
  }

  function handleFilter(f) {
    setFilter(f); setShown(25); setSelectedId(null)
  }

  function clearFilters() {
    setFilter('all'); setRepFilter(''); setStageFilter(''); setSearch(''); setShown(25); setSelectedId(null)
  }

  return (
    <div>

      {/* Stats strip — shows filtered context when filters are active */}
      <div style={s.statsStrip}>
        {isFiltered ? (
          <>
            <div style={s.stat}>
              <div style={s.statLbl}>Showing</div>
              <div style={s.statVal}>
                {filtered.length}
                <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-2)' }}> / {accounts.length}</span>
              </div>
            </div>
            <div style={s.stat}>
              <div style={s.statLbl}>ACV in view</div>
              <div style={{ ...s.statVal, color: '#2563eb' }}>{fmtACV(filteredStats.totalACV)}</div>
            </div>
            <div style={s.stat}>
              <div style={s.statLbl}>Critical / at-risk</div>
              <div style={{ ...s.statVal, color: '#d97706' }}>{filteredStats.atRisk}</div>
            </div>
            <div style={s.stat}>
              <div style={s.statLbl}>Unreliable forecasts</div>
              <div style={{ ...s.statVal, color: '#dc2626' }}>{filteredStats.unreliable}</div>
            </div>
            <div style={s.stat}>
              <div style={s.statLbl}>Avg health</div>
              <div style={{ ...s.statVal, color: '#2563eb' }}>{filteredStats.avgHealth}/100</div>
            </div>
          </>
        ) : (
          <>
            <div style={s.stat}><div style={s.statLbl}>Total ACV</div><div style={s.statVal}>{fmtACV(es.total_acv)}</div></div>
            <div style={s.stat}><div style={s.statLbl}>ACV at risk</div><div style={{ ...s.statVal, color: '#dc2626' }}>{fmtACV(es.acv_at_risk)}</div></div>
            <div style={s.stat}><div style={s.statLbl}>Critical / at-risk</div><div style={{ ...s.statVal, color: '#d97706' }}>{(es.health_distribution?.critical || 0) + (es.health_distribution?.['at-risk'] || 0)}</div></div>
            <div style={s.stat}><div style={s.statLbl}>Unreliable commits</div><div style={{ ...s.statVal, color: '#dc2626' }}>{es.unreliable_commit_count}</div></div>
            <div style={s.stat}><div style={s.statLbl}>Avg intel readiness</div><div style={{ ...s.statVal, color: '#2563eb' }}>{es.avg_intelligence_readiness}/100</div></div>
          </>
        )}
      </div>

      {/* Row 1: search + sort */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
        <div style={s.searchWrap}>
          <input
            style={s.searchInput}
            placeholder="Search by company, rep, or account ID..."
            value={search}
            onChange={e => { setSearch(e.target.value); setShown(25); setSelectedId(null) }}
          />
          {search && (
            <button style={s.clearBtn} onClick={() => { setSearch(''); setShown(25) }}>×</button>
          )}
        </div>
        <select style={s.select} value={sortBy} onChange={e => setSortBy(e.target.value)}>
          {SORT_OPTIONS.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
        </select>
      </div>

      {/* Row 2: health filters + rep + stage + clear */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
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
        <select
          style={s.select}
          value={repFilter}
          onChange={e => { setRepFilter(e.target.value); setShown(25); setSelectedId(null) }}
        >
          <option value="">All reps</option>
          {reps.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          style={s.select}
          value={stageFilter}
          onChange={e => { setStageFilter(e.target.value); setShown(25); setSelectedId(null) }}
        >
          <option value="">All stages</option>
          {stages.map(st => <option key={st} value={st}>{st}</option>)}
        </select>
        {isFiltered && (
          <button
            style={{ ...s.filterBtn, color: 'var(--text-3)', fontSize: 10 }}
            onClick={clearFilters}
          >
            Clear filters ×
          </button>
        )}
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 8 }}>
        {filtered.length} account{filtered.length !== 1 ? 's' : ''}
        {isFiltered ? ' match filters' : ' · sorted by priority'}
      </div>

      {/* Queue rows */}
      <div style={s.queue}>
        {visible.length === 0 && (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-2)' }}>
            No accounts match this filter.
          </div>
        )}
        {visible.map(a => {
          const isSel     = selectedId === a.account_id
          const hc        = HEALTH_COLORS[a.health.label] || '#888'
          const hasFunding = a.intelligence?.timing?.funding_detected
          const hasCont   = a.gaps?.critical_contradictions > 0
          const isStale   = a.health.freshness < 0.4

          return (
            <div key={a.account_id}>
              <div
                style={{
                  ...s.row,
                  borderLeft: `3px solid ${hc}`,
                  ...(isSel ? { borderTopColor: 'var(--border-2)', borderRightColor: 'var(--border-2)', borderBottomColor: 'var(--border-2)' } : {}),
                }}
                onClick={() => toggleRow(a.account_id)}
              >
                {/* Company + rep */}
                <div>
                  <div style={s.company}>
                    {a.company_name}
                    {hasFunding && (
                      <span
                        title="Funding event detected"
                        style={{ fontSize: 9, marginLeft: 5, color: '#854d0e', background: '#fef9c3', padding: '1px 5px', borderRadius: 6, cursor: 'help' }}
                      >
                        💰
                      </span>
                    )}
                    {hasCont && (
                      <span
                        title="Data contradictions detected — forecast reliability affected"
                        style={{ fontSize: 9, marginLeft: 4, color: '#5b21b6', cursor: 'help' }}
                      >
                        ⚑
                      </span>
                    )}
                    {isStale && (
                      <span
                        title="Low activity cadence for this deal stage"
                        style={{ fontSize: 9, marginLeft: 5, color: '#92400e', background: 'rgba(217,119,6,0.12)', padding: '1px 5px', borderRadius: 6, cursor: 'help' }}
                      >
                        Stale
                      </span>
                    )}
                  </div>
                  <div style={s.rep}>{a.rep_name}</div>
                </div>

                {/* Segment */}
                <div style={{ ...s.segPill, borderColor: SEGMENT_COLORS[a.segment] || 'var(--border)', color: SEGMENT_COLORS[a.segment] || 'var(--text-2)' }}>
                  {a.segment}
                </div>

                {/* ACV + stage */}
                <div>
                  <div style={s.acv}>{fmtACV(a.acv_usd)}</div>
                  <div style={s.stage}>{a.current_stage}</div>
                </div>

                {/* Health score */}
                <div style={{ fontSize: 12, fontWeight: 600, minWidth: 44, textAlign: 'right', color: hc }}>
                  {a.health.overall_score}
                  <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-3)' }}>/100</span>
                </div>
              </div>

              {isSel && <AccountDetail account={a} />}
            </div>
          )
        })}
      </div>

      {filtered.length > shown && (
        <button style={s.showMore} onClick={() => setShown(n => Math.min(n + 25, filtered.length))}>
          Show more ({filtered.length - shown} remaining)
        </button>
      )}

    </div>
  )
}
