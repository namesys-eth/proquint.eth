import { http, createConfig, fallback, createStorage } from 'wagmi'
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

// Batching config for multicall (viem batches read calls automatically)
const BATCH_CONFIG = { multicall: { batchSize: 64, wait: 16 } }

// Mainnet public RPC fallbacks (free tier)
const MAINNET_RPC_URLS = [
  'https://eth.llamarpc.com',
  'https://rpc.ankr.com/eth',
  'https://cloudflare-eth.com',
]

export function buildWagmiConfig() {
  const cfg = loadConfig()
  const chain: Chain = cfg.chainId === 31337 ? anvil : mainnet
  const customRpc = cfg.rpcUrl

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

  // Build transport based on network
  let transport
  
  if (chain.id === 31337) {
    // Anvil: single RPC with batching (no fallback needed, local is fast)
    transport = http(customRpc || 'http://localhost:8545', {
      batch: { batchSize: 64, wait: 16 }, // Enable JSON-RPC batching
    })
  } else {
    // Mainnet: fallback transport with batching on each endpoint
    const transports = [
      http(customRpc || MAINNET_RPC_URLS[0], { batch: { batchSize: 64, wait: 16 } }),
      ...MAINNET_RPC_URLS.slice(customRpc ? 0 : 1).map(url => 
        http(url, { batch: { batchSize: 64, wait: 16 } })
      ),
    ]
    transport = fallback(transports, {
      rank: {
        interval: 60_000, // Re-rank every 60s
        sampleCount: 3,   // Sample 3 requests
        timeout: 1_000,   // 1s timeout per sample
      },
      retryCount: 2,
      retryDelay: 100,
    })
  }

  return createConfig({
    chains: [chain],
    connectors,
    transports: {
      [chain.id]: transport,
    },
    // Persistent storage for connection state
    storage: createStorage({
      storage: typeof window !== 'undefined' && window.localStorage ? window.localStorage : undefined,
    }),
    // Multicall batching at config level (works with viem's client)
    batch: BATCH_CONFIG,
    // Cache read results for 6s (reduces RPC calls)
    cacheTime: 6_000,
    // Poll every 6s instead of default 4s
    pollingInterval: 6_000,
    // Keep chain in sync with wallet
    syncConnectedChain: true,
    // Disable SSR for now (no hydration mismatch)
    ssr: false,
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
