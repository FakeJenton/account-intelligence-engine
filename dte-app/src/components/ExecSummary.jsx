import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { fmtACV, HEALTH_COLORS, HEALTH_LABELS } from '../utils'

const s = {
  section: { marginBottom: 26 },
  sectionLabel: {
    fontSize: 11, fontWeight: 600, color: 'var(--text-2)',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12,
  },
  statsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 22,
  },
  statCard: {
    background: 'var(--bg)', borderRadius: 'var(--radius-lg)', padding: '14px 16px',
    boxShadow: 'var(--shadow-sm)',
    transition: 'box-shadow 0.15s, transform 0.15s',
  },
  statCardInteractive: {
    cursor: 'pointer',
  },
  statLabel: { fontSize: 11, color: 'var(--text-2)', marginBottom: 6, letterSpacing: '-0.005em' },
  statVal: { fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 22 },
  panel: {
    background: 'var(--bg)', borderRadius: 'var(--radius-lg)', padding: '16px 18px',
    boxShadow: 'var(--shadow-sm)',
  },
  covRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 },
  covLabel: { fontSize: 12, color: 'var(--text-2)', width: 160, flexShrink: 0 },
  covBar: { flex: 1, height: 6, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' },
  covFill: { height: 6, borderRadius: 3 },
  covVal: { fontSize: 12, color: 'var(--text-2)', minWidth: 36, textAlign: 'right', fontWeight: 500 },
  insightCard: {
    background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '12px 16px',
    marginBottom: 8, boxShadow: 'var(--shadow-sm)',
  },
  insightTitle: { fontSize: 13, fontWeight: 600, marginBottom: 5, letterSpacing: '-0.01em' },
  insightBody: { fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55, marginBottom: 4 },
  insightImpl: { fontSize: 12, color: 'var(--text-2)', fontStyle: 'italic' },
  repTable: { width: '100%', fontSize: 13, borderCollapse: 'separate', borderSpacing: 0 },
  repTh: {
    fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textAlign: 'left',
    padding: '8px 10px', borderBottom: '1px solid var(--border)',
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  repTd: { padding: '10px', borderBottom: '1px solid var(--border)', fontSize: 13 },
}

const REL_COLOR = { reliable: 'var(--green)', questionable: 'var(--amber)', unreliable: 'var(--red)' }
const REL_LABEL = { reliable: 'Reliable', questionable: 'Questionable', unreliable: 'Unreliable' }

function StatCard({ label, value, color, onClick }) {
  return (
    <div
      style={{ ...s.statCard, ...(onClick ? s.statCardInteractive : {}) }}
      onClick={onClick}
      title={onClick ? 'View in Account Queue' : undefined}
    >
      <div style={s.statLabel}>{label}</div>
      <div style={{ ...s.statVal, color: color || 'var(--text)' }}>{value}</div>
      {onClick && <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>View in queue →</div>}
    </div>
  )
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

            <div style={s.sectionLabel}>Health distribution</div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={healthData} layout="vertical" margin={{ left: 10, right: 30, top: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 12, fill: 'var(--text-2)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v) => [`${v} accounts`, '']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }}
                  cursor={{ fill: 'var(--bg-2)' }}
                />
                <Bar
                  dataKey="count"
                  radius={4}
                  cursor={onNavigate ? 'pointer' : 'default'}
                  onClick={onNavigate ? (d) => onNavigate({ health: d.key }) : undefined}
                >
                  {healthData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div style={{ ...s.sectionLabel, marginTop: 18 }}>Forecast reliability</div>
            {Object.entries(relDist).map(([label, count]) => (
              <div
                key={label}
                style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7, cursor: onNavigate ? 'pointer' : 'default' }}
                onClick={onNavigate ? () => onNavigate({ reliability: label }) : undefined}
                title={onNavigate ? `View ${REL_LABEL[label] || label} accounts in queue` : undefined}
              >
                <span style={{ fontSize: 12, color: 'var(--text-2)', width: 96 }}>{REL_LABEL[label] || label}</span>
                <div style={{ flex: 1, height: 6, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: 6, borderRadius: 3, width: `${Math.round(count / (relTotal || 1) * 100)}%`, background: REL_COLOR[label] || '#888' }} />
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-2)', minWidth: 28, fontWeight: 500 }}>{count}</span>
              </div>
            ))}

          </div>

          <div style={{ ...s.panel, marginTop: 12 }}>
            <div style={s.sectionLabel}>CRM data coverage</div>
            <CovRow label="Champion logged" pct={cov.champion_crm_pct} />
            <CovRow label="Economic buyer" pct={cov.econ_buyer_crm_pct} />
            <CovRow label="Exec sponsor engaged" pct={cov.exec_engaged_pct} color={cov.exec_engaged_pct < 0.5 ? 'var(--amber)' : 'var(--blue)'} />
            <CovRow label="Use case defined" pct={cov.use_case_defined_pct} />
            <CovRow label="Competitive logged" pct={cov.competitive_crm_pct} />
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <div
                style={{ flex: 1, background: 'var(--bg-2)', borderRadius: 'var(--radius)', padding: '10px 12px', cursor: onNavigate ? 'pointer' : 'default' }}
                onClick={onNavigate ? () => onNavigate({ funding: true }) : undefined}
                title={onNavigate ? 'View accounts with funding detected' : undefined}
              >
                <div style={s.statLabel}>Funding detected</div>
                <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--amber)', letterSpacing: '-0.01em' }}>{cov.funding_detected_count} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-2)' }}>accounts</span></div>
                {onNavigate && <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>View in queue →</div>}
              </div>
              <div
                style={{ flex: 1, background: 'var(--bg-2)', borderRadius: 'var(--radius)', padding: '10px 12px', cursor: onNavigate ? 'pointer' : 'default' }}
                onClick={onNavigate ? () => onNavigate({ urgency: true }) : undefined}
                title={onNavigate ? 'View accounts with active urgency signals' : undefined}
              >
                <div style={s.statLabel}>Active urgency signals</div>
                <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--amber)', letterSpacing: '-0.01em' }}>{cov.urgency_signal_count} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-2)' }}>accounts</span></div>
                {onNavigate && <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>View in queue →</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div>
          <div style={s.panel}>
            <div style={s.sectionLabel}>Top gap types across fleet</div>
            <ResponsiveContainer width="100%" height={175}>
              <BarChart data={topGaps} layout="vertical" margin={{ left: 10, right: 30, top: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 11, fill: 'var(--text-2)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v) => [`${v} accounts`, '']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }}
                  cursor={{ fill: 'var(--bg-2)' }}
                />
                <Bar dataKey="count" fill="var(--blue)" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ ...s.panel, marginTop: 12 }}>
            <div style={s.sectionLabel}>Segment breakdown</div>
            {Object.entries(es.segment_breakdown || {}).map(([seg, d], idx, arr) => (
              <div
                key={seg}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: idx < arr.length - 1 ? '1px solid var(--border)' : 'none',
                  cursor: onNavigate ? 'pointer' : 'default',
                }}
                onClick={onNavigate ? () => onNavigate({ segment: seg }) : undefined}
                title={onNavigate ? `View ${seg} accounts in queue` : undefined}
              >
                <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>{seg}</span>
                <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--text-2)', alignItems: 'center' }}>
                  <span>{d.count} accts</span>
                  <span style={{ color: 'var(--blue)', fontWeight: 500 }}>{d.avg_health}/100</span>
                  <span style={{ fontWeight: 500 }}>{fmtACV(d.total_acv)}</span>
                  <span style={{ color: d.at_risk_pct > 0.2 ? 'var(--red)' : 'var(--text-2)' }}>{Math.round(d.at_risk_pct * 100)}% at risk</span>
                  {onNavigate && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>→</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Insights */}
      <div style={s.section}>
        <div style={s.sectionLabel}>Non-obvious findings</div>
        {(es.non_obvious_insights || []).map((ins, i) => (
          <div key={i} style={s.insightCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={s.insightTitle}>{ins.title}</div>
              {onNavigate && (
                <button
                  onClick={() => onNavigate({})}
                  style={{ fontSize: 11, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 14px', flexShrink: 0, whiteSpace: 'nowrap' }}
                >
                  View accounts →
                </button>
              )}
            </div>
            <div style={s.insightBody}>{ins.finding}</div>
            <div style={s.insightImpl}>→ {ins.implication}</div>
          </div>
        ))}
      </div>

      {/* Rep scorecard */}
      <div style={s.section}>
        <div style={s.sectionLabel}>Rep scorecard — by at-risk exposure</div>
        <div style={{ ...s.panel, padding: '6px 14px 10px' }}>
          <table style={s.repTable}>
            <thead>
              <tr>
                {['Rep', 'Accounts', 'At-risk', 'Total ACV', 'ACV at risk', 'Avg health', 'Dominant gap'].map(h => (
                  <th key={h} style={s.repTh}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(es.rep_scorecard || []).slice(0, 12).map((r, i, arr) => (
                <tr
                  key={i}
                  onClick={() => onNavigate?.({ rep: r.rep_name })}
                  style={{ cursor: onNavigate ? 'pointer' : 'default' }}
                  title={onNavigate ? `View ${r.rep_name}'s accounts` : undefined}
                >
                  <td style={{ ...s.repTd, fontWeight: 600, letterSpacing: '-0.005em', ...(i === arr.length - 1 ? { borderBottom: 'none' } : {}) }}>{r.rep_name}</td>
                  <td style={{ ...s.repTd, ...(i === arr.length - 1 ? { borderBottom: 'none' } : {}) }}>{r.total_accounts}</td>
                  <td style={{ ...s.repTd, color: r.at_risk_count > 1 ? 'var(--red)' : 'inherit', fontWeight: r.at_risk_count > 1 ? 600 : 400, ...(i === arr.length - 1 ? { borderBottom: 'none' } : {}) }}>{r.at_risk_count}</td>
                  <td style={{ ...s.repTd, ...(i === arr.length - 1 ? { borderBottom: 'none' } : {}) }}>{fmtACV(r.total_acv)}</td>
                  <td style={{ ...s.repTd, ...(i === arr.length - 1 ? { borderBottom: 'none' } : {}) }}>{fmtACV((es.accounts_by_rep || {})[r.rep_name]?.acv_at_risk || 0)}</td>
                  <td style={{ ...s.repTd, color: r.avg_health_score < 60 ? 'var(--red)' : r.avg_health_score < 75 ? 'var(--amber)' : 'var(--green)', fontWeight: 600, ...(i === arr.length - 1 ? { borderBottom: 'none' } : {}) }}>{r.avg_health_score}</td>
                  <td style={{ ...s.repTd, fontSize: 12, color: 'var(--text-2)', ...(i === arr.length - 1 ? { borderBottom: 'none' } : {}) }}>{(r.dominant_gap || '').replace(/_/g, ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
