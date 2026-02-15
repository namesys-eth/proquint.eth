import { useAccount, useReadContract } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { CONTRACTS } from '../../libs/contracts'
import { PROQUINT_ABI } from '../../libs/abi/ERC721ABI'
import { ProfileSearchBar } from './ProfileSearchBar'
import { Identicon } from '../utils/Identicon'
import { useEvents } from '../../hooks/EventIndexerContext'
import { type CachedEvent } from '../../libs/eventCache'
import { bytes4ToProquint } from '../../libs/proquint'

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
  try { return bytes4ToProquint(raw as `0x${string}`).toLowerCase() } catch { return null }
}

function describeEvent(e: CachedEvent, userAddr: string): EventDesc {
  const addr = userAddr.toLowerCase()
  switch (e.type) {
    case 'Transfer': {
      const from = (e.args.from as string || '').toLowerCase()
      const to = (e.args.to as string || '').toLowerCase()
      const name = tokenIdToProquint(e.args.tokenId as string || '0').toLowerCase()
      if (from === ZERO_ADDR) return { label: 'Mint', proquintName: name, extra: null, color: 'var(--success)' }
      if (to === ZERO_ADDR) return { label: 'Burn', proquintName: name, extra: null, color: 'var(--danger)' }
      if (from === addr) return { label: 'Sent', proquintName: name, extra: `→ ${shortAddr(to)}`, color: 'var(--warning)' }
      return { label: 'Received', proquintName: name, extra: `← ${shortAddr(from)}`, color: 'var(--primary)' }
    }
    case 'PrimaryUpdated': {
      const id = e.args.id as string || '0x00000000'
      if (id === '0x00000000') return { label: 'Primary Cleared', proquintName: null, extra: null, color: 'var(--text-dim)' }
      return { label: 'Primary Set', proquintName: toPqName(id), extra: null, color: 'var(--success)' }
    }
    case 'InboxUpdated': {
      const id = e.args.id as string || '0x00000000'
      const ie = e.args.inboxExpiry as string || '0'
      const name = toPqName(id)
      if (ie === '0') return { label: 'Inbox Removed', proquintName: name, extra: null, color: 'var(--text-dim)' }
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
  const primaryProquint = hasPrimary ? bytes4ToProquint(primaryId as `0x${string}`) : null
  const inboxCount = inboxCountData ? Number(inboxCountData) : 0

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
          <Identicon address={connectedAddress} proquintId={hasPrimary ? (primaryId as `0x${string}`) : undefined} size={120} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontFamily: "'SF Mono', 'Monaco', monospace", 
              fontSize: '0.9rem', 
              color: 'var(--text-dim)',
              marginBottom: '0.25rem'
            }}>
              {connectedAddress}
            </div>
          </div>
        </div>

        <div className="info-grid">
          <div className="info-item">
            <div className="info-label">Primary Name</div>
            <div className="info-value">{primaryProquint ? primaryProquint.toUpperCase() : 'None'}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Inbox Count</div>
            <div className="info-value">{inboxCount}</div>
          </div>
        </div>
      </div>

      {/* Event Activity Log */}
      <div className="card">
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>
          Activity
          {eventsLoading && <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 400, marginLeft: '0.5rem' }}>syncing...</span>}
        </h3>

        {lastBlock > 0 && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '1rem', fontFamily: "'SF Mono', 'Monaco', monospace" }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {recentEvents.map((e, i) => {
              const { label, proquintName, extra, color } = describeEvent(e, connectedAddress)
              return (
                <div
                  key={`${e.transactionHash}_${e.logIndex}_${i}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.6rem 0.75rem',
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                  }}
                >
                  <span style={{
                    fontWeight: 600,
                    color,
                    minWidth: '100px',
                    fontSize: '0.8rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                  }}>
                    {label}
                  </span>
                  <span style={{
                    flex: 1,
                    fontFamily: "'SF Mono', 'Monaco', monospace",
                    fontSize: '0.8rem',
                    color: 'var(--text)',
                  }}>
                    {proquintName && (
                      <span
                        onClick={() => navigate(`/${proquintName}`)}
                        style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'var(--border)', textUnderlineOffset: '2px' }}
                      >
                        {proquintName.toUpperCase()}
                      </span>
                    )}
                    {extra && <span style={{ color: 'var(--text-dim)', marginLeft: '0.4rem' }}>{extra}</span>}
                  </span>
                  <span style={{
                    fontFamily: "'SF Mono', 'Monaco', monospace",
                    fontSize: '0.7rem',
                    color: 'var(--text-dim)',
                    whiteSpace: 'nowrap',
                  }}>
                    #{e.blockNumber}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
