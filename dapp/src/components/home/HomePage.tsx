import { useReadContract } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback, useRef } from 'react'
import { CONTRACTS } from '../../libs/contracts'
import { PROQUINT_ABI } from '../../libs/abi/ERC721ABI'
import { generateRandomProquint, proquintToBytes4 } from '../../libs/proquint'

const mono: React.CSSProperties = { fontFamily: "'SF Mono', 'Monaco', 'Consolas', monospace" }

const CONSONANTS = 'b d f g h j k l m n p r s t v z'.split(' ')
const VOWELS = 'a i o u'.split(' ')

// Pattern: C V C V C - C V C V C
const PATTERN = [0,1,0,1,0,0,1,0,1,0] // 0=consonant, 1=vowel

function randomChar(isVowel: boolean): string {
  const set = isVowel ? VOWELS : CONSONANTS
  return set[Math.floor(Math.random() * set.length)]
}

function useSlotMachine(intervalMs = 6000) {
  const [display, setDisplay] = useState<string[]>(() => {
    const name = generateRandomProquint()
    return name.replace('-', '').split('')
  })
  const [settled, setSettled] = useState<boolean[]>(new Array(10).fill(true))
  const [hexId, setHexId] = useState(() => {
    const name = generateRandomProquint()
    try { return proquintToBytes4(name) } catch { return '0x00000000' }
  })
  const targetRef = useRef<string[]>(display)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  const startSpin = useCallback(() => {
    const name = generateRandomProquint()
    const target = name.replace('-', '').split('')
    targetRef.current = target
    try { setHexId(proquintToBytes4(name)) } catch { /* */ }

    // Start all spinning
    setSettled(new Array(10).fill(false))

    // Spin each character rapidly, then settle one by one (staggered)
    const spinIntervals: ReturnType<typeof setInterval>[] = []

    for (let i = 0; i < 10; i++) {
      const isVowel = PATTERN[i] === 1
      const spinId = setInterval(() => {
        setDisplay(prev => {
          const next = [...prev]
          next[i] = randomChar(isVowel)
          return next
        })
      }, 50 + Math.random() * 30)
      spinIntervals.push(spinId)

      // Settle this character after staggered delay (slot machine effect)
      setTimeout(() => {
        clearInterval(spinIntervals[i])
        setDisplay(prev => {
          const next = [...prev]
          next[i] = targetRef.current[i]
          return next
        })
        setSettled(prev => {
          const next = [...prev]
          next[i] = true
          return next
        })
      }, 400 + i * 120 + Math.random() * 80)
    }
  }, [])

  useEffect(() => {
    // Initial spin after a short delay
    const initialTimeout = setTimeout(startSpin, 800)

    const id = setInterval(startSpin, intervalMs)
    return () => {
      clearTimeout(initialTimeout)
      clearInterval(id)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [startSpin, intervalMs])

  // Format as XXXXX-XXXXX
  const formatted = display.slice(0, 5).join('') + '-' + display.slice(5).join('')
  return { formatted, settled, hexId }
}

export function HomePage() {
  const navigate = useNavigate()
  const { formatted, settled, hexId } = useSlotMachine(5000)
  const { data: totalSupply } = useReadContract({
    address: CONTRACTS.ProquintNFT,
    abi: PROQUINT_ABI,
    functionName: 'totalSupply',
  })
  const { data: totalInbox } = useReadContract({
    address: CONTRACTS.ProquintNFT,
    abi: PROQUINT_ABI,
    functionName: 'totalInbox',
  })

  const supply = totalSupply ? Number(totalSupply) : 0
  const inboxed = totalInbox ? Number(totalInbox) : 0
  const active = supply - inboxed

  const allSettled = settled.every(Boolean)

  return (
    <div className="container">
      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '2rem 0 1rem' }}>
        <div style={{
          ...mono,
          fontSize: 'clamp(2.5rem, 8vw, 4.5rem)',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: 'var(--accent)',
          lineHeight: 1.1,
          marginBottom: '0.25rem',
          display: 'inline-flex',
          alignItems: 'baseline',
        }}>
          {formatted.split('').map((ch, i) => {
            // Map display index to settled index (skip the dash at position 5)
            const settledIdx = i < 5 ? i : i > 5 ? i - 1 : -1
            const isSettled = settledIdx === -1 || settled[settledIdx]
            const isDash = ch === '-'
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  textTransform: 'uppercase',
                  transition: isSettled ? 'opacity 0.3s, transform 0.3s' : 'none',
                  opacity: isDash ? 0.4 : isSettled ? 1 : 0.35,
                  transform: isSettled ? 'translateY(0)' : 'translateY(-2px)',
                  minWidth: isDash ? '0.3em' : '0.55em',
                  textAlign: 'center',
                }}
              >
                {ch}
              </span>
            )
          })}
        </div>
        <div style={{
          ...mono,
          fontSize: 'clamp(0.7rem, 2vw, 0.9rem)',
          color: 'var(--text-dim)',
          letterSpacing: '0.05em',
          marginBottom: '1.5rem',
          transition: 'opacity 0.4s',
          opacity: allSettled ? 0.7 : 0.3,
        }}>
          {hexId}
        </div>
        <p style={{ color: 'var(--text)', fontSize: '1.05rem', lineHeight: 1.6, maxWidth: '520px', margin: '0 auto 2rem' }}>
          Human-Readable, Spellable, Pronounceable Identifiers on Ethereum
        </p>
        <button onClick={() => navigate('/register')} style={{ padding: '0.75rem 2.5rem', fontSize: '1rem', fontWeight: 600 }}>
          Register a Name
        </button>
      </div>

      {/* Stats bar */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: '2rem', flexWrap: 'wrap',
        padding: '1rem 0', margin: '0.5rem 0 1rem',
        borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
      }}>
        {[
          { label: 'Registered', val: supply },
          { label: 'Active', val: active },
          { label: 'In Inbox', val: inboxed },
        ].map(({ label, val }) => (
          <div key={label} style={{ textAlign: 'center', minWidth: '80px' }}>
            <div style={{ ...mono, fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent)' }}>{val.toLocaleString()}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Encoding Schema */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--accent)' }}>Encoding Schema</span>
          <span style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        </div>

        {/* Alphabet grid — first */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <div style={{ padding: '0.75rem', background: 'var(--bg)', borderRadius: '6px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>16 Consonants · 4 bits</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
              {CONSONANTS.map(c => (
                <span key={c} style={{ ...mono, fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent)', width: '1.2rem', textAlign: 'center' }}>{c}</span>
              ))}
            </div>
          </div>
          <div style={{ padding: '0.75rem', background: 'var(--bg)', borderRadius: '6px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>4 Vowels · 2 bits</div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {VOWELS.map(v => (
                <span key={v} style={{ ...mono, fontSize: '0.9rem', fontWeight: 600, color: 'var(--warning)', width: '1.2rem', textAlign: 'center' }}>{v}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Pattern breakdown */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '2px', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {['C','V','C','V','C'].map((ch, i) => (
            <div key={i} style={{
              ...mono,
              flex: ch === 'C' ? '1 1 0' : '0.7 1 0',
              maxWidth: ch === 'C' ? '3rem' : '2rem',
              minWidth: ch === 'C' ? '2rem' : '1.4rem',
              padding: '0.45rem 0',
              textAlign: 'center',
              borderRadius: '4px',
              fontSize: 'clamp(0.7rem, 2vw, 0.85rem)',
              fontWeight: 700,
              background: ch === 'C' ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'color-mix(in srgb, var(--warning) 10%, transparent)',
              color: ch === 'C' ? 'var(--accent)' : 'var(--warning)',
              border: `1px solid ${ch === 'C' ? 'color-mix(in srgb, var(--accent) 20%, transparent)' : 'color-mix(in srgb, var(--warning) 20%, transparent)'}`,
            }}>
              <div>{ch}</div>
              <div style={{ fontSize: '0.55rem', opacity: 0.7, marginTop: '1px' }}>{ch === 'C' ? '4b' : '2b'}</div>
            </div>
          ))}
          <div style={{ ...mono, alignSelf: 'center', color: 'var(--text-dim)', fontSize: '0.9rem', padding: '0 0.15rem', flexShrink: 0 }}>-</div>
          {['C','V','C','V','C'].map((ch, i) => (
            <div key={`b${i}`} style={{
              ...mono,
              flex: ch === 'C' ? '1 1 0' : '0.7 1 0',
              maxWidth: ch === 'C' ? '3rem' : '2rem',
              minWidth: ch === 'C' ? '2rem' : '1.4rem',
              padding: '0.45rem 0',
              textAlign: 'center',
              borderRadius: '4px',
              fontSize: 'clamp(0.7rem, 2vw, 0.85rem)',
              fontWeight: 700,
              background: ch === 'C' ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'color-mix(in srgb, var(--warning) 10%, transparent)',
              color: ch === 'C' ? 'var(--accent)' : 'var(--warning)',
              border: `1px solid ${ch === 'C' ? 'color-mix(in srgb, var(--accent) 20%, transparent)' : 'color-mix(in srgb, var(--warning) 20%, transparent)'}`,
            }}>
              <div>{ch}</div>
              <div style={{ fontSize: '0.55rem', opacity: 0.7, marginTop: '1px' }}>{ch === 'C' ? '4b' : '2b'}</div>
            </div>
          ))}
        </div>

        {/* Supply stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div style={{ padding: '0.6rem', background: 'var(--bg)', borderRadius: '6px', border: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ ...mono, fontSize: 'clamp(0.85rem, 2.5vw, 1.05rem)', fontWeight: 700, color: 'var(--accent)' }}>2,147,516,416</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Max Supply</div>
          </div>
          <div style={{ padding: '0.6rem', background: 'var(--bg)', borderRadius: '6px', border: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ ...mono, fontSize: 'clamp(0.85rem, 2.5vw, 1.05rem)', fontWeight: 700, color: 'var(--accent)' }}>65,536</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Palindromes</div>
          </div>
        </div>
      </div>

      {/* Registration */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0 0.75rem', padding: '0 0.25rem' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent)' }}>Registration</span>
        <span style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
        {[
          { title: 'Commit-Reveal', desc: 'Two-step registration prevents front-running.' },
          { title: 'Exponential Pricing', desc: '(2ʸ − 1) × 0.00024 ETH per year. Palindromes 5×.' },
          { title: 'One Primary', desc: 'One active name per address. Extras go to inbox.' },
          { title: 'ERC-721', desc: 'Standard NFT. Transferable and tradeable.' },
        ].map(({ title, desc }) => (
          <div key={title} style={{
            padding: '0.85rem 1rem',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            textAlign: 'center',
          }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--accent)', marginBottom: '0.25rem' }}>{title}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>{desc}</div>
          </div>
        ))}
      </div>

      {/* Inbox System */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0 0.75rem', padding: '0 0.25rem' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent)' }}>Inbox System</span>
        <span style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
        {[
          { title: 'Claim Window', desc: 'Decaying: 42d (first item) → 7d (255th). Max 255 per address.' },
          { title: 'Open Claim', desc: '7d after expiry, anyone can accept on owner\'s behalf.' },
          { title: 'Burn & Refund', desc: 'Owner rejects for refund. Others burn after open claim for split reward.' },
          { title: 'Shelve', desc: 'Move primary to inbox to free the slot. 7d penalty on expiry.' },
        ].map(({ title, desc }) => (
          <div key={title} style={{
            padding: '0.85rem 1rem',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            textAlign: 'center',
          }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--accent)', marginBottom: '0.25rem' }}>{title}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>{desc}</div>
          </div>
        ))}
      </div>

    </div>
  )
}
