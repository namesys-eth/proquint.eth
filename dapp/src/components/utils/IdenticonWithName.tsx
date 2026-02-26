import { Identicon } from './Identicon'
import { monoStyle } from './styles'

interface IdenticonWithNameProps {
  address: string
  proquintId?: `0x${string}` | null
  proquint: string
  size?: number
}

export function IdenticonWithName({ 
  address, 
  proquintId, 
  proquint, 
  size = 200 
}: IdenticonWithNameProps) {
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: `${size}px`, margin: '0 auto' }}>
      <Identicon address={address} proquintId={proquintId} size={size} />
      <div style={{
        position: 'absolute', 
        bottom: 0, 
        left: 0, 
        right: 0,
        padding: '0.35rem 3%',
        backgroundColor: 'rgba(0,0,0,0.7)', 
        color: 'white',
        fontSize: proquint.length > 11 ? '0.9rem' : '1.1rem',
        fontWeight: 700, 
        textAlign: 'center',
        borderBottomLeftRadius: '0.5rem', 
        borderBottomRightRadius: '0.5rem',
        letterSpacing: '0.03em',
        ...monoStyle, 
        whiteSpace: 'nowrap', 
        overflow: 'hidden', 
        textOverflow: 'ellipsis'
      }}>
        {proquint.toUpperCase()}
      </div>
    </div>
  )
}
