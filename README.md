# Proquint Name System

Human-readable, pronounceable 4-byte identifiers as ERC-721 NFTs with an on-chain registry.

A **proquint** encodes 4 bytes (`bytes4`) into an 11-character label like `babab-dabab` using a consonant-vowel pattern (CVCVC-CVCVC). IDs are **normalized** so the smaller half always comes first — `dabab-babab` and `babab-dabab` resolve to the same token.

## Architecture

```
Core.sol            — constants, pricing, shared storage, burn/refund helpers
  └─ Inbox.sol      — inbox state machine (accept / reject / deactivate / burn expired)
       └─ ProquintNFT.sol — ERC-721, commit-reveal registration, renewal, registry lookups
```

**Supporting contracts:**
- `LibProquint.sol` — encode/decode/normalize/namehash (pure assembly, gas-optimized)
- `IProquint.sol` — full interface (errors, events, function signatures)
- `TokenURI.sol` + `SVG` library — fully on-chain SVG artwork + JSON metadata, Upgradable
- `LibPhonetic.sol` — NATO phonetic alphabet converter

## Token States

Each token is in exactly one state:

| State | Condition | How it enters | How it exits |
|-------|-----------|---------------|--------------|
| **Inbox** | `_inboxExpiry[ID] != 0` | `transferFrom`, `registerTo`, `deactivatePrimary` | `acceptInbox`, `rejectInbox`, `burnExpiredInbox` |
| **Primary** | `_primaryName[owner] == namehash` | `register`, `registerPremium`, `acceptInbox` | `deactivatePrimary`, `transferFrom` |

## Registration Flow

1. **`commit(hash)`** — submit `keccak256(ID, secret, recipient)`. Wait 5s–15min.
2. **`register(input)`** — reveal & mint as caller's primary. Requires no existing primary.
3. **`registerTo(input, to)`** — reveal & mint into `to`'s inbox. Recipient must `acceptInbox` to activate.
4. **`registerPremium(input)`** — register during premium window with decaying surcharge.
5. **`renew(input)`** — extend expiry (anyone can renew any name).

`input` layout: `bytes1(years) ++ bytes4(id) ++ bytes27(secret)` packed into `bytes32`.

## Pricing

Fixed ETH pricing — **no oracle dependency**.

| Duration | Base Price |
|----------|-----------|
| 1 year | 0.00024 ETH |
| 2 years | 0.00072 ETH |
| N years | `(2^N - 1) × 0.00024 ETH` |

- **Symmetric (palindrome) IDs** (e.g. `babab-babab`): **5× multiplier**
- **Refund rate**: 0.00002 ETH per remaining whole month
- **Premium period**: linearly decaying surcharge (100% → 0% over 65 days)

## Anti-Sybil & Transfer Mechanics

- **Commit-reveal**: 5-second minimum delay prevents front-running. Commitments expire after 15 minutes.
- **Inbox system**: all transfers (`transferFrom`, `registerTo`) land in recipient's inbox — not directly as primary. Recipient must explicitly `acceptInbox`.
- **Transfer penalty**: every transfer or `deactivatePrimary` subtracts **7 days** from expiry.
- **Decaying inbox duration**: first inbox item gets 42 days pending period; subsequent items approach 7 days (linear decay over 255 items). Discourages inbox spam.
- **One primary per address**: `register` and `acceptInbox` enforce that the address has no existing primary name.
- **Inbox cap**: max 255 pending items per address.

## Lifecycle Timeline

```
Registration ──────── Expiry ──── Grace (300d) ──── Premium (65d) ──── Available
     │                   │              │                  │                │
     │  owner can use    │  can renew   │  decaying premium│  anyone can    │
     │  & transfer       │  only        │  re-registration │  register      │
```

- **Grace period** (300 days): owner can still renew, record still resolves.
- **Premium period** (65 days): anyone can re-register with a decaying surcharge (50% goes to old owner).
- **After 365 days**: fully available, no premium.

## Inbox Actions

| Action | Who | When | Effect |
|--------|-----|------|--------|
| `acceptInbox` | Receiver | Before inbox expiry | Inbox → Primary |
| `acceptInbox` | Anyone | Expiry → Expiry + 7d | Inbox → Primary (helper) |
| `shelve` | Owner | While active | Primary → Inbox (with penalty) |
| `rejectInbox` | Receiver | Before inbox expiry | Burn + refund receiver |
| `cleanInbox` | Anyone | After expiry + 7d | Burn + reward split |

## Build & Test

```shell
forge build
forge test -v
forge test --gas-report
```

## License

WTFPL.ETH / MIT
