interface ToggleOption {
  value: string
  label: string
}

interface ToggleButtonsProps {
  options: ToggleOption[]
  value: string
  onChange: (value: string) => void
}

export function ToggleButtons({ options, value, onChange }: ToggleButtonsProps) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1,
              padding: '0.65rem',
              backgroundColor: active ? 'var(--primary)' : 'transparent',
              color: active ? 'var(--bg)' : 'var(--text-dim)',
              border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
              fontWeight: active ? 600 : 400,
              cursor: 'pointer',
              fontSize: '0.85rem',
              minHeight: 'auto',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
