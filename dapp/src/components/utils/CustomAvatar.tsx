import type { AvatarComponent } from '@rainbow-me/rainbowkit'
import { Identicon } from './Identicon'

export const CustomAvatar: AvatarComponent = ({ address, ensImage, size }) => {
  return ensImage ? (
    <img
      src={ensImage}
      width={size}
      height={size}
      style={{ borderRadius: 999 }}
      alt="Avatar"
    />
  ) : (
    <Identicon address={address} size={size} />
  )
}
