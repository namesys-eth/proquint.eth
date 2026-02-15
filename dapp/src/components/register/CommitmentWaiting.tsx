import { formatPrice } from '../../libs/proquint'
import { explorerTxUrl } from '../../libs/config'
import { Identicon } from '../utils/Identicon'

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
  onRegister,
  onCancel,
}: CommitmentWaitingProps) {
  const mono = { fontFamily: "'SF Mono', 'Monaco', monospace" } as const

  return (
    <div className="card">
      {/* Step indicator — between commit and register */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginBottom: '1.25rem', padding: '0.5rem', backgroundColor: 'var(--bg)', borderRadius: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: 0.4 }}>
          <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg)', fontSize: '0.7rem', fontWeight: 700 }}>✓</div>
          <span style={{ fontSize: '0.8rem' }}>Commit</span>
        </div>
        <div style={{ width: '32px', height: '2px', backgroundColor: 'var(--border)', alignSelf: 'center' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg)', fontSize: '0.7rem', fontWeight: 700 }}>2</div>
          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Register</span>
        </div>
      </div>

      {/* Name centerpiece */}
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

      {/* Identicon + details */}
      {receiverAddress && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Identicon address={receiverAddress} size={100} />
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
            <span>{years} {years === 1 ? 'yr' : 'yrs'}</span>
            <span>{formatPrice(price)} ETH</span>
          </div>
        </div>
      )}

      {/* Countdown / Ready */}
      <div style={{ textAlign: 'center', padding: '1rem 0.5rem', backgroundColor: 'var(--bg)', borderRadius: '6px', marginBottom: '1rem' }}>
        {timeLeft > 0 ? (
          <>
            <div style={{ ...mono, fontSize: '2.5rem', fontWeight: 800, color: 'var(--accent)' }}>{timeLeft}s</div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: '0.25rem' }}>Waiting to register…</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>✅</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--success)' }}>Ready to Register</div>
          </>
        )}
      </div>

      <div className="actions" style={{ justifyContent: 'center' }}>
        <button className="secondary" onClick={onCancel}>Cancel</button>
        <button onClick={onRegister} disabled={!canRegister || isPending}>
          {isPending ? 'Registering…' : 'Register Now'}
        </button>
      </div>

      {commitTxHash && (
        <div style={{ marginTop: '1rem', padding: '0.6rem 0.75rem', backgroundColor: 'var(--bg)', borderRadius: '6px', fontSize: '0.78rem' }}>
          <span style={{ color: 'var(--text-dim)' }}>Commit tx: </span>
          <a
            href={explorerTxUrl(commitTxHash)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...mono, color: 'var(--accent)', wordBreak: 'break-all' }}
          >
            {commitTxHash}
          </a>
        </div>
      )}
    </div>
  )
}
