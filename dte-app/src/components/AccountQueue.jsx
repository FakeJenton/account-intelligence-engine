import { useState, useMemo, useEffect } from 'react'
import AccountDetail from './AccountDetail'
import { fmtACV, HEALTH_COLORS, SEGMENT_COLORS } from '../utils'
import { SectionLabel, StatCard, Chip } from './ui'

const s = {
  statsStrip: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5,1fr)',
    gap: 'var(--space-3)',
    marginBottom: 'var(--space-5)',
  },
  searchWrap: { position: 'relative', flex: 1, minWidth: 240 },
  searchInput: {
    width: '100%',
    padding: '8px 32px 8px var(--space-3)',
    fontSize: 'var(--text-sm)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    background: 'var(--bg)',
    color: 'var(--text)',
    outline: 'none',
    boxSizing: 'border-box',
    boxShadow: 'var(--shadow-sm)',
  },
  clearBtn: {
    position: 'absolute',
    right: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    color: 'var(--text-3)',
    fontSize: 16,
    padding: 0,
    cursor: 'pointer',
    lineHeight: 1,
  },
  filterBtn: {
    fontSize: 'var(--text-xs)',
    padding: '6px var(--space-3)',
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text-2)',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-sm)',
    fontWeight: 500,
  },
  select: {
    fontSize: 'var(--text-xs)',
    padding: '6px 28px 6px var(--space-3)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    cursor: 'pointer',
    outline: 'none',
    boxShadow: 'var(--shadow-sm)',
  },
  activeTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    fontSize: 'var(--text-xs)',
    padding: '4px 4px 4px var(--space-3)',
    borderRadius: 999,
    background: 'var(--bg)',
    border: '1px solid var(--border-2)',
    color: 'var(--text-2)',
  },
  tagX: {
    background: 'var(--bg-2)',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-2)',
    fontSize: 12,
    padding: 0,
    width: 18,
    height: 18,
    borderRadius: 999,
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  queue: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' },
  row: {
    background: 'var(--bg)',
    borderRadius: 'var(--radius)',
    padding: 'var(--space-3) var(--space-4) var(--space-3) 13px',
    cursor: 'pointer',
    display: 'grid',
    gridTemplateColumns: '1fr auto auto auto',
    gap: 'var(--space-4)',
    alignItems: 'center',
    boxShadow: 'var(--shadow-sm)',
    transition: 'box-shadow 0.15s, transform 0.15s',
  },
  company: {
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    letterSpacing: 'var(--track-tight)',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
  },
  rep: { fontSize: 'var(--text-xs)', color: 'var(--text-2)', marginTop: 2 },
  segPill: {
    fontSize: 'var(--text-xs)',
    padding: '3px var(--space-2)',
    borderRadius: 999,
    border: '1px solid var(--border)',
    color: 'var(--text-2)',
    whiteSpace: 'nowrap',
    fontWeight: 500,
  },
  acv: { fontSize: 'var(--text-sm)', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap', letterSpacing: 'var(--track-tight)' },
  stage: { fontSize: 'var(--text-xs)', color: 'var(--text-2)', textAlign: 'right', whiteSpace: 'nowrap', marginTop: 2 },
}

