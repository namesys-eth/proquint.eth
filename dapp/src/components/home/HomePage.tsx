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
      <div style={{ textAlign: 'center', padding: '2.5rem 0 1.5rem' }}>
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
        <p style={{ color: 'var(--text)', fontSize: '1rem', lineHeight: 1.6, maxWidth: '480px', margin: '0 auto 1.75rem' }}>
          Human Readable, Spellable, Pronounceable Identifier on Ethereum.
        </p>
        
        <button 
          onClick={() => navigate('/register')} 
          style={{ padding: '0.75rem 2rem', fontSize: '0.95rem', fontWeight: 600 }}
        >
          Get a Name
        </button>
      </div>

      {/* Stats */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: '2rem', flexWrap: 'wrap',
        padding: '1rem 0', margin: '0 0 1rem',
        borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
      }}>
        {[
          { label: 'Names', val: supply },
          { label: 'Active', val: active },
          { label: 'Inbox', val: inboxed },
        ].map(({ label, val }) => (
          <div key={label} style={{ textAlign: 'center', minWidth: '70px' }}>
            <div style={{ ...mono, fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent)' }}>{val.toLocaleString()}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* The Alphabet */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1.5rem 0 0.75rem' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          The Alphabet
        </span>
        <span style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      </div>
      <div className="card" style={{ padding: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <div style={{ flex: 1, padding: '0.6rem', background: 'var(--bg)', borderRadius: '4px', border: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>C</span>onsonants (4 bits)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.15rem', justifyContent: 'center' }}>
              {CONSONANTS.map(c => (
                <span key={c} style={{ ...mono, fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent)', width: '1rem', textAlign: 'center' }}>{c}</span>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, padding: '0.6rem', background: 'var(--bg)', borderRadius: '4px', border: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <span style={{ color: 'var(--warning)', fontWeight: 700 }}>V</span>owels (2 bits)
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              {VOWELS.map(v => (
                <span key={v} style={{ ...mono, fontSize: '0.8rem', fontWeight: 600, color: 'var(--warning)', width: '1rem', textAlign: 'center' }}>{v}</span>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '2px', flexWrap: 'wrap' }}>
          {['C','V','C','V','C'].map((ch, i) => (
            <div key={i} style={{
              ...mono,
              flex: ch === 'C' ? '1 1 0' : '0.7 1 0',
              maxWidth: ch === 'C' ? '2.5rem' : '1.8rem',
              minWidth: ch === 'C' ? '1.6rem' : '1.2rem',
              padding: '0.35rem 0',
              textAlign: 'center',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 700,
              background: ch === 'C' ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'color-mix(in srgb, var(--warning) 10%, transparent)',
              color: ch === 'C' ? 'var(--accent)' : 'var(--warning)',
              border: `1px solid ${ch === 'C' ? 'color-mix(in srgb, var(--accent) 20%, transparent)' : 'color-mix(in srgb, var(--warning) 20%, transparent)'}`,
            }}>
              {ch}
            </div>
          ))}
          <div style={{ ...mono, alignSelf: 'center', color: 'var(--text-dim)', fontSize: '0.8rem', padding: '0 0.1rem' }}>-</div>
          {['C','V','C','V','C'].map((ch, i) => (
            <div key={`b${i}`} style={{
              ...mono,
              flex: ch === 'C' ? '1 1 0' : '0.7 1 0',
              maxWidth: ch === 'C' ? '2.5rem' : '1.8rem',
              minWidth: ch === 'C' ? '1.6rem' : '1.2rem',
              padding: '0.35rem 0',
              textAlign: 'center',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 700,
              background: ch === 'C' ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'color-mix(in srgb, var(--warning) 10%, transparent)',
              color: ch === 'C' ? 'var(--accent)' : 'var(--warning)',
              border: `1px solid ${ch === 'C' ? 'color-mix(in srgb, var(--accent) 20%, transparent)' : 'color-mix(in srgb, var(--warning) 20%, transparent)'}`,
            }}>
              {ch}
            </div>
          ))}
        </div>
      </div>

      {/* The Namespace */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1.5rem 0 0.75rem' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          The Namespace
        </span>
        <span style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
        {[
          { label: 'Max Supply', val: '2.1B', sub: '50% of 2³²' },
          { label: 'Twins', val: '65,536', sub: 'Palindromes' },
        ].map(({ label, val, sub }) => (
          <div key={label} style={{ textAlign: 'center', padding: '0.6rem', background: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)' }}>
            <div style={{ ...mono, fontSize: 'clamp(0.9rem, 2vw, 1.1rem)', fontWeight: 700, color: 'var(--accent)' }}>{val}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text)', fontWeight: 500 }}>{label}</div>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* How It Works */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1.5rem 0 0.75rem' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          How It Works
        </span>
        <span style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
        {[
          { title: 'Say It Out Loud', desc: 'Names like TOBAM-HABOB, VUJOH-BUGOV. Easy to say and remember.' },
          { title: '32 Bits', desc: 'Every address maps to a unique CVCVC-CVCVC pattern.' },
          { title: 'Commit & Reveal', desc: 'Two-step to prevent front-running. Wait 60s, then register.' },
          { title: 'Fair Pricing', desc: 'Cheap for 1 year. Exponential cost for more. Prevents bots.' },
        ].map(({ title, desc }) => (
          <div key={title} style={{
            padding: '0.75rem 1rem',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
          }}>
            <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--accent)', marginBottom: '0.2rem' }}>{title}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>{desc}</div>
          </div>
        ))}
      </div>

      {/* One Primary + Inbox */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1.5rem 0 0.75rem' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          One Primary + Inbox
        </span>
        <span style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
        {[
          { title: 'One Name Per Address', desc: 'Each address has one primary. Extras go to inbox.' },
          { title: 'Claim Window', desc: '42 days for first item. Decays to 7 days.' },
          { title: 'Open Claim', desc: 'After 7 days, anyone can claim on your behalf.' },
          { title: 'Burn or Keep', desc: 'Reject for refund, or accept as primary.' },
        ].map(({ title, desc }) => (
          <div key={title} style={{
            padding: '0.75rem 1rem',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
          }}>
            <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--accent)', marginBottom: '0.2rem' }}>{title}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>{desc}</div>
          </div>
        ))}
      </div>

    </div>
  )
}
