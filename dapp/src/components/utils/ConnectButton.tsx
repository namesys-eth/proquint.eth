import { ConnectButton as RainbowConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useReadContract } from 'wagmi'
import { Identicon } from './Identicon'
import { CONTRACTS } from '../../libs/contracts'
import { PROQUINT_ABI } from '../../libs/abi/ERC721ABI'
import { bytes4ToProquint } from '../../libs/proquint'

export function ConnectButton() {
  const { address } = useAccount()

  const { data: primaryId } = useReadContract({
    address: CONTRACTS.ProquintNFT,
    abi: PROQUINT_ABI,
    functionName: 'primaryName',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const proquintName = primaryId && primaryId !== '0x00000000'
    ? bytes4ToProquint(primaryId as `0x${string}`)
    : null

  return (
    <RainbowConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== 'loading'
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === 'authenticated')

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              style: {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button onClick={openConnectModal} type="button">
                    Connect Wallet
                  </button>
                )
              }

              if (chain.unsupported) {
                return (
                  <button onClick={openChainModal} type="button">
                    Wrong network
                  </button>
                )
              }

              return (
                <button onClick={openAccountModal} type="button" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Identicon address={account.address} proquintId={primaryId && primaryId !== '0x00000000' ? (primaryId as `0x${string}`) : undefined} size={24} />
                  {proquintName ? proquintName.toUpperCase() : `${account.address.slice(0, 6)}...${account.address.slice(-4)}`}
                </button>
              )
            })()}
          </div>
        )
      }}
    </RainbowConnectButton.Custom>
  )
}
