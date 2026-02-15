#!/usr/bin/env bash

# ── Anvil local dev chain launcher ──
# Starts anvil, deploys ProquintNFT, and prints the contract address.
# Usage: ./script/anvil.sh
#
# Anvil account #0 is the deployer:
#   Address:    0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
#   Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

ANVIL_PORT=${ANVIL_PORT:-8545}
ANVIL_CHAIN_ID=${ANVIL_CHAIN_ID:-31337}
DEPLOYER_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
RPC_URL="http://localhost:${ANVIL_PORT}"
ANVIL_PID=""

cleanup() {
  if [ -n "$ANVIL_PID" ]; then
    echo ""
    echo "Shutting down anvil (pid $ANVIL_PID)..."
    kill "$ANVIL_PID" 2>/dev/null || true
    wait "$ANVIL_PID" 2>/dev/null || true
    echo "Done."
  fi
}
trap cleanup EXIT INT TERM

echo "═══════════════════════════════════════════"
echo "  Proquint · Local Anvil Dev Environment"
echo "═══════════════════════════════════════════"
echo ""

# 1. Start anvil in background
echo "▸ Starting anvil on port ${ANVIL_PORT} (chain ${ANVIL_CHAIN_ID})..."
anvil \
  --port "$ANVIL_PORT" \
  --chain-id "$ANVIL_CHAIN_ID" \
  --block-time 1 \
  --silent &
ANVIL_PID=$!

# Wait for anvil to accept RPC calls (up to 10s)
echo "  Waiting for anvil to be ready..."
READY=0
for _ in $(seq 1 50); do
  if cast chain-id --rpc-url "$RPC_URL" &>/dev/null; then
    READY=1
    break
  fi
  sleep 0.2
done

if [ "$READY" -eq 0 ]; then
  echo "  ✗ Anvil failed to start after 10s"
  exit 1
fi
echo "  ✓ Anvil running (pid ${ANVIL_PID})"
echo ""

# 2. Build contracts first (so we see compile errors clearly)
echo "▸ Building contracts..."
if ! (cd "$PROJECT_ROOT" && forge build 2>&1); then
  echo ""
  echo "  ✗ Forge build failed. Fix compile errors and re-run."
  echo "  Anvil is still running — press Ctrl+C to stop."
  wait "$ANVIL_PID"
  exit 1
fi
echo "  ✓ Build OK"
echo ""

# 3. Deploy ProquintNFT
echo "▸ Deploying ProquintNFT..."
DEPLOY_OUTPUT=$(cd "$PROJECT_ROOT" && forge script script/Deploy.s.sol \
  --rpc-url "$RPC_URL" \
  --private-key "$DEPLOYER_KEY" \
  --broadcast 2>&1) || true

# Extract deployed contract address from broadcast JSON (most reliable)
BROADCAST_JSON="$PROJECT_ROOT/broadcast/Deploy.s.sol/${ANVIL_CHAIN_ID}/run-latest.json"
CONTRACT_ADDR=""
if [ -f "$BROADCAST_JSON" ]; then
  CONTRACT_ADDR=$(python3 -c "
import json, sys
with open('$BROADCAST_JSON') as f:
    d = json.load(f)
for tx in d.get('transactions', []):
    addr = tx.get('contractAddress', '')
    if addr:
        print(addr)
        sys.exit(0)
" 2>/dev/null)
fi

if [ -z "$CONTRACT_ADDR" ]; then
  echo "  ✗ Deploy failed or could not extract address."
  echo "  Forge output:"
  echo "────────────────────────────────"
  echo "$DEPLOY_OUTPUT"
  echo "────────────────────────────────"
  echo ""
  echo "  Anvil is still running — press Ctrl+C to stop."
  wait "$ANVIL_PID"
  exit 1
fi

echo "  ✓ ProquintNFT deployed at: ${CONTRACT_ADDR}"
echo ""
echo "═══════════════════════════════════════════"
echo "  RPC URL:    ${RPC_URL}"
echo "  Chain ID:   ${ANVIL_CHAIN_ID}"
echo "  Contract:   ${CONTRACT_ADDR}"
echo "  Explorer:   n/a (local)"
echo ""
echo "  DApp Config Page → http://localhost:5173/config"
echo "    Set RPC to:      ${RPC_URL}"
echo "    Set Contract to: ${CONTRACT_ADDR}"
echo "═══════════════════════════════════════════"
echo ""
echo "Anvil running. Press Ctrl+C to stop."
echo ""

# Keep running until interrupted
wait "$ANVIL_PID"
