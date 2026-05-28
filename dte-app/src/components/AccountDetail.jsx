import { fmtACV, HEALTH_COLORS, RELIABILITY_COLORS, fmtPct } from '../utils'
import { SectionLabel, Chip, ConfDot, EmptyState } from './ui'

const s = {
  panel: {
    background: 'var(--bg)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-5)',
    marginTop: 'var(--space-2)',
    boxShadow: 'var(--shadow-md)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 'var(--space-4)',
  },
  title: {
    fontSize: 'var(--text-lg)',
    fontWeight: 600,
    letterSpacing: 'var(--track-tight)',
  },
  meta: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-2)',
    marginTop: 'var(--space-1)',
    lineHeight: 1.6,
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 'var(--space-2)',
  },
  badge: {
    display: 'inline-block',
    fontSize: 'var(--text-xs)',
    padding: '3px 10px',
    borderRadius: 999,
    fontWeight: 600,
    color: '#fff',
    marginRight: 'var(--space-1)',
  },

  divider: {
    borderTop: '1px solid var(--border)',
    margin: 'var(--space-5) 0 var(--space-3)',
  },

  scoreBars: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4,1fr)',
    gap: 'var(--space-3)',
    margin: 'var(--space-3) 0',
  },
  barLbl: { fontSize: 'var(--text-xs)', color: 'var(--text-2)', marginBottom: 'var(--space-1)' },
  barBg: { height: 6, background: 'var(--bg-2)', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  barVal: { fontSize: 'var(--text-xs)', color: 'var(--text-2)', marginTop: 'var(--space-1)', fontWeight: 500 },

  scoreCard: {
    background: 'var(--bg-2)',
    borderRadius: 'var(--radius)',
    padding: 'var(--space-3) var(--space-4)',
    marginBottom: 'var(--space-2)',
  },
  scoreCardHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 'var(--space-1)',
  },
  scoreCardName: { fontSize: 'var(--text-sm)', fontWeight: 600, letterSpacing: 'var(--track-tight)' },
  scoreCardPct: { fontSize: 'var(--text-base)', fontWeight: 600, letterSpacing: 'var(--track-display)' },
  scoreCardDesc: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-2)',
    lineHeight: 1.5,
    marginBottom: 'var(--space-2)',
  },
  scoreCardWhy: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text)',
    lineHeight: 1.55,
  },
  scoreCardWhyLabel: {
    fontSize: 'var(--text-xs)',
    fontWeight: 600,
    color: 'var(--text-2)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: 'var(--space-1)',
  },

  gapItem: {
    fontSize: 'var(--text-sm)',
    padding: 'var(--space-2) var(--space-3)',
    background: 'var(--surface-red-bg)',
    borderRadius: 'var(--radius)',
    borderLeft: '3px solid var(--red)',
    marginBottom: 'var(--space-2)',
    color: 'var(--text)',
    lineHeight: 1.5,
  },
  gapLabel: { fontWeight: 600, letterSpacing: 'var(--track-tight)' },
  gapContext: { fontSize: 'var(--text-xs)', color: 'var(--text-2)', marginTop: 'var(--space-1)' },

  contradictionItem: {
    background: 'var(--surface-purple-bg)',
    borderLeft: '3px solid var(--purple)',
    borderRadius: 'var(--radius)',
    padding: 'var(--space-2) var(--space-3)',
    fontSize: 'var(--text-sm)',
    color: 'var(--text)',
    marginBottom: 'var(--space-2)',
    lineHeight: 1.5,
  },

  freshItem: {
    background: 'var(--surface-amber-bg)',
    borderLeft: '3px solid var(--amber)',
    borderRadius: 'var(--radius)',
    padding: 'var(--space-2) var(--space-3)',
    fontSize: 'var(--text-sm)',
    color: 'var(--text)',
    marginBottom: 'var(--space-2)',
    lineHeight: 1.5,
  },

  intelGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 'var(--space-3)',
    marginTop: 'var(--space-2)',
  },
  intelCardPrimary: {
    background: 'var(--bg-2)',
    borderRadius: 'var(--radius)',
    padding: 'var(--space-3) var(--space-4)',
  },
  intelCardSecondary: {
    background: 'var(--bg-2)',
    borderRadius: 'var(--radius)',
    padding: 'var(--space-3)',
  },
  intelLblPrimary: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-2)',
    marginBottom: 'var(--space-2)',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
  },
  intelLblSecondary: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-3)',
    marginBottom: 'var(--space-2)',
    fontWeight: 600,
    letterSpacing: 'var(--track-tight)',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
  },
  intelVal: { fontSize: 'var(--text-sm)', fontWeight: 600 },

  firstMove: {
    background: 'var(--bg-2)',
    borderRadius: 'var(--radius)',
    padding: 'var(--space-3) var(--space-4)',
    fontSize: 'var(--text-sm)',
    lineHeight: 1.65,
  },
  angleBox: {
    background: 'var(--surface-amber-bg)',
    borderLeft: '3px solid var(--amber)',
    borderRadius: 'var(--radius)',
    padding: 'var(--space-3) var(--space-4)',
    fontSize: 'var(--text-base)',
    color: 'var(--text)',
    fontWeight: 500,
    marginBottom: 'var(--space-2)',
  },
  dontBox: {
    background: 'var(--surface-amber-bg-strong)',
    border: '1px solid var(--surface-amber-border)',
    borderRadius: 'var(--radius)',
    padding: 'var(--space-2) var(--space-3)',
    fontSize: 'var(--text-xs)',
    color: 'var(--surface-amber-text)',
    marginTop: 'var(--space-2)',
    lineHeight: 1.55,
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
    description: 'Overall confidence in this deal’s forecast category. Combines the three scores above, with extra penalties for critical contradictions.',
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
  if (pct >= 0.85) return 'Most CRM fields are filled in. Only minor fields are missing.'
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
  if (pct >= 0.85) return 'Activity cadence matches what is expected for this deal stage.'
  if (!flagsDetail || flagsDetail.length === 0) {
    return 'Activity is below the expected cadence for this stage, but no specific flags were logged.'
  }
  return flagsDetail.slice(0, 4).map(f => f.label).join(' · ')
}

