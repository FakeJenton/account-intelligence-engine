import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { fmtACV, HEALTH_COLORS, HEALTH_LABELS } from '../utils'
import { SectionLabel, StatCard, ArrowIcon } from './ui'

const REL_COLOR = { reliable: 'var(--green)', questionable: 'var(--amber)', unreliable: 'var(--red)' }
const REL_LABEL = { reliable: 'Reliable', questionable: 'Questionable', unreliable: 'Unreliable' }

const s = {
  section: { marginBottom: 'var(--space-6)' },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 'var(--space-3)',
    marginBottom: 'var(--space-5)',
  },
  twoCol: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 'var(--space-4)',
    marginBottom: 'var(--space-5)',
  },
  panel: {
    background: 'var(--bg)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-4) var(--space-5)',
    boxShadow: 'var(--shadow-sm)',
  },
  covRow: { display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' },
  covLabel: { fontSize: 'var(--text-sm)', color: 'var(--text-2)', width: 160, flexShrink: 0 },
  covBar: { flex: 1, height: 6, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' },
  covFill: { height: 6, borderRadius: 3 },
  covVal: { fontSize: 'var(--text-sm)', color: 'var(--text-2)', minWidth: 36, textAlign: 'right', fontWeight: 500 },
  insightCard: {
    background: 'var(--bg)',
    borderRadius: 'var(--radius)',
    padding: 'var(--space-3) var(--space-4)',
    marginBottom: 'var(--space-2)',
    boxShadow: 'var(--shadow-sm)',
  },
  insightTitle: { fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)', letterSpacing: 'var(--track-tight)' },
  insightBody: { fontSize: 'var(--text-sm)', color: 'var(--text-2)', lineHeight: 1.55, marginBottom: 'var(--space-1)' },
  insightImpl: { fontSize: 'var(--text-xs)', color: 'var(--text-2)', fontStyle: 'italic' },

  table: { width: '100%', fontSize: 'var(--text-sm)', borderCollapse: 'separate', borderSpacing: 0 },
  th: {
    fontSize: 'var(--text-xs)',
    fontWeight: 600,
    color: 'var(--text-3)',
    textAlign: 'left',
    padding: 'var(--space-2) var(--space-3)',
    borderBottom: '1px solid var(--border)',
    background: 'transparent',
  },
  td: {
    padding: 'var(--space-3)',
    fontSize: 'var(--text-sm)',
    borderBottom: '1px solid var(--border)',
  },
}

function CovRow({ label, pct, color = 'var(--blue)' }) {
  return (
    <div style={s.covRow}>
      <span style={s.covLabel}>{label}</span>
      <div style={s.covBar}>
        <div style={{ ...s.covFill, width: `${Math.round(pct * 100)}%`, background: color }} />
      </div>
      <span style={s.covVal}>{Math.round(pct * 100)}%</span>
    </div>
  )
}

function MiniTile({ label, value, color, onClick }) {
  const interactive = !!onClick
  return (
    <div
      onClick={onClick}
      className={interactive ? 'card-interactive' : undefined}
      style={{
        flex: 1,
        background: 'var(--bg-2)',
        borderRadius: 'var(--radius)',
        padding: 'var(--space-3)',
        cursor: interactive ? 'pointer' : 'default',
        position: 'relative',
      }}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
    >
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-2)', marginBottom: 'var(--space-1)' }}>{label}</div>
      <div style={{
        fontSize: 'var(--text-base)',
        fontWeight: 600,
        color: color || 'var(--text)',
        letterSpacing: 'var(--track-tight)',
      }}>
        {value}
      </div>
      {interactive && (
        <ArrowIcon style={{ position: 'absolute', top: 10, right: 10, color: 'var(--text-3)', opacity: 0.6 }} size={12} />
      )}
    </div>
  )
}

