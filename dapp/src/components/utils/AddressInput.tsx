import { useState, useEffect, useMemo } from 'react'
import { usePublicClient } from 'wagmi'
import { normalize } from 'viem/ens'
import { mainnet } from 'wagmi/chains'
import { createPublicClient, http } from 'viem'
import { proquintToBytes4 } from '../../libs/proquint'
import { CONTRACTS } from '../../libs/contracts'
import { PROQUINT_ABI } from '../../libs/abi/ERC721ABI'

interface AddressInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  currentAddress?: string
  showHelperText?: boolean
  onResolvedChange?: (resolved: string | null) => void
  showResolvedSummary?: boolean
  styleOverrides?: React.CSSProperties
}

export function AddressInput({ value, onChange, placeholder, currentAddress, showHelperText = true, onResolvedChange, showResolvedSummary = true, styleOverrides }: AddressInputProps) {
  const [resolving, setResolving] = useState(false)
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const localClient = usePublicClient()

  // Create mainnet client for ENS resolution - memoize to prevent recreation
  const mainnetClient = useMemo(() => createPublicClient({
    chain: mainnet,
    transport: http()
  }), [])

  useEffect(() => {
    const resolveInput = async () => {
      if (!value || value.startsWith('0x')) {
        setResolvedAddress(null)
        setResolveError(null)
        if (onResolvedChange) onResolvedChange(null)
        return
      }

      setResolving(true)
      setResolveError(null)

      try {
        // Check if it's a proquint name (format: CVCVC-CVCVC)
        if (value.includes('-') && value.length === 11) {
          try {
            const proquintId = proquintToBytes4(value)
            // Get owner of this proquint ID
            const owner = await localClient?.readContract({
              address: CONTRACTS.ProquintNFT,
              abi: PROQUINT_ABI,
              functionName: 'owner',
              args: [proquintId],
            })
            
            if (owner && owner !== '0x0000000000000000000000000000000000000000') {
              setResolvedAddress(owner as string)
              if (onResolvedChange) onResolvedChange(owner as string)
              setResolving(false)
              return
            } else {
              setResolveError('Proquint name not registered')
            }
          } catch (err) {
            setResolveError('Invalid proquint name')
          }
        }

        // Try ENS resolution
        if (value.endsWith('.eth')) {
          try {
            const ensAddress = await mainnetClient.getEnsAddress({
              name: normalize(value),
            })
            
            if (ensAddress) {
              setResolvedAddress(ensAddress)
              if (onResolvedChange) onResolvedChange(ensAddress)
            } else {
            }
          } catch (err) {
            setResolveError('Invalid ENS name')
          }
        }
      } catch (err) {
        console.error('Resolution error:', err)
        setResolveError('Failed to resolve')
      }

      setResolving(false)
    }

    const timer = setTimeout(resolveInput, 500)
    return () => clearTimeout(timer)
  }, [value, localClient, mainnetClient])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)
    
    // If resolved address exists and user is typing, use the resolved address
    if (resolvedAddress && !newValue.startsWith('0x')) {
      // Keep the resolved address in the background
    } else {
      setResolvedAddress(null)
    }
  }

  // Use resolved address if available, otherwise use input value
  const effectiveValue = resolvedAddress || value

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={value}
          onChange={handleChange}
          placeholder={placeholder || '0x... or name.eth or babab-babab'}
          style={{ 
            fontFamily: "'SF Mono', 'Monaco', monospace",
            width: '100%',
            ...styleOverrides,
          }}
        />
        {resolving && (
          <div style={{ 
            position: 'absolute', 
            right: '1rem', 
            top: '50%', 
            transform: 'translateY(-50%)',
            color: 'var(--text-dim)',
            fontSize: '0.875rem'
          }}>
            Resolving...
          </div>
        )}
      </div>
      {resolvedAddress && showResolvedSummary && (
        <div style={{ 
          marginTop: '0.5rem', 
          fontSize: '0.875rem', 
          color: 'var(--primary)',
          fontFamily: "'SF Mono', 'Monaco', monospace"
        }}>
          ✓ Resolved to: {resolvedAddress.slice(0, 6)}...{resolvedAddress.slice(-4)}
        </div>
      )}
      {resolveError && (
        <div style={{ 
          marginTop: '0.5rem', 
          fontSize: '0.875rem', 
          color: 'var(--danger)'
        }}>
          {resolveError}
        </div>
      )}
      {showHelperText && (
        <small style={{ color: 'var(--text-dim)', display: 'block', marginTop: '0.75rem', fontSize: '0.95rem' }}>
          {effectiveValue && effectiveValue !== currentAddress ? '⚠️ Minting to another address' : 'Leave empty to mint to your address'}
        </small>
      )}
    </div>
  )
}
