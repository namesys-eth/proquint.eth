import { useState, useEffect, useMemo } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { useParams, useNavigate } from 'react-router-dom'
import { createPublicClient, http } from 'viem'
import { normalize } from 'viem/ens'
import { mainnet } from 'wagmi/chains'
import { CONTRACTS } from '../../libs/contracts'
import { PROQUINT_ABI } from '../../libs/abi/ERC721ABI'
import { ProfileSearchBar } from './ProfileSearchBar'
import { Identicon } from '../utils/Identicon'
import { useInboxItems } from '../../hooks/useInboxItems'
import { ExpiryDisplay } from '../utils/ExpiryDisplay'
import { InboxItemCard } from '../utils/InboxItemCard'
import { proquintNameStyle, addressStyle } from '../utils/styles'
import { bytes4ToProquint } from '../../libs/proquint'

const ZERO_ID = '0x00000000'

export function ProfileAddress() {
  const { param: urlParam } = useParams<{ param: string }>()
  const { address: connectedAddress } = useAccount()
  const navigate = useNavigate()
  const [resolvedAddress, setResolvedAddress] = useState<`0x${string}` | null>(null)
  const [isResolving, setIsResolving] = useState(false)

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

  if (isResolving) {
    return (
      <div className="container">
        <div className="card">
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-dim)' }}>
            Loading profile...
          </div>
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

        {inboxCount > 0 && isOwner && (
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

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <Identicon address={targetAddress} proquintId={hasPrimary ? (primaryId as `0x${string}`) : undefined} size={160} />
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
            {targetAddress}
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
        </div>

        {/* Primary Name Expiry */}
        {hasPrimary && primaryId && (
          <div style={{ marginTop: '1rem' }}>
            <ExpiryDisplay expiryTimestamp={primaryExpiry} showGracePeriod={true} compact={true} />
          </div>
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
            <div style={{ 
              textAlign: 'center', 
              padding: '2rem', 
              color: 'var(--text-dim)',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '6px',
            }}>
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
    </div>
  )
}
