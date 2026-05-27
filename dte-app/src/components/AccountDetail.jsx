import { fmtACV, HEALTH_COLORS, RELIABILITY_COLORS, confBadge, fmtPct } from '../utils'

const s = {
  panel: {
    background: 'var(--bg)',
    borderRadius: 'var(--radius-lg)',
    padding: '18px 20px',
    marginTop: 8,
    boxShadow: 'var(--shadow-md)',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  title: { fontSize: 17, fontWeight: 600, letterSpacing: '-0.015em' },
  meta: { fontSize: 12, color: 'var(--text-2)', marginTop: 3, lineHeight: 1.55 },
  badge: {
    display: 'inline-block', fontSize: 10, padding: '3px 10px',
    borderRadius: 999, fontWeight: 600, color: '#fff', marginRight: 5,
    letterSpacing: '0.01em',
  },
  sectionLabel: {
    fontSize: 11, fontWeight: 600, color: 'var(--text-3)',
    textTransform: 'uppercase', letterSpacing: '0.06em', margin: '14px 0 7px',
  },
  divider: {
    borderTop: '1px solid var(--border)', margin: '18px 0 12px',
  },
  scoreBars: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, margin: '12px 0' },
  barItem: {},
  barLbl: { fontSize: 11, color: 'var(--text-2)', marginBottom: 4 },
  barBg: { height: 6, background: 'var(--bg-2)', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  barVal: { fontSize: 11, color: 'var(--text-2)', marginTop: 4, fontWeight: 500 },
  gapItem: {
    fontSize: 13, padding: '6px 0 6px 12px',
    borderLeft: '3px solid var(--border-2)', marginBottom: 6,
    color: 'var(--text-2)', lineHeight: 1.5,
  },
  intelGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 6 },
  intelCard: { background: 'var(--bg-2)', borderRadius: 'var(--radius)', padding: '10px 12px' },
  intelLbl: { fontSize: 10, color: 'var(--text-2)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' },
  intelVal: { fontSize: 13, fontWeight: 500 },
  confBadge: {
    display: 'inline-block', fontSize: 10, padding: '2px 8px',
    borderRadius: 999, marginLeft: 5, fontWeight: 500,
  },
  firstMove: {
    background: 'var(--bg-2)', borderRadius: 'var(--radius)', padding: '12px 14px',
    fontSize: 13, lineHeight: 1.65,
  },
  dontBox: {
    background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.25)',
    borderRadius: 'var(--radius)', padding: '9px 12px', fontSize: 12,
    color: '#8a5a00', marginTop: 8, lineHeight: 1.55,
  },
  contradictionBox: {
    background: 'rgba(175,82,222,0.07)', border: '1px solid rgba(175,82,222,0.22)',
    borderRadius: 'var(--radius)', padding: '9px 12px', fontSize: 12,
    color: '#6b21a8', marginTop: 6, lineHeight: 1.55,
  },
  pill: {
    display: 'inline-block', fontSize: 11, padding: '2px 8px',
    borderRadius: 999, marginLeft: 7, fontWeight: 500,
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
    return <div key={i} style={{ marginBottom: line.trim() ? 5 : 2 }} dangerouslySetInnerHTML={{ __html: bold }} />
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
            {hasFunding && <span style={{ ...s.pill, background: '#fff4d6', color: '#8a5a00' }}>Funding</span>}
            {hasLeadershipChange && <span style={{ ...s.pill, background: '#e4e4ff', color: '#3730a3' }}>Leadership change</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>{fmtACV(account.acv_usd)}</div>
          <div style={{ marginTop: 6 }}>
            <span style={{ ...s.badge, background: hc }}>{health.label}</span>
            <span style={{ ...s.badge, background: rc }}>{health.reliability_tag}</span>
          </div>
        </div>
      </div>

      {/* Pre-call angle */}
      <div style={s.sectionLabel}>
        Pre-call angle <ConfBadge conf={action.angle_confidence} />
      </div>
      <div style={{ ...s.gapItem, borderLeftColor: 'var(--amber)', color: 'var(--text)', fontSize: 14 }}>
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

      <div style={s.divider} />

      {/* Score overview */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginBottom: 8 }}>
        <span style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em' }}>
          {health.overall_score}
          <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-2)' }}>/100</span>
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>health</span>
        <span style={{ fontSize: 18, fontWeight: 600, marginLeft: 10, letterSpacing: '-0.02em' }}>
          {intelligence.readiness_score}
          <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-2)' }}>/100</span>
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>intel ready</span>
      </div>

      {/* Dimension bars */}
      <div style={s.scoreBars}>
        <DimBar label="Completeness" value={health.completeness} color="var(--blue)" />
        <DimBar label="Freshness" value={health.freshness} color="var(--green)" />
        <DimBar label="Consistency" value={health.consistency} color="var(--amber)" />
        <DimBar label="Reliability" value={health.reliability} color={rc} />
      </div>

      {/* Critical gaps */}
      {gaps.critical > 0 && (
        <>
          <div style={s.sectionLabel}>{gaps.critical} critical gaps · {gaps.contradictions} contradictions</div>
          {gaps.top_critical_gaps?.map((g, i) => (
            <div key={i} style={{ ...s.gapItem, borderLeftColor: 'var(--red)' }}>
              <strong>{g.label}</strong>
              {g.context && <span style={{ color: 'var(--text-3)', fontSize: 12 }}> — {g.context.slice(0, 80)}</span>}
            </div>
          ))}
          {gaps.top_contradictions?.map((c, i) => (
            <div key={i} style={s.contradictionBox}>
              <strong>{c.label}</strong><br />
              <span>{c.detail}</span>
            </div>
          ))}
        </>
      )}

      {/* Intelligence synthesis */}
      <div style={s.sectionLabel}>Intelligence synthesis</div>
      <div style={s.intelGrid}>

        <div style={s.intelCard}>
          <div style={s.intelLbl}>Champion <ConfBadge conf={intelligence.champion.confidence} /></div>
          <div style={s.intelVal}>{intelligence.champion.has_crm_data ? 'Logged' : 'Not logged'}</div>
          {intelligence.champion.candidates?.slice(0, 1).map((c, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
              {c.inferred_name} — {c.title}
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{c.signal_source}</div>
            </div>
          ))}
        </div>

        <div style={s.intelCard}>
          <div style={s.intelLbl}>Exec engagement</div>
          <div style={{ ...s.intelVal, color: intelligence.economic_buyer.exec_engaged ? 'var(--green)' : 'var(--red)' }}>
            {intelligence.economic_buyer.exec_engaged ? '✓ Engaged' : '✗ Not engaged'}
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-2)' }}> · {intelligence.economic_buyer.meetings} meetings</span>
          </div>
          {intelligence.economic_buyer.inferred_execs?.slice(0, 1).map((e, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
              {e.inferred_name} — {e.title}
            </div>
          ))}
        </div>

        <div style={s.intelCard}>
          <div style={s.intelLbl}>Competitive <ConfBadge conf={intelligence.competitive.confidence} /></div>
          <div style={s.intelVal}>
            {intelligence.competitive.has_crm_data ? 'Logged' : 'Not logged'}
            {intelligence.competitive.pricing_pressure && (
              <span style={{ color: 'var(--amber)', fontSize: 12, fontWeight: 400 }}> · pricing pressure</span>
            )}
          </div>
          {intelligence.competitive.signals?.slice(0, 1).map((sig, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
              {sig.competitor} <ConfBadge conf={sig.confidence} />
            </div>
          ))}
        </div>

        <div style={s.intelCard}>
          <div style={s.intelLbl}>Use case</div>
          <div style={{ fontSize: 12, lineHeight: 1.5, color: intelligence.use_case.has_crm_data ? 'var(--text)' : 'var(--text-2)' }}>
            {intelligence.use_case.inferred || '—'}
          </div>
          {(intelligence.use_case.tech_stack || []).length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
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
            <div key={i} style={{ ...s.gapItem, borderLeftColor: 'var(--amber)' }}>{sig}</div>
          ))}
          {intelligence.timing.recent_news?.slice(0, 1).map((n, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 5 }}>
              {n.headline} — <em>{n.source}</em>
            </div>
          ))}
        </>
      )}

    </div>
  )
}
