import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { loadConfig, saveConfig, resetConfig, PRESETS, type AppConfig } from '../libs/config'
import { clearCache } from '../libs/eventCache'
import { ToggleButtons } from './utils/ToggleButtons'
import { useThemeContext } from '../hooks/ThemeContext'
import { useEvents } from '../hooks/EventIndexerContext'

interface ConfigModalProps {
  open: boolean
  onClose: () => void
}

type Section = 'network' | 'indexer' | null

const sectionHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0.75rem 0',
  cursor: 'pointer',
  userSelect: 'none',
  borderTop: '1px solid var(--border)',
}

const sectionTitle: React.CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 600,
  color: 'var(--accent)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const chevron = (isOpen: boolean): React.CSSProperties => ({
  fontSize: '0.75rem',
  color: 'var(--text-dim)',
  transition: 'transform 0.2s',
  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
})

const labelStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 600,
  marginBottom: '0.3rem',
  display: 'block',
  color: 'var(--text-dim)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const inputStyle: React.CSSProperties = {
  fontFamily: "'SF Mono', 'Monaco', monospace",
  fontSize: '0.85rem',
  padding: '0.6rem',
  width: '100%',
}

export function ConfigModal({ open, onClose }: ConfigModalProps) {
  const [cfg, setCfg] = useState<AppConfig>(loadConfig)
  const [saved, setSaved] = useState(false)
  const { theme, toggle } = useThemeContext()
  const { events, loading, lastBlock, refetch } = useEvents()
  const { address, chainId } = useAccount()
  const [cacheCleared, setCacheCleared] = useState(false)
  const [activeSection, setActiveSection] = useState<Section>(null)

  useEffect(() => {
    if (open) {
      setCfg(loadConfig())
      setSaved(false)
      setCacheCleared(false)
      setActiveSection(null)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const toggleSection = (s: Section) => setActiveSection(prev => prev === s ? null : s)

  const update = (patch: Partial<AppConfig>) => {
    setCfg(prev => ({ ...prev, ...patch }))
    setSaved(false)
  }

  const handleSaveAndReload = () => {
    saveConfig(cfg)
    window.location.reload()
  }

  const handleReset = () => {
    const defaults = resetConfig()
    setCfg(defaults)
    setSaved(false)
  }

  const handleSave = () => {
    saveConfig(cfg)
    setSaved(true)
  }

  const applyPreset = (name: string) => {
    const preset = PRESETS[name]
    if (preset) {
      setCfg(prev => ({ ...prev, ...preset }))
      setSaved(false)
    }
  }

  const isAnvil = cfg.chainId === 31337
  const isMainnet = cfg.chainId === 1

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1200,
        padding: '1rem',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '1.5rem',
        width: '100%',
        maxWidth: '480px',
        maxHeight: '85vh',
        overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0 }}>Settings</h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-dim)',
              fontSize: '1.25rem',
              cursor: 'pointer',
              padding: '0.25rem 0.5rem',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Theme — always visible */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>Theme</label>
          <ToggleButtons
            options={[
              { value: 'light', label: '☀ Light' },
              { value: 'dark', label: '☾ Dark' },
            ]}
            value={theme}
            onChange={() => toggle()}
          />
        </div>

        {/* ── Network Section (accordion) ── */}
        <div
          style={sectionHeader}
          onClick={() => toggleSection('network')}
        >
          <span style={sectionTitle}>Network</span>
          <span style={chevron(activeSection === 'network')}>▼</span>
        </div>
        {activeSection === 'network' && (
          <div style={{ paddingBottom: '1rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <ToggleButtons
                options={[
                  { value: 'mainnet', label: 'Mainnet' },
                  { value: 'anvil', label: 'Anvil' },
                ]}
                value={isMainnet ? 'mainnet' : isAnvil ? 'anvil' : ''}
                onChange={(v) => applyPreset(v)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1rem' }}>
              <div>
                <label style={labelStyle}>Chain ID</label>
                <input type="number" value={cfg.chainId} onChange={e => update({ chainId: Number(e.target.value) || 1 })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>RPC Endpoint</label>
                <input type="text" value={cfg.rpcUrl} onChange={e => update({ rpcUrl: e.target.value })} placeholder="(default)" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Explorer URL</label>
                <input type="text" value={cfg.explorerUrl} onChange={e => update({ explorerUrl: e.target.value })} placeholder="https://etherscan.io" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Contract Address</label>
                <input type="text" value={cfg.contractAddress} onChange={e => update({ contractAddress: e.target.value })} placeholder="0x..." style={inputStyle} />
              </div>
            </div>

            {/* Summary */}
            <div style={{
              padding: '0.6rem 0.75rem',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '6px',
              marginBottom: '1rem',
              fontSize: '0.8rem',
              fontFamily: "'SF Mono', 'Monaco', monospace",
              lineHeight: 1.7,
              color: 'var(--text-dim)',
            }}>
              {cfg.chainId} · {cfg.rpcUrl || 'default RPC'} · {cfg.contractAddress ? `${cfg.contractAddress.slice(0, 8)}...` : 'no contract'}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleSave} className="secondary" style={{ flex: 1, padding: '0.65rem', fontSize: '0.85rem' }}>
                Save
              </button>
              <button onClick={handleSaveAndReload} style={{ flex: 1, padding: '0.65rem', fontSize: '0.85rem' }}>
                Save & Reload
              </button>
              <button onClick={handleReset} className="secondary" style={{ padding: '0.65rem', fontSize: '0.85rem' }}>
                Reset
              </button>
            </div>

            {saved && (
              <div style={{
                marginTop: '0.75rem',
                padding: '0.5rem',
                backgroundColor: 'color-mix(in srgb, var(--success) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--success) 30%, transparent)',
                borderRadius: '6px',
                color: 'var(--success)',
                textAlign: 'center',
                fontSize: '0.85rem',
              }}>
                ✓ Saved. Reload for RPC/chain changes.
              </div>
            )}
          </div>
        )}

        {/* ── Event Indexer Section (accordion) ── */}
        <div
          style={sectionHeader}
          onClick={() => toggleSection('indexer')}
        >
          <span style={sectionTitle}>Event Indexer</span>
          <span style={chevron(activeSection === 'indexer')}>▼</span>
        </div>
        {activeSection === 'indexer' && (
          <div style={{ paddingBottom: '0.5rem' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.5rem',
              marginBottom: '0.75rem',
            }}>
              <div style={{ padding: '0.6rem', background: 'var(--bg)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Events Cached</div>
                <div style={{ fontFamily: "'SF Mono', 'Monaco', monospace", fontSize: '1rem', fontWeight: 600, color: 'var(--accent)' }}>
                  {loading ? '…' : events.length.toLocaleString()}
                </div>
              </div>
              <div style={{ padding: '0.6rem', background: 'var(--bg)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Last Block</div>
                <div style={{ fontFamily: "'SF Mono', 'Monaco', monospace", fontSize: '1rem', fontWeight: 600, color: 'var(--accent)' }}>
                  {loading ? '…' : lastBlock > 0 ? lastBlock.toLocaleString() : '—'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="secondary"
                onClick={() => refetch()}
                disabled={loading}
                style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem' }}
              >
                {loading ? 'Indexing…' : 'Re-index'}
              </button>
              <button
                className="secondary"
                onClick={() => {
                  if (address && chainId) {
                    clearCache(address, chainId)
                    setCacheCleared(true)
                    setTimeout(() => setCacheCleared(false), 2000)
                  }
                }}
                disabled={!address}
                style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem', color: address ? 'var(--danger)' : undefined, borderColor: address ? 'var(--danger)' : undefined }}
              >
                {cacheCleared ? '✓ Cleared' : 'Clear Cache'}
              </button>
            </div>

            {!address && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.5rem', textAlign: 'center' }}>
                Connect wallet to view indexer status
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
