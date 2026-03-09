import { LoadingState } from '../utils/LoadingState'

interface InboxItemLike {
  id: string
  proquint: string
  inboxExpiry: bigint | number
}

interface ProfileInboxItemsSectionProps {
  inboxCount: number
  items: InboxItemLike[]
  loading: boolean
  onItemClick: (proquint: string) => void
}

export function ProfileInboxItemsSection({ inboxCount, items, loading, onItemClick }: ProfileInboxItemsSectionProps) {
  if (inboxCount <= 0) return null

  return (
    <div className="card">
      <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.75rem' }}>
        Inbox Items
        {loading && <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 400, marginLeft: '0.5rem' }}>loading...</span>}
      </h3>

      {items.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '1.25rem', color: 'var(--text-dim)', backgroundColor: 'var(--bg)', borderRadius: '6px' }}>
          No inbox items found
        </div>
      )}

      {loading && items.length === 0 && (
        <LoadingState message="Loading inbox items…" compact />
      )}

      {items.length > 0 && (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '6px' }}>
          <table className="compact-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                <th style={{ textAlign: 'left', padding: '0.55rem 0.6rem', color: 'var(--text-dim)', fontSize: '0.72rem' }}>Name</th>
                <th style={{ textAlign: 'left', padding: '0.55rem 0.6rem', color: 'var(--text-dim)', fontSize: '0.72rem' }}>Claim Left</th>
                <th style={{ textAlign: 'left', padding: '0.55rem 0.6rem', color: 'var(--text-dim)', fontSize: '0.72rem' }}>Expiry</th>
                <th style={{ textAlign: 'left', padding: '0.55rem 0.6rem', color: 'var(--text-dim)', fontSize: '0.72rem' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const now = Math.floor(Date.now() / 1000)
                const inboxExp = Number(item.inboxExpiry)
                const isExpired = inboxExp <= now
                const secondsRemaining = Math.max(0, inboxExp - now)
                const daysRemaining = Math.ceil(secondsRemaining / 86400)
                const claimLabel = isExpired ? 'Expired' : daysRemaining > 0 ? `${daysRemaining}d` : '<1d'
                const expiryLabel = new Date(inboxExp * 1000).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })

                return (
                  <tr key={item.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td data-label="Name" style={{ padding: '0.5rem 0.6rem' }}>
                      <button
                        onClick={() => onItemClick(item.proquint)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          padding: 0,
                          margin: 0,
                          color: 'var(--accent)',
                          textDecoration: 'underline',
                          textUnderlineOffset: '2px',
                          fontFamily: "'SF Mono', 'Monaco', monospace",
                          fontSize: '0.82rem',
                          minHeight: 'auto',
                          textTransform: 'uppercase',
                        }}
                      >
                        {item.proquint}
                      </button>
                    </td>
                    <td data-label="Claim Left" style={{ padding: '0.5rem 0.6rem', fontSize: '0.75rem', color: isExpired ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
                      {claimLabel}
                    </td>
                    <td data-label="Expiry" style={{ padding: '0.5rem 0.6rem', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      {expiryLabel}
                    </td>
                    <td data-label="Status" style={{ padding: '0.5rem 0.6rem', fontSize: '0.75rem', color: isExpired ? 'var(--danger)' : 'var(--text-dim)' }}>
                      {isExpired ? 'Expired' : 'Claimable'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
