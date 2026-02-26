import { formatPrice } from '../../libs/proquint'
import { explorerTxUrl, explorerAddressUrl } from '../../libs/config'
import { StepIndicator } from '../utils/StepIndicator'
import { IdenticonWithName } from '../utils/IdenticonWithName'
import { monoStyle } from '../utils/styles'

interface CommitmentWaitingProps {
  proquint: string
  normalizedId: string | null
  price: bigint
  years: number
  timeLeft: number
  canRegister: boolean
  isPending: boolean
  commitTxHash: string | null
  receiverAddress?: string
  receiverInput?: string
  userAddress?: string
  onRegister: () => void
  onCancel: () => void
}

export function CommitmentWaiting({
  proquint,
  normalizedId,
  price,
  years,
  timeLeft,
  canRegister,
  isPending,
  commitTxHash,
  receiverAddress,
  receiverInput,
  userAddress,
  onRegister,
  onCancel,
}: CommitmentWaitingProps) {
  // Only show receiver if it's actually a different address (minting to another)
  const showReceiver = receiverAddress && receiverAddress !== ''
  const displayReceiver = receiverInput || receiverAddress
  const identiconAddress = userAddress || '0x0000000000000000000000000000000000000000'

  // Step states: commit is always completed at this stage, register is active when ready
  const steps = [
    { id: 'commit', label: 'Committed', state: 'completed' as const },
    { 
      id: 'register', 
      label: 'Register', 
      state: canRegister ? 'active' : 'pending' as const
    },
  ]

  return (
    <div className="card">
      {/* Step indicator */}
      <div style={{ marginBottom: '1.5rem' }}>
        <StepIndicator steps={steps} />
      </div>

      {/* Identicon with proquint overlay */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
        <IdenticonWithName
          address={identiconAddress}
          proquintId={normalizedId as `0x${string}` | undefined}
          proquint={proquint}
          size={200}
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
      <div className="info-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="info-item">
          <div className="info-label">Duration</div>
          <div className="info-value">{years} {years === 1 ? 'yr' : 'yrs'}</div>
        </div>
        <div className="info-item">
          <div className="info-label">Cost</div>
          <div className="info-value">{formatPrice(price)} ETH</div>
        </div>
      </div>

      {/* Countdown / Ready status */}
      <div style={{ 
        textAlign: 'center', 
        padding: '1.5rem 1rem', 
        marginBottom: '1.5rem',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)'
      }}>
        {timeLeft > 0 ? (
          <>
            <div style={{ 
              ...monoStyle, 
              fontSize: 'clamp(2.5rem, 8vw, 3.5rem)', 
              fontWeight: 800, 
              color: 'var(--accent)',
              lineHeight: 1
            }}>{timeLeft}s</div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginTop: '0.5rem' }}>Waiting to register...</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.4rem', lineHeight: 1 }}>✅</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--success)' }}>Ready to Register!</div>
          </>
        )}
      </div>

      <div className="actions" style={{ justifyContent: 'center' }}>
        <button className="secondary" onClick={onCancel} style={{ fontSize: '1rem' }}>Cancel</button>
        <button onClick={onRegister} disabled={!canRegister || isPending} style={{ fontSize: '1.05rem', padding: '0.9rem 1.5rem' }}>
          {isPending ? 'Registering…' : 'Register Now'}
        </button>
      </div>

      {commitTxHash && (
        <div style={{ marginTop: '1.5rem', padding: '0.75rem 1rem', fontSize: '0.85rem', opacity: 0.7 }}>
          <span style={{ color: 'var(--text-dim)' }}>Commit tx: </span>
          <a
            href={explorerTxUrl(commitTxHash)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...monoStyle, color: 'var(--accent)', wordBreak: 'break-all' }}
          >
            {commitTxHash}
          </a>
        </div>
      )}
    </div>
  )
}
