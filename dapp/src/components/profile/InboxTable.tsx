import { useState, useMemo } from 'react'
import { bytes4ToProquint } from '../../libs/proquint'
import { useNavigate } from 'react-router-dom'
import { CONSTANTS } from '../../libs/contracts'

interface InboxItem {
  id: `0x${string}`
  sender: string
  inboxExpiry: bigint
}

function SenderDisplay({ address }: { address: string }) {
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  return <span>{formatAddress(address)}</span>
}

interface InboxTableProps {
  items: InboxItem[]
  isOwner: boolean
  hasPrimary: boolean
}

type SortField = 'name' | 'sender' | 'expiry' | 'burnDate'
type SortDirection = 'asc' | 'desc'

export function InboxTable({ items, isOwner, hasPrimary }: InboxTableProps) {
  const navigate = useNavigate()
  const [sortField, setSortField] = useState<SortField>('expiry')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const sortedItems = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case 'name':
          const nameA = bytes4ToProquint(a.id).toUpperCase()
          const nameB = bytes4ToProquint(b.id).toUpperCase()
          comparison = nameA.localeCompare(nameB)
          break
        case 'sender':
          comparison = a.sender.localeCompare(b.sender)
          break
        case 'expiry':
          comparison = Number(a.inboxExpiry) - Number(b.inboxExpiry)
          break
        case 'burnDate':
          const burnA = Number(a.inboxExpiry) + (42 * 24 * 60 * 60)
          const burnB = Number(b.inboxExpiry) + (42 * 24 * 60 * 60)
          comparison = burnA - burnB
          break
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })

    return sorted
  }, [items, sortField, sortDirection])

  const formatDate = (timestamp: bigint) => {
    if (!timestamp || timestamp === 0n) return '—'
    const date = new Date(Number(timestamp) * 1000)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span style={{ opacity: 0.3 }}>↕</span>
    return <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
  }

  const now = Math.floor(Date.now() / 1000)

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <h3 style={{ marginBottom: '1rem' }}>Inbox ({items.length})</h3>
      
      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
          No pending names in inbox
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            fontSize: '0.9rem'
          }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <th 
                  onClick={() => handleSort('name')}
                  style={{ 
                    padding: '0.75rem', 
                    textAlign: 'left', 
                    cursor: 'pointer',
                    userSelect: 'none',
                    fontWeight: 600
                  }}
                >
                  Name <SortIcon field="name" />
                </th>
                <th 
                  onClick={() => handleSort('sender')}
                  style={{ 
                    padding: '0.75rem', 
                    textAlign: 'left', 
                    cursor: 'pointer',
                    userSelect: 'none',
                    fontWeight: 600
                  }}
                >
                  From <SortIcon field="sender" />
                </th>
                <th 
                  onClick={() => handleSort('expiry')}
                  style={{ 
                    padding: '0.75rem', 
                    textAlign: 'left', 
                    cursor: 'pointer',
                    userSelect: 'none',
                    fontWeight: 600
                  }}
                >
                  Inbox Expires <SortIcon field="expiry" />
                </th>
                <th 
                  onClick={() => handleSort('burnDate')}
                  style={{ 
                    padding: '0.75rem', 
                    textAlign: 'left', 
                    cursor: 'pointer',
                    userSelect: 'none',
                    fontWeight: 600
                  }}
                >
                  Public Burn Date <SortIcon field="burnDate" />
                </th>
                <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600 }}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item) => {
                const proquintName = bytes4ToProquint(item.id)
                const inboxExpiryNum = Number(item.inboxExpiry)
                const gracePeriodEnd = inboxExpiryNum + CONSTANTS.ANYONE_PERIOD
                const burnDate = inboxExpiryNum + CONSTANTS.ANYONE_PERIOD
                const ownerCanAccept = isOwner && !hasPrimary && inboxExpiryNum > 0 && now < inboxExpiryNum
                const anyoneCanAccept = !hasPrimary && now >= inboxExpiryNum && now < gracePeriodEnd
                const canAccept = ownerCanAccept || anyoneCanAccept
                const isExpired = now >= burnDate

                return (
                  <tr 
                    key={item.id}
                    onClick={() => navigate(`/${proquintName}`)}
                    style={{ 
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td 
                      data-label="Name"
                      style={{ 
                        padding: '0.75rem',
                        fontFamily: "'SF Mono', 'Monaco', monospace",
                        fontWeight: 600,
                        textTransform: 'uppercase'
                      }}
                    >
                      {proquintName}
                    </td>
                    <td 
                      data-label="From"
                      style={{ 
                        padding: '0.75rem',
                        fontFamily: "'SF Mono', 'Monaco', monospace",
                        fontSize: '0.85rem'
                      }}
                    >
                      <SenderDisplay address={item.sender} />
                    </td>
                    <td 
                      data-label="Inbox Expires"
                      style={{ padding: '0.75rem', fontSize: '0.85rem' }}
                    >
                      {formatDate(item.inboxExpiry)}
                    </td>
                    <td 
                      data-label="Public Burn Date"
                      style={{ padding: '0.75rem', fontSize: '0.85rem' }}
                    >
                      {formatDate(BigInt(burnDate))}
                    </td>
                    <td 
                      data-label="Status"
                      style={{ padding: '0.75rem', textAlign: 'center' }}
                    >
                      {isExpired ? (
                        <span style={{ 
                          padding: '0.25rem 0.5rem', 
                          borderRadius: '4px', 
                          backgroundColor: 'color-mix(in srgb, var(--danger) 10%, transparent)',
                          color: 'var(--danger)',
                          fontSize: '0.75rem',
                          fontWeight: 600
                        }}>
                          EXPIRED
                        </span>
                      ) : canAccept ? (
                        <span style={{ 
                          padding: '0.25rem 0.5rem', 
                          borderRadius: '4px', 
                          backgroundColor: 'color-mix(in srgb, var(--success) 10%, transparent)',
                          color: 'var(--success)',
                          fontSize: '0.75rem',
                          fontWeight: 600
                        }}>
                          CAN CLAIM
                        </span>
                      ) : (
                        <span style={{ 
                          padding: '0.25rem 0.5rem', 
                          borderRadius: '4px', 
                          backgroundColor: 'color-mix(in srgb, var(--warning) 10%, transparent)',
                          color: 'var(--warning)',
                          fontSize: '0.75rem',
                          fontWeight: 600
                        }}>
                          PENDING
                        </span>
                      )}
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
