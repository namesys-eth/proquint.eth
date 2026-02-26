import { getContractAddress } from './config'

// Single standalone ProquintNFT contract on L1
// Address is read from user config (localStorage) so it works with local anvil or mainnet.
export const CONTRACTS = {
  get ProquintNFT(): `0x${string}` {
    return getContractAddress()
  },
} as const

// Constants from Core.sol — all values in seconds / wei
export const CONSTANTS = {
  PRICE_PER_YEAR: 360_000_000_000_000n,       // 0.00036 ETH
  PRICE_PER_MONTH: 30_000_000_000_000n,       // 0.00003 ETH
  TWIN_MULTIPLIER: 5n,
  MAX_REFUND: 5_000_000_000_000_000_000n,     // 5 ETH
  BASE_PENDING_PERIOD: 42 * 24 * 60 * 60,    // 42 days
  MIN_PENDING_PERIOD: 7 * 24 * 60 * 60,      // 7 days
  GRACE_PERIOD: 300 * 24 * 60 * 60,          // 300 days
  PREMIUM_PERIOD: 65 * 24 * 60 * 60,         // 65 days
  GRACE_PLUS_PREMIUM: 365 * 24 * 60 * 60,    // 365 days
  TRANSFER_PENALTY: 7 * 24 * 60 * 60,        // 7 days
  ANYONE_PERIOD: 7 * 24 * 60 * 60,           // 7 days
  MONTH_DURATION: (365 * 24 * 60 * 60) / 12, // 365 days / 12
  MAX_YEARS: 12,
  MAX_INBOX: 45,
  MIN_COMMITMENT_AGE: 25,                     // 25 seconds
  MAX_COMMITMENT_AGE: 25 * 60,                // 25 minutes
} as const
