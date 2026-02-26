import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { CONTRACTS, CONSTANTS } from '../../libs/contracts'
import { monoStyle } from '../utils/styles'
import { PROQUINT_ABI } from '../../libs/abi/ERC721ABI'
import { encodePacked } from 'viem'
import { bytes4ToProquint, calculateRenewPrice, formatPrice } from '../../libs/proquint'

interface ExtendModalProps {
  open: boolean
  onClose: () => void
  nameId: `0x${string}`
  currentExpiry?: bigint
}

export function ExtendModal({ open, onClose, nameId, currentExpiry }: ExtendModalProps) {
  const { address } = useAccount()
  const [years, setYears] = useState(1)

  const { writeContract, data: hash, isPending, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const { data: expiryTs } = useReadContract({
    address: CONTRACTS.ProquintNFT,
    abi: PROQUINT_ABI,
    functionName: 'getExpiry',
    args: [nameId],
    query: { enabled: !!nameId },
  })

  const proquintName = bytes4ToProquint(nameId).toUpperCase()
  const isTwin = proquintName.split('-')[0] === proquintName.split('-')[1]
  const expiry = currentExpiry || expiryTs || 0n
  const remaining = expiry ? Math.max(0, Number(expiry) - Math.floor(Date.now() / 1000)) : 0
  const price = calculateRenewPrice(years, remaining, isTwin)

  const canExtend = years >= 1 && years <= CONSTANTS.MAX_YEARS && price > 0n

  const handleExtend = () => {
    if (!address || !nameId) return
    // Pack: bytes1(yrs) ++ bytes4(id)
    const input = encodePacked(['uint8', 'bytes4'], [years, nameId])
    writeContract({
      address: CONTRACTS.ProquintNFT,
      abi: PROQUINT_ABI,
      functionName: 'renew',
      args: [input],
      value: price,
    })
  }

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setYears(1)
      reset()
    }
  }, [open, reset])

  // Auto-close on success after 2s
  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => onClose(), 2000)
      return () => clearTimeout(timer)
    }
  }, [isSuccess, onClose])

  if (!open) return null

  const expiryDate = expiry ? new Date(Number(expiry) * 1000) : null
  const newExpiryDate = expiry ? new Date((Number(expiry) + years * 365 * 24 * 60 * 60) * 1000) : null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '8px', padding: '1rem', maxWidth: '500px', width: '100%',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem', color: 'var(--accent)' }}>
          Extend
        </h2>

        <div style={{ marginBottom: '1rem' }}>
          <div style={{
            padding: '0.65rem 0.85rem', background: 'var(--bg)',
            border: '1px solid var(--border)', borderRadius: '6px',
            ...monoStyle, fontSize: '1rem',
            textAlign: 'center', color: 'var(--accent)',
          }}>
            {proquintName}
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text)' }}>
            Additional Years (1-{CONSTANTS.MAX_YEARS})
          </label>
          <input
            type="range"
            min={1}
            max={CONSTANTS.MAX_YEARS}
            value={years}
            onChange={(e) => setYears(Number(e.target.value))}
            style={{ width: '100%', height: '8px', cursor: 'pointer' }}
          />
          <div style={{
            display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem',
            fontSize: '0.85rem', color: 'var(--text-dim)',
          }}>
            <span>1 year</span>
            <span style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--accent)' }}>
              {years} {years === 1 ? 'year' : 'years'}
            </span>
            <span>{CONSTANTS.MAX_YEARS} years</span>
          </div>
        </div>

        {price > 0n && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.4rem 0.75rem',
            padding: '0.65rem 0.85rem', background: 'var(--bg)',
            border: '1px solid var(--border)', borderRadius: '6px',
            fontSize: '0.85rem', marginBottom: '1rem',
          }}>
            <span style={{ color: 'var(--text-dim)' }}>Remaining</span>
            <span>{Math.floor(remaining / (365 * 24 * 60 * 60))} years + {Math.floor((remaining % (365 * 24 * 60 * 60)) / CONSTANTS.MONTH_DURATION)} months</span>
            
            <span style={{ color: 'var(--text-dim)' }}>Cost</span>
            <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{formatPrice(price)} ETH</span>
            
            {expiryDate && (
              <>
                <span style={{ color: 'var(--text-dim)' }}>Current Expiry</span>
                <span>{expiryDate.toLocaleDateString()}</span>
              </>
            )}
            
            {newExpiryDate && (
              <>
                <span style={{ color: 'var(--text-dim)' }}>New Expiry</span>
                <span style={{ fontWeight: 600 }}>{newExpiryDate.toLocaleDateString()}</span>
              </>
            )}
            
            {isTwin && (
              <>
                <span style={{ color: 'var(--text-dim)' }}>Twin Multiplier</span>
                <span style={{ color: 'var(--warning)' }}>5×</span>
              </>
            )}
          </div>
        )}

        {isSuccess && (
          <div style={{
            padding: '0.65rem', marginBottom: '0.85rem', fontSize: '0.9rem',
            background: 'color-mix(in srgb, var(--success) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--success) 30%, transparent)',
            borderRadius: '6px', color: 'var(--success)', textAlign: 'center',
          }}>
            ✓ Extension complete!
          </div>
        )}

        {isConfirming && (
          <div style={{
            padding: '0.65rem', marginBottom: '0.85rem', fontSize: '0.9rem',
            background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: '6px', color: 'var(--text-dim)', textAlign: 'center',
          }}>
            ⏳ Confirming transaction...
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleExtend}
            disabled={!canExtend || isPending || isConfirming || isSuccess}
            style={{
              flex: 1, padding: '0.75rem 1.25rem', fontSize: '0.95rem',
              background: 'var(--primary)', color: 'var(--bg)',
              border: 'none', borderRadius: '6px', cursor: 'pointer',
              fontWeight: 600, transition: 'background 0.2s',
            }}
          >
            {isPending ? 'Extending...' : isSuccess ? 'Extended!' : 'Extend'}
          </button>
          <button
            onClick={onClose}
            disabled={isPending || isConfirming}
            style={{
              padding: '0.75rem 1.25rem', fontSize: '0.95rem',
              background: 'transparent', color: 'var(--text)',
              border: '1px solid var(--border)', borderRadius: '6px',
              cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s',
            }}
          >
            {isSuccess ? 'Close' : 'Cancel'}
          </button>
        </div>

        <div style={{
          marginTop: '0.85rem', padding: '0.65rem', background: 'var(--bg)',
          border: '1px solid var(--border)', borderRadius: '6px',
          fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.5,
        }}>
          <div style={{ marginBottom: '0.4rem' }}>
            <strong style={{ color: 'var(--text)' }}>Exponential Pricing:</strong> Cost increases with remaining time to prevent hoarding. Names with &gt;1 year remaining pay higher marginal rates.
          </div>
          <div>
            <strong style={{ color: 'var(--text)' }}>Gift Renewal:</strong> Anyone can extend any name by paying the renewal fee.
          </div>
        </div>
      </div>
    </div>
  )
}
