import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { fmtACV, HEALTH_COLORS, HEALTH_LABELS } from '../utils'

const s = {
  section: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 11, fontWeight: 500, color: 'var(--text-3)',
    textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10,
  },
  statsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 20,
  },
  statCard: {
    background: 'var(--bg-2)', borderRadius: 8, padding: '10px 12px',
  },
  statLabel: { fontSize: 11, color: 'var(--text-2)', marginBottom: 3 },
  statVal: { fontSize: 20, fontWeight: 500 },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 },
  panel: {
    background: 'var(--bg-2)', borderRadius: 10, padding: '12px 14px',
  },
  covRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  covLabel: { fontSize: 11, color: 'var(--text-2)', width: 160, flexShrink: 0 },
  covBar: { flex: 1, height: 5, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' },
  covFill: { height: 5, borderRadius: 3 },
  covVal: { fontSize: 11, color: 'var(--text-2)', minWidth: 36, textAlign: 'right' },
  insightCard: {
    background: 'var(--bg-2)', borderRadius: 8, padding: '10px 14px', marginBottom: 8,
  },
  insightTitle: { fontSize: 13, fontWeight: 500, marginBottom: 4 },
  insightBody: { fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55, marginBottom: 4 },
  insightImpl: { fontSize: 12, color: 'var(--text-2)', fontStyle: 'italic' },
  repTable: { width: '100%', fontSize: 12, borderCollapse: 'collapse' },
  repTh: {
    fontSize: 11, fontWeight: 500, color: 'var(--text-2)', textAlign: 'left',
    padding: '4px 8px', borderBottom: '0.5px solid var(--border)',
  },
  repTd: { padding: '5px 8px', borderBottom: '0.5px solid var(--border)' },
}

function StatCard({ label, value, color }) {
  return (
    <div style={s.statCard}>
      <div style={s.statLabel}>{label}</div>
      <div style={{ ...s.statVal, color: color || 'var(--text)' }}>{value}</div>
    </div>
  )
}

