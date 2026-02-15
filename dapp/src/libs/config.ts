// Persistent app configuration stored in localStorage.
// Allows switching between mainnet, local anvil, or custom RPC endpoints.

const STORAGE_KEY = 'proquint-config'

export interface AppConfig {
  rpcUrl: string
  explorerUrl: string
  contractAddress: string
  chainId: number
}

const DEFAULTS: AppConfig = {
  rpcUrl: '',                    // empty = use wagmi/RainbowKit default
  explorerUrl: 'https://etherscan.io',
  contractAddress: '0x0000000000000000000000000000000000000000',
  chainId: 1,
}

export const PRESETS: Record<string, AppConfig> = {
  mainnet: {
    rpcUrl: '',
    explorerUrl: 'https://etherscan.io',
    contractAddress: '0x0000000000000000000000000000000000000000', // TODO: real address
    chainId: 1,
  },
  anvil: {
    rpcUrl: 'http://localhost:8545',
    explorerUrl: '',
    contractAddress: '0x5fbdb2315678afecb367f032d93f642f64180aa3', // set after deploy
    chainId: 31337,
  },
}

export function loadConfig(): AppConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { ...DEFAULTS, ...parsed }
    }
  } catch {
    // corrupt data — fall back to defaults
  }
  return { ...DEFAULTS }
}

export function saveConfig(cfg: Partial<AppConfig>): AppConfig {
  const current = loadConfig()
  const merged = { ...current, ...cfg }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  return merged
}

export function resetConfig(): AppConfig {
  localStorage.removeItem(STORAGE_KEY)
  return { ...DEFAULTS }
}

// Helper: build explorer tx link
export function explorerTxUrl(hash: string): string {
  const { explorerUrl } = loadConfig()
  if (!explorerUrl) return ''
  return `${explorerUrl}/tx/${hash}`
}

// Helper: build explorer address link
export function explorerAddressUrl(address: string): string {
  const { explorerUrl } = loadConfig()
  if (!explorerUrl) return ''
  return `${explorerUrl}/address/${address}`
}

// Helper: get effective contract address (config override or default)
export function getContractAddress(): `0x${string}` {
  const { contractAddress } = loadConfig()
  if (contractAddress && contractAddress !== '0x0000000000000000000000000000000000000000') {
    return contractAddress as `0x${string}`
  }
  return '0x0000000000000000000000000000000000000000' as `0x${string}`
}
