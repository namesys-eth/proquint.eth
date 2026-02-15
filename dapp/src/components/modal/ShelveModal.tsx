import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACTS } from '../../libs/contracts'
import { explorerTxUrl } from '../../libs/config'
import { PROQUINT_ABI } from '../../libs/abi/ERC721ABI'

interface ShelveModalProps {
  open: boolean
  onClose: () => void
  nameId: `0x${string}`
  proquintName: string
}

export function ShelveModal({ open, onClose, nameId, proquintName }: ShelveModalProps) {
  const [error, setError] = useState<string | null>(null)
  const { address } = useAccount()
  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (writeError) setError(writeError.message)
  }, [writeError])

  useEffect(() => {
    if (!open) setError(null)
  }, [open])

  const handleShelve = () => {
    if (!address) { setError('Wallet not connected'); return }
    setError(null)
    writeContract({
      address: CONTRACTS.ProquintNFT,
      abi: PROQUINT_ABI,
      functionName: 'shelve',
      args: [nameId],
    })
  }

  if (!open) return null

  return (
    <div style={overlayStyles}>
      <div style={modalStyles}>
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--warning)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Shelve Primary
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.35rem 0', color: 'var(--text)', textTransform: 'uppercase', fontFamily: "'SF Mono', 'Monaco', monospace" }}>
            {proquintName}
          </h2>
          <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--border)', margin: '0.75rem auto', opacity: 0.5 }} />
        </div>

        <p style={{ marginBottom: '1rem', lineHeight: 1.6, color: 'var(--text-dim)', fontSize: '0.85rem' }}>
          Calls <code style={{ fontFamily: "'SF Mono', 'Monaco', monospace" }}>shelve</code>. Moves your primary to inbox, freeing the slot. You can then call <code style={{ fontFamily: "'SF Mono', 'Monaco', monospace" }}>acceptInbox</code> on the pending name.
        </p>

        <div style={{
          padding: '0.65rem 0.75rem', marginBottom: '1rem',
          backgroundColor: 'color-mix(in srgb, var(--warning) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)',
          borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.5
        }}>
          <strong style={{ color: 'var(--warning)' }}>Penalty:</strong> Subtracts 7 days from expiry. Inbox claim window is based on your current inbox count (42d first item → 7d at 255).
        </div>

        {error && (
          <div style={errorStyles}>{error}</div>
        )}

        {hash && (
          <div style={{
            marginBottom: '1rem', padding: '0.75rem',
            backgroundColor: 'var(--bg)', borderRadius: '6px', border: '1px solid var(--border)',
          }}>
            {isSuccess ? (
              <div style={{ color: 'var(--success)', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.85rem' }}>✓ Shelved successfully</div>
            ) : isConfirming ? (
              <div style={{ color: 'var(--text-dim)', marginBottom: '0.4rem', fontSize: '0.85rem' }}>⏳ Confirming…</div>
            ) : (
              <div style={{ color: 'var(--text-dim)', marginBottom: '0.4rem', fontSize: '0.85rem' }}>⏳ Waiting…</div>
            )}
            <a href={explorerTxUrl(hash)} target="_blank" rel="noopener noreferrer"
              style={{ fontFamily: "'SF Mono', 'Monaco', monospace", fontSize: '0.78rem', color: 'var(--accent)', wordBreak: 'break-all', textDecoration: 'none' }}>
              {hash}
            </a>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="secondary" onClick={onClose} disabled={isPending} style={{ flex: 1 }}>
            Cancel
          </button>
          <button
            onClick={handleShelve}
            disabled={isPending || !!hash}
            style={{ flex: 1, backgroundColor: 'var(--warning)', color: '#000' }}
          >
            {isPending ? 'Processing…' : 'Shelve'}
          </button>
        </div>
      </div>
    </div>
  )
}

const overlayStyles: React.CSSProperties = {
  position: 'fixed', inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.75)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: '1rem',
}

const modalStyles: React.CSSProperties = {
  backgroundColor: 'var(--surface)',
  borderRadius: '8px', padding: '1.5rem',
  maxWidth: '460px', width: '100%',
  boxShadow: '0 25px 80px rgba(0, 0, 0, 0.5)',
  border: '1px solid var(--border)',
}

const errorStyles: React.CSSProperties = {
  marginBottom: '0.75rem', padding: '0.6rem',
  borderRadius: '6px',
  backgroundColor: 'color-mix(in srgb, var(--danger) 10%, transparent)',
  border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
  color: 'var(--danger)', fontSize: '0.85rem',
}
