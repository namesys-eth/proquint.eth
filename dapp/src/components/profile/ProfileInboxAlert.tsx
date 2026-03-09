interface ProfileInboxAlertProps {
  inboxCount: number
}

export function ProfileInboxAlert({ inboxCount }: ProfileInboxAlertProps) {
  return (
    <div
      style={{
        padding: '1rem',
        backgroundColor: 'color-mix(in srgb, var(--warning) 10%, transparent)',
        border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)',
        borderRadius: '6px',
        marginBottom: '1.5rem',
        fontSize: '0.9rem',
      }}
    >
      ⚠️ <strong>Action Required:</strong> You have {inboxCount} name{inboxCount > 1 ? 's' : ''} in your inbox.
    </div>
  )
}
