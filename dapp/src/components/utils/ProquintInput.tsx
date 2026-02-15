import { useEffect, useRef, useState } from 'react'
import { proquintToBytes4, bytes4ToProquint, normalizeProquint } from '../../libs/proquint'

interface ProquintInputProps {
  value: string
  onChange: (value: string) => void
  showRandom?: boolean
  showBytes4?: boolean
}

export function ProquintInput({ value, onChange, showRandom = true, showBytes4 = false }: ProquintInputProps) {
  const [first, setFirst] = useState('')
  const [second, setSecond] = useState('')
  const [hexInput, setHexInput] = useState('')
  const editingHex = useRef(false)

  // Sync proquint halves + hex from external value changes (not from hex editing)
  useEffect(() => {
    const [a = '', b = ''] = value.split('-')
    setFirst(a)
    setSecond(b)
    if (!editingHex.current && showBytes4) {
      try {
        if (a.length === 5 && b.length === 5) {
          setHexInput(proquintToBytes4(value))
        }
      } catch { /* incomplete proquint */ }
    }
  }, [value, showBytes4])

  const handlePartChange = (part: 'first' | 'second', raw: string) => {
    editingHex.current = false
    const cleaned = raw.toLowerCase().replace(/[^a-z]/g, '').slice(0, 5)
    const nextFirst = part === 'first' ? cleaned : first
    const nextSecond = part === 'second' ? cleaned : second
    setFirst(nextFirst)
    setSecond(nextSecond)
    onChange([nextFirst, nextSecond].filter(Boolean).join('-'))
  }

  const handleHexChange = (raw: string) => {
    editingHex.current = true
    const cleaned = raw.toLowerCase().replace(/[^0-9a-fx]/g, '').slice(0, 10)
    setHexInput(cleaned)
    // Only convert when we have a complete bytes4 (0x + 8 hex chars)
    if (cleaned.length === 10 && cleaned.startsWith('0x')) {
      try {
        const pq = bytes4ToProquint(cleaned as `0x${string}`)
        onChange(pq)
        editingHex.current = false
      } catch { /* invalid */ }
    }
  }

  const handleRandom = () => {
    editingHex.current = false
    const consonants = 'bdfghjklmnprstvz'
    const vowels = 'aiou'
    const gen = () => {
      let s = ''
      for (let i = 0; i < 5; i++) {
        s += (i % 2 === 0 ? consonants : vowels)[Math.floor(Math.random() * (i % 2 === 0 ? 16 : 4))]
      }
      return s
    }
    const generated = `${gen()}-${gen()}`
    try { onChange(normalizeProquint(generated)) } catch { onChange(generated) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <input
          type="text"
          value={first.toUpperCase()}
          onChange={(e) => handlePartChange('first', e.target.value)}
          placeholder="CVCVC"
          maxLength={5}
          style={{
            flex: 1,
            fontFamily: "'SF Mono', 'Monaco', monospace",
            textTransform: 'uppercase',
            fontSize: '1.15rem',
            padding: '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.05em'
          }}
        />
        <span style={{ color: 'var(--text-dim)', fontSize: '1.25rem', fontWeight: 700 }}>-</span>
        <input
          type="text"
          value={second.toUpperCase()}
          onChange={(e) => handlePartChange('second', e.target.value)}
          placeholder="CVCVC"
          maxLength={5}
          style={{
            flex: 1,
            fontFamily: "'SF Mono', 'Monaco', monospace",
            textTransform: 'uppercase',
            fontSize: '1.15rem',
            padding: '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.05em'
          }}
        />
        {showRandom && (
          <button type="button" onClick={handleRandom} style={{ padding: '0.75rem', minWidth: 'auto', fontSize: '1.1rem' }}>
            🎲
          </button>
        )}
      </div>

      {showBytes4 && (
        <input
          id="hex-input"
          type="text"
          value={hexInput}
          onChange={(e) => handleHexChange(e.target.value)}
          placeholder="0x00000000"
          maxLength={10}
          style={{
            fontFamily: "'SF Mono', 'Monaco', monospace",
            fontSize: '0.9rem',
            padding: '0.6rem 0.75rem',
            color: 'var(--text-dim)'
          }}
        />
      )}
    </div>
  )
}
