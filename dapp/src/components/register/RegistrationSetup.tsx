import { ProquintInput } from '../utils/ProquintInput'
import { ToggleButtons } from '../utils/ToggleButtons'
import { Identicon } from '../utils/Identicon'
import { monoStyle } from '../utils/styles'
import { HelpDot } from '../utils/Tooltip'
import { formatPrice, isTwin, proquintToBytes4 } from '../../libs/proquint'
import { useState, useEffect, useMemo } from 'react'
import { usePublicClient, useReadContract } from 'wagmi'
import { normalize } from 'viem/ens'
import { mainnet } from 'wagmi/chains'
import { createPublicClient, http } from 'viem'
import { CONTRACTS, CONSTANTS } from '../../libs/contracts'
import { PROQUINT_ABI } from '../../libs/abi/ERC721ABI'
import { explorerAddressUrl } from '../../libs/config'

interface RegistrationSetupProps {
  proquint: string
  setProquint: (value: string) => void
  years: number
  setYears: (value: number) => void
  receiver: string
  setReceiver: (value: string) => void
  onResolvedReceiverChange?: (resolved: string | null) => void
  address?: string
  price: bigint
  normalizedProquint: string | null
  normalizedId: string | null
  isAvailable: boolean
  canCommit: boolean
  isPending: boolean
  isConfirming: boolean
  onCommit: () => void
  inboxCount?: number
  userPrimaryId?: string
}

