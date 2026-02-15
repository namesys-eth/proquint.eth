import { useEffect, useState } from 'react'
import { usePublicClient, useReadContract } from 'wagmi'
import { parseAbiItem } from 'viem'
import { CONTRACTS } from '../libs/contracts'
import { PROQUINT_ABI } from '../libs/abi/ERC721ABI'
import { bytes4ToProquint } from '../libs/proquint'

export interface InboxItem {
  id: `0x${string}`       // bytes4 normalized ID (0x + 8 hex chars)
  proquint: string        // human-readable proquint
  inboxExpiry: bigint     // current on-chain inbox expiry (0 if removed)
  expiry: bigint          // name registration expiry
  owner: `0x${string}`    // current owner
}

/**
 * Indexed bytes4 values are left-padded to bytes32 in event topics.
 * Extract the actual bytes4 from the padded hex.
 * e.g. "0x00010002000...000" → "0x00010002"
 */
function topicToBytes4(topic: `0x${string}` | string): `0x${string}` {
  const hex = topic.replace('0x', '')
  // bytes4 is left-aligned in the 32-byte topic: first 8 hex chars
  return `0x${hex.slice(0, 8)}` as `0x${string}`
}

/**
 * Fetch inbox items for a user by reading InboxUpdated event logs,
 * then verifying current state on-chain via inboxExpiry reads.
 *
 * Strategy:
 * 1. Get all InboxUpdated(user, id, inboxExpiry) logs where user = address
 * 2. Collect unique IDs where inboxExpiry > 0 (entered inbox)
 * 3. For each candidate, read current inboxExpiry on-chain to confirm still in inbox
 * 4. Read expiry + ownerOf for display
 */
export function useInboxItems(address: `0x${string}` | undefined) {
  const client = usePublicClient()
  const [items, setItems] = useState<InboxItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Also read inbox count to know when to refetch
  const { data: inboxCount } = useReadContract({
    address: CONTRACTS.ProquintNFT,
    abi: PROQUINT_ABI,
    functionName: 'inboxCount',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  useEffect(() => {
    if (!address || !client) {
      setItems([])
      return
    }

    const count = inboxCount ? Number(inboxCount) : 0
    if (count === 0) {
      setItems([])
      return
    }

    let cancelled = false

    async function fetchInboxItems() {
      setLoading(true)
      setError(null)

      try {
        // Get InboxUpdated logs for this user
        const logs = await client!.getLogs({
          address: CONTRACTS.ProquintNFT,
          event: parseAbiItem('event InboxUpdated(address indexed user, bytes4 indexed id, uint64 inboxExpiry)'),
          args: { user: address },
          fromBlock: 0n,
          toBlock: 'latest',
        })

        // Build a map of latest inboxExpiry per ID from logs
        // Indexed bytes4 comes back padded — extract real bytes4
        const latestByIdHex = new Map<string, bigint>()
        for (const log of logs) {
          if (!log.args.id || log.args.inboxExpiry === undefined || log.args.inboxExpiry === null) continue
          const id = topicToBytes4(log.args.id as `0x${string}`)
          const ie = log.args.inboxExpiry as bigint
          latestByIdHex.set(id, ie)
        }

        // Filter to IDs where the last log had inboxExpiry > 0 (still in inbox per logs)
        const candidateIds = [...latestByIdHex.entries()]
          .filter(([, ie]) => ie > 0n)
          .map(([id]) => id as `0x${string}`)

        if (candidateIds.length === 0 || cancelled) {
          if (!cancelled) setItems([])
          setLoading(false)
          return
        }

        // Verify on-chain for each candidate
        const verified: InboxItem[] = []
        for (const id of candidateIds) {
          if (cancelled) break

          // tokenId = uint256(uint32(bytes4))
          const tokenId = BigInt(parseInt(id.slice(2), 16))

          const [ieResult, expiryResult, ownerResult] = await Promise.all([
            client!.readContract({
              address: CONTRACTS.ProquintNFT,
              abi: PROQUINT_ABI,
              functionName: 'inboxExpiry',
              args: [id],
            }),
            client!.readContract({
              address: CONTRACTS.ProquintNFT,
              abi: PROQUINT_ABI,
              functionName: 'getExpiry',
              args: [id],
            }),
            client!.readContract({
              address: CONTRACTS.ProquintNFT,
              abi: PROQUINT_ABI,
              functionName: 'ownerOf',
              args: [tokenId],
            }).catch(() => null),
          ])

          const ie = ieResult as bigint
          const expiry = expiryResult as bigint
          const owner = ownerResult as `0x${string}` | null

          // Only include if still in inbox and owned by this user
          if (ie > 0n && owner && owner.toLowerCase() === address!.toLowerCase()) {
            let proquint = id
            try {
              proquint = bytes4ToProquint(id)
            } catch {
              // fallback to hex
            }
            verified.push({
              id,
              proquint,
              inboxExpiry: ie,
              expiry,
              owner,
            })
          }
        }

        if (!cancelled) {
          setItems(verified)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch inbox items')
          setItems([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchInboxItems()
    return () => { cancelled = true }
  }, [address, client, inboxCount])

  return { items, loading, error, inboxCount: inboxCount ? Number(inboxCount) : 0 }
}