function explainConsistency(pct, allContras) {
  if (pct >= 0.9) return 'All fields agree with each other. No contradictions found.'
  if (!allContras || allContras.length === 0) {
    return 'Some minor inconsistencies were detected, but none are flagged critical.'
  }
  const critical = allContras.filter(c => c.severity === 'critical')
  if (critical.length === 0) {
    return `${allContras.length} minor inconsistencies in the data, none currently flagged critical.`
  }
  return `${allContras.length} contradiction${allContras.length > 1 ? 's' : ''} found (${critical.length} critical). See the contradictions list below.`
}

function explainReliability(tag, pct, hasCritContra) {
  if (tag === 'reliable') {
    return 'All signals support this deal’s forecast category. This is a trustworthy deal, safe to include in committed pipeline.'
  }
  if (tag === 'questionable') {
    return 'Some signals do not match the forecast category. Verify the key fields and address the gaps before committing this deal to the quarter.'
  }
  const extra = hasCritContra ? ' Multiple critical contradictions are dragging the score down.' : ''
  return `Multiple signals contradict the current forecast. Do not rely on this deal closing in the committed quarter without first resolving the issues below.${extra}`
}

function DimBar({ label, value, color }) {
  return (
    <div>
      <div style={s.barLbl}>{label}</div>
      <div style={s.barBg}>
        <div style={{ ...s.barFill, width: fmtPct(value), background: color, opacity: 0.9 }} />
      </div>
      <div style={s.barVal}>{fmtPct(value)}</div>
    </div>
  )
}

