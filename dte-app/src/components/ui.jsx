// Shared visual primitives. One source of truth for chips, section labels,
// stat cards, confidence indicators, and the small icons used across surfaces.

export function SectionLabel({ children, style }) {
  return (
    <div
      style={{
        fontSize: 'var(--text-xs)',
        fontWeight: 600,
        color: 'var(--text-2)',
        marginBottom: 'var(--space-3)',
        letterSpacing: 'var(--track-tight)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

const CHIP = {
  amber:   { bg: 'var(--surface-amber-bg)',   text: 'var(--surface-amber-text)' },
  blue:    { bg: 'var(--surface-blue-bg)',    text: 'var(--surface-blue-text)' },
  purple:  { bg: 'var(--surface-purple-bg)',  text: 'var(--surface-purple-text)' },
  green:   { bg: 'var(--surface-green-bg)',   text: 'var(--surface-green-text)' },
  red:     { bg: 'var(--surface-red-bg)',     text: 'var(--surface-red-text)' },
  neutral: { bg: 'var(--bg-2)',               text: 'var(--text-2)' },
}

export function Chip({ variant = 'neutral', children, title, style }) {
  const c = CHIP[variant] || CHIP.neutral
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 'var(--text-xs)',
        padding: '2px 8px',
        borderRadius: 999,
        background: c.bg,
        color: c.text,
        fontWeight: 500,
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
        cursor: title ? 'help' : 'inherit',
        ...style,
      }}
    >
      {children}
    </span>
  )
}

const CONF_DOT = {
  'crm-confirmed':   { color: 'var(--green)', outlined: false, label: 'CRM confirmed' },
  'inferred-strong': { color: 'var(--blue)',  outlined: false, label: 'Strong signal' },
  'inferred-weak':   { color: 'var(--amber)', outlined: false, label: 'Weak signal' },
  unverified:        { color: 'var(--text-3)', outlined: true, label: 'Unverified' },
}

export function ConfDot({ conf, inline = false }) {
  const d = CONF_DOT[conf] || CONF_DOT.unverified
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 'var(--text-xs)',
        color: 'var(--text-2)',
        marginLeft: inline ? 6 : 0,
        fontWeight: 500,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: d.outlined ? 'transparent' : d.color,
          border: d.outlined ? `1.5px solid ${d.color}` : 'none',
          display: 'inline-block',
          flexShrink: 0,
        }}
      />
      {d.label}
    </span>
  )
}

// Stat card with link affordance as a corner glyph instead of a bottom row,
// removing the type-size mismatch between the value and the link text.
export function StatCard({ label, value, color, onClick, accent }) {
  const interactive = !!onClick
  return (
    <div
      onClick={onClick}
      className={interactive ? 'card-interactive' : undefined}
      style={{
        position: 'relative',
        background: 'var(--bg)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-4)',
        boxShadow: 'var(--shadow-sm)',
        cursor: interactive ? 'pointer' : 'default',
        ...(accent ? { boxShadow: `inset 3px 0 0 ${accent}, var(--shadow-sm)` } : {}),
      }}
      title={interactive ? 'View in Account Queue' : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
    >
      <div style={{
        fontSize: 'var(--text-xs)',
        color: 'var(--text-2)',
        marginBottom: 'var(--space-2)',
        letterSpacing: 'var(--track-tight)',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 'var(--text-xl)',
        fontWeight: 600,
        letterSpacing: 'var(--track-display)',
        color: color || 'var(--text)',
        lineHeight: 1.1,
      }}>
        {value}
      </div>
      {interactive && (
        <ArrowIcon
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            color: 'var(--text-3)',
            opacity: 0.7,
          }}
        />
      )}
    </div>
  )
}

export function ArrowIcon({ size = 14, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      style={style}
      aria-hidden="true"
    >
      <path d="M3 7h8M7.5 3.5L11 7l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function DownloadIcon({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={style} aria-hidden="true">
      <path d="M7 1.5v7M3.5 5.5L7 9l3.5-3.5M2.5 12h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function CheckIcon({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={style} aria-hidden="true">
      <path d="M2.5 7.5L5.5 10.5L11.5 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function EmptyState({ children, icon = 'check' }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        fontSize: 'var(--text-sm)',
        color: 'var(--text-2)',
        padding: 'var(--space-3)',
        background: 'var(--bg-2)',
        borderRadius: 'var(--radius)',
      }}
    >
      {icon === 'check' && (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 18, height: 18,
          borderRadius: 999,
          background: 'var(--surface-green-bg)',
          color: 'var(--surface-green-text)',
          flexShrink: 0,
        }}>
          <CheckIcon size={11} />
        </span>
      )}
      {children}
    </div>
  )
}
