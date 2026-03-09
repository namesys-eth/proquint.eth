export function formatDateTime(timestamp?: bigint | number | null): string {
  if (timestamp === undefined || timestamp === null) return '—'
  const value = typeof timestamp === 'bigint' ? Number(timestamp) : timestamp
  if (value === 0) return '—'
  return new Date(value * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatTimeRemaining(targetTimestamp?: bigint | number | null): { main: string; sub: string } {
  if (targetTimestamp === undefined || targetTimestamp === null) return { main: '—', sub: '' }
  const target = typeof targetTimestamp === 'bigint' ? Number(targetTimestamp) : targetTimestamp
  if (target === 0) return { main: '—', sub: '' }

  const now = Math.floor(Date.now() / 1000)
  const diff = target - now
  if (diff <= 0) return { main: 'Expired', sub: formatDateTime(targetTimestamp) }

  const days = Math.floor(diff / 86400)
  const hours = Math.floor((diff % 86400) / 3600)
  const minutes = Math.floor((diff % 3600) / 60)

  if (days < 7) {
    if (days > 0) return { main: `${days}d ${hours}h`, sub: formatDateTime(targetTimestamp) }
    return { main: `${hours}h ${minutes}m`, sub: formatDateTime(targetTimestamp) }
  }

  const years = Math.floor(days / 365)
  const remainingDays = days % 365
  if (years > 0) return { main: `${years}y ${remainingDays}d`, sub: formatDateTime(targetTimestamp) }
  return { main: `${days}d`, sub: formatDateTime(targetTimestamp) }
}
