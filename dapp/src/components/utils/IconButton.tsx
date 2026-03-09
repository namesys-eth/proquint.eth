interface IconButtonProps {
  onClick: () => void
  title: string
  label: string
  children: React.ReactNode
}

export function IconButton({ onClick, title, label, children }: IconButtonProps) {
  return (
    <button
      className="icon-button"
      onClick={onClick}
      aria-label={label}
      title={title}
      style={{
        padding: '0.35rem 0.45rem',
        background: 'transparent',
        border: '1px solid var(--border)',
        color: 'var(--text-dim)',
        cursor: 'pointer',
        borderRadius: '6px',
        fontSize: '1rem',
        lineHeight: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        minHeight: '32px',
      }}
    >
      {children}
    </button>
  )
}
