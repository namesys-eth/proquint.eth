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

  // Check if it's a proquint format (xxxxx-xxxxx) - case insensitive
  const isProquint = param.match(/^[a-zA-Z]{5}-[a-zA-Z]{5}$/)
  
  if (isProquint) {
    return <ProfileInbox />
  }

  // Otherwise treat as address (0x... or ENS)
  return <ProfileAddress />
}
