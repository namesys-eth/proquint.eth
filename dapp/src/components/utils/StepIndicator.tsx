interface Step {
  id: string
  label: string
  state: 'completed' | 'active' | 'pending'
}

interface StepIndicatorProps {
  steps: Step[]
}

export function StepIndicator({ steps }: StepIndicatorProps) {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center',
      gap: '0.75rem', 
    }}>
      {steps.map((step, index) => (
        <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ 
              width: '28px', 
              height: '28px', 
              borderRadius: '50%', 
              backgroundColor: step.state === 'completed' ? 'var(--success)' : 
                              step.state === 'active' ? 'var(--primary)' : 'var(--border)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: step.state === 'pending' ? 'var(--text-dim)' : 'white', 
              fontSize: '0.85rem', 
              fontWeight: 700,
              transition: 'all 0.3s ease'
            }}>
              {step.state === 'completed' ? '✓' : index + 1}
            </div>
            <span style={{ 
              fontSize: '0.85rem', 
              fontWeight: step.state === 'active' || step.state === 'completed' ? 500 : 400, 
              color: step.state === 'pending' ? 'var(--text-dim)' : 'var(--text)' 
            }}>
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div style={{ 
              width: '40px', 
              height: '2px', 
              backgroundColor: step.state === 'completed' ? 'var(--success)' : 'var(--border)',
              marginLeft: '0.25rem'
            }} />
          )}
        </div>
      ))}
    </div>
  )
}
