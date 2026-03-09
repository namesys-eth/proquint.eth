import { useAccount, useReadContract } from 'wagmi'
import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { CONTRACTS, CONSTANTS } from '../../libs/contracts'
import { PROQUINT_ABI } from '../../libs/abi/ERC721ABI'
import { proquintToBytes4 } from '../../libs/proquint'
import { ProfileSearchBar } from './ProfileSearchBar'
import { ProfileHero } from './ProfileHero'
import { InboxStatusSection } from './InboxStatusSection'
import { ProfileInboxItemsSection } from './ProfileInboxItemsSection'
import { ProfileActivity } from './ProfileActivity'
import { TransferModal } from '../modal/TransferModal'
import { BurnModal } from '../modal/BurnModal'
import { RejectModal } from '../modal/RejectModal'
import { RefundModal } from '../modal/RefundModal'
import { ExtendModal } from '../modal/ExtendModal'
import { ActionButtons } from '../utils/ActionButtons'
import { compactButtonStyle } from '../utils/styles'
import { LoadingState } from '../utils/LoadingState'
import { formatTimeRemaining } from '../utils/time'
import { useInboxItems } from '../../hooks/useInboxItems'
import { useEvents } from '../../hooks/EventIndexerContext'

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

  const proquintName = urlParam || ''
  const isOwner = !!(proquintOwner && connectedAddress && proquintOwner.toLowerCase() === connectedAddress.toLowerCase())
  const hasPrimary = !!(primaryId && primaryId !== '0x00000000')
  const isInInbox = !!(inboxExpiryTimestamp && inboxExpiryTimestamp > 0n)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showBurnModal, setShowBurnModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showCleanModal, setShowCleanModal] = useState(false)
  const [showExtendModal, setShowExtendModal] = useState(false)
  const { items: ownerInboxItems, loading: ownerInboxLoading } = useInboxItems(proquintOwner as `0x${string}` | undefined)
  const { events, loading: eventsLoading, lastBlock } = useEvents()

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

  if (isLoadingOwner) {
    return (
      <div className="container">
        <div className="card">
          <LoadingState message="Loading profile…" />
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

        <ProfileHero
          title={proquintName}
          subtitle={proquintBytes4}
          ownerAddress={proquintOwner}
          identiconAddress={proquintOwner}
          identiconId={proquintBytes4}
          identiconSize={200}
        />

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
            onBurnClick={isOwner && canClaim ? () => setShowRejectModal(true) : undefined}
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

        {/* Clean button for anyone after expiry */}
        {isInInbox && canBurn && !isOwner && (
          <div className="actions" style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            <button
              onClick={() => setShowCleanModal(true)}
              style={{ 
                ...compactButtonStyle,
                backgroundColor: 'var(--success)',
                color: '#fff'
              }}
            >
              Clean
            </button>
          </div>
        )}
      </div>

      {!isInInbox && (
        <ProfileInboxItemsSection
          inboxCount={ownerInboxItems.length}
          items={ownerInboxItems}
          loading={ownerInboxLoading}
          onItemClick={(proquint) => navigate(`/${proquint.toLowerCase()}`)}
        />
      )}

      {!isInInbox && (
        <ProfileActivity events={events} loading={eventsLoading} lastBlock={lastBlock} />
      )}

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
