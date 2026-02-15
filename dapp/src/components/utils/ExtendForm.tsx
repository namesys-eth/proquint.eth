import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { ProquintInput } from './ProquintInput'
import { useAvailability } from '../../hooks/useAvailability'
import { CONTRACTS, CONSTANTS } from '../../libs/contracts'
import { PROQUINT_ABI } from '../../libs/abi/ERC721ABI'
import { encodePacked } from 'viem'
import { proquintToBytes4, bytes4ToProquint, validateProquint, calculatePrice, formatPrice } from '../../libs/proquint'

export function ExtendForm() {
  const { address } = useAccount()
  const [proquint, setProquint] = useState('')
  const [years, setYears] = useState(1)
  const { isLoading } = useAvailability(proquint)

  const normalizedId: `0x${string}` | null = (() => {
    try {
      return validateProquint(proquint) ? proquintToBytes4(proquint) : null
    } catch {
      return null
    }
  })()
  const normalizedProquint = normalizedId ? bytes4ToProquint(normalizedId) : null

  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const isPalin = normalizedProquint ? normalizedProquint.split('-')[0] === normalizedProquint.split('-')[1] : false
  const price = proquint && validateProquint(proquint) ? calculatePrice(years, isPalin) : 0n
  const canExtend = proquint && validateProquint(proquint) && years >= 1 && years <= CONSTANTS.MAX_YEARS && !isLoading

  const handleExtend = () => {
    if (!address || !normalizedId) return
    // Pack: bytes1(yrs) ++ bytes4(id) — remaining bytes ignored by renew()
    const input = encodePacked(['uint8', 'bytes4'], [years, normalizedId])
    const padded = (input + '0'.repeat(66 - input.length)) as `0x${string}`
    writeContract({
      address: CONTRACTS.ProquintNFT,
      abi: PROQUINT_ABI,
      functionName: 'renew',
      args: [padded],
      value: price,
    })
  }

  return (
    <div className="container">
      <h2 className="page-title">Extend</h2>

      <div className="card">
        <div className="form-group">
          <label>Proquint Name</label>
          <ProquintInput value={proquint} onChange={setProquint} showRandom={false} showBytes4={true} />
        </div>

        <div className="form-group">
          <label>Additional Years (1-{CONSTANTS.MAX_YEARS})</label>
          <input
            type="number"
            min={1}
            max={CONSTANTS.MAX_YEARS}
            value={years}
            onChange={(e) => setYears(Number(e.target.value))}
          />
        </div>

        {price > 0n && (
          <div className="info-grid">
            <div className="info-item">
              <div className="info-label">Cost</div>
              <div className="info-value">{formatPrice(price)} ETH</div>
            </div>
            <div className="info-item">
              <div className="info-label">Normalized</div>
              <div className="info-value">{normalizedProquint ?? '—'}</div>
            </div>
            <div className="info-item">
              <div className="info-label">bytes4</div>
              <div className="info-value">{normalizedId ?? '—'}</div>
            </div>
          </div>
        )}

        <div className="actions">
          <button onClick={handleExtend} disabled={!canExtend || isPending}>
            {isPending ? 'Extending...' : 'Extend'}
          </button>
        </div>

        {isConfirming && <p style={{ marginTop: '1rem', color: 'var(--text-dim)' }}>⏳ Confirming...</p>}
        {isSuccess && <p style={{ marginTop: '1rem', color: 'var(--accent)' }}>✓ Extension complete!</p>}
      </div>
    </div>
  )
}
