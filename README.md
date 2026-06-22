<div align="center">
  <h1>yield-aggregator-app</h1>
  <p><strong>Automated yield farming vaults and liquidity provisioning for Soroban.</strong></p>
</div>

<br />

## 📖 Overview

yield-aggregator-app is a critical component of our decentralized ecosystem. This repository contains the source code, tests, and deployment configurations necessary to run the service. Built with modern, enterprise-grade architecture, it ensures high availability, secure execution, and seamless integration with the broader network.

## ✨ Key Features

- **Robust Architecture**: Designed to handle high-throughput and scale horizontally.
- **Secure by Default**: Follows industry-standard security practices and comprehensive auditing guidelines.
- **Extensible Integration**: Exposes clean, well-documented interfaces for third-party extensions.
- **Comprehensive Testing**: Backed by a strict CI/CD pipeline enforcing an 85%+ code coverage requirement.

## 🚀 Getting Started

### Prerequisites
- Make sure you have the latest stable versions of our core toolchains (e.g., Node.js, Rust/Cargo) installed.
- Ensure Docker is installed for running localized integration environments.

### Local Installation

\\\ash
# Clone the repository
git clone https://github.com/YourOrganization/yield-aggregator-app.git
cd yield-aggregator-app

# Install dependencies and build
# (Refer to package.json or Cargo.toml for specific build commands)
\\\

## 🚢 Deployment (Soroban / Testnet)

The Soroban vault contract (`src/lib.rs`) can be built and deployed to the
Stellar Testnet with a single command:

```bash
npm run deploy:testnet   # or: make deploy
```

This builds the contract to Wasm, optimizes it, deploys it to Testnet, and
initializes it. Secret keys are never stored in the repo — the source account is
a `stellar-cli` identity, auto-funded via Friendbot on Testnet. See
[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for full details and configuration.

## 🔌 Adding a New Yield Protocol

Create a file `src/core/strategies/YourProtocolStrategy.ts` implementing `IYieldStrategy`:

```typescript
import { IYieldStrategy, YieldMetrics } from './IYieldStrategy';

export class YourProtocolStrategy implements IYieldStrategy {
  readonly name = 'Your Protocol';

  async getAPY(): Promise<number> { /* fetch/calculate APY */ }
  async getTVL(): Promise<number> { /* fetch/calculate TVL */ }
  async simulateDeposit(amount: number): Promise<number> { /* return estimated yield */ }
  async getMetrics(): Promise<YieldMetrics> {
    const [apy, tvl] = await Promise.all([this.getAPY(), this.getTVL()]);
    return { apy, tvl };
  }
}
```

Register it in `src/core/strategies/index.ts` and add it to the auto-registration block in `StrategyRegistry.ts`. Write tests in `tests/strategies.test.ts` following the existing pattern.

## 🤝 Contributing
We welcome contributions from the community! Please read our [Contributing Guidelines](./CONTRIBUTING.md) to get started. Before submitting a Pull Request, ensure that you have reviewed our [Code of Conduct](./CODE_OF_CONDUCT.md).

## 📄 License
This project is licensed under the MIT License. See the LICENSE file for more details.
