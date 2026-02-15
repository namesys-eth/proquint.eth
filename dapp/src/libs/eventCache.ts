/**
 * Client-side event cache backed by localStorage.
 * Stores per-address event logs and the last indexed block number
 * so the dapp only fetches new events on subsequent loads.
 */

const STORAGE_KEY_PREFIX = 'pq_events_'
const BLOCK_KEY_PREFIX = 'pq_lastblock_'

export interface CachedEvent {
  type: 'Transfer' | 'PrimaryUpdated' | 'InboxUpdated' | 'Renewed' | 'Committed'
  blockNumber: number
  transactionHash: string
  logIndex: number
  args: Record<string, string | number>
}

function storageKey(address: string, chainId: number): string {
  return `${STORAGE_KEY_PREFIX}${chainId}_${address.toLowerCase()}`
}

function blockKey(address: string, chainId: number): string {
  return `${BLOCK_KEY_PREFIX}${chainId}_${address.toLowerCase()}`
}

export function loadCachedEvents(address: string, chainId: number): CachedEvent[] {
  try {
    const raw = localStorage.getItem(storageKey(address, chainId))
    if (!raw) return []
    return JSON.parse(raw) as CachedEvent[]
  } catch {
    return []
  }
}

export function saveCachedEvents(address: string, chainId: number, events: CachedEvent[]): void {
  try {
    localStorage.setItem(storageKey(address, chainId), JSON.stringify(events))
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

export function loadLastBlock(address: string, chainId: number): number {
  try {
    const raw = localStorage.getItem(blockKey(address, chainId))
    if (!raw) return 0
    return parseInt(raw, 10) || 0
  } catch {
    return 0
  }
}

export function saveLastBlock(address: string, chainId: number, block: number): void {
  try {
    localStorage.setItem(blockKey(address, chainId), String(block))
  } catch {
    // silently fail
  }
}

export function clearCache(address: string, chainId: number): void {
  try {
    localStorage.removeItem(storageKey(address, chainId))
    localStorage.removeItem(blockKey(address, chainId))
  } catch {
    // silently fail
  }
}

/**
 * Deduplicate events by (transactionHash, logIndex).
 * Keeps the latest version of each event.
 */
export function deduplicateEvents(events: CachedEvent[]): CachedEvent[] {
  const map = new Map<string, CachedEvent>()
  for (const e of events) {
    map.set(`${e.transactionHash}_${e.logIndex}`, e)
  }
  return [...map.values()].sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex)
}
