import { keccak256, encodePacked } from 'viem'

export interface CommitmentData {
  data: `0x${string}`
  commitment: `0x${string}`
  timestamp: number
}

/**
 * Pack registration input: bytes1(yrs) ++ bytes4(id) ++ bytes27(secret) = bytes32
 * Matches ProquintNFT.sol input layout.
 */
export function packRegistrationData(
  years: number,
  proquintId: `0x${string}`,
  secret: `0x${string}`
): `0x${string}` {
  return encodePacked(
    ['uint8', 'bytes4', 'bytes27'],
    [years, proquintId, secret]
  )
}

/**
 * Create commitment matching ProquintNFT.makeCommitment:
 *   ID = normalize(bytes4(input << 8))
 *   secret = bytes27(input << 40)
 *   commitment = keccak256(abi.encodePacked(ID, secret, recipient))
 *
 * In the dapp we pre-normalize the ID, so the packed bytes31 = ID ++ secret
 * and commitment = keccak256(abi.encodePacked(bytes31(idSecret), recipient))
 */
export function createCommitment(
  years: number,
  proquintId: `0x${string}`,
  secret: `0x${string}`,
  recipientAddress: `0x${string}`
): CommitmentData {
  // Pack: uint8 years + bytes4 id + bytes27 secret = bytes32
  const data = packRegistrationData(years, proquintId, secret)

  // _checkCommitment uses bytes31(input << 8) = ID ++ secret (31 bytes)
  // Remove first byte (years) → 62 hex chars = 31 bytes
  const idSecret = ('0x' + data.slice(4, 66)) as `0x${string}`

  const commitment = keccak256(
    encodePacked(['bytes31', 'address'], [idSecret, recipientAddress])
  )

  return {
    data,
    commitment,
    timestamp: Date.now(),
  }
}

export function saveCommitment(commitment: `0x${string}`, data: CommitmentData): void {
  const commitments = JSON.parse(localStorage.getItem('commitments') || '{}')
  commitments[commitment] = data
  localStorage.setItem('commitments', JSON.stringify(commitments))
}

export function getCommitment(commitment: `0x${string}`): CommitmentData | null {
  const commitments = JSON.parse(localStorage.getItem('commitments') || '{}')
  return commitments[commitment] || null
}

export function checkCommitmentAge(timestamp: number): { ready: boolean; expired: boolean; waitTime?: number } {
  const elapsed = Date.now() - timestamp
  const MIN_WAIT = 5_000   // 5 seconds — MIN_COMMITMENT_AGE
  const MAX_WAIT = 15 * 60 * 1000 // 15 minutes — MAX_COMMITMENT_AGE

  if (elapsed < MIN_WAIT) {
    return { ready: false, expired: false, waitTime: MIN_WAIT - elapsed }
  }

  if (elapsed > MAX_WAIT) {
    return { ready: false, expired: true }
  }

  return { ready: true, expired: false }
}
