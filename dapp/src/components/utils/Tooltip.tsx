import { useState, useRef, useEffect } from 'react'

interface TooltipProps {
  text: string
  children: React.ReactNode
  position?: 'top' | 'bottom'
}

export function Tooltip({ text, children, position = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState<{ top: boolean }>({ top: position === 'top' })
  const wrapperRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!visible || !wrapperRef.current || !tipRef.current) return
    const rect = wrapperRef.current.getBoundingClientRect()
    const tipH = tipRef.current.offsetHeight
    // Flip if not enough space above
    if (position === 'top' && rect.top < tipH + 8) {
      setCoords({ top: false })
    } else if (position === 'bottom' && window.innerHeight - rect.bottom < tipH + 8) {
      setCoords({ top: true })
    } else {
      setCoords({ top: position === 'top' })
    }
  }, [visible, position])

  if (!text) return <>{children}</>

  return (
    <span
      ref={wrapperRef}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
    >
      {children}
      {visible && (
        <div
          ref={tipRef}
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            ...(coords.top
              ? { bottom: 'calc(100% + 6px)' }
              : { top: 'calc(100% + 6px)' }),
            padding: '0.45rem 0.65rem',
            backgroundColor: 'var(--surface)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            fontSize: '0.78rem',
            lineHeight: 1.45,
            whiteSpace: 'normal',
            width: 'max-content',
            maxWidth: '260px',
            zIndex: 9999,
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            pointerEvents: 'none',
          }}
        >
          {text}
        </div>
      )}
    </span>
  )
}

export function HelpDot({ text, position }: { text: string; position?: 'top' | 'bottom' }) {
  return (
    <Tooltip text={text} position={position}>
      <span style={{
        cursor: 'help',
        fontSize: '0.65rem',
        color: 'var(--text-dim)',
        border: '1px solid var(--border)',
        borderRadius: '50%',
        width: '1rem',
        height: '1rem',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>?</span>
    </Tooltip>
  )
}
