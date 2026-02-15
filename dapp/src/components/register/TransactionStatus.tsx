import { formatPrice } from '../../libs/proquint'
import { Identicon } from '../utils/Identicon'

interface TransactionStatusProps {
  step: 'commit' | 'register'
  isConfirming: boolean
  isSuccess: boolean
  proquint?: string
  normalizedId?: string | null
  price?: bigint
  years?: number
  receiverAddress?: string
  onCancel?: () => void
}

export function TransactionStatus({
  step,
  isConfirming,
  isSuccess,
  proquint,
  normalizedId,
  price,
  years,
  receiverAddress,
  onCancel,
}: TransactionStatusProps) {
  const mono = { fontFamily: "'SF Mono', 'Monaco', monospace" } as const

  const StepDot = ({ n, active }: { n: number; active: boolean }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: active ? 1 : 0.4 }}>
      <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: active ? 'var(--primary)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg)', fontSize: '0.7rem', fontWeight: 700 }}>{n}</div>
      <span style={{ fontSize: '0.8rem', fontWeight: active ? 600 : 400 }}>{n === 1 ? 'Commit' : 'Register'}</span>
    </div>
  )

  return (
    <div className="card">
      {/* Step indicator */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginBottom: '1.25rem', padding: '0.5rem', backgroundColor: 'var(--bg)', borderRadius: '6px' }}>
        <StepDot n={1} active={step === 'commit'} />
        <div style={{ width: '32px', height: '2px', backgroundColor: 'var(--border)', alignSelf: 'center' }} />
        <StepDot n={2} active={step === 'register'} />
      </div>

      {/* Name centerpiece */}
      {proquint && (
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <div style={{
            ...mono,
            fontSize: 'clamp(1.5rem, 5vw, 2.2rem)',
            fontWeight: 800,
            color: 'var(--accent)',
            textTransform: 'uppercase',
            letterSpacing: '-0.01em',
            lineHeight: 1.1,
            marginBottom: '0.15rem',
          }}>
            {proquint}
          </div>
          {normalizedId && (
            <div style={{ ...mono, fontSize: '0.78rem', color: 'var(--text-dim)' }}>{normalizedId}</div>
          )}
        </div>
      )}

      {/* Identicon + details */}
      {receiverAddress && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Identicon address={receiverAddress} size={100} />
          {price && years && (
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
              <span>{years} {years === 1 ? 'yr' : 'yrs'}</span>
              <span>{formatPrice(price)} ETH</span>
            </div>
          )}
        </div>
      )}

      {/* Status message */}
      <div style={{ textAlign: 'center', padding: '1rem 0.5rem', backgroundColor: 'var(--bg)', borderRadius: '6px', marginBottom: '1rem' }}>
        {step === 'commit' && (
          <>
            <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>⏳</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>
              {isConfirming ? 'Confirming Commitment' : 'Confirm in Wallet'}
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
              {isConfirming ? 'Processing on-chain…' : 'Approve the commit transaction'}
            </div>
          </>
        )}
        {step === 'register' && (
          <>
            <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>
              {isConfirming ? '⏳' : '👛'}
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>
              {isConfirming ? 'Confirming Registration' : 'Confirm in Wallet'}
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
              {isConfirming ? 'Processing on-chain…' : 'Approve the registration transaction'}
            </div>
          </>
        )}
      </div>

      {onCancel && !isSuccess && (
        <div className="actions" style={{ justifyContent: 'center' }}>
          <button className="secondary" onClick={onCancel}>Cancel</button>
        </div>
      )}
    </div>
  )
}
