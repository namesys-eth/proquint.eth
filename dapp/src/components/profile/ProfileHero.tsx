import { Identicon } from '../utils/Identicon'
import { addressStyle } from '../utils/styles'

interface ProfileHeroProps {
  title: string
  subtitle?: string
  onTitleClick?: () => void
  ownerAddress: string
  identiconAddress: string
  identiconId?: `0x${string}`
  identiconSize?: number
}

export function ProfileHero({
  title,
  subtitle,
  onTitleClick,
  ownerAddress,
  identiconAddress,
  identiconId,
  identiconSize = 180,
}: ProfileHeroProps) {
  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <div
          className="profile-hero-title"
          onClick={onTitleClick}
          style={{ cursor: onTitleClick ? 'pointer' : 'default' }}
        >
          {title}
        </div>
        {subtitle && <div className="profile-hero-subtitle">{subtitle}</div>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', width: '100%' }}>
        <Identicon address={identiconAddress} proquintId={identiconId} size={identiconSize} />
        <a href={`/${ownerAddress}`} style={{ ...addressStyle, textDecoration: 'none', width: '100%' }}>
          {ownerAddress}
        </a>
      </div>
    </>
  )
}
