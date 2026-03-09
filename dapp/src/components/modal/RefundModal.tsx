import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACTS } from '../../libs/contracts'
import { txHashStyle } from '../utils/styles'
import { explorerTxUrl } from '../../libs/config'
import { PROQUINT_ABI } from '../../libs/abi/ERC721ABI'

interface RefundModalProps {
  open: boolean
  onClose: () => void
  nameId: `0x${string}`
  proquintName: string
  rewardAmount: number
  remainingMonths: number
}

function formatEth(amount: number): string {
  if (amount === 0) return '0 ETH'
  if (amount < 0.0001) return `${(amount * 1e18).toFixed(0)} wei`
  if (amount < 0.01) return `${amount.toFixed(6)} ETH`
  return `${amount.toFixed(4)} ETH`
}

export function RefundModal({ open, onClose, nameId, proquintName, rewardAmount, remainingMonths }: RefundModalProps) {
  const [error, setError] = useState<string | null>(null)
  
  const { address } = useAccount()
  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract()
  const { isSuccess } = useWaitForTransactionReceipt({
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

    // Use the specified burn function
    writeContract({
      address: CONTRACTS.ProquintNFT,
      abi: PROQUINT_ABI,
      functionName: 'cleanInbox',
      args: [nameId],
    })
  }

  if (!open) return null

  return (
    <div style={overlayStyles}>
      <div style={modalStyles}>
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--success)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
            Clean Expired Inbox
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0', color: 'var(--text)' }}>
            Burn & Claim Reward
          </h2>
        </div>

        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.5rem' }}>
            {proquintName.toUpperCase()}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.75rem' }}>
            {remainingMonths > 1 ? 'Reward (50% of remaining value)' : 'Reward (1 month fixed)'}
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>
            {formatEth(rewardAmount)}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.35rem' }}>
            {remainingMonths > 1 ? `50% of ${remainingMonths} mo × 0.00003 ETH` : '1 mo × 0.00003 ETH (fixed reward)'}
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
          <strong>Cleaning an expired inbox name:</strong> This inbox name has expired and can be burned by anyone.
          {remainingMonths > 1 ? (
            <> You'll receive 50% of the remaining registration value as a reward. The other 50% goes to the original owner.</>
          ) : (
            <> You'll receive a fixed reward of 1 month (0.00003 ETH). The owner receives nothing as less than 1 month remains.</>
          )}
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
                Cleaned Successfully
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
            style={{ flex: 1, backgroundColor: 'var(--success)', color: '#fff' }}
            disabled={isPending || !!hash}
          >
            {isPending ? 'Processing…' : 'Clean & Claim'}
          </button>
        </div>
      </div>
    </div>
  )
}

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