function CovRow({ label, pct, color = '#2563eb' }) {
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
    count,
    color: HEALTH_COLORS[key] || '#888',
  }))

  const topGaps = (es.top_gap_types || []).slice(0, 6).map(g => ({
    label: g.label.replace('No ', '').replace(' not logged', '').replace(' not identified', '').replace(' not defined', '').replace(' not confirmed', '').replace(' not shared', '').replace(' not engaged', ''),
    count: g.count,
  }))

  return (
    <div>
      {/* Top stats */}
      <div style={s.statsGrid}>
        <StatCard label="Total pipeline ACV" value={fmtACV(es.total_acv)} />
        <StatCard label="ACV at risk" value={fmtACV(es.acv_at_risk)} color="#dc2626" />
        <StatCard label="Critical / at-risk" value={`${(healthDist.critical || 0) + (healthDist['at-risk'] || 0)}`} color="#d97706" />
        <StatCard label="Unreliable commits" value={es.unreliable_commit_count} color="#dc2626" />
        <StatCard label="Avg health score" value={`${es.avg_health_score}/100`} color="#2563eb" />
      </div>

      <div style={s.twoCol}>
        {/* Left panel */}
        <div>
          <div style={s.panel}>
            <div style={s.sectionLabel}>Health distribution</div>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={healthData} layout="vertical" margin={{ left: 10, right: 30, top: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 11, fill: 'var(--text-2)' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => [`${v} deals`, '']} contentStyle={{ fontSize: 12, borderRadius: 6, border: '0.5px solid var(--border)' }} />
                <Bar dataKey="count" radius={3}>
                  {healthData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div style={{ ...s.sectionLabel, marginTop: 14 }}>Forecast reliability</div>
            {Object.entries(relDist).map(([label, count]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: 'var(--text-2)', width: 90 }}>{label}</span>
                <div style={{ flex: 1, height: 5, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: 5, borderRadius: 3, width: `${Math.round(count / (relTotal || 1) * 100)}%`, background: label === 'reliable' ? '#16a34a' : label === 'questionable' ? '#d97706' : '#dc2626' }} />
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-2)', minWidth: 24 }}>{count}</span>
              </div>
            ))}
          </div>

          <div style={{ ...s.panel, marginTop: 10 }}>
            <div style={s.sectionLabel}>CRM data coverage</div>
            <CovRow label="Champion logged" pct={cov.champion_crm_pct} />
            <CovRow label="Economic buyer" pct={cov.econ_buyer_crm_pct} />
            <CovRow label="Exec sponsor engaged" pct={cov.exec_engaged_pct} color={cov.exec_engaged_pct < 0.5 ? '#d97706' : '#2563eb'} />
            <CovRow label="Use case defined" pct={cov.use_case_defined_pct} />
            <CovRow label="Competitive logged" pct={cov.competitive_crm_pct} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <div style={{ flex: 1, background: 'var(--bg-3)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={s.statLabel}>Funding detected</div>
                <div style={{ fontSize: 16, fontWeight: 500, color: '#d97706' }}>{cov.funding_detected_count} accounts</div>
              </div>
              <div style={{ flex: 1, background: 'var(--bg-3)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={s.statLabel}>Active urgency signals</div>
                <div style={{ fontSize: 16, fontWeight: 500, color: '#d97706' }}>{cov.urgency_signal_count} accounts</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div>
          <div style={s.panel}>
            <div style={s.sectionLabel}>Top gap types across fleet</div>
            <ResponsiveContainer width="100%" height={165}>
              <BarChart data={topGaps} layout="vertical" margin={{ left: 10, right: 30, top: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 10, fill: 'var(--text-2)' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => [`${v} accounts`, '']} contentStyle={{ fontSize: 12, borderRadius: 6, border: '0.5px solid var(--border)' }} />
                <Bar dataKey="count" fill="#2563eb" radius={3} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ ...s.panel, marginTop: 10 }}>
            <div style={s.sectionLabel}>Segment breakdown</div>
            {Object.entries(es.segment_breakdown || {}).map(([seg, d]) => (
              <div key={seg} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '0.5px solid var(--border)' }}>
                <span style={{ fontSize: 12, fontWeight: 500 }}>{seg}</span>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-2)' }}>
                  <span>{d.count} accts</span>
                  <span style={{ color: '#2563eb' }}>{d.avg_health}/100</span>
                  <span>{fmtACV(d.total_acv)}</span>
                  <span style={{ color: d.at_risk_pct > 0.2 ? '#dc2626' : 'var(--text-2)' }}>{Math.round(d.at_risk_pct * 100)}% at risk</span>
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
                  style={{ fontSize: 11, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 12px', flexShrink: 0, whiteSpace: 'nowrap' }}
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
        <table style={s.repTable}>
          <thead>
            <tr>
              {['Rep', 'Accounts', 'At-risk', 'Total ACV', 'ACV at risk', 'Avg health', 'Dominant gap'].map(h => (
                <th key={h} style={s.repTh}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(es.rep_scorecard || []).slice(0, 12).map((r, i) => (
              <tr
                key={i}
                onClick={() => onNavigate?.({ rep: r.rep_name })}
                style={{ cursor: onNavigate ? 'pointer' : 'default' }}
                title={onNavigate ? `View ${r.rep_name}'s accounts` : undefined}
              >
                <td style={{ ...s.repTd, color: 'var(--text)', fontWeight: 500 }}>{r.rep_name}</td>
                <td style={s.repTd}>{r.total_accounts}</td>
                <td style={{ ...s.repTd, color: r.at_risk_count > 1 ? '#dc2626' : 'inherit', fontWeight: r.at_risk_count > 1 ? 500 : 400 }}>{r.at_risk_count}</td>
                <td style={s.repTd}>{fmtACV(r.total_acv)}</td>
                <td style={s.repTd}>{fmtACV((es.accounts_by_rep || {})[r.rep_name]?.acv_at_risk || 0)}</td>
                <td style={{ ...s.repTd, color: r.avg_health_score < 60 ? '#dc2626' : r.avg_health_score < 75 ? '#d97706' : '#16a34a' }}>{r.avg_health_score}</td>
                <td style={{ ...s.repTd, fontSize: 11, color: 'var(--text-2)' }}>{(r.dominant_gap || '').replace(/_/g, ' ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
