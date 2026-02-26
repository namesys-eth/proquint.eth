interface InboxItemCardProps {
  proquint: string
  isExpired: boolean
  onClick: () => void
}

export function InboxItemCard({ proquint, isExpired, onClick }: InboxItemCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        padding: '0.75rem',
        backgroundColor: 'var(--bg)',
        borderRadius: '6px',
        cursor: 'pointer',
        border: '1px solid var(--border)',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--surface)'
        e.currentTarget.style.borderColor = 'var(--primary)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--bg)'
        e.currentTarget.style.borderColor = 'var(--border)'
      }}
    >
      <span style={{
        fontFamily: "'SF Mono', 'Monaco', monospace",
        fontSize: '0.95rem',
        fontWeight: 600,
        color: 'var(--accent)',
        textTransform: 'uppercase'
      }}>
        {proquint}
      </span>
      <span style={{
        fontSize: '0.8rem',
        color: isExpired ? 'var(--danger)' : 'var(--text-dim)',
        fontWeight: isExpired ? 600 : 400
      }}>
        {isExpired ? 'Expired' : 'Active'}
      </span>
    </div>
  )
}
