import { useEffect, useMemo, useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { AddressInput } from '../utils/AddressInput'
import { CONTRACTS } from '../../libs/contracts'
import { explorerTxUrl } from '../../libs/config'
import { PROQUINT_ABI } from '../../libs/abi/ERC721ABI'

interface TransferModalProps {
  open: boolean
  onClose: () => void
  nameId: `0x${string}`
  onBurnRequest: () => void
  proquintName?: string
  expiryTimestamp?: bigint | number | null
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export function TransferModal({ open, onClose, nameId, onBurnRequest, proquintName, expiryTimestamp }: TransferModalProps) {
  const [inputValue, setInputValue] = useState('')
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const { address } = useAccount()
  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  })

  useEffect(() => {
    if (!open) {
      setInputValue('')
      setResolvedAddress(null)
      setError(null)
    }
  }, [open])

  useEffect(() => {
    if (writeError) {
      setError(writeError.message)
    }
  }, [writeError])

  const target = useMemo(() => (resolvedAddress || inputValue).trim(), [resolvedAddress, inputValue])

  const normalizedTarget = useMemo(() => {
    if (!target) return null
    const lower = target.toLowerCase()
    if (/^0x[0-9a-f]{40}$/.test(lower)) {
      return lower as `0x${string}`
    }
    return null
  }, [target])

  const isZeroAddress = normalizedTarget === ZERO_ADDRESS

  const formattedExpiry = useMemo(() => {
    if (!expiryTimestamp) return 'Not set'
    const numericValue = typeof expiryTimestamp === 'bigint'
      ? Number(expiryTimestamp)
      : expiryTimestamp
    if (!numericValue || Number.isNaN(numericValue)) return 'Not set'
    const date = new Date(numericValue * 1000)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [expiryTimestamp])

  const handleConfirm = () => {
    if (!normalizedTarget) {
      setError('Enter a valid address, ENS name, or proquint owner')
      return
    }

    if (!address) {
      setError('Wallet not connected')
      return
    }

    if (isZeroAddress) {
      onClose()
      onBurnRequest()
      return
    }

    setError(null)
    
    try {
      writeContract({
        address: CONTRACTS.ProquintNFT,
        abi: PROQUINT_ABI,
        functionName: 'safeTransferFrom',
        args: [address, normalizedTarget, BigInt(nameId)],
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate transfer')
    }
  }

  if (!open) return null

  return (
    <div style={overlayStyles}>
      <div style={modalStyles}>
        <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Transfer Inbox Name
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0.35rem 0', color: 'var(--text)', textTransform: 'uppercase' }}>
            {proquintName ?? 'Pending Inbox Name'}
          </h2>
          <div style={{ fontFamily: '"SF Mono", Monaco, monospace', fontSize: '0.85rem', color: 'var(--text-dim)' }}>
            {nameId} • Expires {formattedExpiry}
          </div>
          <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--border)', margin: '1rem auto', opacity: 0.5 }} />
          <button
            type="button"
            onClick={() => {
              onClose()
              onBurnRequest()
            }}
            style={{
              marginTop: '0.25rem',
              padding: 0,
              border: 'none',
              background: 'none',
              color: 'var(--accent)',
              fontSize: '0.9rem',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Prefer to refund / burn this name?
          </button>
        </div>
        <p style={{ marginBottom: '1rem', lineHeight: 1.6, color: 'var(--text-dim)', fontSize: '0.9rem' }}>
          Calls <code style={{ fontFamily: "'SF Mono', 'Monaco', monospace" }}>safeTransferFrom</code>. Name lands in the receiver's inbox — they must call <code style={{ fontFamily: "'SF Mono', 'Monaco', monospace" }}>acceptInbox</code> before the claim window expires.
          Each transfer subtracts <strong style={{ color: 'var(--warning)' }}>7 days</strong> from expiry.
        </p>

        <div style={{ marginBottom: '1rem' }}>
          <AddressInput
            value={inputValue}
            onChange={setInputValue}
            placeholder="0x... / ethereum.eth / CVCVC-CVCVC"
            showHelperText={false}
            onResolvedChange={setResolvedAddress}
            showResolvedSummary={false}
          />
        </div>

        {resolvedAddress && (
          <div style={resolvedStyles}>
            ✓ Resolved to <span>{resolvedAddress}</span>
          </div>
        )}

        {isZeroAddress && (
          <div style={warningStyles}>
            Sending to <code>0x0</code> will permanently burn this inbox ID. You will be asked to confirm the burn instead of a transfer.
          </div>
        )}

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
                ✓ Transfer Complete!
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
          marginTop: '1.5rem',
          display: 'flex',
          gap: '0.75rem',
          flexWrap: 'wrap',
        }}>
          {isSuccess ? (
            <button onClick={onClose} style={{ flex: 1 }}>
              Close
            </button>
          ) : (
            <>
              <button className="secondary" onClick={onClose} style={{ flex: 1 }} disabled={isPending}>
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                style={{ flex: 1 }}
                disabled={isPending || !!hash}
              >
                {isPending ? 'Processing...' : isZeroAddress ? 'Burn Instead' : 'Transfer'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const overlayStyles: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.75)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1rem',
  zIndex: 1100,
}

const modalStyles: React.CSSProperties = {
  backgroundColor: 'var(--surface)',
  borderRadius: '8px',
  padding: '2rem',
  width: '100%',
  maxWidth: '520px',
  boxShadow: '0 25px 80px rgba(0, 0, 0, 0.5)',
  border: '1px solid var(--border)',
}

const resolvedStyles: React.CSSProperties = {
  fontFamily: '"SF Mono", Monaco, monospace',
  fontSize: '0.85rem',
  color: 'var(--primary)',
}

const warningStyles: React.CSSProperties = {
  marginTop: '0.75rem',
  padding: '0.75rem',
  borderRadius: '6px',
  backgroundColor: 'color-mix(in srgb, var(--warning) 10%, transparent)',
  border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)',
  fontSize: '0.9rem',
  lineHeight: 1.4,
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
