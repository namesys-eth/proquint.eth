import { formatPrice } from '../../libs/proquint'
import { explorerAddressUrl } from '../../libs/config'
import { StepIndicator } from '../utils/StepIndicator'
import { Identicon } from '../utils/Identicon'
import { Confetti } from '../utils/Confetti'
import { monoStyle } from '../utils/styles'

interface TransactionStatusProps {
  step: 'commit' | 'register'
  isConfirming: boolean
  isSuccess: boolean
  proquint?: string
  normalizedId?: string | null
  price?: bigint
  years?: number
  receiverAddress?: string
  receiverInput?: string
  userAddress?: string
  onCancel?: () => void
  onViewName?: () => void
  onRegisterAnother?: () => void
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
  receiverInput,
  userAddress,
  onCancel,
  onViewName,
  onRegisterAnother,
}: TransactionStatusProps) {
  const showReceiver = receiverAddress && receiverAddress !== ''
  const displayReceiver = receiverInput || receiverAddress
  const identiconAddress = userAddress || '0x0000000000000000000000000000000000000000'

  // Step indicator logic:
  // - In 'commit' step: commit is "active" while confirming, "completed" after success
  // - In 'register' step: commit is "completed", register is "active" while confirming, "completed" after success
  const steps: { id: string; label: string; state: 'completed' | 'active' | 'pending' }[] = [
    { 
      id: 'commit', 
      label: 'Committed', 
      state: (step === 'commit' && !isSuccess) ? 'active' : 'completed'
    },
    { 
      id: 'register', 
      label: 'Register', 
      state: step === 'register' ? (isSuccess ? 'completed' : 'active') : 'pending'
    },
  ]
  return (
    <div className="card">
      {/* Step indicator */}
      <div style={{ marginBottom: '1.5rem' }}>
        <StepIndicator steps={steps} />
      </div>

      {/* Identicon with proquint overlay */}
      {proquint && (
        <>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <Identicon
              address={identiconAddress} 
              proquintId={normalizedId as `0x${string}` | undefined}
              size={200}
              overlayLabel={proquint}
            />
          </div>

          {/* Hex ID display */}
          {normalizedId && (
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 500 }}>Hex ID: </span>
              <span style={{ ...monoStyle, fontSize: '0.9rem', color: 'var(--text)', fontWeight: 600 }}>
                {normalizedId.toUpperCase()}
              </span>
            </div>
          )}
        </>
      )}

      {/* Registration details */}
      {showReceiver && (
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '0.75rem', fontWeight: 500 }}>
            Recipient
          </div>
          <Identicon address={receiverAddress!} size={80} />
          <div style={{ 
            ...monoStyle, 
            fontSize: '0.85rem', 
            color: 'var(--text)', 
            marginTop: '0.5rem',
            fontWeight: 600
          }}>
            {displayReceiver}
          </div>
          {explorerAddressUrl(receiverAddress!) && (
            <a 
              href={explorerAddressUrl(receiverAddress!)} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ 
                fontSize: '0.75rem', 
                color: 'var(--accent)', 
                textDecoration: 'none',
                marginTop: '0.25rem',
                display: 'inline-block'
              }}
            >
              View on Explorer ↗
            </a>
          )}
        </div>
      )}

      {/* Info grid - Duration and Cost inline */}
      {(price || years) && (
        <div className="info-grid" style={{ marginBottom: '1.5rem' }}>
          {years && (
            <div className="info-item">
              <div className="info-label">Duration</div>
              <div className="info-value">{years} {years === 1 ? 'yr' : 'yrs'}</div>
            </div>
          )}
          {price && (
            <div className="info-item">
              <div className="info-label">Cost</div>
              <div className="info-value">{formatPrice(price)} ETH</div>
            </div>
          )}
        </div>
      )}

      {/* Status message */}
      <div style={{ textAlign: 'center', padding: '1.5rem 1rem', marginBottom: '1.5rem', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        {isSuccess ? (
          <>
            <Confetti />
            <div style={{ fontSize: '4rem', marginBottom: '1rem', animation: 'bounce 0.6s ease-in-out' }}>🎉</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)', marginBottom: '0.5rem' }}>
              Registration Complete!
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: '1rem' }}>
              Your proquint name is now registered
            </div>
            <style>{`
              @keyframes bounce {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.2); }
              }
            `}</style>
          </>
        ) : step === 'commit' ? (
          <>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>⏳</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
              {isConfirming ? 'Confirming Commitment' : 'Confirm in Wallet'}
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.95rem', marginTop: '0.4rem' }}>
              {isConfirming ? 'Processing on-chain…' : 'Approve the commit transaction'}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
              {isConfirming ? '⏳' : '👛'}
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
              {isConfirming ? 'Confirming Registration' : 'Confirm in Wallet'}
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.95rem', marginTop: '0.4rem' }}>
              {isConfirming ? 'Processing on-chain…' : 'Approve the registration transaction'}
            </div>
          </>
        )}
      </div>

      {onCancel && !isSuccess && (
        <div className="actions" style={{ justifyContent: 'center' }}>
          <button className="secondary" onClick={onCancel} style={{ fontSize: '1rem' }}>Cancel</button>
        </div>
      )}

      {isSuccess && step === 'register' && (
        <div className="actions" style={{ justifyContent: 'center' }}>
          <button onClick={onViewName} disabled={!onViewName}>
            View Name
          </button>
          <button className="secondary" onClick={onRegisterAnother} disabled={!onRegisterAnother}>
            Register New
          </button>
        </div>
      )}
    </div>
  )
}
