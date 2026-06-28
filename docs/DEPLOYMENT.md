# Soroban Contract Deployment Flow

This document describes how to build, optimize, deploy, and initialize the
project's Soroban vault contract (`src/lib.rs`) on the **Stellar Testnet**.

The flow is implemented in [`scripts/deploy.sh`](../scripts/deploy.sh) and exposed
through both `make` and `npm` targets.

## Prerequisites

| Tool | Notes |
| --- | --- |
| [Rust](https://www.rust-lang.org/tools/install) + `wasm32v1-none` target | `rustup target add wasm32v1-none` |
| [stellar-cli](https://developers.stellar.org/docs/tools/cli) | `stellar --version` (tested with 25.x) |
| `bash` | Linux/macOS, or Git Bash on Windows |

No secret keys are ever stored in the repository. The deploy *source account* is
a named identity managed by `stellar-cli` (`stellar keys`). On Testnet it is
created and funded automatically via Friendbot if it does not yet exist.

## Quick start

```bash
# Build, optimize, deploy and initialize on Testnet in one step:
npm run deploy:testnet
# or
make deploy
# or
bash scripts/deploy.sh
```

This will:

1. Ensure the source account exists (`vault-deployer` by default) and is funded.
2. Build and optimize the contract to Wasm (`stellar contract build --optimize`).
3. Deploy it to Testnet (`stellar contract deploy`).
4. Initialize it, setting the deployer as the vault admin.
5. Write the resulting contract id to `deployments/testnet.json` and `.env`
   (both git-ignored).

## Configuration

The script is parameterized through environment variables (see
[`.env.example`](../.env.example)):

| Variable | Default | Description |
| --- | --- | --- |
| `STELLAR_NETWORK` | `testnet` | Target network. The script refuses `mainnet`/`public`. Legacy `NETWORK` is still accepted as a fallback. |
| `STELLAR_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` | Passphrase used by local clients and written to `.env` for the deployed network. |
| `STELLAR_HORIZON_URL` | `https://horizon-testnet.stellar.org` | Horizon endpoint used by local clients and written to `.env`. |
| `STELLAR_SOURCE` | `vault-deployer` | `stellar-cli` identity used as the source account. Legacy `SOURCE` is still accepted as a fallback. |

Examples:

```bash
# Use a different identity:
STELLAR_SOURCE=my-key npm run deploy:testnet

# Point local clients at a standalone network:
STELLAR_NETWORK=standalone \
STELLAR_NETWORK_PASSPHRASE="Standalone Network ; February 2017" \
STELLAR_HORIZON_URL=http://localhost:8000 \
bash scripts/deploy.sh

# Force a fresh deploy instead of reusing the cached contract id:
bash scripts/deploy.sh --force
```

## Manual steps (equivalent to the script)

```bash
# 1. Create and fund a testnet identity
stellar keys generate vault-deployer --network testnet
stellar keys fund vault-deployer --network testnet

# 1a. Export matching client/network settings
export STELLAR_NETWORK=testnet
export STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
export STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org

# 2. Build & optimize
stellar contract build --optimize

# 3. Deploy
CONTRACT_ID=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/yield_aggregator_vault.wasm \
  --source vault-deployer --network testnet)

# 4. Initialize (admin = deployer public key)
ADMIN=$(stellar keys address vault-deployer)
stellar contract invoke --id "$CONTRACT_ID" \
  --source vault-deployer --network testnet \
  -- initialize --admin "$ADMIN"

# 5. Read it back
stellar contract invoke --id "$CONTRACT_ID" \
  --source vault-deployer --network testnet -- admin
```

## Idempotency

* Re-running the script reuses the contract id recorded in
  `deployments/<network>.json` (pass `--force` to deploy a fresh instance).
* `initialize` can only run once; a second attempt returns
  `AlreadyInitialized`, which the script treats as success.

## Contract surface

| Function | Description |
| --- | --- |
| `initialize(admin: Address)` | One-time setup; stores the vault admin. |
| `admin() -> Address` | Returns the configured admin. |
| `version() -> Symbol` | Returns the contract version. |
