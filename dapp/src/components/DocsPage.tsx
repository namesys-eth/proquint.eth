import { loadConfig } from '../libs/config'

const mono: React.CSSProperties = { fontFamily: "'SF Mono', 'Monaco', monospace" }

export function DocsPage() {
  return (
    <div className="container">
      <div className="card">
        <h1 style={{ marginBottom: '1.5rem' }}>Documentation</h1>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem', color: 'var(--accent)' }}>
            Overview
          </h2>
          <p style={{ lineHeight: 1.6, marginBottom: '0.75rem', fontSize: '0.95rem' }}>
            Human-readable, pronounceable 4-byte identifiers as ERC-721 NFTs with an on-chain registry.
            A proquint encodes <code style={mono}>bytes4</code> into an 11-character label like <code style={mono}>babab-dabab</code> using
            a consonant-vowel pattern (CVCVC-CVCVC). IDs are normalized so the smaller half always comes first.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem', color: 'var(--accent)' }}>
            Registration
          </h2>
          <ol style={{ lineHeight: 1.8, paddingLeft: '1.5rem', marginBottom: '1rem', fontSize: '0.95rem' }}>
            <li><strong>commit(hash)</strong> — submit keccak256(ID, secret, recipient). Wait 5s–15min.</li>
            <li><strong>register(input)</strong> — reveal & mint as caller's primary. Requires no existing primary.</li>
            <li><strong>registerTo(input, to)</strong> — reveal & mint into recipient's inbox.</li>
            <li><strong>renew(input)</strong> — extend expiry. Anyone can renew any name.</li>
          </ol>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem', color: 'var(--accent)' }}>
            Pricing
          </h2>
          <div style={{
            display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.25rem 1rem',
            padding: '0.75rem 1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px',
            marginBottom: '0.75rem', fontSize: '0.9rem', ...mono,
          }}>
            <span style={{ color: 'var(--text-dim)' }}>Base</span><span>0.00024 ETH / year</span>
            <span style={{ color: 'var(--text-dim)' }}>N years</span><span>(2ᴺ − 1) × 0.00024 ETH</span>
            <span style={{ color: 'var(--text-dim)' }}>Palindrome</span><span>5× multiplier</span>
            <span style={{ color: 'var(--text-dim)' }}>Refund</span><span>0.00002 ETH / remaining month</span>
            <span style={{ color: 'var(--text-dim)' }}>Max</span><span>12 years</span>
          </div>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem', color: 'var(--accent)' }}>
            Lifecycle
          </h2>
          <div style={{
            padding: '0.75rem 1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px',
            marginBottom: '0.75rem', fontSize: '0.85rem', ...mono, lineHeight: 1.7, overflowX: 'auto',
          }}>
            Registration → Expiry → Grace (300d) → Premium (65d) → Available
          </div>
          <ul style={{ lineHeight: 1.8, paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
            <li><strong>Grace (300d):</strong> owner can renew, record still resolves.</li>
            <li><strong>Premium (65d):</strong> anyone re-registers with decaying surcharge (50% to old owner).</li>
            <li><strong>After 365d:</strong> fully available, no premium.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem', color: 'var(--accent)' }}>
            Inbox System
          </h2>
          <p style={{ lineHeight: 1.6, marginBottom: '0.75rem', fontSize: '0.9rem' }}>
            All transfers and <code style={mono}>registerTo</code> land in the recipient's inbox — never directly as primary.
            One primary per address. Decaying claim window: 42 days (first item) → 7 days (255th). Max 255 items.
          </p>
          <div style={{
            display: 'grid', gridTemplateColumns: 'auto auto auto 1fr', gap: '0.2rem 0.75rem',
            padding: '0.75rem 1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px',
            fontSize: '0.85rem', lineHeight: 1.7,
          }}>
            <strong style={{ color: 'var(--text-dim)' }}>Action</strong>
            <strong style={{ color: 'var(--text-dim)' }}>Who</strong>
            <strong style={{ color: 'var(--text-dim)' }}>When</strong>
            <strong style={{ color: 'var(--text-dim)' }}>Effect</strong>

            <span style={mono}>acceptInbox</span><span>Receiver</span><span>Before expiry</span><span>Inbox → Primary</span>
            <span style={mono}>acceptInbox</span><span>Anyone</span><span>Expiry → +7d</span><span>Inbox → Primary (helper)</span>
            <span style={mono}>shelve</span><span>Owner</span><span>While active</span><span>Primary → Inbox (7d penalty)</span>
            <span style={mono}>rejectInbox</span><span>Receiver</span><span>Before expiry</span><span>Burn + refund</span>
            <span style={mono}>cleanInbox</span><span>Anyone</span><span>After expiry +7d</span><span>Burn + reward split</span>
          </div>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem', color: 'var(--accent)' }}>
            Anti-Sybil
          </h2>
          <ul style={{ lineHeight: 1.8, paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
            <li><strong>Commit-reveal:</strong> 5s min delay, 15min max. Prevents front-running.</li>
            <li><strong>Transfer penalty:</strong> every transfer or shelve subtracts 7 days from expiry.</li>
            <li><strong>One primary per address.</strong> <code style={mono}>register</code> and <code style={mono}>acceptInbox</code> enforce this.</li>
            <li><strong>Inbox cap:</strong> max 255 pending items per address.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem', color: 'var(--accent)' }}>
            Contract
          </h2>
          <div style={{
            padding: '0.75rem 1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px',
            fontSize: '0.9rem', ...mono, lineHeight: 1.8,
          }}>
            <strong style={{ fontFamily: 'inherit' }}>ProquintNFT</strong> — ERC-721 + registry + inbox + commit-reveal<br />
            Ethereum Mainnet (Chain 1): TBD
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem', color: 'var(--accent)' }}>
            Links
          </h2>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <a
              href="https://github.com/namesys-eth/proquint.eth"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block', padding: '0.65rem 1.25rem',
                backgroundColor: 'var(--primary)', color: 'var(--bg)',
                textDecoration: 'none', borderRadius: '6px', fontWeight: 500, fontSize: '0.9rem',
              }}
            >
              GitHub ↗
            </a>
            {loadConfig().explorerUrl && (
              <a
                href={loadConfig().explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block', padding: '0.65rem 1.25rem',
                  border: '1px solid var(--border)', color: 'var(--text)',
                  textDecoration: 'none', borderRadius: '6px', fontWeight: 500, fontSize: '0.9rem',
                }}
              >
                Explorer ↗
              </a>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
