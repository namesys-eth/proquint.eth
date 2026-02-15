interface NameDetailsProps {
  viewingSpecificId: boolean
  displayName: string
  ownerPrimaryName?: string | null
  primaryOwnerAddress?: string | null
  expiry?: string
  gracePeriodEnd?: string
}

export function NameDetails({ 
  viewingSpecificId, 
  displayName, 
  ownerPrimaryName,
  primaryOwnerAddress,
  expiry,
  gracePeriodEnd
}: NameDetailsProps) {
  const items = []

  if (viewingSpecificId) {
    items.push(
      <div key="current" className="info-item">
        <div className="info-label">Current ID</div>
        <div className="info-value">{displayName}</div>
      </div>
    )
  }

  const normalizedPrimary = ownerPrimaryName
    ? ownerPrimaryName.toUpperCase()
    : 'NONE SET'

  const primaryHref = ownerPrimaryName
    ? `/${ownerPrimaryName.toLowerCase()}`
    : primaryOwnerAddress
      ? `/${primaryOwnerAddress}`
      : null

  items.push(
    <div key="primary" className="info-item">
      <div className="info-label">Primary ID</div>
      <div className="info-value">
        {primaryHref ? (
          <a href={primaryHref} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            {normalizedPrimary}
          </a>
        ) : (
          normalizedPrimary
        )}
      </div>
    </div>
  )
  
  if (expiry) {
    items.push(
      <div key="expiry" className="info-item">
        <div className="info-label">Expires</div>
        <div className="info-value">{expiry}</div>
      </div>
    )
  }
  
  if (gracePeriodEnd) {
    items.push(
      <div key="grace" className="info-item">
        <div className="info-label">Grace Period Ends</div>
        <div className="info-value">{gracePeriodEnd}</div>
      </div>
    )
  }
  
  return <div className="info-grid">{items}</div>
}
