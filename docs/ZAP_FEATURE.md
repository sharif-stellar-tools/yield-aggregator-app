# Zap Feature Documentation

## Overview

The Zap feature enables users to deposit a single asset (e.g., USDC, XLM, or USDT) and automatically have it swapped and split to fund a liquidity pool in one click. This eliminates the manual process of:
1. Splitting funds manually
2. Swapping assets individually
3. Depositing to the liquidity pool

## Features

### ✨ Key Capabilities

- **Single-Click Deposits**: Deposit any supported asset and receive LP tokens immediately
- **Automatic Asset Splitting**: Intelligently splits deposits into the required pool ratio (50/50 for XLM/USDC)
- **Path Payment Integration**: Uses Stellar path payments to handle swaps automatically
- **Slippage Protection**: Configurable slippage tolerance to protect against unfavorable prices
- **Real-Time Quotes**: Get instant quotes showing estimated LP tokens and asset split
- **Multi-Asset Support**: Supports USDC, XLM, and USDT deposits

### 🎯 Supported Assets

| Asset | Symbol | Notes |
|-------|--------|-------|
| USD Coin | USDC | Primary stablecoin |
| Stellar Lumens | XLM | Native Stellar asset |
| Tether USD | USDT | Additional stablecoin support |

## Architecture

### Components

```
src/
├── core/
│   └── strategies/
│       ├── IZapStrategy.ts          # Zap strategy interface
│       ├── XlmZapStrategy.ts        # XLM pool zap implementation
│       └── index.ts                 # Exports
└── ui/
    ├── ZapModal.ts                  # Zap modal UI component
    └── dashboard.ts                 # Dashboard integration
```

### Strategy Pattern

The Zap feature uses the Strategy pattern to enable different liquidity pools:

```typescript
interface IZapStrategy {
  readonly name: string;
  readonly supportedAssets: string[];
  
  getZapQuote(inputAsset: string, amount: number): Promise<ZapQuote>;
  executeZap(inputAsset: string, amount: number, minLPTokens: number): Promise<ZapResult>;
  isSupportedAsset(asset: string): boolean;
}
```

## User Flow

### 1. Opening the Zap Modal

```typescript
// User clicks "Open Zap Modal" button on dashboard
const zapModal = new ZapModal();
zapModal.open((lpTokensReceived, txHash) => {
  // Success callback
  console.log(`Received ${lpTokensReceived} LP tokens`);
});
```

### 2. Getting a Quote

User inputs:
- Asset to deposit (USDC, XLM, or USDT)
- Amount to deposit
- Optional: slippage tolerance (default 0.5%)

The system returns:
```typescript
interface ZapQuote {
  inputAmount: number;           // e.g., 1000 USDC
  inputAsset: string;            // e.g., "USDC"
  estimatedLPTokens: number;     // e.g., 980 LP tokens
  assetSplit: [
    { asset: "USDC", amount: 500 },
    { asset: "XLM", amount: 4166.67 }
  ];
  slippage: 0.005;              // 0.5%
  apy: 0.05;                    // 5%
}
```

### 3. Executing the Zap

```typescript
// User clicks "Execute Zap"
const result = await zapStrategy.executeZap(
  'USDC',
  1000,
  minLPTokens // Calculated from quote and slippage tolerance
);

if (result.success) {
  console.log(`Transaction: ${result.txHash}`);
  console.log(`Received: ${result.lpTokensReceived} LP tokens`);
  console.log(`Actual slippage: ${result.actualSlippage * 100}%`);
}
```

## Technical Implementation

### Path Payment Logic

The Zap strategy uses Stellar path payments to convert the input asset into the required pool assets:

```typescript
// Example: USDC → XLM/USDC Pool
1. User deposits 1000 USDC
2. System calculates 50/50 split:
   - Keep 500 USDC
   - Convert 500 USDC to XLM via path payment
3. Deposit both assets to liquidity pool
4. Receive LP tokens proportional to deposit
```

### Slippage Protection

```typescript
const quote = await getZapQuote('USDC', 1000);
// Quote: estimatedLPTokens = 980

const maxSlippage = 0.01; // 1%
const minLPTokens = quote.estimatedLPTokens * (1 - maxSlippage);
// minLPTokens = 970.2

const result = await executeZap('USDC', 1000, minLPTokens);
// Transaction will revert if LP tokens < 970.2
```

### Error Handling

The Zap feature handles multiple error scenarios:

1. **Invalid Input**
   ```typescript
   // Throws: "Amount must be greater than 0"
   await zapStrategy.getZapQuote('USDC', 0);
   ```

2. **Unsupported Asset**
   ```typescript
   // Throws: "Asset BTC is not supported"
   await zapStrategy.getZapQuote('BTC', 1000);
   ```

3. **Slippage Exceeded**
   ```typescript
   // Returns: { success: false, error: "Slippage tolerance exceeded" }
   await zapStrategy.executeZap('USDC', 1000, tooHighMinimum);
   ```