function ScoreCard({ dimKey, score, why }) {
  const info = DIM_INFO[dimKey]
  const isWeak = score < 0.5
  return (
    <div
      style={{
        ...s.scoreCard,
        ...(isWeak ? { boxShadow: `inset 3px 0 0 ${info.color}` } : {}),
      }}
    >
      <div style={s.scoreCardHead}>
        <span style={s.scoreCardName}>{info.name}</span>
        <span style={{ ...s.scoreCardPct, color: info.color }}>{fmtPct(score)}</span>
      </div>
      <div style={s.scoreCardDesc}>{info.description}</div>
      <div style={s.scoreCardWhyLabel}>Why this score</div>
      <div style={s.scoreCardWhy}>{why}</div>
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

  const allGaps    = gaps.all_gaps || []
  const allContras = gaps.all_contradictions || []
  const freshFlags = gaps.freshness_flags_detail || []

  const criticalGaps = allGaps.filter(g => g.severity === 'critical' && g.source !== 'consistency')
  const gapsToShow   = criticalGaps.length > 0 ? criticalGaps : (gaps.top_critical_gaps || [])

  const contradictions = allContras.length > 0 ? allContras : (gaps.top_contradictions || [])
  const critContras    = contradictions.filter(c => c.severity === 'critical')

  return (
    <div style={s.panel}>

      {/* Header */}
      <div style={s.header}>
        <div>
          <div style={s.title}>{account.company_name}</div>
          <div style={s.meta}>
            <span>{account.rep_name} · {account.segment} · {account.current_stage} · {account.forecast_category}</span>
            {hasFunding && <Chip variant="amber" title="Funding event detected">Funding</Chip>}
            {hasLeadershipChange && <Chip variant="blue" title="Recent leadership change at this account">Leadership change</Chip>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 600, letterSpacing: 'var(--track-display)' }}>
            {fmtACV(account.acv_usd)}
          </div>
          <div style={{ marginTop: 'var(--space-2)' }}>
            <span style={{ ...s.badge, background: hc }}>{health.label}</span>
            <span style={{ ...s.badge, background: rc }}>{health.reliability_tag}</span>
          </div>
        </div>
      </div>

      {/* Pre-call angle */}
      <SectionLabel style={{ marginTop: 'var(--space-4)' }}>
        Pre-call angle <ConfDot conf={action.angle_confidence} inline />
      </SectionLabel>
      <div style={s.angleBox}>{action.top_angle}</div>
      {action.what_not_to_do && (
        <div style={s.dontBox}>
          <strong>Don't:</strong> {action.what_not_to_do}
        </div>
      )}

      {/* First move */}
      <SectionLabel style={{ marginTop: 'var(--space-4)' }}>First move, do this today</SectionLabel>
      <div style={s.firstMove}>
        {formatFirstMove(action.first_move || action.first_move_preview)}
      </div>

      <div style={s.divider} />

      {/* Score overview */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-4)', marginBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, letterSpacing: 'var(--track-display)', lineHeight: 1 }}>
          {health.overall_score}
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 400, color: 'var(--text-2)' }}>/100</span>
        </span>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>overall health</span>
        <span style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginLeft: 'var(--space-3)', letterSpacing: 'var(--track-tight)' }}>
          {intelligence.readiness_score}
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 400, color: 'var(--text-2)' }}>/100</span>
        </span>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>intel ready</span>
      </div>

      {/* At-a-glance dimension bars */}
      <div style={s.scoreBars}>
        <DimBar label="Completeness" value={health.completeness} color="var(--blue)" />
        <DimBar label="Freshness"    value={health.freshness}    color="var(--green)" />
        <DimBar label="Consistency"  value={health.consistency}  color="var(--amber)" />
        <DimBar label="Reliability"  value={health.reliability}  color={rc} />
      </div>

      {/* Score breakdown */}
      <SectionLabel style={{ marginTop: 'var(--space-4)' }}>Score breakdown, why these grades</SectionLabel>
      <ScoreCard dimKey="completeness" score={health.completeness} why={explainCompleteness(health.completeness, allGaps)} />
      <ScoreCard dimKey="freshness"    score={health.freshness}    why={explainFreshness(health.freshness, freshFlags)} />
      <ScoreCard dimKey="consistency"  score={health.consistency}  why={explainConsistency(health.consistency, allContras)} />
      <ScoreCard dimKey="reliability"  score={health.reliability}  why={explainReliability(health.reliability_tag, health.reliability, critContras.length > 0)} />

      {/* Critical gaps */}
      <SectionLabel style={{ marginTop: 'var(--space-4)' }}>
        Critical gaps {gapsToShow.length > 0 && `(${gapsToShow.length})`}
      </SectionLabel>
      {gapsToShow.length === 0 ? (
        <EmptyState>No critical gaps. CRM fields appropriate for this deal stage are filled in.</EmptyState>
      ) : (
        gapsToShow.map((g, i) => (
          <div key={i} style={s.gapItem}>
            <div style={s.gapLabel}>{g.label}</div>
            {g.context && <div style={s.gapContext}>{g.context}</div>}
          </div>
        ))
      )}

      {/* Contradictions */}
      <SectionLabel style={{ marginTop: 'var(--space-4)' }}>
        Contradictions {contradictions.length > 0 && `(${contradictions.length})`}
      </SectionLabel>
      {contradictions.length === 0 ? (
        <EmptyState>No contradictions found. The data in this record agrees with itself.</EmptyState>
      ) : (
        contradictions.map((c, i) => (
          <div key={i} style={s.contradictionItem}>
            <div style={s.gapLabel}>{c.label}</div>
            {c.detail && <div style={s.gapContext}>{c.detail}</div>}
          </div>
        ))
      )}

      {/* Freshness flags */}
      {freshFlags.length > 0 && (
        <>
          <SectionLabel style={{ marginTop: 'var(--space-4)' }}>
            Freshness flags ({freshFlags.length})
          </SectionLabel>
          {freshFlags.map((f, i) => (
            <div key={i} style={s.freshItem}>
              <div style={s.gapLabel}>{f.label}</div>
            </div>
          ))}
        </>
      )}

      {/* Intelligence synthesis — Champion + Exec primary, Use case + Competitive secondary */}
      <SectionLabel style={{ marginTop: 'var(--space-4)' }}>Intelligence synthesis</SectionLabel>
      <div style={s.intelGrid}>

        <div style={s.intelCardPrimary}>
          <div style={s.intelLblPrimary}>
            Champion <ConfDot conf={intelligence.champion.confidence} />
          </div>
          <div style={s.intelVal}>{intelligence.champion.has_crm_data ? 'Logged' : 'Not logged'}</div>
          {intelligence.champion.candidates?.slice(0, 1).map((c, i) => (
            <div key={i} style={{ fontSize: 'var(--text-xs)', color: 'var(--text-2)', marginTop: 'var(--space-1)' }}>
              {c.inferred_name} · {c.title}
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', marginTop: 1 }}>{c.signal_source}</div>
            </div>
          ))}
        </div>

        <div style={s.intelCardPrimary}>
          <div style={s.intelLblPrimary}>Exec engagement</div>
          <div style={{ ...s.intelVal, color: intelligence.economic_buyer.exec_engaged ? 'var(--green)' : 'var(--red)' }}>
            {intelligence.economic_buyer.exec_engaged ? 'Engaged' : 'Not engaged'}
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 400, color: 'var(--text-2)' }}>
              {' · '}{intelligence.economic_buyer.meetings} meetings
            </span>
          </div>
          {intelligence.economic_buyer.inferred_execs?.slice(0, 1).map((e, i) => (
            <div key={i} style={{ fontSize: 'var(--text-xs)', color: 'var(--text-2)', marginTop: 'var(--space-1)' }}>
              {e.inferred_name} · {e.title}
            </div>
          ))}
        </div>

      </div>

      <div style={{ ...s.intelGrid, marginTop: 'var(--space-2)' }}>

        <div style={s.intelCardSecondary}>
          <div style={s.intelLblSecondary}>
            Competitive <ConfDot conf={intelligence.competitive.confidence} />
          </div>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
            {intelligence.competitive.has_crm_data ? 'Logged' : 'Not logged'}
            {intelligence.competitive.pricing_pressure && (
              <span style={{ color: 'var(--amber)', fontSize: 'var(--text-xs)', fontWeight: 400 }}> · pricing pressure</span>
            )}
          </div>
          {intelligence.competitive.signals?.slice(0, 1).map((sig, i) => (
            <div key={i} style={{ fontSize: 'var(--text-xs)', color: 'var(--text-2)', marginTop: 'var(--space-1)' }}>
              {sig.competitor} <ConfDot conf={sig.confidence} inline />
            </div>
          ))}
        </div>

        <div style={s.intelCardSecondary}>
          <div style={s.intelLblSecondary}>Use case</div>
          <div style={{ fontSize: 'var(--text-xs)', lineHeight: 1.5, color: intelligence.use_case.has_crm_data ? 'var(--text)' : 'var(--text-2)' }}>
            {intelligence.use_case.inferred || '—'}
          </div>
          {(intelligence.use_case.tech_stack || []).length > 0 && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', marginTop: 'var(--space-1)' }}>
              {intelligence.use_case.tech_stack.slice(0, 3).join(' + ')}
            </div>
          )}
        </div>

      </div>

      {/* Timing signals */}
      {(intelligence.timing?.urgency_signals || []).length > 0 && (
        <>
          <SectionLabel style={{ marginTop: 'var(--space-4)' }}>Timing signals</SectionLabel>
          {intelligence.timing.urgency_signals.map((sig, i) => (
            <div key={i} style={s.freshItem}>
              <div style={s.gapLabel}>{sig}</div>
            </div>
          ))}
          {intelligence.timing.recent_news?.slice(0, 1).map((n, i) => (
            <div key={i} style={{ fontSize: 'var(--text-xs)', color: 'var(--text-2)', marginTop: 'var(--space-2)' }}>
              {n.headline} <em>· {n.source}</em>
            </div>
          ))}
        </>
      )}

    </div>
  )
}