const FILTERS = [
  { key: 'all',             label: 'All',             activeColor: 'var(--text)' },
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
            <StatCard label="Showing" value={<>{filtered.length}<span style={{ fontSize: 'var(--text-sm)', fontWeight: 400, color: 'var(--text-2)' }}> / {accounts.length}</span></>} />
            <StatCard label="ACV in view" value={fmtACV(filteredStats.totalACV)} color="var(--blue)" />
            <StatCard label="Critical / at-risk" value={filteredStats.atRisk} color="var(--amber)" />
            <StatCard label="Unreliable forecasts" value={filteredStats.unreliable} color="var(--red)" />
            <StatCard label="Avg health" value={`${filteredStats.avgHealth}/100`} color="var(--blue)" />
          </>
        ) : (
          <>
            <StatCard label="Total ACV" value={fmtACV(es.total_acv)} />
            <StatCard label="ACV at risk" value={fmtACV(es.acv_at_risk)} color="var(--red)" />
            <StatCard label="Critical / at-risk" value={(es.health_distribution?.critical || 0) + (es.health_distribution?.['at-risk'] || 0)} color="var(--amber)" />
            <StatCard label="Unreliable commits" value={es.unreliable_commit_count} color="var(--red)" />
            <StatCard label="Avg intel readiness" value={`${es.avg_intelligence_readiness}/100`} color="var(--blue)" />
          </>
        )}
      </div>

      {/* Row 1: search + sort */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', alignItems: 'center' }}>
        <div style={s.searchWrap}>
          <input
            style={s.searchInput}
            placeholder="Search by company, rep, or account ID"
            value={search}
            onChange={e => { setSearch(e.target.value); setSelectedId(null) }}
          />
          {search && (
            <button style={s.clearBtn} onClick={() => setSearch('')} aria-label="Clear search">×</button>
          )}
        </div>
        <select style={s.select} value={sortBy} onChange={e => setSortBy(e.target.value)}>
          {SORT_OPTIONS.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
        </select>
      </div>

      {/* Row 2: health pills + dropdowns */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: navTags.length ? 'var(--space-2)' : 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
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
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
          {navTags.map((tag, i) => (
            <span key={i} style={s.activeTag}>
              {tag.label}
              <button style={s.tagX} onClick={tag.clear} aria-label="Remove filter">×</button>
            </span>
          ))}
          {isFiltered && (
            <button style={{ ...s.filterBtn, color: 'var(--text-3)', fontSize: 'var(--text-xs)' }} onClick={clearFilters}>
              Clear all
            </button>
          )}
        </div>
      )}

      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-2)', marginBottom: 'var(--space-3)' }}>
        {filtered.length} account{filtered.length !== 1 ? 's' : ''}
        {isFiltered ? ' match filters' : ''}
      </div>

      {/* Queue rows */}
      <div style={s.queue}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-2)', background: 'var(--bg)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
            No accounts match the active filters.
          </div>
        )}
        {filtered.map(a => {
          const isSel      = selectedId === a.account_id
          const hc         = HEALTH_COLORS[a.health.label] || '#888'
          const hasFunding = a.intelligence?.timing?.funding_detected
          const hasCont    = a.gaps?.critical_contradictions > 0
          const isStale    = a.health.freshness < 0.4
          const flagCount  = (hasFunding ? 1 : 0) + (hasCont ? 1 : 0) + (isStale ? 1 : 0)

          return (
            <div key={a.account_id}>
              <div
                className="card-interactive"
                style={{
                  ...s.row,
                  borderLeft: `3px solid ${hc}`,
                  ...(isSel ? { boxShadow: `0 0 0 2px ${hc}33, var(--shadow-md)` } : {}),
                }}
                onClick={() => toggleRow(a.account_id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleRow(a.account_id) } }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={s.company}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.company_name}</span>
                    {flagCount > 2 ? (
                      <Chip variant="amber" title={[
                        hasFunding && 'Funding event detected',
                        hasCont && 'Data contradictions detected',
                        isStale && 'Low activity cadence for this stage',
                      ].filter(Boolean).join(' · ')}>
                        {flagCount} flags
                      </Chip>
                    ) : (
                      <>
                        {hasFunding && <Chip variant="amber" title="Funding event detected">Funding</Chip>}
                        {hasCont && <Chip variant="purple" title="Data contradictions detected — forecast reliability affected">Contradiction</Chip>}
                        {isStale && <Chip variant="amber" title="Low activity cadence for this deal stage">Stale</Chip>}
                      </>
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

                <div style={{
                  fontSize: 'var(--text-base)',
                  fontWeight: 600,
                  minWidth: 56,
                  textAlign: 'right',
                  color: hc,
                  letterSpacing: 'var(--track-display)',
                }}>
                  {a.health.overall_score}
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 400, color: 'var(--text-3)' }}>/100</span>
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