export function RegistrationSetup({
  proquint,
  setProquint,
  years,
  setYears,
  receiver,
  setReceiver,
  onResolvedReceiverChange,
  address,
  price,
  normalizedProquint,
  normalizedId,
  isAvailable,
  canCommit,
  isPending,
  isConfirming,
  onCommit,
  inboxCount = 0,
  userPrimaryId,
}: RegistrationSetupProps) {
  const identiconSize = 200
  const [mintToSelf, setMintToSelf] = useState(true)
  const [receiverInboxCount, setReceiverInboxCount] = useState<number>(0)
  const [resolvedReceiver, setResolvedReceiver] = useState<string | null>(null)
  const [isResolving, setIsResolving] = useState(false)

  // Inbox expiry time based on count
  const inboxExpiryTime = (count: number) => {
    if (count === 0) return { days: 42, hours: 0 }
    const totalSec = CONSTANTS.BASE_PENDING_PERIOD - Math.floor(count * (CONSTANTS.BASE_PENDING_PERIOD - CONSTANTS.MIN_PENDING_PERIOD) / CONSTANTS.MAX_INBOX)
    return { days: Math.floor(totalSec / 86400), hours: Math.floor((totalSec % 86400) / 3600) }
  }

  const effectiveInboxCount = !mintToSelf && resolvedReceiver ? receiverInboxCount : inboxCount

  // Auto-clear receiver when switching to self
  useEffect(() => {
    if (mintToSelf && receiver) setReceiver('')
  }, [mintToSelf, receiver, setReceiver])

  // Twin check
  let isPalin = false
  try {
    if (proquint && normalizedId) isPalin = isTwin(proquintToBytes4(proquint))
  } catch { isPalin = false }

  // Inbox warning logic
  const hasSelfPrimary = !!userPrimaryId && userPrimaryId !== '' && userPrimaryId !== '0x00000000'
  const isToSelf = mintToSelf || (!resolvedReceiver && !receiver.trim())
  const shouldShowInboxWarning = hasSelfPrimary && isToSelf
  const expiryTime = shouldShowInboxWarning ? inboxExpiryTime(effectiveInboxCount + 1) : { days: 42, hours: 0 }

  // Resolve receiver address
  const localClient = usePublicClient()
  const mainnetClient = useMemo(() => createPublicClient({ chain: mainnet, transport: http() }), [])

  const { data: receiverInboxData } = useReadContract({
    address: CONTRACTS.ProquintNFT,
    abi: PROQUINT_ABI,
    functionName: 'inboxCount',
    args: resolvedReceiver ? [resolvedReceiver as `0x${string}`] : undefined,
    query: { enabled: !mintToSelf && !!resolvedReceiver },
  })

  useEffect(() => {
    setReceiverInboxCount(!mintToSelf && receiverInboxData ? Number(receiverInboxData) : 0)
  }, [mintToSelf, receiverInboxData])

  useEffect(() => {
    if (receiver && mintToSelf) setMintToSelf(false)
    if (mintToSelf) {
      setResolvedReceiver(null)
      setIsResolving(false)
      onResolvedReceiverChange?.(null)
      return
    }

    const resolveAddress = async () => {
      if (!receiver) {
        setResolvedReceiver(null)
        setIsResolving(false)
        onResolvedReceiverChange?.(null)
        return
      }
      if (receiver.startsWith('0x') && receiver.length === 42) {
        setResolvedReceiver(receiver)
        setIsResolving(false)
        onResolvedReceiverChange?.(receiver)
        return
      }
      if (receiver.startsWith('0x')) {
        setResolvedReceiver(null)
        setIsResolving(false)
        onResolvedReceiverChange?.(null)
        return
      }
      setIsResolving(true)
      try {
        if (receiver.includes('-') && receiver.length === 11) {
          try {
            const owner = await localClient?.readContract({
              address: CONTRACTS.ProquintNFT,
              abi: PROQUINT_ABI,
              functionName: 'owner',
              args: [proquintToBytes4(receiver)],
            })
            if (owner && owner !== '0x0000000000000000000000000000000000000000') {
              setResolvedReceiver(owner as string)
              setIsResolving(false)
              onResolvedReceiverChange?.(owner as string)
              return
            }
          } catch {}
        }
        if (receiver.endsWith('.eth')) {
          try {
            const ensAddress = await mainnetClient.getEnsAddress({ name: normalize(receiver) })
            if (ensAddress) {
              setResolvedReceiver(ensAddress)
              setIsResolving(false)
              onResolvedReceiverChange?.(ensAddress)
              return
            }
          } catch {}
        }
        setResolvedReceiver(null)
        onResolvedReceiverChange?.(null)
      } catch (err) {
        console.error('Resolution error:', err)
      }
      setIsResolving(false)
    }

    const timer = setTimeout(resolveAddress, 500)
    return () => clearTimeout(timer)
  }, [receiver, mintToSelf, localClient, mainnetClient, onResolvedReceiverChange])

  return (
    <div className="card">
      <div className="registration-layout">
        {/* Identicon */}
        {address && (
          <div className="registration-identicon">
            <div style={{ position: 'relative', width: '100%', maxWidth: '200px' }}>
              {!mintToSelf && isResolving ? (
                <div style={{ width: '200px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--surface)', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '2rem' }}>⏳</span>
                </div>
              ) : (
                <Identicon
                  address={!mintToSelf && resolvedReceiver ? resolvedReceiver : address}
                  size={identiconSize}
                  overlayLabel={proquint || undefined}
                />
              )}
            </div>
          </div>
        )}

        {/* Inputs */}
        <div className="registration-inputs">
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
              Name
            </label>
            <ProquintInput value={proquint} onChange={setProquint} showBytes4={false} />
          </div>

          {/* Hex ID and Year slider on same line - mobile first */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr',
            gap: '1rem', 
            marginBottom: '1rem'
          }} className="year-hex-grid">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="hex-id-display" style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-dim)', marginBottom: '0.25rem', display: 'block' }}>
                Hex ID:
              </label>
              <input
                id="hex-id-display"
                type="text"
                value={normalizedId ?? ''}
                readOnly
                placeholder="0x00000000"
                style={{
                  fontFamily: "'SF Mono', 'Monaco', monospace",
                  fontSize: '0.9rem',
                  padding: '0.6rem 0.75rem',
                  color: 'var(--text-dim)',
                  backgroundColor: 'var(--bg)',
                  cursor: 'default'
                }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '1rem', fontWeight: 600 }}>
                  Duration{isPalin && <span style={{ color: 'var(--warning)', fontSize: '0.85rem', marginLeft: '0.35rem' }}>(Twin 5×)</span>}
                </label>
                <span style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent)' }}>
                  {years} {years === 1 ? 'yr' : 'yrs'}
                </span>
              </div>
              <input
                id="years-input"
                type="range"
                min={1}
                max={CONSTANTS.MAX_YEARS}
                value={years > CONSTANTS.MAX_YEARS ? CONSTANTS.MAX_YEARS : years}
                onChange={(e) => setYears(Number(e.target.value))}
                style={{ width: '100%', height: '8px', cursor: 'pointer' }}
                title={years > 1 ? 'Exponential: renewing yearly is cheaper' : ''}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mint To */}
      <div className="form-group" style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
        <label style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block', textAlign: 'center' }}>
          Mint To
        </label>
        <div style={{ marginBottom: '0.75rem' }}>
          <ToggleButtons
            options={[
              { value: 'self', label: 'Self' },
              { value: 'other', label: 'Other' },
            ]}
            value={mintToSelf ? 'self' : 'other'}
            onChange={(v) => setMintToSelf(v === 'self')}
          />
        </div>

        {mintToSelf ? (
          <div style={{
            padding: '0.65rem 0.75rem',
            backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px',
            ...monoStyle, fontSize: '0.85rem', color: 'var(--text-dim)'
          }}>
            {address || 'Connect wallet'}
          </div>
        ) : (
          <input
            id="receiver-input"
            type="text"
            placeholder="0x… / name.eth / cvcvc-cvcvc"
            value={receiver}
            onChange={(e) => setReceiver(e.target.value)}
            style={{
              ...monoStyle,
              width: '100%',
              maxWidth: '100%',
              minWidth: 0,
              fontSize: '0.85rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              boxSizing: 'border-box',
            }}
            title="Ethereum address, ENS name, or proquint name"
          />
        )}
      </div>

      {/* Receiver Display */}
      {!mintToSelf && resolvedReceiver && (
        <div style={{
          padding: '1rem',
          marginTop: '1.5rem',
          marginBottom: '1rem',
          backgroundColor: 'color-mix(in srgb, var(--primary) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
          borderRadius: '6px',
        }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-dim)', marginBottom: '0.5rem', textAlign: 'center' }}>
            Registering to:
          </div>
          <div style={{ ...monoStyle, fontSize: '0.85rem', color: 'var(--text)', textAlign: 'center', wordBreak: 'break-all' }}>
            {resolvedReceiver}
          </div>
        </div>
      )}

      {/* Info grid */}
      {price > 0n && (
        <div className="info-grid" style={{ marginTop: '1.5rem' }}>
          <div className="info-item">
            <div className="info-label">Cost</div>
            <div className="info-value">{formatPrice(price)} ETH</div>
          </div>
          <div className="info-item">
            <div className="info-label">Normalized</div>
            <div className="info-value">{normalizedProquint?.toUpperCase() ?? '—'}</div>
          </div>
          <div className="info-item">
            <div className="info-label">bytes4</div>
            <div className="info-value">{normalizedId ?? '—'}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Status</div>
            <div className="info-value">{proquint ? (isAvailable ? 'Available' : 'Not available') : '—'}</div>
          </div>
          {resolvedReceiver && (
            <div className="info-item" style={{ gridColumn: '1 / -1' }}>
              <div className="info-label">Resolved To</div>
              <div className="info-value" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Identicon address={resolvedReceiver} size={20} />
                <span style={{ ...monoStyle, fontSize: '0.8rem', flex: 1, minWidth: '180px' }}>{resolvedReceiver}</span>
                {explorerAddressUrl(resolvedReceiver) && (
                  <a href={explorerAddressUrl(resolvedReceiver)} target="_blank" rel="noopener noreferrer"
                    style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 500 }}>
                    Explorer ↗
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Inbox warning */}
      {shouldShowInboxWarning && (
        <div style={{
          padding: '1rem', marginBottom: '1rem', marginTop: '1rem',
          backgroundColor: 'color-mix(in srgb, var(--warning) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)',
          borderRadius: '6px', fontSize: '0.95rem', lineHeight: 1.6
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
            <strong style={{ color: 'var(--warning)', fontSize: '1rem' }}>⚠️ Goes to Inbox</strong>
            <HelpDot text="You have a primary. New names go to inbox with a decaying claim window (42d→7d). After expiry: 7d open claim, then burnable." position="bottom" />
          </div>
          <span style={{ color: 'var(--text-dim)' }}>
            Claim window: <strong style={{ color: 'var(--text)' }}>{expiryTime.days}d {expiryTime.hours}h</strong>
            {' · '}then 7d open claim{' · '}then burnable
          </span>
        </div>
      )}

      {/* Commit button */}
      <div className="actions" style={{ marginTop: '2rem' }}>
        <button
          onClick={onCommit}
          disabled={!canCommit || isPending || isConfirming}
          style={{ width: '100%', fontWeight: 600, fontSize: '1.05rem', padding: '0.9rem 1.5rem' }}
        >
          {isPending || isConfirming ? 'Committing…' : isAvailable ? 'Commit' : 'Unavailable'}
        </button>
      </div>
    </div>
  )
}
