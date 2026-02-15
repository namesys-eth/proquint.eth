interface IconButtonProps {
  onClick: () => void
  title: string
  label: string
  children: React.ReactNode
}

export function IconButton({ onClick, title, label, children }: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={title}
      style={{
        padding: '0.4rem 0.5rem',
        background: 'transparent',
        border: '1px solid var(--border)',
        color: 'var(--text-dim)',
        cursor: 'pointer',
        borderRadius: '6px',
        fontSize: '1.05rem',
        lineHeight: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        minHeight: 'auto',
      }}
    >
      {children}
    </button>
  )
}
