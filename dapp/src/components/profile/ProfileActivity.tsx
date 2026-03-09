import { useNavigate } from 'react-router-dom'
import { type CachedEvent } from '../../libs/eventCache'
import { bytes4ToProquint } from '../../libs/proquint'
import { explorerTxUrl } from '../../libs/config'
import { monoStyle, txHashStyle } from '../utils/styles'

interface ProfileActivityProps {
  events: CachedEvent[]
  loading: boolean
  lastBlock: number
}

const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function tokenIdToProquint(tokenId: string): string {
  try {
    const num = BigInt(tokenId)
    const hex = num.toString(16).padStart(8, '0')
    return bytes4ToProquint(`0x${hex}` as `0x${string}`)
  } catch {
    return tokenId
  }
}

function toPqName(raw: string): string | null {
  try {
    return bytes4ToProquint(raw as `0x${string}`).toUpperCase()
  } catch {
    return null
  }
}

function describeEvent(e: CachedEvent): { label: string; proquintName: string | null; extra: string | null; color: string } {
  switch (e.type) {
    case 'Transfer': {
      const from = (e.args.from as string || '').toLowerCase()
      const to = (e.args.to as string || '').toLowerCase()
      const name = tokenIdToProquint(e.args.tokenId as string || '0').toUpperCase()
      if (from === ZERO_ADDR) return { label: 'Mint', proquintName: name, extra: null, color: 'var(--success)' }
      if (to === ZERO_ADDR) return { label: 'Burn', proquintName: name, extra: null, color: 'var(--danger)' }
      return { label: 'Transfer', proquintName: name, extra: `${shortAddr(from)} → ${shortAddr(to)}`, color: 'var(--primary)' }
    }
    case 'PrimaryUpdated': {
      const id = e.args.id as string || '0x00000000'
      if (id === '0x00000000') return { label: 'Primary Cleared', proquintName: null, extra: null, color: 'var(--text-dim)' }
      return { label: 'Primary Set', proquintName: toPqName(id), extra: null, color: 'var(--success)' }
    }
    case 'InboxUpdated': {
      const id = e.args.id as string || '0x00000000'
      const ie = e.args.inboxExpiry as bigint | string
      const name = toPqName(id)
      const expiryNum = typeof ie === 'bigint' ? Number(ie) : parseInt(ie as string || '0')
      if (expiryNum === 0) return { label: 'Inbox Removed', proquintName: name, extra: null, color: 'var(--text-dim)' }
      return { label: 'Inbox Received', proquintName: name, extra: null, color: 'var(--primary)' }
    }
    case 'Renewed': {
      const id = e.args.id as string || '0x00000000'
      return { label: 'Renewed', proquintName: toPqName(id), extra: null, color: 'var(--success)' }
    }
    default:
      return { label: e.type, proquintName: null, extra: null, color: 'var(--text-dim)' }
  }
}

export function ProfileActivity({ events, loading, lastBlock }: ProfileActivityProps) {
  const navigate = useNavigate()
  const recentEvents = [...events].reverse().slice(0, 50)

  return (
    <div className="card">
      <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.75rem' }}>
        Activity
        {loading && <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 400, marginLeft: '0.5rem' }}>syncing...</span>}
      </h3>

      {lastBlock > 0 && (
        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '0.75rem', ...monoStyle }}>
          Indexed to block {lastBlock.toLocaleString()}
        </div>
      )}

      {recentEvents.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '1.25rem', color: 'var(--text-dim)', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px' }}>
          No activity yet
        </div>
      )}

      {recentEvents.length > 0 && (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '6px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                <th style={{ textAlign: 'left', padding: '0.55rem 0.6rem', color: 'var(--text-dim)', fontSize: '0.72rem' }}>Type</th>
                <th style={{ textAlign: 'left', padding: '0.55rem 0.6rem', color: 'var(--text-dim)', fontSize: '0.72rem' }}>Name</th>
                <th style={{ textAlign: 'left', padding: '0.55rem 0.6rem', color: 'var(--text-dim)', fontSize: '0.72rem' }}>Details</th>
                <th style={{ textAlign: 'left', padding: '0.55rem 0.6rem', color: 'var(--text-dim)', fontSize: '0.72rem' }}>Block / Time</th>
                <th style={{ textAlign: 'left', padding: '0.55rem 0.6rem', color: 'var(--text-dim)', fontSize: '0.72rem' }}>Tx</th>
              </tr>
            </thead>
            <tbody>
              {recentEvents.map((e, idx) => {
                const { label, proquintName, extra, color } = describeEvent(e)
                const dateStr = new Date(e.timestamp * 1000).toLocaleString('en-US', {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                })
                const shortTxHash = `${e.transactionHash.slice(0, 10)}…`
                const txUrl = explorerTxUrl(e.transactionHash) || `https://etherscan.io/tx/${e.transactionHash}`
                return (
                  <tr key={`${e.transactionHash}-${e.logIndex}-${idx}`} style={{ borderTop: '1px solid var(--border)' }}>
                    <td data-label="Type" style={{ padding: '0.5rem 0.6rem' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color }}>{label}</span>
                    </td>
                    <td data-label="Name" style={{ padding: '0.5rem 0.6rem' }}>
                      {proquintName ? (
                        <button
                          onClick={() => navigate(`/${proquintName.toLowerCase()}`)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            padding: 0,
                            margin: 0,
                            color: 'var(--accent)',
                            textDecoration: 'underline',
                            textUnderlineOffset: '2px',
                            fontFamily: "'SF Mono', 'Monaco', monospace",
                            fontSize: '0.8rem',
                            minHeight: 'auto',
                            textAlign: 'left',
                          }}
                        >
                          {proquintName.toUpperCase()}
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>
                    <td data-label="Details" style={{ padding: '0.5rem 0.6rem' }}>
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem', wordBreak: 'break-word' }}>
                        {extra || e.type}
                      </span>
                    </td>
                    <td data-label="Block / Time" style={{ padding: '0.5rem 0.6rem' }}>
                      <div style={{ ...monoStyle, fontSize: '0.7rem', color: 'var(--text-dim)' }}>#{e.blockNumber.toLocaleString()}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{dateStr}</div>
                    </td>
                    <td data-label="Tx" style={{ padding: '0.5rem 0.6rem' }}>
                      <a
                        href={txUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ ...txHashStyle, fontSize: '0.7rem', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                      >
                        {shortTxHash}
                      </a>
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
