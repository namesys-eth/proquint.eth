import { useState, useEffect } from 'react'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACTS, CONSTANTS } from '../../libs/contracts'
import { PROQUINT_ABI } from '../../libs/abi/ERC721ABI'
import { TransferModal } from '../modal/TransferModal'
import { RefundModal } from '../modal/RefundModal'
import { ShelveModal } from '../modal/ShelveModal'
import { bytes4ToProquint } from '../../libs/proquint'

interface InboxStatusSectionProps {
  nameId: `0x${string}`
  inboxExpiryTs: number          // unix seconds — receiver claim deadline
  isInboxOwner: boolean
  ownerHasPrimary: boolean
  ownerPrimaryId?: string        // bytes4 of owner's current primary (for shelve)
  canClaim: boolean              // receiver period active
  canClaimOnBehalf: boolean      // anyone period active
  canBurn: boolean               // burn period active
  expiryTimestamp?: bigint       // registration expiry
}

function useCountdown(targetTs: number): string {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(id)
  }, [])
  const diff = targetTs - now
  if (diff <= 0) return 'Expired'
  const d = Math.floor(diff / 86400)
  const h = Math.floor((diff % 86400) / 3600)
  const m = Math.floor((diff % 3600) / 60)
  const s = diff % 60
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${s}s`
  return `${m}m ${s}s`
}

function formatDate(ts: number): string {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function InboxStatusSection({
  nameId,
  inboxExpiryTs,
  isInboxOwner,
  ownerHasPrimary,
  ownerPrimaryId,
  canClaim,
  canClaimOnBehalf,
  canBurn,
  expiryTimestamp,
}: InboxStatusSectionProps) {
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)
  const [showBurnModal, setShowBurnModal] = useState(false)
  const [showShelveModal, setShowShelveModal] = useState(false)
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isSuccess } = useWaitForTransactionReceipt({ hash })

  const anyoneEnd = inboxExpiryTs + CONSTANTS.ANYONE_PERIOD
  const proquintName = bytes4ToProquint(nameId)

  // Countdowns
  const receiverCountdown = useCountdown(inboxExpiryTs)
  const anyoneCountdown = useCountdown(anyoneEnd)

  const handleClaim = () => {
    writeContract({
      address: CONTRACTS.ProquintNFT,
      abi: PROQUINT_ABI,
      functionName: 'acceptInbox',
      args: [nameId],
    })
  }

  // Mirrors contract _refundAmount exactly:
  //   remainingMonths = (expiresAt[ID] - block.timestamp) / 30 days
  //   refund = remainingMonths * PRICE_PER_MONTH (0.00002 ETH)
  const calculateRefundReward = () => {
    const PRICE_PER_MONTH_ETH = Number(CONSTANTS.PRICE_PER_MONTH) / 1e18 // 0.00002
    const SECONDS_PER_MONTH = 30 * 24 * 60 * 60 // 30 days
    const now = Math.floor(Date.now() / 1000)
    const expiry = expiryTimestamp ? Number(expiryTimestamp) : now

    const remainingMonths = expiry > now ? Math.floor((expiry - now) / SECONDS_PER_MONTH) : 0
    const totalRefund = remainingMonths * PRICE_PER_MONTH_ETH

    if (isInboxOwner) {
      // rejectInbox: receiver gets full _refundAmount
      return {
        amount: totalRefund,
        remainingMonths,
        description: `${remainingMonths} mo × 0.00002 ETH`,
      }
    } else {
      // cleanInbox: if totalRefund > PRICE_PER_MONTH && receiver exists → 50/50, else 100% burner
      const split = totalRefund > PRICE_PER_MONTH_ETH
      const burnerReward = split ? totalRefund / 2 : totalRefund
      return {
        amount: burnerReward,
        remainingMonths,
        description: split
          ? `50% of ${remainingMonths} mo × 0.00002 ETH`
          : `${remainingMonths} mo × 0.00002 ETH (100% to burner)`,
      }
    }
  }

  const refundReward = calculateRefundReward()

  // Owner can claim only if no primary
  const ownerCanClaim = isInboxOwner && !ownerHasPrimary && canClaim
  // Others can claim on behalf only if owner has no primary AND anyone period active
  const othersCanClaim = !isInboxOwner && !ownerHasPrimary && canClaimOnBehalf

  const mono = { fontFamily: "'SF Mono', 'Monaco', monospace" } as const
  const cardBg: React.CSSProperties = {
    padding: '0.75rem', background: 'var(--bg)',
    border: '1px solid var(--border)', borderRadius: '6px',
    textAlign: 'center',
  }

  return (
    <div style={{ marginTop: '1.25rem' }}>
      {/* Owner warning */}
      {isInboxOwner && (
        <div style={{
          padding: '0.6rem 0.75rem', marginBottom: '0.75rem',
          backgroundColor: 'color-mix(in srgb, var(--warning) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)',
          borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text)', lineHeight: 1.5,
        }}>
          <strong style={{ color: 'var(--warning)' }}>Action Required</strong>
          <span style={{ color: 'var(--text-dim)', marginLeft: '0.4rem' }}>
            {ownerHasPrimary
              ? 'Shelve your current primary to claim this, or transfer/refund it.'
              : 'Claim this name as your primary before it expires.'}
          </span>
        </div>
      )}

      {/* Timeline cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
        {/* Receiver claim period */}
        <div style={{ ...cardBg, borderColor: canClaim ? 'color-mix(in srgb, var(--success) 40%, var(--border))' : 'var(--border)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
            Owner Claim
          </div>
          <div style={{ ...mono, fontSize: '1rem', fontWeight: 700, color: canClaim ? 'var(--success)' : 'var(--text-dim)', marginBottom: '0.2rem' }}>
            {receiverCountdown}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
            {formatDate(inboxExpiryTs)}
          </div>
        </div>

        {/* Anyone claim period */}
        <div style={{ ...cardBg, borderColor: canClaimOnBehalf ? 'color-mix(in srgb, var(--warning) 40%, var(--border))' : 'var(--border)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
            Open Claim
          </div>
          <div style={{ ...mono, fontSize: '1rem', fontWeight: 700, color: canClaimOnBehalf ? 'var(--warning)' : 'var(--text-dim)', marginBottom: '0.2rem' }}>
            {canClaim ? 'Waiting' : anyoneCountdown}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
            {formatDate(anyoneEnd)}
          </div>
        </div>

        {/* Burn period */}
        <div style={{ ...cardBg, borderColor: canBurn ? 'color-mix(in srgb, var(--danger) 40%, var(--border))' : 'var(--border)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
            Burnable
          </div>
          <div style={{ ...mono, fontSize: '1rem', fontWeight: 700, color: canBurn ? 'var(--danger)' : 'var(--text-dim)', marginBottom: '0.2rem' }}>
            {canBurn ? 'Now' : 'Waiting'}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
            {formatDate(anyoneEnd)}
          </div>
        </div>
      </div>

      {/* Period descriptions */}
      <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: '1rem', padding: '0 0.25rem' }}>
        {canClaim && isInboxOwner && (
          ownerHasPrimary
            ? <span>You already have a primary. <strong style={{ color: 'var(--text)' }}>Shelve</strong> it first, then claim this name.</span>
            : <span><strong style={{ color: 'var(--success)' }}>Owner claim active.</strong> Claim this as your primary now.</span>
        )}
        {canClaim && !isInboxOwner && (
          <span>Only the owner can claim during this period.</span>
        )}
        {canClaimOnBehalf && (
          <span><strong style={{ color: 'var(--warning)' }}>Open claim period.</strong> Anyone without a primary can claim on behalf of the owner — the owner receives it as their primary.</span>
        )}
        {canBurn && (
          <span><strong style={{ color: 'var(--danger)' }}>Burn period.</strong> Owner can refund anytime. Others can burn for a split reward.</span>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {isInboxOwner ? (
          <>
            {ownerHasPrimary ? (
              <button
                onClick={() => setShowShelveModal(true)}
                disabled={isPending}
                style={{ flex: '1 1 auto' }}
                title="Shelve primary to inbox (7d penalty), then claim this name"
              >
                {isPending ? 'Processing…' : 'Shelve Primary'}
              </button>
            ) : (
              <button
                onClick={handleClaim}
                disabled={!ownerCanClaim || isPending}
                style={{ flex: '1 1 auto' }}
                title={!canClaim ? 'Claim period not active' : 'Accept as your primary'}
              >
                {isPending ? 'Processing…' : 'Claim as Primary'}
              </button>
            )}
            <button
              onClick={() => setIsTransferModalOpen(true)}
              disabled={isPending}
              className="secondary"
              style={{ flex: '1 1 auto' }}
            >
              Transfer
            </button>
            <button
              onClick={() => setShowBurnModal(true)}
              disabled={isPending}
              className="secondary"
              style={{ flex: '1 1 auto' }}
              title="Reject inbox item and receive refund based on remaining time"
            >
              Refund
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleClaim}
              disabled={!othersCanClaim || isPending}
              style={{ flex: '1 1 auto' }}
              title={ownerHasPrimary ? 'Owner has a primary — cannot accept' : !canClaimOnBehalf ? '7d open claim not active yet' : 'Accept on behalf — owner gets this as primary'}
            >
              {isPending ? 'Processing…' : 'Claim On Behalf'}
            </button>
            <button
              onClick={() => setShowBurnModal(true)}
              disabled={!canBurn || isPending}
              className="secondary"
              style={{ flex: '1 1 auto' }}
              title={!canBurn ? 'Burnable after open claim ends' : 'Burn for split reward'}
            >
              {isPending ? 'Processing…' : 'Burn'}
            </button>
          </>
        )}
      </div>

      {isSuccess && (
        <div style={{
          marginTop: '0.75rem', padding: '0.6rem',
          backgroundColor: 'color-mix(in srgb, var(--success) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--success) 30%, transparent)',
          borderRadius: '6px', color: 'var(--success)', textAlign: 'center', fontSize: '0.85rem',
        }}>
          ✓ Transaction successful
        </div>
      )}

      <RefundModal
        open={showBurnModal}
        onClose={() => setShowBurnModal(false)}
        nameId={nameId}
        isInboxOwner={isInboxOwner}
        refundReward={refundReward}
      />

      <TransferModal
        open={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        nameId={nameId}
        onBurnRequest={() => {
          setIsTransferModalOpen(false)
          setShowBurnModal(true)
        }}
        proquintName={proquintName}
        expiryTimestamp={expiryTimestamp}
      />

      {ownerPrimaryId && ownerPrimaryId !== '0x00000000' && (
        <ShelveModal
          open={showShelveModal}
          onClose={() => setShowShelveModal(false)}
          nameId={ownerPrimaryId as `0x${string}`}
          proquintName={bytes4ToProquint(ownerPrimaryId as `0x${string}`)}
        />
      )}
    </div>
  )
}
