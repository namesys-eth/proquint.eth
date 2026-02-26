import { CONSTANTS } from '../../libs/contracts'

interface ExpiryDisplayProps {
  expiryTimestamp: bigint | undefined
  showGracePeriod?: boolean
  showPremiumPeriod?: boolean
  compact?: boolean
}

export function ExpiryDisplay({ 
  expiryTimestamp, 
  showGracePeriod = true, 
  showPremiumPeriod = false,
  compact = false 
}: ExpiryDisplayProps) {
  if (!expiryTimestamp) return null

  const expiryDate = new Date(Number(expiryTimestamp) * 1000)
  const now = Date.now()
  const isExpired = expiryDate.getTime() < now

  const dateStr = compact
    ? expiryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : expiryDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  const graceDays = Math.floor(CONSTANTS.GRACE_PERIOD / (24 * 60 * 60))
  const premiumDays = Math.floor(CONSTANTS.PREMIUM_PERIOD / (24 * 60 * 60))

  return (
    <div style={{
      padding: '0.75rem',
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: '6px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.35rem' }}>
        {isExpired ? 'Expired' : 'Expires'}
      </div>
      <div style={{ 
        fontSize: '0.9rem', 
        fontWeight: 600, 
        color: isExpired ? 'var(--danger)' : 'var(--text)' 
      }}>
        {dateStr}
      </div>
      {showGracePeriod && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.35rem' }}>
          +{graceDays} days grace period
        </div>
      )}
      {showPremiumPeriod && (
        <div style={{ fontSize: '0.75rem', color: 'var(--warning)', marginTop: '0.25rem' }}>
          +{premiumDays} days premium period
        </div>
      )}
    </div>
  )
}
