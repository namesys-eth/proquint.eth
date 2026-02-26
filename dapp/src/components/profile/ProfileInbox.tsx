import { useAccount, useReadContract } from 'wagmi'
import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { CONTRACTS, CONSTANTS } from '../../libs/contracts'
import { PROQUINT_ABI } from '../../libs/abi/ERC721ABI'
import { proquintToBytes4 } from '../../libs/proquint'
import { ProfileSearchBar } from './ProfileSearchBar'
import { Identicon } from '../utils/Identicon'
import { InboxStatusSection } from './InboxStatusSection'
import { TransferModal } from '../modal/TransferModal'
import { BurnModal } from '../modal/BurnModal'
import { RejectModal } from '../modal/RejectModal'
import { RefundModal } from '../modal/RefundModal'
import { ExtendModal } from '../modal/ExtendModal'
import { ActionButtons } from '../utils/ActionButtons'
import { monoStyle } from '../utils/styles'

export function ProfileInbox() {
  const { param: urlParam } = useParams<{ param: string }>()
  const { address: connectedAddress } = useAccount()
  const navigate = useNavigate()

  const proquintBytes4 = urlParam ? proquintToBytes4(urlParam.toLowerCase()) as `0x${string}` : undefined
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

  // Smart time formatting: years/days, or days/hours if < 1 week
  const formatTimeRemaining = (targetTimestamp?: bigint | number | null): { main: string; sub: string } => {
    if (targetTimestamp === undefined || targetTimestamp === null) return { main: '—', sub: '' }
    const target = typeof targetTimestamp === 'bigint' ? Number(targetTimestamp) : targetTimestamp
    if (target === 0) return { main: '—', sub: '' }
    
    const diff = target - now
    if (diff <= 0) return { main: 'Expired', sub: formatDate(targetTimestamp) }
    
    const days = Math.floor(diff / 86400)
    const hours = Math.floor((diff % 86400) / 3600)
    const minutes = Math.floor((diff % 3600) / 60)
    
    // If < 1 week, show days & hours
    if (days < 7) {
      if (days > 0) {
        return { main: `${days}d ${hours}h`, sub: formatDate(targetTimestamp) }
      }
      return { main: `${hours}h ${minutes}m`, sub: formatDate(targetTimestamp) }
    }
    
    // Otherwise show years & days
    const years = Math.floor(days / 365)
    const remainingDays = days % 365
    if (years > 0) {
      return { main: `${years}y ${remainingDays}d`, sub: formatDate(targetTimestamp) }
    }
    return { main: `${days}d`, sub: formatDate(targetTimestamp) }
  }

  const proquintName = urlParam || ''
  const isOwner = !!(proquintOwner && connectedAddress && proquintOwner.toLowerCase() === connectedAddress.toLowerCase())
  const hasPrimary = !!(primaryId && primaryId !== '0x00000000')
  const isInInbox = !!(inboxExpiryTimestamp && inboxExpiryTimestamp > 0n)
  const [, setHasTokenImage] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showBurnModal, setShowBurnModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showCleanModal, setShowCleanModal] = useState(false)
  const [showExtendModal, setShowExtendModal] = useState(false)

  const now = Math.floor(Date.now() / 1000)
  const inboxExp = inboxExpiryTimestamp ? Number(inboxExpiryTimestamp) : 0
  const canClaim = isInInbox && inboxExp >= now
  const canClaimOnBehalf = isInInbox && now > inboxExp && inboxExp + CONSTANTS.ANYONE_PERIOD >= now
  const canBurn = isInInbox && now > inboxExp + CONSTANTS.ANYONE_PERIOD

  // Calculate refund/reward amounts (contract uses integer division which truncates)
  const PRICE_PER_MONTH_ETH = Number(CONSTANTS.PRICE_PER_MONTH) / 1e18
  const expiry = expiryTimestamp ? Number(expiryTimestamp) : now
  const remainingMonths = expiry > now ? Math.floor((expiry - now) / CONSTANTS.MONTH_DURATION) : 0
  const totalRefund = remainingMonths * PRICE_PER_MONTH_ETH
  
  // For cleanInbox: if >1 month, burner gets 50%; if ≤1 month, burner gets fixed 1 month
  const cleanReward = remainingMonths > 1 ? totalRefund / 2 : PRICE_PER_MONTH_ETH

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

  return (
    <div className="container">
      <div className="card">
        <ProfileSearchBar />

        {/* Name as centerpiece */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            ...monoStyle,
            fontSize: 'clamp(2.2rem, 8vw, 3.5rem)',
            fontWeight: 800,
            color: 'var(--accent)',
            letterSpacing: '-0.01em',
            textTransform: 'uppercase',
            lineHeight: 1.1,
            marginBottom: '0.4rem',
          }}>
            {proquintName}
          </div>
          {proquintBytes4 && (
            <div style={{ ...monoStyle, fontSize: '0.95rem', color: 'var(--text-dim)' }}>
              {proquintBytes4}
            </div>
          )}
        </div>

        {/* Identicon + owner */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <Identicon
            address={proquintOwner}
            proquintId={proquintBytes4}
            size={200}
            onImageTypeChange={setHasTokenImage}
          />
          <a href={`/${proquintOwner}`} style={{ ...monoStyle, fontSize: '0.9rem', color: 'var(--text-dim)', textDecoration: 'none' }}>
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
            <div className="info-label">Expires</div>
            <div className="info-value">{formatTimeRemaining(expiryTimestamp).main}</div>
            <div className="info-sub" style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.15rem' }}>
              {formatTimeRemaining(expiryTimestamp).sub}
            </div>
          </div>
          <div className="info-item">
            <div className="info-label">Grace Period</div>
            <div className="info-value">
              {expiryTimestamp ? formatTimeRemaining(Number(expiryTimestamp) + CONSTANTS.GRACE_PERIOD).main : '—'}
            </div>
            <div className="info-sub" style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.15rem' }}>
              {expiryTimestamp ? formatTimeRemaining(Number(expiryTimestamp) + CONSTANTS.GRACE_PERIOD).sub : ''}
            </div>
          </div>
          {isInInbox && (
            <div className="info-item">
              <div className="info-label">Claim Deadline</div>
              <div className="info-value">{formatTimeRemaining(inboxExpiryTimestamp).main}</div>
              <div className="info-sub" style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.15rem' }}>
                {formatTimeRemaining(inboxExpiryTimestamp).sub}
              </div>
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

        {!isInInbox && isOwner && (
          <div style={{
            textAlign: 'center', padding: '1.25rem',
            color: 'var(--text-dim)', fontSize: '0.95rem',
            backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px',
            marginTop: '1.5rem'
          }}>
            Active as your primary name.
          </div>
        )}

        {!isInInbox && !isOwner && (
          <div style={{
            textAlign: 'center', padding: '1.25rem',
            color: 'var(--text-dim)', fontSize: '0.95rem',
            backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px',
            marginTop: '1.5rem'
          }}>
            Active as the owner's primary name.
          </div>
        )}

        {/* Owner Actions */}
        {isOwner && !isInInbox && (
          <ActionButtons
            style={{ marginTop: '1.5rem' }}
            actions={[
              { label: 'Extend', onClick: () => setShowExtendModal(true) },
              { label: 'Transfer', onClick: () => setShowTransferModal(true), variant: 'secondary' },
              { label: 'Burn', onClick: () => setShowBurnModal(true), variant: 'danger' }
            ]}
          />
        )}

        {/* Non-owner can gift extend */}
        {!isOwner && !isInInbox && proquintOwner && (
          <ActionButtons
            style={{ marginTop: '1.5rem' }}
            actions={[
              { label: 'Extend', onClick: () => setShowExtendModal(true) }
            ]}
          />
        )}

        {/* Burn button for owner before expiry */}
        {isInInbox && isOwner && canClaim && (
          <div className="actions" style={{ marginTop: '1.5rem' }}>
            <button
              onClick={() => setShowRejectModal(true)}
              style={{ 
                fontSize: '1rem', 
                padding: '0.85rem 1.5rem',
                backgroundColor: 'var(--danger)',
                color: '#fff'
              }}
            >
              Burn
            </button>
          </div>
        )}

        {/* Clean button for anyone after expiry */}
        {isInInbox && canBurn && !isOwner && (
          <div className="actions" style={{ marginTop: '1.5rem' }}>
            <button
              onClick={() => setShowCleanModal(true)}
              style={{ 
                fontSize: '1rem', 
                padding: '0.85rem 1.5rem',
                backgroundColor: 'var(--success)',
                color: '#fff'
              }}
            >
              Burn
            </button>
          </div>
        )}
      </div>

      {proquintBytes4 && (
        <>
          <TransferModal
            open={showTransferModal}
            onClose={() => setShowTransferModal(false)}
            nameId={proquintBytes4}
            proquintName={proquintName}
            expiryTimestamp={expiryTimestamp}
            onBurnRequest={() => {
              setShowTransferModal(false)
              setShowBurnModal(true)
            }}
          />
          <BurnModal
            open={showBurnModal}
            onClose={() => setShowBurnModal(false)}
            nameId={proquintBytes4}
            proquintName={proquintName}
            refundAmount={totalRefund}
            remainingMonths={remainingMonths}
          />
          <RejectModal
            open={showRejectModal}
            onClose={() => setShowRejectModal(false)}
            nameId={proquintBytes4}
            proquintName={proquintName}
            refundAmount={totalRefund}
            remainingMonths={remainingMonths}
          />
          <RefundModal
            open={showCleanModal}
            onClose={() => setShowCleanModal(false)}
            nameId={proquintBytes4}
            proquintName={proquintName}
            rewardAmount={cleanReward}
            remainingMonths={remainingMonths}
          />
          <ExtendModal
            open={showExtendModal}
            onClose={() => setShowExtendModal(false)}
            nameId={proquintBytes4}
            currentExpiry={expiryTimestamp}
          />
        </>
      )}
    </div>
  )
}
