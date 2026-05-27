import { useState, useMemo, useEffect } from 'react'
import AccountDetail from './AccountDetail'
import { fmtACV, HEALTH_COLORS, SEGMENT_COLORS } from '../utils'

const s = {
  statsStrip: { display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 18 },
  stat: {
    background: 'var(--bg)', borderRadius: 'var(--radius-lg)', padding: '14px 16px',
    boxShadow: 'var(--shadow-sm)',
  },
  statLbl: { fontSize: 11, color: 'var(--text-2)', marginBottom: 6, letterSpacing: '-0.005em' },
  statVal: { fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' },

  searchWrap: { position: 'relative', flex: 1, minWidth: 200 },
  searchInput: {
    width: '100%', padding: '8px 30px 8px 12px', fontSize: 13,
    border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    background: 'var(--bg)', color: 'var(--text)', outline: 'none',
    boxSizing: 'border-box', boxShadow: 'var(--shadow-sm)',
  },
  clearBtn: {
    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', color: 'var(--text-3)',
    fontSize: 16, padding: 0, cursor: 'pointer', lineHeight: 1,
  },

  filterBtn: {
    fontSize: 12, padding: '6px 12px', borderRadius: 999,
    border: '1px solid var(--border)', background: 'var(--bg)',
    color: 'var(--text-2)', cursor: 'pointer', boxShadow: 'var(--shadow-sm)',
    letterSpacing: '-0.005em',
  },

  select: {
    fontSize: 12, padding: '6px 28px 6px 12px', borderRadius: 'var(--radius)',
    border: '1px solid var(--border)', background: 'var(--bg)',
    color: 'var(--text)', cursor: 'pointer', outline: 'none',
    boxShadow: 'var(--shadow-sm)',
  },

  activeTag: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontSize: 11, padding: '4px 4px 4px 10px', borderRadius: 999,
    background: 'var(--bg)', border: '1px solid var(--border-2)',
    color: 'var(--text-2)',
  },
  tagX: {
    background: 'var(--bg-2)', border: 'none', cursor: 'pointer',
    color: 'var(--text-2)', fontSize: 12, padding: 0,
    width: 18, height: 18, borderRadius: 999, lineHeight: 1,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },

  queue: { display: 'flex', flexDirection: 'column', gap: 6 },
  row: {
    background: 'var(--bg)',
    borderRadius: 'var(--radius)', padding: '12px 14px 12px 13px',
    cursor: 'pointer',
    display: 'grid', gridTemplateColumns: '1fr auto auto auto',
    gap: 14, alignItems: 'center',
    boxShadow: 'var(--shadow-sm)',
    transition: 'box-shadow 0.15s, transform 0.15s',
  },
  company: { fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' },
  rep: { fontSize: 11, color: 'var(--text-2)', marginTop: 2 },
  segPill: {
    fontSize: 10, padding: '3px 8px', borderRadius: 999,
    border: '1px solid var(--border)', color: 'var(--text-2)', whiteSpace: 'nowrap',
    fontWeight: 500, letterSpacing: '0.01em',
  },
  acv: { fontSize: 13, fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap', letterSpacing: '-0.01em' },
  stage: { fontSize: 11, color: 'var(--text-2)', textAlign: 'right', whiteSpace: 'nowrap', marginTop: 2 },
}

const FILTERS = [
  { key: 'all',             label: 'All',             activeColor: '#1d1d1f' },
  { key: 'critical',        label: 'Critical',        activeColor: 'var(--red)' },
  { key: 'at-risk',         label: 'At Risk',         activeColor: 'var(--amber)' },
  { key: 'needs-attention', label: 'Needs Attention', activeColor: 'var(--blue)' },
  { key: 'healthy',         label: 'Healthy',         activeColor: 'var(--green)' },
]

const SORT_OPTIONS = [
  { key: 'priority',      label: 'Priority score' },
  { key: 'acv-desc',      label: 'ACV (high to low)' },
  { key: 'health-asc',    label: 'Health (worst first)' },
  { key: 'health-desc',   label: 'Health (best first)' },
  { key: 'freshness-asc', label: 'Staleness (least active first)' },
]

const REL_LABELS = { reliable: 'Reliable', questionable: 'Questionable', unreliable: 'Unreliable' }

function sortAccounts(accounts, sortBy) {
  if (sortBy === 'acv-desc')      return [...accounts].sort((a, b) => (b.acv_usd || 0) - (a.acv_usd || 0))
  if (sortBy === 'health-asc')    return [...accounts].sort((a, b) => a.health.overall_score - b.health.overall_score)
  if (sortBy === 'health-desc')   return [...accounts].sort((a, b) => b.health.overall_score - a.health.overall_score)
  if (sortBy === 'freshness-asc') return [...accounts].sort((a, b) => a.health.freshness - b.health.freshness)
  return [...accounts].sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0))
}

