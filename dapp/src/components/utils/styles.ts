// Common style constants to avoid duplication across components

export const MONO_FONT = "'SF Mono', 'Monaco', monospace"

export const monoStyle: React.CSSProperties = {
  fontFamily: MONO_FONT
}

export const proquintNameStyle: React.CSSProperties = {
  fontFamily: MONO_FONT,
  fontSize: 'clamp(1.4rem, 5vw, 2rem)',
  fontWeight: 800,
  color: 'var(--accent)',
  textTransform: 'uppercase',
  letterSpacing: '-0.01em',
  lineHeight: 1.1,
}

export const addressStyle: React.CSSProperties = {
  fontFamily: MONO_FONT,
  fontSize: '0.85rem',
  color: 'var(--text-dim)',
  wordBreak: 'break-all',
  textAlign: 'center',
}

export const txHashStyle: React.CSSProperties = {
  fontFamily: MONO_FONT,
  fontSize: '0.75rem',
  color: 'var(--accent)',
  wordBreak: 'break-all',
  textDecoration: 'none',
}

export const inputStyle: React.CSSProperties = {
  fontFamily: MONO_FONT,
  fontSize: '0.85rem',
  padding: '0.6rem',
  width: '100%',
}
