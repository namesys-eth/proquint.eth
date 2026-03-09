import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACTS } from '../../libs/contracts'
import { explorerTxUrl } from '../../libs/config'
import { PROQUINT_ABI } from '../../libs/abi/ERC721ABI'
import { monoStyle, txHashStyle } from '../utils/styles'

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
  const { isSuccess } = useWaitForTransactionReceipt({ hash })

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
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--warning)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
            Shelve Primary
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0', color: 'var(--text)', textTransform: 'uppercase', ...monoStyle }}>
            {proquintName}
          </h2>
        </div>

        <div style={{
          padding: '0.75rem', marginBottom: '1rem',
          backgroundColor: 'var(--bg)', borderRadius: '6px',
          border: '1px solid var(--border)',
          fontSize: '0.9rem', color: 'var(--text-dim)', lineHeight: 1.6, textAlign: 'center',
        }}>
          Moves this name to your inbox so you can claim a different one as primary.
          <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--warning)' }}>
            7-day penalty subtracted from expiry
          </div>
        </div>

        {error && (
          <div style={errorStyles}>{error}</div>
        )}

        {hash && (
          <div style={{
            marginBottom: '1rem', padding: '0.75rem',
            backgroundColor: 'var(--bg)', borderRadius: '6px', border: '1px solid var(--border)',
            textAlign: 'center',
          }}>
            {isSuccess ? (
              <div style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.9rem' }}>Shelved successfully</div>
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
  borderRadius: '8px', padding: '1rem',
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
