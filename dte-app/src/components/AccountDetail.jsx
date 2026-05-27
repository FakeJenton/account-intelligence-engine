import { fmtACV, HEALTH_COLORS, RELIABILITY_COLORS, confBadge, fmtPct } from '../utils'

const s = {
  panel: {
    background: 'var(--bg)', border: '1px solid var(--border-2)',
    borderRadius: 12, padding: '14px 16px', marginTop: 6,
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  title: { fontSize: 15, fontWeight: 500 },
  meta: { fontSize: 11, color: 'var(--text-2)', marginTop: 2, lineHeight: 1.5 },
  badge: {
    display: 'inline-block', fontSize: 10, padding: '2px 8px',
    borderRadius: 8, fontWeight: 500, color: '#fff', marginRight: 4,
  },
  sectionLabel: {
    fontSize: 10, fontWeight: 500, color: 'var(--text-3)',
    textTransform: 'uppercase', letterSpacing: '0.07em', margin: '10px 0 5px',
  },
  scoreBars: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, margin: '10px 0' },
  barItem: {},
  barLbl: { fontSize: 10, color: 'var(--text-2)', marginBottom: 2 },
  barBg: { height: 4, background: 'var(--bg-2)', borderRadius: 2, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2 },
  barVal: { fontSize: 10, color: 'var(--text-2)', marginTop: 2 },
  gapItem: {
    fontSize: 12, padding: '4px 0 4px 10px',
    borderLeft: '2px solid var(--border-2)', marginBottom: 4,
    color: 'var(--text-2)', lineHeight: 1.45,
  },
  intelGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 },
  intelCard: { background: 'var(--bg-2)', borderRadius: 8, padding: '8px 10px' },
  intelLbl: { fontSize: 10, color: 'var(--text-2)', marginBottom: 3 },
  intelVal: { fontSize: 12, fontWeight: 500 },
  confBadge: {
    display: 'inline-block', fontSize: 10, padding: '1px 6px',
    borderRadius: 8, marginLeft: 4,
  },
  firstMove: {
    background: 'var(--bg-2)', borderRadius: 8, padding: '10px 12px',
    fontSize: 12, lineHeight: 1.65,
  },
  dontBox: {
    background: 'rgba(217,119,6,0.08)', border: '0.5px solid rgba(217,119,6,0.3)',
    borderRadius: 8, padding: '7px 10px', fontSize: 11,
    color: '#92400e', marginTop: 6, lineHeight: 1.5,
  },
  contradictionBox: {
    background: 'rgba(124,58,237,0.07)', border: '0.5px solid rgba(124,58,237,0.3)',
    borderRadius: 8, padding: '7px 10px', fontSize: 11,
    color: '#5b21b6', marginTop: 4, lineHeight: 1.5,
  },
  fundingPill: {
    display: 'inline-block', fontSize: 10, padding: '1px 7px',
    borderRadius: 8, background: '#fef9c3', color: '#854d0e',
    border: '0.5px solid #fcd34d', marginLeft: 6,
  },
}

function ConfBadge({ conf }) {
  const { label, bg, text } = confBadge(conf)
  return <span style={{ ...s.confBadge, background: bg, color: text }}>{label}</span>
}

function DimBar({ label, value, color }) {
  return (
    <div style={s.barItem}>
      <div style={s.barLbl}>{label}</div>
      <div style={s.barBg}>
        <div style={{ ...s.barFill, width: fmtPct(value), background: color }} />
      </div>
      <div style={s.barVal}>{fmtPct(value)}</div>
    </div>
  )
}

function formatFirstMove(text) {
  if (!text) return null
  return text.split('\n').map((line, i) => {
    const bold = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    return <div key={i} style={{ marginBottom: line.trim() ? 4 : 2 }} dangerouslySetInnerHTML={{ __html: bold }} />
  })
}

