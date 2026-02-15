import { useReadContract } from 'wagmi'
import { CONTRACTS, CONSTANTS } from '../libs/contracts'
import { proquintToBytes4 } from '../libs/proquint'
import { PROQUINT_ABI } from '../libs/abi/ERC721ABI'
import type { AvailabilityResult } from '../types'

export function useAvailability(proquintString: string) {
  let proquintId: `0x${string}` = '0x00000000'
  try {
    proquintId = proquintString ? proquintToBytes4(proquintString) : '0x00000000'
  } catch {
    // Invalid proquint format while typing - use default
  }

  const { data: expiry, isLoading } = useReadContract({
    address: CONTRACTS.ProquintNFT,
    abi: PROQUINT_ABI,
    functionName: 'getExpiry',
    args: [proquintId],
  })

  const checkAvailability = (): AvailabilityResult => {
    if (!expiry) {
      return { status: 'available', type: 'new' }
    }

    const now = Math.floor(Date.now() / 1000)
    const expiryNum = Number(expiry)

    if (expiryNum === 0) {
      return { status: 'available', type: 'new' }
    }

    if (now < expiryNum) {
      return { status: 'taken', expiryDate: new Date(expiryNum * 1000) }
    }

    const elapsed = now - expiryNum

    if (elapsed <= CONSTANTS.GRACE_PERIOD) {
      return {
        status: 'grace',
        message: 'In grace period - only old owner can renew',
        expiryDate: new Date(expiryNum * 1000),
      }
    }

    if (elapsed <= CONSTANTS.GRACE_PLUS_PREMIUM) {
      return {
        status: 'premium',
        message: 'Premium period - higher cost',
        expiryDate: new Date(expiryNum * 1000),
      }
    }

    return {
      status: 'available',
      type: 'expired',
      message: 'Available for registration',
    }
  }

  return {
    availability: checkAvailability(),
    isLoading,
  }
}
