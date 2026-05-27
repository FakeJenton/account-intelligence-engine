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
    textTransform: 'uppercase', letterSpacing: '0.06em', margin: '16px 0 8px',
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

  scoreCard: {
    background: 'var(--bg-2)', borderRadius: 'var(--radius)',
    padding: '12px 14px', marginBottom: 8,
  },
  scoreCardHead: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
    marginBottom: 4,
  },
  scoreCardName: { fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' },
  scoreCardPct: { fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em' },
  scoreCardDesc: {
    fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 6,
  },
  scoreCardWhy: {
    fontSize: 12, color: 'var(--text)', lineHeight: 1.55,
  },

  gapItem: {
    fontSize: 13, padding: '8px 12px',
    background: 'var(--bg-2)', borderRadius: 'var(--radius)',
    borderLeft: '3px solid var(--border-2)', marginBottom: 6,
    color: 'var(--text)', lineHeight: 1.5,
  },
  gapLabel: { fontWeight: 600, letterSpacing: '-0.005em' },
  gapContext: { fontSize: 12, color: 'var(--text-2)', marginTop: 3 },

  contradictionItem: {
    background: 'rgba(175,82,222,0.05)', borderLeft: '3px solid var(--purple)',
    borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 13,
    color: 'var(--text)', marginBottom: 6, lineHeight: 1.5,
  },
  contradictionDetail: {
    fontSize: 12, color: 'var(--text-2)', marginTop: 3,
  },

  freshItem: {
    background: 'rgba(255,149,0,0.06)', borderLeft: '3px solid var(--amber)',
    borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 13,
    color: 'var(--text)', marginBottom: 6, lineHeight: 1.5,
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
  angleBox: {
    background: 'rgba(255,149,0,0.06)', borderLeft: '3px solid var(--amber)',
    borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 14,
    color: 'var(--text)', fontWeight: 500, marginBottom: 6,
  },
  dontBox: {
    background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.25)',
    borderRadius: 'var(--radius)', padding: '9px 12px', fontSize: 12,
    color: '#8a5a00', marginTop: 6, lineHeight: 1.55,
  },
  pill: {
    display: 'inline-block', fontSize: 11, padding: '2px 8px',
    borderRadius: 999, marginLeft: 7, fontWeight: 500,
  },
  emptyState: {
    fontSize: 12, color: 'var(--text-2)', fontStyle: 'italic',
    padding: '6px 0',
  },
}

const DIM_INFO = {
  completeness: {
    name: 'Completeness',
    color: 'var(--blue)',
    description: 'How much of the basic CRM info is filled in for this deal. Lower scores mean the rep has left important fields blank.',
  },
  freshness: {
    name: 'Freshness',
    color: 'var(--green)',
    description: 'How recently this deal has been worked, compared to what is expected for its stage. Lower scores mean it has gone quiet or is stuck.',
  },
  consistency: {
    name: 'Consistency',
    color: 'var(--amber)',
    description: 'Whether the different fields in this record agree with each other. Lower scores mean the CRM is telling contradictory stories.',
  },
  reliability: {
    name: 'Reliability',
    color: 'var(--purple)',
    description: 'Our overall confidence in this deal’s forecast category. Combines the three scores above, with extra penalties for critical contradictions.',
  },
}

function cleanFieldName(label) {
  return label
    .replace(/^No /, '')
    .replace(/ not logged$/, '')
    .replace(/ not identified$/, '')
    .replace(/ not defined$/, '')
    .replace(/ not confirmed$/, '')
    .replace(/ not shared$/, '')
    .replace(/ not engaged$/, '')
    .replace(/ unknown$/, '')
    .replace(/ blank$/, '')
}

function explainCompleteness(pct, allGaps) {
  const completenessGaps = (allGaps || []).filter(g => g.source === 'completeness')
  const critical = completenessGaps.filter(g => g.severity === 'critical')
  if (pct >= 0.85) {
    return 'Most CRM fields are filled in. Only minor fields are missing.'
  }
  if (critical.length === 0 && completenessGaps.length === 0) {
    return 'Some fields are missing but none are flagged critical for this stage.'
  }
  const fields = critical.slice(0, 6).map(g => cleanFieldName(g.label)).filter(Boolean)
  if (critical.length === 0) {
    return `${completenessGaps.length} CRM fields are blank or low-quality, though none are flagged critical for this stage yet.`
  }
  const intro = pct >= 0.65
    ? `${critical.length} important field${critical.length > 1 ? 's are' : ' is'} blank`
    : `${critical.length} critical CRM field${critical.length > 1 ? 's are' : ' is'} blank, including`
  return `${intro}: ${fields.join(', ')}. Without these the deal cannot be forecast confidently.`
}

function explainFreshness(pct, flagsDetail) {
  if (pct >= 0.85) {
    return 'Activity cadence matches what is expected for this deal stage.'
  }
  if (!flagsDetail || flagsDetail.length === 0) {
    return 'Activity is below the expected cadence for this stage, but no specific flags were logged.'
  }
  const lines = flagsDetail.slice(0, 4).map(f => f.label)
  return lines.join(' · ')
}

function explainConsistency(pct, allContras) {
  if (pct >= 0.9) {
    return 'All fields agree with each other. No contradictions found.'
  }
  if (!allContras || allContras.length === 0) {
    return 'Some minor inconsistencies were detected, but none are flagged critical.'
  }
  const critical = allContras.filter(c => c.severity === 'critical')
  if (critical.length === 0) {
    return `${allContras.length} minor inconsistencies in the data — none currently flagged critical.`
  }
  return `${allContras.length} contradiction${allContras.length > 1 ? 's' : ''} found (${critical.length} critical). See the contradictions list below for details.`
}

function explainReliability(tag, pct, hasCritContra) {
  if (tag === 'reliable') {
    return 'All signals support this deal’s forecast category. This is a trustworthy deal — safe to include in committed pipeline.'
  }
  if (tag === 'questionable') {
    return 'Some signals do not match the forecast category. Verify the key fields and address the gaps before committing this deal to the quarter.'
  }
  const extra = hasCritContra ? ' Multiple critical contradictions are dragging the score down.' : ''
  return `Multiple signals contradict the current forecast. Do not rely on this deal closing in the committed quarter without first resolving the issues below.${extra}`
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

function ScoreCard({ dimKey, score, why }) {
  const info = DIM_INFO[dimKey]
  return (
    <div style={s.scoreCard}>
      <div style={s.scoreCardHead}>
        <span style={s.scoreCardName}>{info.name}</span>
        <span style={{ ...s.scoreCardPct, color: info.color }}>{fmtPct(score)}</span>
      </div>
      <div style={s.scoreCardDesc}>{info.description}</div>
      <div style={s.scoreCardWhy}><strong style={{ fontWeight: 600 }}>Why this score:</strong> {why}</div>
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

  const allGaps     = gaps.all_gaps || []
  const allContras  = gaps.all_contradictions || []
  const freshFlags  = gaps.freshness_flags_detail || []

  // Critical gaps (anything severity=critical that isn't a contradiction)
  const criticalGaps = allGaps.filter(g => g.severity === 'critical' && g.source !== 'consistency')
  // Fall back to top_critical_gaps if all_gaps wasn't enriched for some reason
  const gapsToShow = criticalGaps.length > 0 ? criticalGaps : (gaps.top_critical_gaps || [])

  const contradictions = allContras.length > 0 ? allContras : (gaps.top_contradictions || [])
  const critContras = contradictions.filter(c => c.severity === 'critical')

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
      <div style={s.angleBox}>{action.top_angle}</div>
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
        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>overall health</span>
        <span style={{ fontSize: 18, fontWeight: 600, marginLeft: 10, letterSpacing: '-0.02em' }}>
          {intelligence.readiness_score}
          <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-2)' }}>/100</span>
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>intel ready</span>
      </div>

      {/* Dimension bars at-a-glance */}
      <div style={s.scoreBars}>
        <DimBar label="Completeness" value={health.completeness} color="var(--blue)" />
        <DimBar label="Freshness"    value={health.freshness}    color="var(--green)" />
        <DimBar label="Consistency"  value={health.consistency}  color="var(--amber)" />
        <DimBar label="Reliability"  value={health.reliability}  color={rc} />
      </div>

      {/* Score breakdown — plain-language justification for each dimension */}
      <div style={s.sectionLabel}>Score breakdown — why these grades</div>
      <ScoreCard
        dimKey="completeness"
        score={health.completeness}
        why={explainCompleteness(health.completeness, allGaps)}
      />
      <ScoreCard
        dimKey="freshness"
        score={health.freshness}
        why={explainFreshness(health.freshness, freshFlags)}
      />
      <ScoreCard
        dimKey="consistency"
        score={health.consistency}
        why={explainConsistency(health.consistency, allContras)}
      />
      <ScoreCard
        dimKey="reliability"
        score={health.reliability}
        why={explainReliability(health.reliability_tag, health.reliability, critContras.length > 0)}
      />

      {/* All critical gaps */}
      <div style={s.sectionLabel}>
        Critical gaps {gapsToShow.length > 0 && `(${gapsToShow.length})`}
      </div>
      {gapsToShow.length === 0 ? (
        <div style={s.emptyState}>No critical gaps. CRM fields appropriate for this deal stage are filled in.</div>
      ) : (
        gapsToShow.map((g, i) => (
          <div key={i} style={{ ...s.gapItem, borderLeftColor: 'var(--red)' }}>
            <div style={s.gapLabel}>{g.label}</div>
            {g.context && <div style={s.gapContext}>{g.context}</div>}
          </div>
        ))
      )}

      {/* All contradictions */}
      <div style={s.sectionLabel}>
        Contradictions {contradictions.length > 0 && `(${contradictions.length})`}
      </div>
      {contradictions.length === 0 ? (
        <div style={s.emptyState}>No contradictions found. The data in this record agrees with itself.</div>
      ) : (
        contradictions.map((c, i) => (
          <div key={i} style={s.contradictionItem}>
            <div style={s.gapLabel}>{c.label}</div>
            {c.detail && <div style={s.contradictionDetail}>{c.detail}</div>}
          </div>
        ))
      )}

      {/* Freshness flags */}
      {freshFlags.length > 0 && (
        <>
          <div style={s.sectionLabel}>
            Freshness flags ({freshFlags.length})
          </div>
          {freshFlags.map((f, i) => (
            <div key={i} style={s.freshItem}>
              <div style={s.gapLabel}>{f.label}</div>
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
            <div key={i} style={{ ...s.freshItem }}>
              <div style={s.gapLabel}>{sig}</div>
            </div>
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
