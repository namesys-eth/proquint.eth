import { useState } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { CONTRACTS, CONSTANTS } from '../../libs/contracts'
import { PROQUINT_ABI } from '../../libs/abi/ERC721ABI'
import { ProfileSearchBar } from './ProfileSearchBar'
import { Identicon } from '../utils/Identicon'
import { useEvents } from '../../hooks/EventIndexerContext'
import { useInboxItems } from '../../hooks/useInboxItems'
import { TransferModal } from '../modal/TransferModal'
import { ExtendModal } from '../modal/ExtendModal'
import { BurnModal } from '../modal/BurnModal'
import { ActionButtons } from '../utils/ActionButtons'
import { InboxItemCard } from '../utils/InboxItemCard'
import { type CachedEvent } from '../../libs/eventCache'
import { bytes4ToProquint } from '../../libs/proquint'
import { monoStyle, proquintNameStyle, addressStyle } from '../utils/styles'

const ZERO_ID = '0x00000000'
const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function tokenIdToProquint(tokenId: string): string {
  try {
    const num = BigInt(tokenId)
    const hex = num.toString(16).padStart(8, '0')
    return bytes4ToProquint(`0x${hex}` as `0x${string}`)
  } catch {
    return tokenId
  }
}

interface EventDesc { label: string; proquintName: string | null; extra: string | null; color: string }

function toPqName(raw: string): string | null {
  try { return bytes4ToProquint(raw as `0x${string}`).toUpperCase() } catch { return null }
}

function describeEvent(e: CachedEvent): EventDesc {
  switch (e.type) {
    case 'Transfer': {
      const from = (e.args.from as string || '').toLowerCase()
      const to = (e.args.to as string || '').toLowerCase()
      const name = tokenIdToProquint(e.args.tokenId as string || '0').toUpperCase()
      if (from === ZERO_ADDR) return { label: 'Mint', proquintName: name, extra: null, color: 'var(--success)' }
      if (to === ZERO_ADDR) return { label: 'Burn', proquintName: name, extra: null, color: 'var(--danger)' }
      return { label: 'Transfer', proquintName: name, extra: `${shortAddr(from)} → ${shortAddr(to)}`, color: 'var(--primary)' }
    }
    case 'PrimaryUpdated': {
      const id = e.args.id as string || '0x00000000'
      if (id === '0x00000000') return { label: 'Primary Cleared', proquintName: null, extra: null, color: 'var(--text-dim)' }
      return { label: 'Primary Set', proquintName: toPqName(id), extra: null, color: 'var(--success)' }
    }
    case 'InboxUpdated': {
      const id = e.args.id as string || '0x00000000'
      const ie = e.args.inboxExpiry as bigint | string
      const name = toPqName(id)
      const expiryNum = typeof ie === 'bigint' ? Number(ie) : parseInt(ie as string || '0')
      if (expiryNum === 0) return { label: 'Inbox Removed', proquintName: name, extra: null, color: 'var(--text-dim)' }
      return { label: 'Inbox Received', proquintName: name, extra: null, color: 'var(--primary)' }
    }
    case 'Renewed': {
      const id = e.args.id as string || '0x00000000'
      return { label: 'Renewed', proquintName: toPqName(id), extra: null, color: 'var(--success)' }
    }
    default:
      return { label: e.type, proquintName: null, extra: null, color: 'var(--text-dim)' }
  }
}

