import { useState } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { CONTRACTS, CONSTANTS } from '../../libs/contracts'
import { PROQUINT_ABI } from '../../libs/abi/ERC721ABI'
import { ProfileSearchBar } from './ProfileSearchBar'
import { useEvents } from '../../hooks/EventIndexerContext'
import { useInboxItems } from '../../hooks/useInboxItems'
import { TransferModal } from '../modal/TransferModal'
import { ExtendModal } from '../modal/ExtendModal'
import { BurnModal } from '../modal/BurnModal'
import { ProfileHero } from './ProfileHero'
import { ProfileInboxAlert } from './ProfileInboxAlert'
import { ProfileActivity } from './ProfileActivity'
import { ProfileInboxItemsSection } from './ProfileInboxItemsSection'
import { ActionButtons } from '../utils/ActionButtons'
import { LoadingState } from '../utils/LoadingState'
import { bytes4ToProquint } from '../../libs/proquint'
import { formatTimeRemaining } from '../utils/time'

const ZERO_ID = '0x00000000'

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
          <LoadingState message="Connect your wallet to view your profile" />
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="card">
        <ProfileSearchBar />

        {inboxCount > 0 && <ProfileInboxAlert inboxCount={inboxCount} />}

        <ProfileHero
          title={primaryProquint || 'NO-PRIMARY'}
          subtitle={hasPrimary && primaryId ? String(primaryId).toLowerCase() : undefined}
          onTitleClick={primaryProquint ? () => navigate(`/${primaryProquint.toLowerCase()}`) : undefined}
          ownerAddress={connectedAddress}
          identiconAddress={connectedAddress}
          identiconId={hasPrimary ? (primaryId as `0x${string}`) : undefined}
          identiconSize={180}
        />

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
                <div className="info-value">{formatTimeRemaining(primaryExpiry).main}</div>
                <div className="info-sub" style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.15rem' }}>
                  {formatTimeRemaining(primaryExpiry).sub}
                </div>
              </div>
              <div className="info-item">
                <div className="info-label">Grace Period</div>
                <div className="info-value">{formatTimeRemaining(Number(primaryExpiry) + CONSTANTS.GRACE_PERIOD).main}</div>
                <div className="info-sub" style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.15rem' }}>
                  {formatTimeRemaining(Number(primaryExpiry) + CONSTANTS.GRACE_PERIOD).sub}
                </div>
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

      <ProfileInboxItemsSection
        inboxCount={inboxCount}
        items={inboxItems}
        loading={inboxLoading}
        onItemClick={(proquint) => navigate(`/${proquint.toLowerCase()}`)}
      />

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

      <ProfileActivity events={events} loading={eventsLoading} lastBlock={lastBlock} />
    </div>
  )
}