export default function AccountQueue({ data, navFilters, onNavConsumed }) {
  const [filter, setFilter]               = useState('all')
  const [repFilter, setRepFilter]         = useState('')
  const [stageFilter, setStageFilter]     = useState('')
  const [segmentFilter, setSegmentFilter] = useState('')
  const [reliabilityFilter, setReliabilityFilter] = useState('')
  const [fundingFilter, setFundingFilter] = useState(false)
  const [urgencyFilter, setUrgencyFilter] = useState(false)
  const [sortBy, setSortBy]               = useState('priority')
  const [search, setSearch]               = useState('')
  const [selectedId, setSelectedId]       = useState(null)

  const es       = data.executive_summary
  const accounts = data.accounts || []

  const reps     = useMemo(() => [...new Set(accounts.map(a => a.rep_name))].sort(), [accounts])
  const stages   = useMemo(() => [...new Set(accounts.map(a => a.current_stage))].sort(), [accounts])
  const segments = useMemo(() => [...new Set(accounts.map(a => a.segment))].sort(), [accounts])

  useEffect(() => {
    if (navFilters === null) return
    setFilter(navFilters.health || 'all')
    setRepFilter(navFilters.rep || '')
    setStageFilter(navFilters.stage || '')
    setSegmentFilter(navFilters.segment || '')
    setReliabilityFilter(navFilters.reliability || '')
    setFundingFilter(!!navFilters.funding)
    setUrgencyFilter(!!navFilters.urgency)
    setSortBy(navFilters.sortBy || 'priority')
    setSearch('')
    setSelectedId(null)
    onNavConsumed?.()
  }, [navFilters])  // eslint-disable-line react-hooks/exhaustive-deps

  const isFiltered = (
    filter !== 'all' || repFilter || stageFilter || segmentFilter ||
    reliabilityFilter || fundingFilter || urgencyFilter || search
  )

  const filtered = useMemo(() => {
    const base = accounts.filter(a => {
      const healthOk      = filter === 'all'   || a.health.label === filter
      const repOk         = !repFilter         || a.rep_name === repFilter
      const stageOk       = !stageFilter       || a.current_stage === stageFilter
      const segmentOk     = !segmentFilter     || a.segment === segmentFilter
      const reliabilityOk = !reliabilityFilter || a.health.reliability_tag === reliabilityFilter
      const fundingOk     = !fundingFilter     || !!a.intelligence?.timing?.funding_detected
      const urgencyOk     = !urgencyFilter     || (a.intelligence?.timing?.urgency_signals || []).length > 0
      const q             = search.toLowerCase()
      const searchOk      = !q
        || a.company_name.toLowerCase().includes(q)
        || a.rep_name.toLowerCase().includes(q)
        || a.account_id.toLowerCase().includes(q)
      return healthOk && repOk && stageOk && segmentOk && reliabilityOk && fundingOk && urgencyOk && searchOk
    })
    return sortAccounts(base, sortBy)
  }, [accounts, filter, repFilter, stageFilter, segmentFilter, reliabilityFilter, fundingFilter, urgencyFilter, search, sortBy])

  const filteredStats = useMemo(() => {
    const totalACV   = filtered.reduce((sum, a) => sum + (a.acv_usd || 0), 0)
    const atRisk     = filtered.filter(a => a.health.label === 'critical' || a.health.label === 'at-risk').length
    const avgHealth  = filtered.length
      ? Math.round(filtered.reduce((sum, a) => sum + a.health.overall_score, 0) / filtered.length)
      : 0
    const unreliable = filtered.filter(a => a.health.reliability_tag === 'unreliable').length
    return { totalACV, atRisk, avgHealth, unreliable }
  }, [filtered])

  function toggleRow(id) {
    setSelectedId(prev => prev === id ? null : id)
  }

  function handleFilter(f) {
    setFilter(f); setSelectedId(null)
  }

  function clearFilters() {
    setFilter('all')
    setRepFilter(''); setStageFilter(''); setSegmentFilter('')
    setReliabilityFilter(''); setFundingFilter(false); setUrgencyFilter(false)
    setSearch(''); setSelectedId(null)
  }

  const navTags = [
    reliabilityFilter && { label: `Reliability: ${REL_LABELS[reliabilityFilter] || reliabilityFilter}`, clear: () => setReliabilityFilter('') },
    fundingFilter     && { label: 'Funding detected', clear: () => setFundingFilter(false) },
    urgencyFilter     && { label: 'Has urgency signals', clear: () => setUrgencyFilter(false) },
  ].filter(Boolean)

  return (
    <div>

      {/* Stats strip */}
      <div style={s.statsStrip}>
        {isFiltered ? (
          <>
            <div style={s.stat}>
              <div style={s.statLbl}>Showing</div>
              <div style={s.statVal}>
                {filtered.length}
                <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-2)' }}> / {accounts.length}</span>
              </div>
            </div>
            <div style={s.stat}>
              <div style={s.statLbl}>ACV in view</div>
              <div style={{ ...s.statVal, color: 'var(--blue)' }}>{fmtACV(filteredStats.totalACV)}</div>
            </div>
            <div style={s.stat}>
              <div style={s.statLbl}>Critical / at-risk</div>
              <div style={{ ...s.statVal, color: 'var(--amber)' }}>{filteredStats.atRisk}</div>
            </div>
            <div style={s.stat}>
              <div style={s.statLbl}>Unreliable forecasts</div>
              <div style={{ ...s.statVal, color: 'var(--red)' }}>{filteredStats.unreliable}</div>
            </div>
            <div style={s.stat}>
              <div style={s.statLbl}>Avg health</div>
              <div style={{ ...s.statVal, color: 'var(--blue)' }}>{filteredStats.avgHealth}/100</div>
            </div>
          </>
        ) : (
          <>
            <div style={s.stat}><div style={s.statLbl}>Total ACV</div><div style={s.statVal}>{fmtACV(es.total_acv)}</div></div>
            <div style={s.stat}><div style={s.statLbl}>ACV at risk</div><div style={{ ...s.statVal, color: 'var(--red)' }}>{fmtACV(es.acv_at_risk)}</div></div>
            <div style={s.stat}><div style={s.statLbl}>Critical / at-risk</div><div style={{ ...s.statVal, color: 'var(--amber)' }}>{(es.health_distribution?.critical || 0) + (es.health_distribution?.['at-risk'] || 0)}</div></div>
            <div style={s.stat}><div style={s.statLbl}>Unreliable commits</div><div style={{ ...s.statVal, color: 'var(--red)' }}>{es.unreliable_commit_count}</div></div>
            <div style={s.stat}><div style={s.statLbl}>Avg intel readiness</div><div style={{ ...s.statVal, color: 'var(--blue)' }}>{es.avg_intelligence_readiness}/100</div></div>
          </>
        )}
      </div>

      {/* Row 1: search + sort */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
        <div style={s.searchWrap}>
          <input
            style={s.searchInput}
            placeholder="Search by company, rep, or account ID"
            value={search}
            onChange={e => { setSearch(e.target.value); setSelectedId(null) }}
          />
          {search && (
            <button style={s.clearBtn} onClick={() => setSearch('')}>×</button>
          )}
        </div>
        <select style={s.select} value={sortBy} onChange={e => setSortBy(e.target.value)}>
          {SORT_OPTIONS.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
        </select>
      </div>

      {/* Row 2: health pills + dropdowns */}
      <div style={{ display: 'flex', gap: 8, marginBottom: navTags.length ? 8 : 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {FILTERS.map(f => {
          const active = filter === f.key
          return (
            <button
              key={f.key}
              style={{
                ...s.filterBtn,
                ...(active ? { background: f.activeColor, color: '#fff', borderColor: f.activeColor } : {}),
              }}
              onClick={() => handleFilter(f.key)}
            >
              {f.label}
            </button>
          )
        })}
        <select style={s.select} value={repFilter} onChange={e => { setRepFilter(e.target.value); setSelectedId(null) }}>
          <option value="">All reps</option>
          {reps.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select style={s.select} value={stageFilter} onChange={e => { setStageFilter(e.target.value); setSelectedId(null) }}>
          <option value="">All stages</option>
          {stages.map(st => <option key={st} value={st}>{st}</option>)}
        </select>
        <select style={s.select} value={segmentFilter} onChange={e => { setSegmentFilter(e.target.value); setSelectedId(null) }}>
          <option value="">All segments</option>
          {segments.map(sg => <option key={sg} value={sg}>{sg}</option>)}
        </select>
      </div>

      {/* Row 3: nav tags + clear */}
      {(navTags.length > 0 || isFiltered) && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          {navTags.map((tag, i) => (
            <span key={i} style={s.activeTag}>
              {tag.label}
              <button style={s.tagX} onClick={tag.clear} aria-label="Remove filter">×</button>
            </span>
          ))}
          {isFiltered && (
            <button style={{ ...s.filterBtn, color: 'var(--text-3)', fontSize: 11 }} onClick={clearFilters}>
              Clear all
            </button>
          )}
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 10 }}>
        {filtered.length} account{filtered.length !== 1 ? 's' : ''}
        {isFiltered ? ' match filters' : ''}
      </div>

      {/* Queue rows — show all filtered, no pagination */}
      <div style={s.queue}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-2)', background: 'var(--bg)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
            No accounts match the active filters.
          </div>
        )}
        {filtered.map(a => {
          const isSel      = selectedId === a.account_id
          const hc         = HEALTH_COLORS[a.health.label] || '#888'
          const hasFunding = a.intelligence?.timing?.funding_detected
          const hasCont    = a.gaps?.critical_contradictions > 0
          const isStale    = a.health.freshness < 0.4

          return (
            <div key={a.account_id}>
              <div
                style={{
                  ...s.row,
                  borderLeft: `3px solid ${hc}`,
                  ...(isSel ? { boxShadow: 'var(--shadow-md)' } : {}),
                }}
                onClick={() => toggleRow(a.account_id)}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={s.company}>
                    {a.company_name}
                    {hasFunding && (
                      <span title="Funding event detected" style={{ fontSize: 10, marginLeft: 7, color: '#a16500', background: '#fff8e1', padding: '2px 7px', borderRadius: 6, cursor: 'help', fontWeight: 500 }}>
                        Funding
                      </span>
                    )}
                    {hasCont && (
                      <span title="Data contradictions detected — forecast reliability affected" style={{ fontSize: 10, marginLeft: 6, color: '#6b21a8', background: '#f3e8ff', padding: '2px 7px', borderRadius: 6, cursor: 'help', fontWeight: 500 }}>
                        Contradiction
                      </span>
                    )}
                    {isStale && (
                      <span title="Low activity cadence for this deal stage" style={{ fontSize: 10, marginLeft: 6, color: '#a16500', background: '#fff8e1', padding: '2px 7px', borderRadius: 6, cursor: 'help', fontWeight: 500 }}>
                        Stale
                      </span>
                    )}
                  </div>
                  <div style={s.rep}>{a.rep_name}</div>
                </div>

                <div style={{ ...s.segPill, borderColor: SEGMENT_COLORS[a.segment] || 'var(--border-2)', color: SEGMENT_COLORS[a.segment] || 'var(--text-2)' }}>
                  {a.segment}
                </div>

                <div>
                  <div style={s.acv}>{fmtACV(a.acv_usd)}</div>
                  <div style={s.stage}>{a.current_stage}</div>
                </div>

                <div style={{ fontSize: 14, fontWeight: 600, minWidth: 52, textAlign: 'right', color: hc, letterSpacing: '-0.02em' }}>
                  {a.health.overall_score}
                  <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-3)' }}>/100</span>
                </div>
              </div>

              {isSel && <AccountDetail account={a} />}
            </div>
          )
        })}
      </div>

    </div>
  )
}
