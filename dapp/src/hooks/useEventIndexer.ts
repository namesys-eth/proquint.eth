import { useEffect, useState, useCallback, useRef } from 'react'
import { usePublicClient, useWatchContractEvent, useAccount } from 'wagmi'
import { type Log } from 'viem'
import { CONTRACTS } from '../libs/contracts'
import { PROQUINT_ABI } from '../libs/abi/ERC721ABI'
import {
  type CachedEvent,
  loadCachedEvents,
  saveCachedEvents,
  loadLastBlock,
  saveLastBlock,
  deduplicateEvents,
} from '../libs/eventCache'

/**
 * Parse a raw viem log into our CachedEvent format.
 * Handles indexed bytes4 (left-padded to bytes32 in topics) and bigint serialization.
 */
function parseLog(log: Log, eventName: string): CachedEvent | null {
  if (!log.blockNumber || !log.transactionHash) return null
  const args: Record<string, string | number> = {}

  const rawArgs = (log as any).args
  if (rawArgs) {
    for (const [key, val] of Object.entries(rawArgs)) {
      if (val === null || val === undefined) continue
      if (typeof val === 'bigint') {
        args[key] = val.toString()
      } else if (typeof val === 'string') {
        // Indexed bytes4 comes back as bytes32-padded hex — extract first 8 hex chars
        if (val.startsWith('0x') && val.length === 66) {
          args[key] = `0x${val.slice(2, 10)}`
        } else {
          args[key] = val
        }
      } else {
        args[key] = String(val)
      }
    }
  }

  return {
    type: eventName as CachedEvent['type'],
    blockNumber: Number(log.blockNumber),
    transactionHash: log.transactionHash,
    logIndex: log.logIndex ?? 0,
    args,
  }
}

/**
 * Client-side event indexer for the connected address.
 *
 * - On mount: loads cached events from localStorage, fetches new events from lastBlock+1
 * - Live: watches for new Transfer/PrimaryUpdated/InboxUpdated/Renewed events
 * - Persists to localStorage after each update
 *
 * Returns all events for the connected address, sorted by block number.
 */
