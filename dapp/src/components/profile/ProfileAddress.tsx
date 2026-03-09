import { useState, useEffect, useMemo } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { useParams, useNavigate } from 'react-router-dom'
import { createPublicClient, http } from 'viem'
import { normalize } from 'viem/ens'
import { mainnet } from 'wagmi/chains'
import { CONTRACTS, CONSTANTS } from '../../libs/contracts'
import { PROQUINT_ABI } from '../../libs/abi/ERC721ABI'
import { ProfileSearchBar } from './ProfileSearchBar'
import { ProfileHero } from './ProfileHero'
import { ProfileInboxAlert } from './ProfileInboxAlert'
import { ProfileInboxItemsSection } from './ProfileInboxItemsSection'
import { ProfileActivity } from './ProfileActivity'
import { useInboxItems } from '../../hooks/useInboxItems'
import { useEvents } from '../../hooks/EventIndexerContext'
import { TransferModal } from '../modal/TransferModal'
import { ExtendModal } from '../modal/ExtendModal'
import { BurnModal } from '../modal/BurnModal'
import { ActionButtons } from '../utils/ActionButtons'
import { LoadingState } from '../utils/LoadingState'
import { bytes4ToProquint } from '../../libs/proquint'
import { formatTimeRemaining } from '../utils/time'

const ZERO_ID = '0x00000000'

export function ProfileAddress() {
  const { param: urlParam } = useParams<{ param: string }>()
  const { address: connectedAddress } = useAccount()
  const navigate = useNavigate()
  const [resolvedAddress, setResolvedAddress] = useState<`0x${string}` | null>(null)
  const [isResolving, setIsResolving] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showExtendModal, setShowExtendModal] = useState(false)
  const [showBurnModal, setShowBurnModal] = useState(false)
  const { events, loading: eventsLoading, lastBlock } = useEvents()

  const mainnetClient = useMemo(() => createPublicClient({
    chain: mainnet,
    transport: http(),
  }), [])

  const isAddressFormat = urlParam && urlParam.startsWith('0x') && urlParam.length === 42
  const isEnsFormat = urlParam && urlParam.endsWith('.eth')

  useEffect(() => {
    let cancelled = false
    const resolve = async () => {
      if (!urlParam) return

      if (isAddressFormat) {
        setResolvedAddress(urlParam as `0x${string}`)
        setIsResolving(false)
        return
      }

      if (isEnsFormat) {
        try {
          setIsResolving(true)
          const ensAddress = await mainnetClient.getEnsAddress({ name: normalize(urlParam) })
          if (!cancelled && ensAddress) {
            setResolvedAddress(ensAddress as `0x${string}`)
          }
        } catch (err) {
          console.error('ENS resolve error:', err)
        } finally {
          if (!cancelled) setIsResolving(false)
        }
      }
    }
    resolve()
    return () => { cancelled = true }
  }, [urlParam, isAddressFormat, isEnsFormat, mainnetClient])

  const targetAddress = resolvedAddress

  // primaryName returns bytes4 ID (0x00000000 if none)
  const { data: primaryId } = useReadContract({
    address: CONTRACTS.ProquintNFT,
    abi: PROQUINT_ABI,
    functionName: 'primaryName',
    args: targetAddress ? [targetAddress] : undefined,
    query: { enabled: !!targetAddress },
  })

  // inbox count
  const { data: inboxCountData } = useReadContract({
    address: CONTRACTS.ProquintNFT,
    abi: PROQUINT_ABI,
    functionName: 'inboxCount',
    args: targetAddress ? [targetAddress] : undefined,
    query: { enabled: !!targetAddress },
  })

  const hasPrimary = !!(primaryId && primaryId !== ZERO_ID)
  const primaryProquint = hasPrimary ? bytes4ToProquint(primaryId as `0x${string}`).toUpperCase() : null
  const inboxCount = inboxCountData ? Number(inboxCountData) : 0
  const isOwner = targetAddress === connectedAddress
  const { items: inboxItems, loading: inboxLoading } = useInboxItems(targetAddress || undefined)

  // Get primary name expiry
  const { data: primaryExpiry } = useReadContract({
    address: CONTRACTS.ProquintNFT,
    abi: PROQUINT_ABI,
    functionName: 'getExpiry',
    args: hasPrimary ? [primaryId as `0x${string}`] : undefined,
    query: { enabled: hasPrimary },
  })

  const PRICE_PER_MONTH_ETH = Number(CONSTANTS.PRICE_PER_MONTH) / 1e18
  const now = Math.floor(Date.now() / 1000)
  const primaryExpiryNum = primaryExpiry ? Number(primaryExpiry) : now
  const remainingMonths = primaryExpiryNum > now ? Math.floor((primaryExpiryNum - now) / CONSTANTS.MONTH_DURATION) : 0
  const totalRefund = remainingMonths * PRICE_PER_MONTH_ETH

  if (isResolving) {
    return (
      <div className="container">
        <div className="card">
          <LoadingState message="Loading profile…" />
        </div>
      </div>
    )
  }

  if (!targetAddress) {
    return (
      <div className="container">
        <div className="card">
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
              Address not found
            </div>
            <div style={{ color: 'var(--text-dim)', marginBottom: '1.5rem' }}>
              Could not resolve the address or ENS name.
            </div>
            <button
              onClick={() => navigate('/register')}
              style={{ minWidth: '180px' }}
            >
              Register a name
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

        {inboxCount > 0 && isOwner && <ProfileInboxAlert inboxCount={inboxCount} />}

        <ProfileHero
          title={primaryProquint || 'NO-PRIMARY'}
          subtitle={hasPrimary && primaryId ? String(primaryId).toLowerCase() : undefined}
          onTitleClick={primaryProquint ? () => navigate(`/${primaryProquint.toLowerCase()}`) : undefined}
          ownerAddress={targetAddress}
          identiconAddress={targetAddress}
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

        {isOwner && hasPrimary && (
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

      {!hasPrimary && inboxCount === 0 && (
        <div className="card">
          <div style={{ 
            textAlign: 'center', 
            padding: '2rem', 
            color: 'var(--text-dim)',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '6px',
          }}>
            No proquint names registered
          </div>
        </div>
      )}

      {isOwner && hasPrimary && primaryId && (
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
