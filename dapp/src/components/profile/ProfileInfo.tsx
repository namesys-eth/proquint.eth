import { Identicon } from '../utils/Identicon'

interface ProfileInfoProps {
  address: string
  primaryName?: string | null
  proquintId?: `0x${string}` | null
}

export function ProfileInfo({ address, primaryName, proquintId }: ProfileInfoProps) {
  return (
    <>
      {/* Desktop layout - blockies on left */}
      <div className="profile-info-desktop">
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginTop: '2rem', marginBottom: '2rem' }}>
          <Identicon address={address} proquintId={proquintId} size={120} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {primaryName && (
              <div style={{ fontSize: '1.5rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {primaryName}
              </div>
            )}
            <div style={{ fontFamily: "'SF Mono', 'Monaco', monospace", fontSize: '0.9rem', color: 'var(--text-dim)' }}>
              {address}
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile layout - blockies on top */}
      <div className="profile-info-mobile">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginTop: '2rem', marginBottom: '2rem' }}>
          <Identicon address={address} proquintId={proquintId} size={120} />
          {primaryName && (
            <div style={{ fontSize: '1.5rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {primaryName}
            </div>
          )}
          <div style={{ fontFamily: "'SF Mono', 'Monaco', monospace", fontSize: '0.9rem', color: 'var(--text-dim)' }}>
            {address}
          </div>
        </div>
      </div>
    </>
  )
}
