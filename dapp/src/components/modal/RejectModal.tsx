import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACTS } from '../../libs/contracts'
import { txHashStyle } from '../utils/styles'
import { explorerTxUrl } from '../../libs/config'
import { PROQUINT_ABI } from '../../libs/abi/ERC721ABI'

interface RejectModalProps {
  open: boolean
  onClose: () => void
  nameId: `0x${string}`
  proquintName: string
  refundAmount: number
  remainingMonths: number
}

function formatEth(amount: number): string {
  if (amount === 0) return '0 ETH'
  if (amount < 0.0001) return `${(amount * 1e18).toFixed(0)} wei`
  if (amount < 0.01) return `${amount.toFixed(6)} ETH`
  return `${amount.toFixed(4)} ETH`
}

export function RejectModal({ open, onClose, nameId, proquintName, refundAmount, remainingMonths }: RejectModalProps) {
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
      functionName: 'rejectInbox',
      args: [nameId],
    })
  }

  if (!open) return null

  const overlayStyles: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem',
  }

  const modalStyles: React.CSSProperties = {
    backgroundColor: 'var(--surface)',
    borderRadius: '12px',
    padding: '1.5rem',
    maxWidth: '480px',
    width: '100%',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
  }

  const cardStyle: React.CSSProperties = {
    padding: '1rem',
    backgroundColor: 'var(--bg)',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    marginBottom: '1rem',
  }

  const errorStyles: React.CSSProperties = {
    padding: '0.75rem',
    backgroundColor: 'color-mix(in srgb, var(--danger) 10%, transparent)',
    border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
    borderRadius: '6px',
    color: 'var(--danger)',
    fontSize: '0.85rem',
    marginBottom: '1rem',
  }

  return (
    <div style={overlayStyles}>
      <div style={modalStyles}>
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--danger)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
            Reject Inbox Name
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0', color: 'var(--text)' }}>
            Reject & Get Refund
          </h2>
        </div>

        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.5rem' }}>
            {proquintName.toUpperCase()}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.75rem' }}>
            Refund (100% of remaining value)
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)' }}>
            {formatEth(refundAmount)}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.35rem' }}>
            {remainingMonths} mo × 0.00003 ETH
          </div>
        </div>

        <div style={{
          padding: '0.75rem',
          marginBottom: '1rem',
          backgroundColor: 'var(--bg)',
          borderRadius: '6px',
          border: '1px solid var(--border)',
          fontSize: '0.85rem',
          color: 'var(--text-dim)',
          lineHeight: 1.5,
        }}>
          <strong>Rejecting an inbox name:</strong> This will permanently burn the inbox name and refund you 100% of the remaining registration value. The name will become available for re-registration after the grace period.
        </div>

        {error && (
          <div style={errorStyles}>{error}</div>
        )}

        {hash && (
          <div style={{
            marginBottom: '1rem', padding: '0.75rem',
            backgroundColor: 'var(--bg)', borderRadius: '6px',
            border: '1px solid var(--border)', textAlign: 'center',
          }}>
            {isSuccess ? (
              <div style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.9rem' }}>
                Rejected Successfully
              </div>
            ) : (
              <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Confirming…</div>
            )}
            <a href={explorerTxUrl(hash)} target="_blank" rel="noopener noreferrer"
              style={txHashStyle}>
              {hash}
            </a>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="secondary" onClick={onClose} disabled={isPending} style={{ flex: 1 }}>
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            style={{ flex: 1, backgroundColor: 'var(--danger)', color: '#fff' }}
            disabled={isPending || !!hash}
          >
            {isPending ? 'Processing…' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  )
}
