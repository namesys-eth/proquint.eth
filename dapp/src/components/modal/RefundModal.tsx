import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACTS } from '../../libs/contracts'
import { explorerTxUrl } from '../../libs/config'
import { PROQUINT_ABI } from '../../libs/abi/ERC721ABI'

interface RefundModalProps {
  open: boolean
  onClose: () => void
  nameId: `0x${string}`
  isInboxOwner: boolean
  refundReward: {
    amount: number
    remainingMonths: number
    description: string
  }
}

function formatEth(amount: number): string {
  if (amount === 0) return '0 ETH'
  if (amount < 0.0001) return `${(amount * 1e18).toFixed(0)} wei`
  if (amount < 0.01) return `${amount.toFixed(6)} ETH`
  return `${amount.toFixed(4)} ETH`
}

export function RefundModal({ open, onClose, nameId, isInboxOwner, refundReward }: RefundModalProps) {
  const [error, setError] = useState<string | null>(null)
  
  const { address } = useAccount()
  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  })

  useEffect(() => {
    if (writeError) setError(writeError.message)
  }, [writeError])

  useEffect(() => {
    if (!open) setError(null)
  }, [open])

  const handleConfirm = () => {
    if (!address) {
      setError('Wallet not connected')
      return
    }

    setError(null)

    writeContract({
      address: CONTRACTS.ProquintNFT,
      abi: PROQUINT_ABI,
      functionName: isInboxOwner ? 'rejectInbox' : 'cleanInbox',
      args: [nameId],
    })
  }

  if (!open) return null

  return (
    <div style={overlayStyles}>
      <div style={modalStyles}>
        <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: isInboxOwner ? 'var(--danger)' : 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {isInboxOwner ? 'Refund this inbox' : 'Burn expired inbox'}
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0.35rem 0', color: 'var(--text)' }}>
            {isInboxOwner ? 'Claim Your Refund' : 'Earn Burn Reward'}
          </h2>
          <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--border)', margin: '1rem auto', opacity: 0.5 }} />
        </div>
        
        <div style={{ marginBottom: '1.5rem', lineHeight: '1.6' }}>
          {isInboxOwner ? (
            <>
              <p style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--text-dim)' }}>
                Calls <code style={mono}>rejectInbox</code>. Burns the name and sends you the refund.
              </p>

              <div style={cardStyle}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)', marginBottom: '0.15rem' }}>
                  {formatEth(refundReward.amount)}
                </div>
                <div style={{ ...mono, fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                  {refundReward.description}
                </div>
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.75rem', lineHeight: 1.6 }}>
                Refund = remaining whole months × 0.00002 ETH.<br />
                Partial months are not counted. Returns 0 if &lt;30 days remain.
              </div>
            </>
          ) : (
            <>
              <p style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--text-dim)' }}>
                Calls <code style={mono}>cleanInbox</code>. Burns the expired name.
                {refundReward.amount > 0
                  ? ' Reward split: 50% you, 50% receiver (if >1 month remains and receiver exists). Otherwise 100% to you.'
                  : ' No reward — name has <1 month remaining.'}
              </p>

              <div style={cardStyle}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)', marginBottom: '0.15rem' }}>
                  {formatEth(refundReward.amount)}
                </div>
                <div style={{ ...mono, fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                  {refundReward.description}
                </div>
              </div>
            </>
          )}
        </div>

        {error && (
          <div style={errorStyles}>
            {error}
          </div>
        )}

        {hash && (
          <div style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border)',
          }}>
            {isSuccess ? (
              <div style={{ color: 'var(--accent)', marginBottom: '0.5rem', fontWeight: 600 }}>
                ✓ {isInboxOwner ? 'Refund' : 'Burn'} Complete!
              </div>
            ) : isConfirming ? (
              <div style={{ color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
                ⏳ Confirming transaction...
              </div>
            ) : (
              <div style={{ color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
                ⏳ Waiting for transaction...
              </div>
            )}
            <a
              href={explorerTxUrl(hash)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: '"SF Mono", Monaco, monospace',
                fontSize: '0.85rem',
                color: 'var(--accent)',
                wordBreak: 'break-all',
                textDecoration: 'none',
              }}
            >
              {hash}
            </a>
          </div>
        )}

        <div style={{
          display: 'flex',
          gap: '0.75rem',
          flexWrap: 'wrap',
        }}>
          <button 
            className="secondary" 
            onClick={onClose} 
            disabled={isPending}
            style={{ flex: 1 }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            style={{ 
              flex: 1,
              backgroundColor: isInboxOwner ? 'var(--danger)' : 'var(--primary)',
              color: isInboxOwner ? '#fff' : 'var(--bg)'
            }}
            disabled={isPending || !!hash}
          >
            {isPending ? 'Processing...' : isInboxOwner ? 'Refund' : 'Burn'} →
          </button>
        </div>
      </div>
    </div>
  )
}

const mono: React.CSSProperties = { fontFamily: "'SF Mono', 'Monaco', monospace" }

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-secondary)',
  padding: '1rem',
  borderRadius: '8px',
  textAlign: 'center',
}

const overlayStyles: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.75)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '1rem'
}

const modalStyles: React.CSSProperties = {
  backgroundColor: 'var(--surface)',
  borderRadius: '8px',
  padding: '2rem',
  maxWidth: '500px',
  width: '100%',
  boxShadow: '0 25px 80px rgba(0, 0, 0, 0.5)',
  border: '1px solid var(--border)'
}

const errorStyles: React.CSSProperties = {
  marginTop: '0.75rem',
  padding: '0.75rem',
  borderRadius: '6px',
  backgroundColor: 'color-mix(in srgb, var(--danger) 10%, transparent)',
  border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
  color: 'var(--danger)',
  fontSize: '0.9rem',
}
