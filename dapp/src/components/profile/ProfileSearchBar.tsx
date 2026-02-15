import { AddressInput } from '../utils/AddressInput'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface ProfileSearchBarProps {
  initial?: string
}

export function ProfileSearchBar({ initial = '' }: ProfileSearchBarProps) {
  const [value, setValue] = useState(initial)
  const [resolved, setResolved] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleSearch = () => {
    if (!value) return
    const target = resolved || value
    navigate(`/${target}`)
  }

  return (
    <div className="form-group" style={{ marginBottom: '2rem' }}>
      <label>Search Profile</label>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 240px', minWidth: '0' }}>
          <AddressInput
            value={value}
            onChange={setValue}
            placeholder="0x... / name.eth / babab-babab"
            showHelperText={false}
            onResolvedChange={setResolved}
            showResolvedSummary={false}
            styleOverrides={{ minHeight: '48px', fontSize: '1rem', padding: '0.75rem 1rem' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button 
            onClick={handleSearch} 
            style={{ minWidth: '100px', padding: '0.75rem 1.25rem', minHeight: '48px', height: '48px' }}
          >
            Search
          </button>
          <button 
            onClick={() => { setValue(''); setResolved(null); }} 
            className="secondary"
            disabled={!value}
            style={{ minWidth: '100px', padding: '0.75rem 1.25rem', minHeight: '48px', height: '48px' }}
          >
            Clear
          </button>
        </div>
      </div>
      {resolved && (
        <div style={{ 
          marginTop: '0.75rem',
          fontSize: '0.9rem',
          color: 'var(--primary)',
          fontFamily: "'SF Mono', 'Monaco', monospace"
        }}>
          ✓ Resolved to: {resolved.slice(0, 6)}...{resolved.slice(-4)}
        </div>
      )}
    </div>
  )
}
