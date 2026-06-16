#!/usr/bin/env bash
#
# Deploy the yield-aggregator Soroban vault contract to a Stellar network.
#
# Pipeline: build -> optimize -> deploy -> initialize -> persist contract id.
#
# Safety / design:
#   * Defaults to TESTNET and refuses mainnet/public.
#   * Never hardcodes secret keys. The source account is a named stellar-cli
#     identity (`stellar keys`). For testnet it is auto-created and funded via
#     Friendbot when missing. Secret keys stay in stellar-cli's local store,
#     never in the repository.
#   * Idempotent: reuses a previously deployed contract id (unless --force) and
#     tolerates an already-initialized contract.
#
# Usage:
#   ./scripts/deploy.sh                       # deploy to testnet with defaults
#   NETWORK=testnet SOURCE=my-key ./scripts/deploy.sh
#   ./scripts/deploy.sh --force               # force a fresh deploy
#
# Environment variables:
#   NETWORK   Stellar network to target            (default: testnet)
#   SOURCE    stellar-cli identity / source account (default: vault-deployer)
#
set -euo pipefail

NETWORK="${NETWORK:-testnet}"
SOURCE="${SOURCE:-vault-deployer}"
CONTRACT_NAME="yield-aggregator-vault"
WASM_NAME="yield_aggregator_vault"
FORCE=0

for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DEPLOYMENTS_DIR="$ROOT_DIR/deployments"
DEPLOY_FILE="$DEPLOYMENTS_DIR/${NETWORK}.json"
ENV_FILE="$ROOT_DIR/.env"
mkdir -p "$DEPLOYMENTS_DIR"

log() { printf '\n\033[1;34m==>\033[0m %s\n' "$1"; }

# --- guard: testnet only ---------------------------------------------------
case "$NETWORK" in
  mainnet|public|pubnet)
    echo "Refusing to deploy to '$NETWORK': this script is TESTNET only." >&2
    exit 1 ;;
esac

# --- 1. ensure source account ----------------------------------------------
log "Ensuring source account '$SOURCE' on '$NETWORK'"
if ! stellar keys address "$SOURCE" >/dev/null 2>&1; then
  echo "Identity '$SOURCE' not found; generating..."
  stellar keys generate "$SOURCE" --network "$NETWORK"
fi
echo "Funding '$SOURCE' via Friendbot (no-op if already funded)..."
stellar keys fund "$SOURCE" --network "$NETWORK" || true
DEPLOYER_PUBKEY="$(stellar keys address "$SOURCE")"
echo "Deployer public key: $DEPLOYER_PUBKEY"

# --- 2. build + optimize ---------------------------------------------------
# `stellar contract build --optimize` optimizes the Wasm in place, writing the
# optimized bytes to <crate>.wasm (no separate .optimized.wasm artifact).
log "Building and optimizing contract to Wasm"
stellar contract build --optimize
WASM="target/wasm32v1-none/release/${WASM_NAME}.wasm"
[ -f "$WASM" ] || { echo "Expected Wasm not found at $WASM" >&2; exit 1; }
echo "Using Wasm: $WASM"

# --- 3. deploy (idempotent) ------------------------------------------------
CONTRACT_ID=""
if [ "$FORCE" -eq 0 ] && [ -f "$DEPLOY_FILE" ]; then
  CONTRACT_ID="$(sed -n 's/.*"contract_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$DEPLOY_FILE" | head -1)"
fi
if [ -n "$CONTRACT_ID" ]; then
  log "Reusing contract id from $DEPLOY_FILE: $CONTRACT_ID (use --force to redeploy)"
else
  log "Deploying contract to $NETWORK"
  CONTRACT_ID="$(stellar contract deploy --wasm "$WASM" --source "$SOURCE" --network "$NETWORK")"
  echo "Deployed contract id: $CONTRACT_ID"
fi

# --- 4. initialize (idempotent) --------------------------------------------
log "Initializing contract (admin = deployer)"
set +e
INIT_OUT="$(stellar contract invoke --id "$CONTRACT_ID" --source "$SOURCE" --network "$NETWORK" \
  -- initialize --admin "$DEPLOYER_PUBKEY" 2>&1)"
INIT_RC=$?
set -e
echo "$INIT_OUT"
if [ "$INIT_RC" -ne 0 ]; then
  if echo "$INIT_OUT" | grep -qiE "AlreadyInitialized|Error\(Contract, #1\)"; then
    echo "Contract already initialized; continuing (idempotent)."
  else
    echo "Initialization failed." >&2
    exit 1
  fi
fi

# --- 5. persist deployment metadata ----------------------------------------
log "Recording deployment metadata"
cat > "$DEPLOY_FILE" <<EOF
{
  "network": "$NETWORK",
  "contract_name": "$CONTRACT_NAME",
  "contract_id": "$CONTRACT_ID",
  "deployer_public_key": "$DEPLOYER_PUBKEY",
  "wasm": "$WASM"
}
EOF
echo "Wrote $DEPLOY_FILE"

if [ ! -f "$ENV_FILE" ] && [ -f "$ROOT_DIR/.env.example" ]; then
  cp "$ROOT_DIR/.env.example" "$ENV_FILE"
fi
touch "$ENV_FILE"
update_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i.bak "s|^${key}=.*|${key}=${val}|" "$ENV_FILE" && rm -f "${ENV_FILE}.bak"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}
update_env "STELLAR_NETWORK" "$NETWORK"
update_env "STELLAR_SOURCE" "$SOURCE"
update_env "VAULT_CONTRACT_ID" "$CONTRACT_ID"
update_env "DEPLOYER_PUBLIC_KEY" "$DEPLOYER_PUBKEY"

log "Done."
echo "Network:        $NETWORK"
echo "Contract ID:    $CONTRACT_ID"
echo "Admin/Deployer: $DEPLOYER_PUBKEY"
