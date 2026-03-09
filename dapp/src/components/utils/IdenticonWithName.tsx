import { Identicon } from './Identicon'

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
  return <Identicon address={address} proquintId={proquintId} size={size} overlayLabel={proquint} />
}