export function useEventIndexer() {
  const { address, chainId } = useAccount()
  const client = usePublicClient()
  const [events, setEvents] = useState<CachedEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [lastBlock, setLastBlock] = useState(0)
  const fetchedRef = useRef<string | null>(null)

  // Persist events + lastBlock whenever they change
  const persist = useCallback(
    (evts: CachedEvent[], block: number) => {
      if (!address || !chainId) return
      saveCachedEvents(address, chainId, evts)
      saveLastBlock(address, chainId, block)
    },
    [address, chainId]
  )

  // Fetch historical events from chain
  const fetchEvents = useCallback(async () => {
    if (!address || !client || !chainId) return

    // Prevent duplicate fetches for the same address
    const fetchKey = `${chainId}_${address}`
    if (fetchedRef.current === fetchKey) return
    fetchedRef.current = fetchKey

    setLoading(true)

    // Load cache
    const cached = loadCachedEvents(address, chainId)
    const cachedBlock = loadLastBlock(address, chainId)

    if (cached.length > 0) {
      setEvents(cached)
      setLastBlock(cachedBlock)
    }

    try {
      const fromBlock = cachedBlock > 0 ? BigInt(cachedBlock + 1) : 0n
      const currentBlock = await client.getBlockNumber()

      if (fromBlock > currentBlock) {
        setLoading(false)
        return
      }

      // Fetch all relevant events in parallel
      // Transfer events where user is sender or receiver
      const [transfersFrom, transfersTo, primaryUpdated, inboxUpdated, renewed] =
        await Promise.all([
          client.getLogs({
            address: CONTRACTS.ProquintNFT,
            event: {
              type: 'event',
              name: 'Transfer',
              inputs: [
                { name: 'from', type: 'address', indexed: true },
                { name: 'to', type: 'address', indexed: true },
                { name: 'tokenId', type: 'uint256', indexed: true },
              ],
            },
            args: { from: address },
            fromBlock,
            toBlock: currentBlock,
          }),
          client.getLogs({
            address: CONTRACTS.ProquintNFT,
            event: {
              type: 'event',
              name: 'Transfer',
              inputs: [
                { name: 'from', type: 'address', indexed: true },
                { name: 'to', type: 'address', indexed: true },
                { name: 'tokenId', type: 'uint256', indexed: true },
              ],
            },
            args: { to: address },
            fromBlock,
            toBlock: currentBlock,
          }),
          client.getLogs({
            address: CONTRACTS.ProquintNFT,
            event: {
              type: 'event',
              name: 'PrimaryUpdated',
              inputs: [
                { name: 'user', type: 'address', indexed: true },
                { name: 'id', type: 'bytes4', indexed: true },
              ],
            },
            args: { user: address },
            fromBlock,
            toBlock: currentBlock,
          }),
          client.getLogs({
            address: CONTRACTS.ProquintNFT,
            event: {
              type: 'event',
              name: 'InboxUpdated',
              inputs: [
                { name: 'user', type: 'address', indexed: true },
                { name: 'id', type: 'bytes4', indexed: true },
                { name: 'inboxExpiry', type: 'uint64', indexed: false },
              ],
            },
            args: { user: address },
            fromBlock,
            toBlock: currentBlock,
          }),
          client.getLogs({
            address: CONTRACTS.ProquintNFT,
            event: {
              type: 'event',
              name: 'Renewed',
              inputs: [
                { name: 'id', type: 'bytes4', indexed: true },
                { name: 'newExpiry', type: 'uint64', indexed: false },
              ],
            },
            fromBlock,
            toBlock: currentBlock,
          }),
        ])

      const newEvents: CachedEvent[] = []

      for (const log of transfersFrom) {
        const parsed = parseLog(log as any, 'Transfer')
        if (parsed) newEvents.push(parsed)
      }
      for (const log of transfersTo) {
        const parsed = parseLog(log as any, 'Transfer')
        if (parsed) newEvents.push(parsed)
      }
      for (const log of primaryUpdated) {
        const parsed = parseLog(log as any, 'PrimaryUpdated')
        if (parsed) newEvents.push(parsed)
      }
      for (const log of inboxUpdated) {
        const parsed = parseLog(log as any, 'InboxUpdated')
        if (parsed) newEvents.push(parsed)
      }
      for (const log of renewed) {
        const parsed = parseLog(log as any, 'Renewed')
        if (parsed) newEvents.push(parsed)
      }

      const merged = deduplicateEvents([...cached, ...newEvents])
      const newBlock = Number(currentBlock)

      setEvents(merged)
      setLastBlock(newBlock)
      persist(merged, newBlock)
    } catch (err) {
      console.error('[EventIndexer] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [address, client, chainId, persist])

  // Fetch on mount / address change
  useEffect(() => {
    if (!address || !client) {
      setEvents([])
      setLastBlock(0)
      fetchedRef.current = null
      return
    }
    fetchedRef.current = null // reset so new address triggers fetch
    fetchEvents()
  }, [address, client, chainId, fetchEvents])

  // Live event watchers — append new events as they arrive
  const appendLiveEvent = useCallback(
    (eventName: string, logs: Log[]) => {
      if (!address || !chainId) return
      const newParsed: CachedEvent[] = []
      for (const log of logs) {
        const parsed = parseLog(log, eventName)
        if (parsed) newParsed.push(parsed)
      }
      if (newParsed.length === 0) return

      setEvents((prev) => {
        const merged = deduplicateEvents([...prev, ...newParsed])
        const maxBlock = Math.max(...newParsed.map((e) => e.blockNumber), lastBlock)
        persist(merged, maxBlock)
        setLastBlock(maxBlock)
        return merged
      })
    },
    [address, chainId, lastBlock, persist]
  )

  useWatchContractEvent({
    address: CONTRACTS.ProquintNFT,
    abi: PROQUINT_ABI,
    eventName: 'Transfer',
    onLogs(logs) {
      // Filter to only events involving the connected address
      const relevant = logs.filter((l: any) => {
        const from = l.args?.from?.toLowerCase()
        const to = l.args?.to?.toLowerCase()
        const addr = address?.toLowerCase()
        return from === addr || to === addr
      })
      if (relevant.length > 0) appendLiveEvent('Transfer', relevant as any)
    },
  })

  useWatchContractEvent({
    address: CONTRACTS.ProquintNFT,
    abi: PROQUINT_ABI,
    eventName: 'PrimaryUpdated',
    onLogs(logs) {
      const relevant = logs.filter((l: any) => l.args?.user?.toLowerCase() === address?.toLowerCase())
      if (relevant.length > 0) appendLiveEvent('PrimaryUpdated', relevant as any)
    },
  })

  useWatchContractEvent({
    address: CONTRACTS.ProquintNFT,
    abi: PROQUINT_ABI,
    eventName: 'InboxUpdated',
    onLogs(logs) {
      const relevant = logs.filter((l: any) => l.args?.user?.toLowerCase() === address?.toLowerCase())
      if (relevant.length > 0) appendLiveEvent('InboxUpdated', relevant as any)
    },
  })

  useWatchContractEvent({
    address: CONTRACTS.ProquintNFT,
    abi: PROQUINT_ABI,
    eventName: 'Renewed',
    onLogs(logs) {
      // Renewed isn't user-indexed, so we include all and let the UI filter by owned IDs
      appendLiveEvent('Renewed', logs as any)
    },
  })

  return {
    events,
    loading,
    lastBlock,
    refetch: () => {
      fetchedRef.current = null
      fetchEvents()
    },
  }
}
