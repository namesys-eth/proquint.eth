// Lookup tables matching LibProquint.sol
const CONSONANTS = 'bdfghjklmnprstvz' // 16 consonants
const VOWELS = 'aiou' // 4 vowels

// Decode lookup: maps 'a'-'z' to their index values (matching LibProquint.sol DECODE_LOOKUP)
// Invalid chars (b,c,e,q,w,x,y) map to 0 for auto-normalization
const DECODE_MAP: { [key: string]: number } = {
  'a': 0, 'b': 0, 'c': 0, 'd': 1, 'e': 0, 'f': 2, 'g': 3, 'h': 4, 
  'i': 1, 'j': 5, 'k': 6, 'l': 7, 'm': 8, 'n': 9, 'o': 2, 'p': 10, 
  'q': 0, 'r': 11, 's': 12, 't': 13, 'u': 3, 'v': 14, 'w': 0, 
  'x': 0, 'y': 0, 'z': 15
}

/**
 * Normalize bytes4 ID to canonical form (sorted halves)
 * Matches LibProquint.sol normalize() function
 */
export function normalizeBytes4(bytes: `0x${string}`): `0x${string}` {
  const hex = bytes.slice(2).padStart(8, '0')
  const first = parseInt(hex.slice(0, 4), 16)
  const second = parseInt(hex.slice(4, 8), 16)
  
  // Sort halves so smaller comes first
  const [i, j] = first > second ? [second, first] : [first, second]
  
  const normalized = ((i << 16) | j) >>> 0
  return `0x${normalized.toString(16).padStart(8, '0')}`
}

/**
 * Encode bytes4 to proquint string (auto-normalizes)
 * Matches LibProquint.sol encode() function
 */
export function bytes4ToProquint(bytes: `0x${string}`): string {
  const hex = bytes.slice(2).padStart(8, '0')
  let first = parseInt(hex.slice(0, 4), 16)
  let second = parseInt(hex.slice(4, 8), 16)
  
  // Auto-normalize: sort halves so smaller comes first
  if (first > second) {
    [first, second] = [second, first]
  }
  
  const encodeHalf = (n: number): string => {
    return (
      CONSONANTS[(n) & 0x0f] +
      VOWELS[(n >> 4) & 0x03] +
      CONSONANTS[(n >> 6) & 0x0f] +
      VOWELS[(n >> 10) & 0x03] +
      CONSONANTS[(n >> 12) & 0x0f]
    )
  }
  
  return `${encodeHalf(first)}-${encodeHalf(second)}`
}

/**
 * Decode proquint string to bytes4 (auto-normalizes)
 * Matches LibProquint.sol decode() function
 */
export function proquintToBytes4(proquint: string): `0x${string}` {
  const normalized = proquint.toLowerCase().replace('-', '')
  
  if (normalized.length !== 10) {
    throw new Error('Invalid proquint length')
  }
  
  const decodeHalf = (chars: string): number => {
    return (
      (DECODE_MAP[chars[4]] << 12) |
      (DECODE_MAP[chars[3]] << 10) |
      (DECODE_MAP[chars[2]] << 6) |
      (DECODE_MAP[chars[1]] << 4) |
      DECODE_MAP[chars[0]]
    )
  }
  
  let first = decodeHalf(normalized.slice(0, 5))
  let second = decodeHalf(normalized.slice(5, 10))
  
  // Auto-normalize: sort halves so smaller comes first
  if (first > second) {
    [first, second] = [second, first]
  }
  
  const combined = ((first << 16) | second) >>> 0
  return `0x${combined.toString(16).padStart(8, '0')}`
}

/**
 * Check if a bytes4 ID is palindromic
 * Matches LibProquint.sol isPalindromic() function
 */
export function isPalindromic(bytes: `0x${string}`): boolean {
  const hex = bytes.slice(2).padStart(8, '0')
  const first = parseInt(hex.slice(0, 4), 16)
  const second = parseInt(hex.slice(4, 8), 16)
  return first === second
}

/**
 * Validate proquint format (strict CVCVC-CVCVC)
 */
export function isValidCVCVC(proquint: string): boolean {
  const pattern = /^[bdfghjklmnprstvz][aiou][bdfghjklmnprstvz][aiou][bdfghjklmnprstvz]-[bdfghjklmnprstvz][aiou][bdfghjklmnprstvz][aiou][bdfghjklmnprstvz]$/i
  return pattern.test(proquint)
}

/**
 * Validate proquint can be decoded (10 letters a-z)
 * Non-CVCVC format is allowed - invalid chars are auto-zeroed
 */
export function validateProquint(proquint: string): boolean {
  const cleaned = proquint.toLowerCase().replace(/[^a-z]/g, '')
  return cleaned.length === 10
}

/**
 * Normalize proquint input to canonical form
 */
export function normalizeProquint(input: string): string {
  try {
    const bytes = proquintToBytes4(input as `0x${string}`)
    return bytes4ToProquint(bytes)
  } catch {
    return input.toLowerCase().trim()
  }
}

export function generateRandomBytes(length: number): `0x${string}` {
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return `0x${Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')}`
}

export function generateRandomProquint(): string {
  // Generate random 4 bytes (uint32)
  const randomBytes = generateRandomBytes(4)
  return bytes4ToProquint(randomBytes)
}

export function formatPrice(price: bigint): string {
  const eth = Number(price) / 1e18
  if (eth >= 0.01) return eth.toFixed(4)
  if (eth >= 0.001) return eth.toFixed(5)
  return eth.toFixed(6)
}

export function calculatePrice(years: number, isPalindromic: boolean = false): bigint {
  // Formula from Core.sol: (2^yrs - 1) * PRICE_PER_YEAR
  // PRICE_PER_YEAR = 0.00024 ETH = 240_000_000_000_000 wei
  const PRICE_PER_YEAR = 240_000_000_000_000n
  const multiplier = (1n << BigInt(years)) - 1n
  let price = multiplier * PRICE_PER_YEAR
  if (isPalindromic) price *= 5n
  return price
}
