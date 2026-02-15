import { useAccount, useReadContract } from 'wagmi'
import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { CONTRACTS, CONSTANTS } from '../../libs/contracts'
import { PROQUINT_ABI } from '../../libs/abi/ERC721ABI'
import { proquintToBytes4 } from '../../libs/proquint'
import { ProfileSearchBar } from './ProfileSearchBar'
import { Identicon } from '../utils/Identicon'
import { InboxStatusSection } from './InboxStatusSection'

export function ProfileInbox() {
  const { param: urlParam } = useParams<{ param: string }>()
  const { address: connectedAddress } = useAccount()
  const navigate = useNavigate()

  const proquintBytes4 = urlParam ? proquintToBytes4(urlParam) as `0x${string}` : undefined
  const tokenId = proquintBytes4 ? BigInt(parseInt(proquintBytes4.slice(2), 16)) : undefined

  const { data: proquintOwner, isLoading: isLoadingOwner } = useReadContract({
    address: CONTRACTS.ProquintNFT,
    abi: PROQUINT_ABI,
    functionName: 'ownerOf',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  })

  const { data: expiryTimestamp } = useReadContract({
    address: CONTRACTS.ProquintNFT,
    abi: PROQUINT_ABI,
    functionName: 'getExpiry',
    args: proquintBytes4 ? [proquintBytes4] : undefined,
    query: { enabled: !!proquintBytes4 },
  })

  const { data: inboxExpiryTimestamp } = useReadContract({
    address: CONTRACTS.ProquintNFT,
    abi: PROQUINT_ABI,
    functionName: 'inboxExpiry',
    args: proquintBytes4 ? [proquintBytes4] : undefined,
    query: { enabled: !!proquintBytes4 },
  })

  const { data: primaryId } = useReadContract({
    address: CONTRACTS.ProquintNFT,
    abi: PROQUINT_ABI,
    functionName: 'primaryName',
    args: proquintOwner ? [proquintOwner] : undefined,
    query: { enabled: !!proquintOwner },
  })

  const formatDate = (timestamp?: bigint | number | null) => {
    if (timestamp === undefined || timestamp === null) return '—'
    const value = typeof timestamp === 'bigint' ? Number(timestamp) : timestamp
    if (value === 0) return '—'
    const date = new Date(value * 1000)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const proquintName = urlParam || ''
  const isOwner = !!(proquintOwner && connectedAddress && proquintOwner.toLowerCase() === connectedAddress.toLowerCase())
  const hasPrimary = !!(primaryId && primaryId !== '0x00000000')
  const isInInbox = !!(inboxExpiryTimestamp && inboxExpiryTimestamp > 0n)
  const [hasTokenImage, setHasTokenImage] = useState(false)

  const now = Math.floor(Date.now() / 1000)
  const inboxExp = inboxExpiryTimestamp ? Number(inboxExpiryTimestamp) : 0
  const canClaim = isInInbox && inboxExp >= now
  const canClaimOnBehalf = isInInbox && now > inboxExp && inboxExp + CONSTANTS.ANYONE_PERIOD >= now
  const canBurn = isInInbox && now > inboxExp + CONSTANTS.ANYONE_PERIOD

  useEffect(() => {
    setHasTokenImage(false)
  }, [proquintBytes4])

  if (isLoadingOwner) {
    return (
      <div className="container">
        <div className="card">
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-dim)' }}>
            Loading...
          </div>
        </div>
      </div>
    )
  }

  if (!proquintOwner) {
    return (
      <div className="container">
        <div className="card">
          <ProfileSearchBar />
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
              Name not registered
            </div>
            <div style={{ color: 'var(--text-dim)', marginBottom: '1.5rem' }}>
              <strong>{proquintName.toUpperCase()}</strong> is not registered or has been burned.
            </div>
            <button
              onClick={() => navigate('/register')}
              style={{ minWidth: '180px' }}
            >
              Register
            </button>
          </div>
        </div>
      </div>
    )
  }

  const mono = { fontFamily: "'SF Mono', 'Monaco', monospace" } as const

  return (
    <div className="container">
      <div className="card">
        <ProfileSearchBar />

        {/* Name as centerpiece */}
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{
            ...mono,
            fontSize: 'clamp(1.8rem, 6vw, 2.8rem)',
            fontWeight: 800,
            color: 'var(--accent)',
            letterSpacing: '-0.01em',
            textTransform: 'uppercase',
            lineHeight: 1.1,
            marginBottom: '0.2rem',
          }}>
            {proquintName}
          </div>
          {proquintBytes4 && (
            <div style={{ ...mono, fontSize: '0.8rem', color: 'var(--text-dim)' }}>
              {proquintBytes4}
            </div>
          )}
        </div>

        {/* Identicon + owner */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <Identicon
            address={proquintOwner}
            proquintId={proquintBytes4}
            size={160}
            onImageTypeChange={setHasTokenImage}
          />
          <a href={`/${proquintOwner}`} style={{ ...mono, fontSize: '0.8rem', color: 'var(--text-dim)', textDecoration: 'none' }}>
            {proquintOwner}
          </a>
        </div>

        {/* Info grid */}
        <div className="info-grid">
          <div className="info-item">
            <div className="info-label">Status</div>
            <div className="info-value" style={{ color: isInInbox ? 'var(--warning)' : 'var(--success)' }}>
              {isInInbox ? 'In Inbox' : 'Primary'}
            </div>
          </div>
          <div className="info-item">
            <div className="info-label">Registration Expires</div>
            <div className="info-value">{formatDate(expiryTimestamp)}</div>
          </div>
          {isInInbox && (
            <div className="info-item">
              <div className="info-label">Claim Deadline</div>
              <div className="info-value">{formatDate(inboxExpiryTimestamp)}</div>
            </div>
          )}
        </div>

        {isInInbox && proquintBytes4 && (
          <InboxStatusSection
            nameId={proquintBytes4}
            inboxExpiryTs={inboxExp}
            isInboxOwner={isOwner}
            ownerHasPrimary={hasPrimary}
            ownerPrimaryId={primaryId as string | undefined}
            canClaim={canClaim}
            canClaimOnBehalf={canClaimOnBehalf}
            canBurn={canBurn}
            expiryTimestamp={expiryTimestamp}
          />
        )}

        {!isInInbox && (
          <div style={{
            textAlign: 'center', padding: '1rem',
            color: 'var(--text-dim)', fontSize: '0.85rem',
            backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px',
            marginTop: '1rem'
          }}>
            Active as {isOwner ? 'your' : 'the owner\u2019s'} primary name.
          </div>
        )}
      </div>
    </div>
  )
}
