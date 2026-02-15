import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { connectorsForWallets } from '@rainbow-me/rainbowkit'
import {
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
  injectedWallet,
} from '@rainbow-me/rainbowkit/wallets'
import { loadConfig } from './config'
import type { Chain } from 'wagmi/chains'

const anvil: Chain = {
  id: 31337,
  name: 'Anvil',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['http://localhost:8545'] },
  },
}

export function buildWagmiConfig() {
  const cfg = loadConfig()
  const chain: Chain = cfg.chainId === 31337 ? anvil : mainnet
  const rpcUrl = cfg.rpcUrl || undefined // undefined = use chain default

  const connectors = connectorsForWallets(
    [
      {
        groupName: 'Popular',
        wallets: [metaMaskWallet, rainbowWallet, walletConnectWallet, injectedWallet],
      },
    ],
    {
      appName: 'Proquint Name System',
      projectId: 'YOUR_PROJECT_ID',
    },
  )

  return createConfig({
    chains: [chain],
    connectors,
    transports: {
      [chain.id]: http(rpcUrl),
    },
  })
}

export let config = buildWagmiConfig()

// Call this after saving config to rebuild the wagmi config.
// The app must re-mount providers for this to take effect (page reload).
export function reloadConfig() {
  config = buildWagmiConfig()
}

declare module 'wagmi' {
  interface Register {
    config: ReturnType<typeof buildWagmiConfig>
  }
}
