interface Action {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
}

interface ActionButtonsProps {
  actions: Action[]
  style?: React.CSSProperties
}

export function ActionButtons({ actions, style }: ActionButtonsProps) {
  return (
    <div className="actions" style={{ marginTop: '1rem', ...style }}>
      {actions.map((action, idx) => (
        <button
          key={idx}
          onClick={action.onClick}
          className={action.variant === 'secondary' ? 'secondary' : undefined}
          disabled={action.disabled}
          style={{
            fontSize: '1rem',
            padding: '0.85rem 1.5rem',
            ...(action.variant === 'danger' && {
              backgroundColor: 'var(--danger)',
              color: '#fff'
            })
          }}
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}
