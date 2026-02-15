import { useAccount, useReadContract, useWatchContractEvent } from 'wagmi'
import { CONTRACTS } from '../libs/contracts'
import { PROQUINT_ABI } from '../libs/abi/ERC721ABI'

export function useInbox() {
  const { address } = useAccount()

  // Get primary name (bytes4 ID, 0x00000000 if none)
  const { data: primaryId, refetch: refetchPrimary } = useReadContract({
    address: CONTRACTS.ProquintNFT,
    abi: PROQUINT_ABI,
    functionName: 'primaryName',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  // Get inbox count
  const { data: inboxCountData, refetch: refetchInboxCount } = useReadContract({
    address: CONTRACTS.ProquintNFT,
    abi: PROQUINT_ABI,
    functionName: 'inboxCount',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  // Watch for InboxUpdated events (covers: received, rejected, burned, cleaned)
  useWatchContractEvent({
    address: CONTRACTS.ProquintNFT,
    abi: PROQUINT_ABI,
    eventName: 'InboxUpdated',
    onLogs() {
      refetchPrimary()
      refetchInboxCount()
    },
  })

  // Watch for PrimaryUpdated events (covers: accepted, registered, shelved)
  useWatchContractEvent({
    address: CONTRACTS.ProquintNFT,
    abi: PROQUINT_ABI,
    eventName: 'PrimaryUpdated',
    onLogs() {
      refetchPrimary()
      refetchInboxCount()
    },
  })

  const hasPrimary = !!primaryId && primaryId !== '0x00000000'

  return {
    hasPrimary,
    primaryId: primaryId as `0x${string}` | undefined,
    inboxCount: inboxCountData ? Number(inboxCountData) : 0,
    refetch: () => {
      refetchPrimary()
      refetchInboxCount()
    },
  }
}
