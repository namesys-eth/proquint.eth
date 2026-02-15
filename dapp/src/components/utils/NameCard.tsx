import { useNavigate } from 'react-router-dom'
import { bytes4ToProquint } from '../../libs/proquint'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACTS, CONSTANTS } from '../../libs/contracts'
import { PROQUINT_ABI } from '../../libs/abi/ERC721ABI'
import { useState } from 'react'

interface NameCardProps {
  nameId: `0x${string}`
  sender?: string
  inboxExpiry?: bigint
  isOwner: boolean
  hasPrimary: boolean
  onTransferSuccess?: () => void
}

export function NameCard({ 
  nameId, 
  sender, 
  inboxExpiry,
  isOwner,
  hasPrimary,
  onTransferSuccess
}: NameCardProps) {
  const navigate = useNavigate()
  const [transferTo, setTransferTo] = useState('')
  const [showTransfer, setShowTransfer] = useState(false)
  const [transferError, setTransferError] = useState<string | null>(null)
  const proquintName = bytes4ToProquint(nameId)
  const now = Math.floor(Date.now() / 1000)
  
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isSuccess } = useWaitForTransactionReceipt({ hash })
  
  const inboxExpiryNum = inboxExpiry ? Number(inboxExpiry) : 0
  const anyonePeriodEnd = inboxExpiryNum + CONSTANTS.ANYONE_PERIOD // 7 days
  
  // Owner can accept if they have no primary and within inbox period
  const ownerCanAccept = isOwner && !hasPrimary && inboxExpiryNum > 0 && now < inboxExpiryNum
  // Anyone can accept if owner has no primary and within anyone period (7 days after inbox expiry)
  const anyoneCanAccept = !hasPrimary && now >= inboxExpiryNum && now < anyonePeriodEnd
  const canAccept = ownerCanAccept || anyoneCanAccept
  // Burnable after both inbox expiry + anyone period
  const canBurn = inboxExpiryNum > 0 && now >= anyonePeriodEnd

  const formatDate = (timestamp: bigint | number) => {
    if (!timestamp || timestamp === 0) return '—'
    const num = typeof timestamp === 'bigint' ? Number(timestamp) : timestamp
    return new Date(num * 1000).toLocaleDateString()
  }

  const handleNameClick = () => {
    navigate(`/${proquintName}`)
  }

  const handleIdClick = () => {
    navigate(`/${proquintName}`)
  }
  
  const handleTransfer = () => {
    if (!transferTo || !transferTo.startsWith('0x') || transferTo.length !== 42) {
      setTransferError('Please enter a valid Ethereum address')
      return
    }
    setTransferError(null)
    
    writeContract({
      address: CONTRACTS.ProquintNFT,
      abi: PROQUINT_ABI,
      functionName: 'safeTransferFrom',
      args: [sender as `0x${string}`, transferTo as `0x${string}`, BigInt(nameId)]
    })
  }
  
  // Reset and notify on success
  if (isSuccess && onTransferSuccess) {
    setShowTransfer(false)
    setTransferTo('')
    onTransferSuccess()
  }

  return (
    <div className="info-grid" style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: '0.5rem' }}>
      <div className="info-item">
        <div className="info-label">Name</div>
        <div 
          className="info-value" 
          style={{ 
            fontFamily: "'SF Mono', 'Monaco', monospace",
            cursor: 'pointer',
            color: 'var(--primary)',
            textDecoration: 'underline'
          }}
          onClick={handleNameClick}
          title="Click to view profile"
        >
          {proquintName.toUpperCase()}
        </div>
      </div>
      <div className="info-item">
        <div className="info-label">ID</div>
        <div 
          className="info-value" 
          style={{ 
            fontFamily: "'SF Mono', 'Monaco', monospace", 
            fontSize: '0.8rem',
            cursor: 'pointer',
            color: 'var(--primary)',
            textDecoration: 'underline'
          }}
          onClick={handleIdClick}
          title="Click to view profile"
        >
          {nameId}
        </div>
      </div>
      {sender && (
        <div className="info-item">
          <div className="info-label">From</div>
          <div className="info-value" style={{ fontFamily: "'SF Mono', 'Monaco', monospace", fontSize: '0.8rem' }}>
            {sender.slice(0, 6)}...{sender.slice(-4)}
          </div>
        </div>
      )}
      {inboxExpiry && inboxExpiry > 0n && (
        <div className="info-item">
          <div className="info-label">Inbox Expires</div>
          <div className="info-value">
            {formatDate(inboxExpiry)}
          </div>
        </div>
      )}
      
      {inboxExpiry && inboxExpiry > 0n && (
        <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button 
              disabled={!canAccept}
              style={{ flex: '1 1 auto', minWidth: '120px' }}
              title={
                hasPrimary ? 'Owner has a primary — shelve it first' :
                !canAccept ? 'Claim period not active' : 
                ownerCanAccept ? 'Claim as primary' :
                'Claim on behalf of owner (7d open period)'
              }
            >
              Accept
            </button>
            <button 
              disabled={!isOwner}
              className="secondary"
              style={{ flex: '1 1 auto', minWidth: '120px' }}
              title={!isOwner ? 'Only receiver can reject' : 'Reject and receive refund'}
            >
              Reject
            </button>
            <button 
              disabled={!canBurn}
              className="secondary"
              style={{ flex: '1 1 auto', minWidth: '120px' }}
              title={!canBurn ? 'Burnable after open claim ends' : 'Burn for reward'}
            >
              Burn
            </button>
            {isOwner && (
              <button 
                onClick={() => setShowTransfer(!showTransfer)}
                className="secondary"
                style={{ flex: '1 1 auto', minWidth: '120px' }}
                title="Transfer to another address (7d penalty)"
              >
                Transfer
              </button>
            )}
          </div>
          
          {showTransfer && isOwner && (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="0x..."
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  style={{ flex: 1, fontFamily: "'SF Mono', 'Monaco', monospace" }}
                />
                <button 
                  onClick={handleTransfer}
                  disabled={isPending || !transferTo}
                  style={{ minWidth: '100px' }}
                >
                  {isPending ? 'Sending...' : 'Send'}
                </button>
              </div>
              {transferError && (
                <div style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem',
                  backgroundColor: 'color-mix(in srgb, var(--danger) 10%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  color: 'var(--danger)'
                }}>
                  {transferError}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