export default function AccountDetail({ account }) {
  const { health, gaps, intelligence, action } = account
  const hc = HEALTH_COLORS[health.label] || '#888'
  const rc = RELIABILITY_COLORS[health.reliability_tag] || '#888'
  const hasFunding = intelligence.timing?.funding_detected
  const hasLeadershipChange = intelligence.timing?.leadership_change

  return (
    <div style={s.panel}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <div style={s.title}>{account.company_name}</div>
          <div style={s.meta}>
            {account.rep_name} · {account.segment} · {account.current_stage} · {account.forecast_category}
            {hasFunding && <span style={s.fundingPill}>💰 Funding</span>}
            {hasLeadershipChange && <span style={{ ...s.fundingPill, background: '#e0e7ff', color: '#3730a3', borderColor: '#c7d2fe' }}>👤 Leadership change</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 500 }}>{fmtACV(account.acv_usd)}</div>
          <div style={{ marginTop: 4 }}>
            <span style={{ ...s.badge, background: hc }}>{health.label}</span>
            <span style={{ ...s.badge, background: rc }}>{health.reliability_tag}</span>
          </div>
        </div>
      </div>

      {/* Score overview */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 8 }}>
        <span style={{ fontSize: 22, fontWeight: 500 }}>{health.overall_score}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-2)' }}>/100</span></span>
        <span style={{ fontSize: 14, color: 'var(--text-2)' }}>health</span>
        <span style={{ fontSize: 16, fontWeight: 500, marginLeft: 8 }}>{intelligence.readiness_score}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-2)' }}>/100</span></span>
        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>intel ready</span>
      </div>

      {/* Dimension bars */}
      <div style={s.scoreBars}>
        <DimBar label="Completeness" value={health.completeness} color="#2563eb" />
        <DimBar label="Freshness" value={health.freshness} color="#16a34a" />
        <DimBar label="Consistency" value={health.consistency} color="#d97706" />
        <DimBar label="Reliability" value={health.reliability} color={rc} />
      </div>

      {/* Critical gaps */}
      {gaps.critical > 0 && (
        <>
          <div style={s.sectionLabel}>{gaps.critical} critical gaps · {gaps.contradictions} contradictions</div>
          {gaps.top_critical_gaps?.map((g, i) => (
            <div key={i} style={{ ...s.gapItem, borderLeftColor: '#dc2626' }}>
              <strong>{g.label}</strong>
              {g.context && <span style={{ color: 'var(--text-3)', fontSize: 11 }}> — {g.context.slice(0, 80)}</span>}
            </div>
          ))}
          {gaps.top_contradictions?.map((c, i) => (
            <div key={i} style={s.contradictionBox}>
              <strong>⚑ {c.label}</strong><br />
              <span>{c.detail}</span>
            </div>
          ))}
        </>
      )}

      {/* Intelligence synthesis */}
      <div style={s.sectionLabel}>Intelligence synthesis</div>
      <div style={s.intelGrid}>
        {/* Champion */}
        <div style={s.intelCard}>
          <div style={s.intelLbl}>Champion <ConfBadge conf={intelligence.champion.confidence} /></div>
          <div style={s.intelVal}>{intelligence.champion.has_crm_data ? 'Logged' : 'Not logged'}</div>
          {intelligence.champion.candidates?.slice(0, 1).map((c, i) => (
            <div key={i} style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 3 }}>
              {c.inferred_name} — {c.title}
              <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{c.signal_source}</div>
            </div>
          ))}
        </div>

        {/* Exec engagement */}
        <div style={s.intelCard}>
          <div style={s.intelLbl}>Exec engagement</div>
          <div style={{ ...s.intelVal, color: intelligence.economic_buyer.exec_engaged ? '#16a34a' : '#dc2626' }}>
            {intelligence.economic_buyer.exec_engaged ? '✓ Engaged' : '✗ Not engaged'}
            <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-2)' }}> · {intelligence.economic_buyer.meetings} meetings</span>
          </div>
          {intelligence.economic_buyer.inferred_execs?.slice(0, 1).map((e, i) => (
            <div key={i} style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 3 }}>
              {e.inferred_name} — {e.title}
            </div>
          ))}
        </div>

        {/* Competitive */}
        <div style={s.intelCard}>
          <div style={s.intelLbl}>Competitive <ConfBadge conf={intelligence.competitive.confidence} /></div>
          <div style={s.intelVal}>
            {intelligence.competitive.has_crm_data ? 'Logged' : 'Not logged'}
            {intelligence.competitive.pricing_pressure && <span style={{ color: '#d97706', fontSize: 11, fontWeight: 400 }}> · ⚠️ pricing pressure</span>}
          </div>
          {intelligence.competitive.signals?.slice(0, 1).map((sig, i) => (
            <div key={i} style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 3 }}>
              {sig.competitor} <ConfBadge conf={sig.confidence} />
            </div>
          ))}
        </div>

        {/* Use case */}
        <div style={s.intelCard}>
          <div style={s.intelLbl}>Use case</div>
          <div style={{ fontSize: 11, lineHeight: 1.4, color: intelligence.use_case.has_crm_data ? 'var(--text)' : 'var(--text-2)' }}>
            {intelligence.use_case.inferred || '—'}
          </div>
          {(intelligence.use_case.tech_stack || []).length > 0 && (
            <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>
              {intelligence.use_case.tech_stack.slice(0, 3).join(' + ')}
            </div>
          )}
        </div>
      </div>

      {/* Timing signals */}
      {(intelligence.timing?.urgency_signals || []).length > 0 && (
        <>
          <div style={s.sectionLabel}>Timing signals</div>
          {intelligence.timing.urgency_signals.map((sig, i) => (
            <div key={i} style={{ ...s.gapItem, borderLeftColor: '#d97706' }}>{sig}</div>
          ))}
          {intelligence.timing.recent_news?.slice(0, 1).map((n, i) => (
            <div key={i} style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 3 }}>
              📰 {n.headline} — <em>{n.source}</em>
            </div>
          ))}
        </>
      )}

      {/* Pre-call angle */}
      <div style={s.sectionLabel}>
        Pre-call angle <ConfBadge conf={action.angle_confidence} />
      </div>
      <div style={{ ...s.gapItem, borderLeftColor: '#d97706', color: 'var(--text)', fontWeight: 400 }}>
        <strong>{action.top_angle}</strong>
      </div>
      {action.what_not_to_do && (
        <div style={s.dontBox}>
          <strong>Don't:</strong> {action.what_not_to_do}
        </div>
      )}

      {/* First move */}
      <div style={s.sectionLabel}>First move — do this today</div>
      <div style={s.firstMove}>
        {formatFirstMove(action.first_move || action.first_move_preview)}
      </div>
    </div>
  )
}