export default function ExecSummary({ data, onNavigate }) {
  const es = data.executive_summary
  const cov = es.intelligence_coverage
  const healthDist = es.health_distribution
  const relDist = es.reliability_distribution

  const relTotal = Object.values(relDist).reduce((a, b) => a + b, 0)

  const healthData = Object.entries(healthDist).map(([key, count]) => ({
    label: HEALTH_LABELS[key] || key,
    key,
    count,
    color: HEALTH_COLORS[key] || '#888',
  }))

  const topGaps = (es.top_gap_types || []).slice(0, 6).map(g => ({
    label: g.label
      .replace('No ', '').replace(' not logged', '').replace(' not identified', '')
      .replace(' not defined', '').replace(' not confirmed', '')
      .replace(' not shared', '').replace(' not engaged', ''),
    count: g.count,
  }))

  return (
    <div>

      {/* Top stats */}
      <div style={s.statsGrid}>
        <StatCard label="Total pipeline ACV" value={fmtACV(es.total_acv)} />
        <StatCard
          label="ACV at risk"
          value={fmtACV(es.acv_at_risk)}
          color="var(--red)"
          onClick={onNavigate ? () => onNavigate({ sortBy: 'acv-desc', health: 'at-risk' }) : undefined}
        />
        <StatCard
          label="Critical / at-risk"
          value={`${(healthDist.critical || 0) + (healthDist['at-risk'] || 0)}`}
          color="var(--amber)"
          onClick={onNavigate ? () => onNavigate({ sortBy: 'health-asc' }) : undefined}
        />
        <StatCard
          label="Unreliable commits"
          value={es.unreliable_commit_count}
          color="var(--red)"
          onClick={onNavigate ? () => onNavigate({ reliability: 'unreliable' }) : undefined}
        />
        <StatCard label="Avg health score" value={`${es.avg_health_score}/100`} color="var(--blue)" />
      </div>

      <div style={s.twoCol}>

        {/* Left column */}
        <div>
          <div style={s.panel}>

            <SectionLabel>Health distribution</SectionLabel>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={healthData} layout="vertical" margin={{ left: 10, right: 30, top: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 12, fill: 'var(--text-2)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v) => [`${v} accounts`, '']}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-md)',
                    background: 'var(--bg)',
                  }}
                  cursor={{ fill: 'var(--bg-2)' }}
                />
                <Bar
                  dataKey="count"
                  radius={4}
                  cursor={onNavigate ? 'pointer' : 'default'}
                  onClick={onNavigate ? (d) => onNavigate({ health: d.key }) : undefined}
                >
                  {healthData.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.85} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <SectionLabel style={{ marginTop: 'var(--space-5)' }}>Forecast reliability</SectionLabel>
            {Object.entries(relDist).map(([label, count]) => (
              <div
                key={label}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                  marginBottom: 'var(--space-2)',
                  cursor: onNavigate ? 'pointer' : 'default',
                  padding: '2px 4px',
                  margin: '-2px -4px',
                  borderRadius: 6,
                }}
                onClick={onNavigate ? () => onNavigate({ reliability: label }) : undefined}
                title={onNavigate ? `View ${REL_LABEL[label] || label} accounts in queue` : undefined}
                role={onNavigate ? 'button' : undefined}
                tabIndex={onNavigate ? 0 : undefined}
                onKeyDown={onNavigate ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate({ reliability: label }) } } : undefined}
              >
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)', width: 96 }}>{REL_LABEL[label] || label}</span>
                <div style={{ flex: 1, height: 6, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: 6, borderRadius: 3,
                    width: `${Math.round(count / (relTotal || 1) * 100)}%`,
                    background: REL_COLOR[label] || '#888',
                    opacity: 0.85,
                  }} />
                </div>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)', minWidth: 28, fontWeight: 500 }}>{count}</span>
              </div>
            ))}

          </div>

          <div style={{ ...s.panel, marginTop: 'var(--space-3)' }}>
            <SectionLabel>CRM data coverage</SectionLabel>
            <CovRow label="Champion logged" pct={cov.champion_crm_pct} />
            <CovRow label="Economic buyer" pct={cov.econ_buyer_crm_pct} />
            <CovRow label="Exec sponsor engaged" pct={cov.exec_engaged_pct} color={cov.exec_engaged_pct < 0.5 ? 'var(--amber)' : 'var(--blue)'} />
            <CovRow label="Use case defined" pct={cov.use_case_defined_pct} />
            <CovRow label="Competitive logged" pct={cov.competitive_crm_pct} />
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
              <MiniTile
                label="Funding detected"
                value={<>{cov.funding_detected_count} <span style={{ fontSize: 'var(--text-sm)', fontWeight: 400, color: 'var(--text-2)' }}>accounts</span></>}
                color="var(--amber)"
                onClick={onNavigate ? () => onNavigate({ funding: true }) : undefined}
              />
              <MiniTile
                label="Active urgency signals"
                value={<>{cov.urgency_signal_count} <span style={{ fontSize: 'var(--text-sm)', fontWeight: 400, color: 'var(--text-2)' }}>accounts</span></>}
                color="var(--amber)"
                onClick={onNavigate ? () => onNavigate({ urgency: true }) : undefined}
              />
            </div>
          </div>
        </div>

        {/* Right column */}
        <div>
          <div style={s.panel}>
            <SectionLabel>Top gap types across fleet</SectionLabel>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={topGaps} layout="vertical" margin={{ left: 10, right: 30, top: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 12, fill: 'var(--text-2)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v) => [`${v} accounts`, '']}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-md)',
                    background: 'var(--bg)',
                  }}
                  cursor={{ fill: 'var(--bg-2)' }}
                />
                <Bar dataKey="count" fill="var(--blue)" fillOpacity={0.85} radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ ...s.panel, marginTop: 'var(--space-3)' }}>
            <SectionLabel>Segment breakdown</SectionLabel>
            {Object.entries(es.segment_breakdown || {}).map(([seg, d], idx, arr) => (
              <div
                key={seg}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: 'var(--space-3) 0',
                  borderBottom: idx < arr.length - 1 ? '1px solid var(--border)' : 'none',
                  cursor: onNavigate ? 'pointer' : 'default',
                }}
                onClick={onNavigate ? () => onNavigate({ segment: seg }) : undefined}
                title={onNavigate ? `View ${seg} accounts in queue` : undefined}
                role={onNavigate ? 'button' : undefined}
                tabIndex={onNavigate ? 0 : undefined}
                onKeyDown={onNavigate ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate({ segment: seg }) } } : undefined}
              >
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, letterSpacing: 'var(--track-tight)' }}>{seg}</span>
                <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--text-2)', alignItems: 'center' }}>
                  <span>{d.count} accts</span>
                  <span style={{ color: 'var(--blue)', fontWeight: 500 }}>{d.avg_health}/100</span>
                  <span style={{ fontWeight: 500 }}>{fmtACV(d.total_acv)}</span>
                  <span style={{ color: d.at_risk_pct > 0.2 ? 'var(--red)' : 'var(--text-2)' }}>{Math.round(d.at_risk_pct * 100)}% at risk</span>
                  {onNavigate && <ArrowIcon size={12} style={{ color: 'var(--text-3)' }} />}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Insights */}
      <div style={s.section}>
        <SectionLabel>Non-obvious findings</SectionLabel>
        {(es.non_obvious_insights || []).map((ins, i) => (
          <div key={i} style={s.insightCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={s.insightTitle}>{ins.title}</div>
              {onNavigate && (
                <button
                  onClick={() => onNavigate({})}
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-3)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0 0 0 14px',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  View accounts <ArrowIcon size={12} />
                </button>
              )}
            </div>
            <div style={s.insightBody}>{ins.finding}</div>
            <div style={s.insightImpl}>{ins.implication}</div>
          </div>
        ))}
      </div>

      {/* Rep scorecard */}
      <div style={s.section}>
        <SectionLabel>Rep scorecard, by at-risk exposure</SectionLabel>
        <div style={{ ...s.panel, padding: 0, overflow: 'hidden' }}>
          <table className="table-zebra" style={s.table}>
            <thead>
              <tr>
                {['Rep', 'Accounts', 'At-risk', 'Total ACV', 'ACV at risk', 'Avg health', 'Dominant gap'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(es.rep_scorecard || []).slice(0, 12).map((r, i, arr) => {
                const isLast = i === arr.length - 1
                const tdStyle = { ...s.td, ...(isLast ? { borderBottom: 'none' } : {}) }
                return (
                  <tr
                    key={i}
                    onClick={() => onNavigate?.({ rep: r.rep_name })}
                    style={{ cursor: onNavigate ? 'pointer' : 'default' }}
                    title={onNavigate ? `View ${r.rep_name}'s accounts` : undefined}
                  >
                    <td style={{ ...tdStyle, fontWeight: 600, letterSpacing: 'var(--track-tight)' }}>{r.rep_name}</td>
                    <td style={tdStyle}>{r.total_accounts}</td>
                    <td style={{ ...tdStyle, color: r.at_risk_count > 1 ? 'var(--red)' : 'inherit', fontWeight: r.at_risk_count > 1 ? 600 : 400 }}>{r.at_risk_count}</td>
                    <td style={tdStyle}>{fmtACV(r.total_acv)}</td>
                    <td style={tdStyle}>{fmtACV((es.accounts_by_rep || {})[r.rep_name]?.acv_at_risk || 0)}</td>
                    <td style={{ ...tdStyle, color: r.avg_health_score < 60 ? 'var(--red)' : r.avg_health_score < 75 ? 'var(--amber)' : 'var(--green)', fontWeight: 600 }}>{r.avg_health_score}</td>
                    <td style={{ ...tdStyle, fontSize: 'var(--text-xs)', color: 'var(--text-2)' }}>{(r.dominant_gap || '').replace(/_/g, ' ')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
