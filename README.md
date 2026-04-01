<div align="center">
  <h1>yield-aggregator-app</h1>
  <p><strong>DeFi Yield Aggregator & Multi-Strategy Vault Protocol on Soroban / Stellar.</strong></p>

  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Soroban](https://img.shields.io/badge/Soroban-Smart%20Contracts-purple)](https://soroban.stellar.org)
  [![Security: Audited](https://img.shields.io/badge/Security-TimeLock%20%7C%20Pause-blue)](#)
</div>

<br />

## 📖 Overview

`yield-aggregator-app` is a decentralized yield optimization protocol built natively on Stellar's Soroban smart contract platform. It automatically routes deposited crypto assets across multiple liquidity protocols (AMM LPs, lending protocols, yield farming pools) to achieve optimal risk-adjusted returns.

Designed with high security guardrails, the protocol features MEV/sandwich-attack prevention through time-locked withdrawals, emergency multi-sig pause controls, multi-strategy liquidity routing, and an indexer REST API for real-time analytics.

---

## 🏗️ Protocol Architecture

```
+-------------------------------------------------------------------------+
|                              Web Frontend / dApp                        |
+-------------------------------------------------------------------------+
       |                                                    |
       v (Contract Calls)                                   v (REST API)
+-------------------------------+                  +----------------------+
|     Soroban Vault Router      |                  |   Event Indexer      |
|  +-------------------------+  |                  |   (Node.js + SQLite) |
|  | Multi-Strategy Allocation|  |                  +----------------------+
|  +-------------------------+  |                             ^
|  |  Time-Lock Withdrawal   |  |                             | (Soroban RPC)
|  +-------------------------+  |                             |
|  |  Emergency Multi-Sig    |  |-----------------------------+
|  +-------------------------+  |
+-------------------------------+
       |               |               |
       v               v               v
+-------------+ +-------------+ +-------------+
| Strategy A  | | Strategy B  | | Strategy C  |
| (AMM Pool)  | | (Lending)   | | (Staking)   |
+-------------+ +-------------+ +-------------+
```

---

## 🔒 Security Architecture

1. **Sandwich Attack Mitigation**: Time-locked withdrawal queues prevent flash-loan & front-running exploits by requiring a configurable delay (`unlock_ledger`) before funds can be claimed.
2. **Multi-Sig Governance**: Critical administration actions (such as emergency pausing or fee adjustment) require `M-of-N` signatures.
3. **Drift Threshold Rebalancing**: Automated rebalancing triggers only when capital allocation deviates beyond a pre-configured drift tolerance (e.g. >50 bps), minimizing transaction fee churn.

---

## 💡 Code & Contract Usage

### 1. Interacting with Vault Router (Soroban CLI)

```bash
# Deposit asset into vault router
soroban contract invoke \
  --id CD...VAULT_ROUTER \
  --source admin \
  --network testnet \
  -- \
  deposit --from GB...USER_ADDRESS --amount 1000000000

# Initiate withdrawal (starts time-lock period)
soroban contract invoke \
  --id CD...VAULT_ROUTER \
  --source admin \
  --network testnet \
  -- \
  initiate_withdrawal --from GB...USER_ADDRESS --amount 500000000
```

### 2. Fetching Analytics from Indexer API

```typescript
import axios from 'axios';

// Get vault APY and TVL metrics
const response = await axios.get('http://localhost:3000/api/v1/vaults/vault-usdc');
console.log(`Current APY (7-day rolling): ${response.data.apy}%`);
console.log(`Total Value Locked: $${response.data.tvl}`);
```

---

## 🚀 Development & Local Testing

### Prerequisites

- **Rust**: 1.75+ with `wasm32-unknown-unknown`
- **Node.js**: v18+ & Yarn
- **Docker Compose**: For running indexer + database locally

### Build Contracts & Run Simulation

```bash
# Build Soroban smart contracts
cargo build --target wasm32-unknown-unknown --release

# Run smart contract unit tests
cargo test

# Run local vault simulation CLI
yarn sim --scenario scenarios/basic.yaml
```

### Run Local Indexer Stack

```bash
# Launch database and analytics indexer
docker-compose up -d
```

---

## 🛣️ Roadmap & Active GitHub Issues

- [[Feature] Implement time-locked withdrawal mechanism to prevent sandwich attacks](https://github.com/sharif-stellar-tools/yield-aggregator-app/issues/1)
- [[Feature] Add multi-strategy vault router to distribute deposits across protocols](https://github.com/sharif-stellar-tools/yield-aggregator-app/issues/2)
- [[Observability] Build an on-chain event indexer and REST API for vault analytics](https://github.com/sharif-stellar-tools/yield-aggregator-app/issues/3)
- [[Security] Implement emergency pause mechanism with multi-sig governance](https://github.com/sharif-stellar-tools/yield-aggregator-app/issues/4)
- [[DX] Add a local vault simulation CLI for testing deposit/withdraw/compound flows](https://github.com/sharif-stellar-tools/yield-aggregator-app/issues/5)

---

## 📄 License

Licensed under the MIT License. See [LICENSE](./LICENSE) for details.
