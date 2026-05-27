export const HEALTH_COLORS = {
  critical: '#ff3b30',
  'at-risk': '#ff9500',
  'needs-attention': '#007aff',
  healthy: '#34c759',
}

export const RELIABILITY_COLORS = {
  reliable: '#34c759',
  questionable: '#ff9500',
  unreliable: '#ff3b30',
}

export const CONFIDENCE_LABELS = {
  'crm-confirmed': '✓ CRM confirmed',
  'inferred-strong': '~ Strong signal',
  'inferred-weak': '~ Weak signal',
  unverified: '? Unverified',
}

export const CONFIDENCE_COLORS = {
  'crm-confirmed':   { bg: '#e6f7ec', text: '#1f7a3c' },
  'inferred-strong': { bg: '#e4f0ff', text: '#0050d0' },
  'inferred-weak':   { bg: '#fff4d6', text: '#8a5a00' },
  unverified:        { bg: 'var(--bg-2)', text: 'var(--text-3)' },
}

export const HEALTH_LABELS = {
  'critical': 'Critical',
  'at-risk': 'At Risk',
  'needs-attention': 'Needs Attention',
  'healthy': 'Healthy',
}

export const SEGMENT_COLORS = {
  Enterprise: '#5856d6',
  'Mid-Market': '#007aff',
  SMB: '#34c759',
}

export function fmtACV(v) {
  if (!v) return '—'
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`
  return `$${v}`
}

export function fmtPct(v) {
  return `${Math.round((v || 0) * 100)}%`
}

export function confBadge(conf) {
  const c = CONFIDENCE_COLORS[conf] || CONFIDENCE_COLORS.unverified
  const label = CONFIDENCE_LABELS[conf] || conf || '?'
  return { label, bg: c.bg, text: c.text }
}
