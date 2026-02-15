import blockies from 'ethereum-blockies-base64'
import { useEffect, useMemo, useState } from 'react'
import { useReadContract } from 'wagmi'
import { CONTRACTS } from '../../libs/contracts'
import { PROQUINT_ABI } from '../../libs/abi/ERC721ABI'
import { normalizeBytes4 } from '../../libs/proquint'

const isDebug =
  typeof import.meta !== 'undefined' &&
  Boolean((import.meta as Record<string, any>)?.env?.MODE !== 'production')

interface IdenticonProps {
  address?: string | null
  proquintId?: `0x${string}` | null
  size?: number
  onImageTypeChange?: (hasTokenImage: boolean) => void
}

export function Identicon({ address, proquintId, size = 40, onImageTypeChange }: IdenticonProps) {
  const normalizedId = useMemo(() => {
    if (!proquintId || proquintId === '0x00000000') return null
    try {
      return normalizeBytes4(proquintId)
    } catch {
      return proquintId
    }
  }, [proquintId])

  const numericTokenId = useMemo(() => {
    if (!normalizedId) return null
    try {
      return BigInt(normalizedId)
    } catch {
      return null
    }
  }, [normalizedId])

  const { data: expiryData } = useReadContract({
    address: CONTRACTS.ProquintNFT,
    abi: PROQUINT_ABI,
    functionName: 'getExpiry',
    args: normalizedId ? [normalizedId] : undefined,
    query: { enabled: Boolean(normalizedId) },
  })

  const expiry = expiryData as bigint | undefined
  const hasActiveRecord = !!expiry && expiry > 0n

  const { data: tokenUriData } = useReadContract({
    address: CONTRACTS.ProquintNFT,
    abi: PROQUINT_ABI,
    functionName: 'tokenURI',
    args: numericTokenId ? [numericTokenId] : undefined,
    query: { enabled: Boolean(numericTokenId && hasActiveRecord) },
  })

  const tokenUri = tokenUriData as string | undefined

  const [imageSrc, setImageSrc] = useState<string | null>(null)

  useEffect(() => {
    if (isDebug) {
      console.debug('[Identicon]', {
        proquintId,
        normalizedId,
        numericTokenId: numericTokenId?.toString(),
        expiry: expiry?.toString(),
        hasActiveRecord,
        tokenUriSample: tokenUri ? `${tokenUri.slice(0, 120)}${tokenUri.length > 120 ? '…' : ''}` : null,
      })
    }
  }, [proquintId, normalizedId, numericTokenId, expiry, hasActiveRecord, tokenUri])

  useEffect(() => {
    if (!tokenUri) {
      setImageSrc(null)
      if (isDebug) {
        console.debug('[Identicon] No tokenURI available', { proquintId })
      }
      return
    }

    const parsed = extractImageFromTokenURI(tokenUri)
    if (!parsed && isDebug) {
      console.warn('[Identicon] Failed to extract image from tokenURI', { proquintId, tokenUri })
    }
    setImageSrc(parsed)
  }, [tokenUri, proquintId])

  useEffect(() => {
    onImageTypeChange?.(Boolean(imageSrc))
  }, [imageSrc, onImageTypeChange])

  const fallback = useMemo(() => {
    if (!address) return ''
    return blockies(address.toLowerCase())
  }, [address])

  const src = imageSrc ?? fallback
  const alt = imageSrc ? 'proquint token' : 'identicon'

  if (!src) return null

  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      style={{
        borderRadius: '0.5rem',
        display: 'block',
        imageRendering: imageSrc ? 'auto' : 'pixelated',
        objectFit: 'cover',
      }}
    />
  )
}

function extractImageFromTokenURI(uri: string): string | null {
  if (!uri) return null

  if (uri.startsWith('data:application/json')) {
    const commaIndex = uri.indexOf(',')
    if (commaIndex === -1) return null

    const payload = uri.slice(commaIndex + 1).trim()
    const jsonString =
      payload.startsWith('{')
        ? payload
        : safeDecodeBase64(payload) ?? safeDecodeURIComponent(payload)

    if (!jsonString) return null

    try {
      const metadata = JSON.parse(jsonString)
      if (typeof metadata.image === 'string' && metadata.image.length > 0) {
        return metadata.image
      }
      if (typeof metadata.image_data === 'string' && metadata.image_data.length > 0) {
        return metadata.image_data
      }
    } catch {
      return null
    }
  }

  try {
    const parsed = JSON.parse(uri)
    if (typeof parsed.image === 'string' && parsed.image.length > 0) {
      return parsed.image
    }
  } catch {
    // Not JSON, fall through
  }

  if (uri.startsWith('data:image') || uri.startsWith('http')) {
    return uri
  }

  return null
}

function safeDecodeBase64(value: string): string | null {
  if (typeof globalThis !== 'undefined' && typeof globalThis.atob === 'function') {
    try {
      return globalThis.atob(value)
    } catch {
      // continue to other decoding strategies
    }
  }

  const nodeBuffer = (globalThis as Record<string, any>)?.Buffer
  if (nodeBuffer) {
    try {
      return nodeBuffer.from(value, 'base64').toString('utf-8')
    } catch {
      // fallthrough
    }
  }

  return null
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}