4. **Path Payment Failure**
   ```typescript
   // Returns: { success: false, error: "Path payment failed" }
   // Automatically handled by the strategy
   ```

## Testing

### Unit Tests

```bash
npm run test:zap
```

Tests cover:
- Asset validation
- Quote generation for all supported assets
- Slippage calculations
- Transaction execution
- Edge cases (small amounts, large amounts, decimals)

### E2E Tests

```bash
npm run cy:run -- --spec cypress/e2e/zap-feature.cy.ts
```

E2E tests validate:
- UI rendering
- Modal interactions
- Quote fetching
- Transaction execution
- Dashboard updates
- Error handling

## API Reference

### ZapModal Class

```typescript
class ZapModal {
  constructor();
  
  // Open the modal with optional success callback
  open(onSuccess?: (lpTokens: number, txHash: string) => void): void;
  
  // Close the modal
  close(): void;
}
```

### XlmZapStrategy Class

```typescript
class XlmZapStrategy implements IZapStrategy {
  readonly name: string;
  readonly supportedAssets: string[];
  
  // Check if asset is supported
  isSupportedAsset(asset: string): boolean;
  
  // Get quote for zap transaction
  getZapQuote(inputAsset: string, amount: number): Promise<ZapQuote>;
  
  // Execute zap transaction
  executeZap(
    inputAsset: string,
    amount: number,
    minLPTokens: number
  ): Promise<ZapResult>;
}
```

## Usage Examples

### Basic Usage

```typescript
import { ZapModal } from './src/ui/ZapModal';

// Open Zap modal
const zapModal = new ZapModal();
zapModal.open((lpTokens, txHash) => {
  console.log(`Success! Received ${lpTokens} LP tokens`);
  console.log(`Transaction: ${txHash}`);
});
```

### Programmatic Zap

```typescript
import { XlmZapStrategy } from './src/core/strategies/XlmZapStrategy';

const zapStrategy = new XlmZapStrategy();

// Get quote
const quote = await zapStrategy.getZapQuote('USDC', 1000);
console.log(`Estimated LP tokens: ${quote.estimatedLPTokens}`);

// Execute with 1% slippage tolerance
const minLPTokens = quote.estimatedLPTokens * 0.99;
const result = await zapStrategy.executeZap('USDC', 1000, minLPTokens);

if (result.success) {
  console.log(`Zap successful!`);
  console.log(`TX: ${result.txHash}`);
  console.log(`LP tokens: ${result.lpTokensReceived}`);
}
```

## Acceptance Criteria

✅ **Zap feature works for major assets**
- Supports USDC, XLM, and USDT
- Automatic asset splitting and swapping
- Real-time price fetching

✅ **User receives LP tokens in a single transaction**
- One-click deposit flow
- Automatic path payment execution
- LP tokens credited immediately

✅ **UI Implementation**
- Modal interface with clear UX
- Real-time quote display
- Success/error feedback
- Dashboard integration

✅ **Error Handling**
- Input validation
- Slippage protection
- Transaction failure handling
- User-friendly error messages

✅ **Testing Coverage**
- Comprehensive unit tests
- E2E tests for user flows
- Edge case coverage
- Integration tests

## Future Enhancements

### Potential Improvements

1. **Multiple Pool Support**
   - Add strategies for other liquidity pools
   - Registry pattern for pool discovery

2. **Advanced Path Finding**
   - Multi-hop path payments
   - Optimized routing for better rates

3. **Historical Analytics**
   - Track zap transaction history
   - Display average slippage statistics
   - Show cumulative LP token earnings

4. **Gas Optimization**
   - Batch multiple operations
   - Smart contract optimizations

5. **Additional Assets**
   - Support for more tokens
   - Custom token support

## Troubleshooting

### Common Issues

**Q: Quote fetch fails**
```
A: Check network connectivity and CoinGecko API availability
```

**Q: Transaction fails with high slippage**
```
A: Increase slippage tolerance or reduce deposit amount
```

**Q: Modal doesn't open**
```
A: Ensure ZapModal.ts is properly imported and initialized
```

**Q: LP tokens not updating**
```
A: Check localStorage permissions and dashboard event listeners
```

## Security Considerations

1. **Slippage Protection**: Always enforced to prevent sandwich attacks
2. **Input Validation**: All inputs sanitized and validated
3. **Transaction Simulation**: Pre-flight checks before execution
4. **Error Boundaries**: Graceful error handling throughout

## Performance

- **Quote Generation**: ~500ms (includes price fetch)
- **Transaction Execution**: ~2-3 seconds (simulated)
- **UI Responsiveness**: Async operations with loading states
- **Caching**: Price data cached for 5 minutes

## License

MIT License - See LICENSE file for details

## Support

For issues or questions:
- GitHub Issues: [github.com/sharif-stellar-tools/yield-aggregator-app/issues](https://github.com/sharif-stellar-tools/yield-aggregator-app/issues)
- Documentation: [README.md](../README.md)
