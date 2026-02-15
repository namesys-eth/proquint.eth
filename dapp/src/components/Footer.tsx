import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer style={{
      marginTop: 'auto',
      padding: '2rem 1rem',
      borderTop: '1px solid var(--border)',
      backgroundColor: 'var(--bg-secondary)',
      fontSize: '0.875rem',
      color: 'var(--text-dim)'
    }}>
      <div className="container" style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        alignItems: 'center',
        textAlign: 'center'
      }}>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link 
            to="/docs" 
            style={{ 
              color: 'var(--accent)', 
              textDecoration: 'none',
              fontWeight: 500
            }}
          >
            Documentation
          </Link>
          <a 
            href="https://github.com/namesys-eth" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ 
              color: 'var(--accent)', 
              textDecoration: 'none',
              fontWeight: 500
            }}
          >
            GitHub ↗
          </a>
        </div>
        
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '0.4rem',
          fontSize: '0.75rem'
        }}>
          <div>
            Based on{' '}
            <a 
              href="https://arxiv.org/abs/0901.4016" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: 'var(--text-dim)', textDecoration: 'underline', textUnderlineOffset: '2px' }}
            >
              <em>Proquints: Identifiers that Are Readable, Spellable, and Pronounceable</em>
            </a>
            {' '}(2009) by Daniel S. Wilkerson
          </div>
          <div>
            <strong>Proquint Name System</strong> (v0.1.0) by{' '}
            <a 
              href="https://github.com/namesys-eth" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: 'var(--accent)', textDecoration: 'none' }}
            >
              NameSys.eth
            </a>
            {' · '}License: <strong>WTFPL.ETH</strong>
          </div>
        </div>
      </div>
    </footer>
  )
}
