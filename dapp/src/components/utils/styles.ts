// Common style constants to avoid duplication across components

export const MONO_FONT = "var(--mono-font), 'SF Mono', 'Monaco', monospace"

export const monoStyle: React.CSSProperties = {
  fontFamily: MONO_FONT
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

export const compactButtonStyle: React.CSSProperties = {
  padding: '0.75rem 1.1rem',
  fontSize: '0.98rem',
  minWidth: 'auto',
  minHeight: '44px',
}
