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
  PRICE_PER_YEAR: 240_000_000_000_000n,       // 0.00024 ETH
  PRICE_PER_MONTH: 20_000_000_000_000n,       // 0.00002 ETH
  PALINDROME_MULTIPLIER: 5n,
  MAX_REFUND: 5_000_000_000_000_000_000n,     // 5 ETH
  BASE_PENDING_PERIOD: 42 * 24 * 60 * 60,    // 42 days
  MIN_PENDING_PERIOD: 7 * 24 * 60 * 60,      // 7 days
  GRACE_PERIOD: 300 * 24 * 60 * 60,          // 300 days
  PREMIUM_PERIOD: 65 * 24 * 60 * 60,         // 65 days
  GRACE_PLUS_PREMIUM: 365 * 24 * 60 * 60,    // 365 days
  TRANSFER_PENALTY: 7 * 24 * 60 * 60,        // 7 days
  ANYONE_PERIOD: 7 * 24 * 60 * 60,           // 7 days
  MAX_YEARS: 12,
  MAX_INBOX: 255,
  MIN_COMMITMENT_AGE: 5,                      // 5 seconds
  MAX_COMMITMENT_AGE: 15 * 60,                // 15 minutes
} as const
