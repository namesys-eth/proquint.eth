export type AvailabilityStatus = 'available' | 'taken' | 'grace' | 'premium'

export interface AvailabilityResult {
  status: AvailabilityStatus
  type?: 'new' | 'expired'
  message?: string
  expiryDate?: Date
}

export interface PremiumPrice {
  rent: bigint
  premium: bigint
  total: bigint
}
