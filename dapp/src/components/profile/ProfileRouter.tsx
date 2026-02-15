import { useParams } from 'react-router-dom'
import { ProfileDefault } from './ProfileDefault'
import { ProfileAddress } from './ProfileAddress'
import { ProfileInbox } from './ProfileInbox'

export function ProfileRouter() {
  const { param } = useParams<{ param: string }>()

  // No param = default profile
  if (!param) {
    return <ProfileDefault />
  }

  // Check if it's a proquint format (xxxxx-xxxxx)
  const isProquint = param.match(/^[a-z]{5}-[a-z]{5}$/)
  
  if (isProquint) {
    return <ProfileInbox />
  }

  // Otherwise treat as address (0x... or ENS)
  return <ProfileAddress />
}
