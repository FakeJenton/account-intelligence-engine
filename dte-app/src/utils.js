export const HEALTH_COLORS = {
  critical: '#dc2626',
  'at-risk': '#d97706',
  'needs-attention': '#2563eb',
  healthy: '#16a34a',
}

export const RELIABILITY_COLORS = {
  reliable: '#16a34a',
  questionable: '#d97706',
  unreliable: '#dc2626',
}

export const CONFIDENCE_LABELS = {
  'crm-confirmed': '✓ CRM confirmed',
  'inferred-strong': '~ Strong signal',
  'inferred-weak': '~ Weak signal',
  unverified: '? Unverified',
}

export const CONFIDENCE_COLORS = {
  'crm-confirmed': { bg: '#dcfce7', text: '#166534' },
  'inferred-strong': { bg: '#dbeafe', text: '#1e40af' },
  'inferred-weak': { bg: '#fef9c3', text: '#854d0e' },
  unverified: { bg: 'var(--bg-2)', text: 'var(--text-3)' },
}

export const HEALTH_LABELS = {
  'critical': 'Critical',
  'at-risk': 'At Risk',
  'needs-attention': 'Needs Attention',
  'healthy': 'Healthy',
}

export const SEGMENT_COLORS = {
  Enterprise: '#6366f1',
  'Mid-Market': '#0ea5e9',
  SMB: '#10b981',
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