export function ProfileDefault() {
  const { address: connectedAddress } = useAccount()
  const { events, loading: eventsLoading, lastBlock } = useEvents()
  const { items: inboxItems, loading: inboxLoading } = useInboxItems(connectedAddress)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showExtendModal, setShowExtendModal] = useState(false)
  const [showBurnModal, setShowBurnModal] = useState(false)

  const navigate = useNavigate()

  // primaryName returns bytes4 ID (0x00000000 if none)
  const { data: primaryId } = useReadContract({
    address: CONTRACTS.ProquintNFT,
    abi: PROQUINT_ABI,
    functionName: 'primaryName',
    args: connectedAddress ? [connectedAddress] : undefined,
    query: { enabled: !!connectedAddress },
  })

  // inbox count
  const { data: inboxCountData } = useReadContract({
    address: CONTRACTS.ProquintNFT,
    abi: PROQUINT_ABI,
    functionName: 'inboxCount',
    args: connectedAddress ? [connectedAddress] : undefined,
    query: { enabled: !!connectedAddress },
  })

  const hasPrimary = !!(primaryId && primaryId !== ZERO_ID)
  const primaryProquint = hasPrimary ? bytes4ToProquint(primaryId as `0x${string}`).toUpperCase() : null
  const inboxCount = inboxCountData ? Number(inboxCountData) : 0

  // Get primary name expiry
  const { data: primaryExpiry } = useReadContract({
    address: CONTRACTS.ProquintNFT,
    abi: PROQUINT_ABI,
    functionName: 'getExpiry',
    args: hasPrimary ? [primaryId as `0x${string}`] : undefined,
    query: { enabled: hasPrimary },
  })

  // Calculate refund for primary name burn
  const PRICE_PER_MONTH_ETH = Number(CONSTANTS.PRICE_PER_MONTH) / 1e18
  const now = Math.floor(Date.now() / 1000)
  const primaryExpiryNum = primaryExpiry ? Number(primaryExpiry) : now
  const remainingMonths = primaryExpiryNum > now ? Math.floor((primaryExpiryNum - now) / CONSTANTS.MONTH_DURATION) : 0
  const totalRefund = remainingMonths * PRICE_PER_MONTH_ETH

  if (!connectedAddress) {
    return (
      <div className="container">
        <div className="card">
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-dim)' }}>
            Connect your wallet to view your profile
          </div>
        </div>
      </div>
    )
  }

  // Show most recent events first
  const recentEvents = [...events].reverse().slice(0, 50)

  return (
    <div className="container">
      <div className="card">
        <ProfileSearchBar />

        {inboxCount > 0 && (
          <div style={{ 
            padding: '1rem', 
            backgroundColor: 'color-mix(in srgb, var(--warning) 10%, transparent)', 
            border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)',
            borderRadius: '6px',
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
          }}>
            ⚠️ <strong>Action Required:</strong> You have {inboxCount} name{inboxCount > 1 ? 's' : ''} in your inbox.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', width: '100%' }}>
          <Identicon address={connectedAddress} proquintId={hasPrimary ? (primaryId as `0x${string}`) : undefined} size={160} />
          {primaryProquint && (
            <div
              onClick={() => navigate(`/${primaryProquint.toLowerCase()}`)}
              style={{
                ...proquintNameStyle,
                cursor: 'pointer',
                lineHeight: 1.1,
              }}
            >
              {primaryProquint}
            </div>
          )}
          <div style={addressStyle}>
            {connectedAddress}
          </div>
        </div>

        <div className="info-grid">
          <div className="info-item">
            <div className="info-label">Primary</div>
            <div className="info-value">{primaryProquint ? primaryProquint.toUpperCase() : 'None'}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Inbox</div>
            <div className="info-value">{inboxCount}</div>
          </div>
          {hasPrimary && primaryExpiry && (
            <>
              <div className="info-item">
                <div className="info-label">Expires</div>
                <div className="info-value">{new Date(Number(primaryExpiry) * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
              </div>
              <div className="info-item">
                <div className="info-label">Grace Period</div>
                <div className="info-value">+300 days</div>
              </div>
            </>
          )}
        </div>

        {/* Primary Name Actions */}
        {hasPrimary && (
          <ActionButtons actions={[
            { label: 'Extend', onClick: () => setShowExtendModal(true) },
            { label: 'Transfer', onClick: () => setShowTransferModal(true), variant: 'secondary' },
            { label: 'Burn', onClick: () => setShowBurnModal(true), variant: 'danger' }
          ]} />
        )}
      </div>

      {/* Inbox Items */}
      {inboxCount > 0 && (
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>
            Inbox Items
            {inboxLoading && <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 400, marginLeft: '0.5rem' }}>loading...</span>}
          </h3>

          {inboxItems.length === 0 && !inboxLoading && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)', backgroundColor: 'var(--bg)', borderRadius: '6px' }}>
              No inbox items found
            </div>
          )}

          {inboxItems.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {inboxItems.map((item) => {
                const now = Math.floor(Date.now() / 1000)
                const inboxExp = Number(item.inboxExpiry)
                const isExpired = inboxExp < now
                return (
                  <InboxItemCard
                    key={item.id}
                    proquint={item.proquint}
                    isExpired={isExpired}
                    onClick={() => navigate(`/${item.proquint.toLowerCase()}`)}
                  />
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {hasPrimary && primaryId && (
        <>
          <TransferModal
            open={showTransferModal}
            onClose={() => setShowTransferModal(false)}
            nameId={primaryId as `0x${string}`}
            proquintName={primaryProquint || ''}
            expiryTimestamp={primaryExpiry}
            onBurnRequest={() => {
              setShowTransferModal(false)
              setShowBurnModal(true)
            }}
          />
          <BurnModal
            open={showBurnModal}
            onClose={() => setShowBurnModal(false)}
            nameId={primaryId as `0x${string}`}
            proquintName={primaryProquint || ''}
            refundAmount={totalRefund}
            remainingMonths={remainingMonths}
          />
          <ExtendModal
            open={showExtendModal}
            onClose={() => setShowExtendModal(false)}
            nameId={primaryId as `0x${string}`}
            currentExpiry={primaryExpiry}
          />
        </>
      )}

      {/* Event Activity Log */}
      <div className="card">
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>
          Activity
          {eventsLoading && <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 400, marginLeft: '0.5rem' }}>syncing...</span>}
        </h3>

        {lastBlock > 0 && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '1rem', ...monoStyle }}>
            Indexed to block {lastBlock.toLocaleString()}
          </div>
        )}

        {recentEvents.length === 0 && !eventsLoading && (
          <div style={{ 
            textAlign: 'center', 
            padding: '2rem', 
            color: 'var(--text-dim)',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '6px',
          }}>
            No activity yet
          </div>
        )}

        {recentEvents.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {recentEvents.map((e, idx) => {
              const { label, proquintName, extra, color } = describeEvent(e)
              const dateStr = new Date(e.timestamp * 1000).toLocaleString('en-US', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
              })
              const shortTxHash = e.transactionHash.slice(0, 10)
              return (
                <div
                  key={`${e.transactionHash}-${e.logIndex}-${idx}`}
                  style={{
                    padding: '0.75rem',
                    backgroundColor: 'var(--bg)',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color }}>{label}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{dateStr}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {proquintName && (
                      <span
                        onClick={() => navigate(`/${proquintName.toLowerCase()}`)}
                        style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'var(--border)', textUnderlineOffset: '2px' }}
                      >
                        {proquintName.toUpperCase()}
                      </span>
                    )}
                    {extra && <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{extra}</span>}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontFamily: 'monospace' }}>tx: {shortTxHash}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
