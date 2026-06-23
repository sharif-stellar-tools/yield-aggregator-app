/**
 * Interface for Zap strategies that enable single-asset deposits into liquidity pools
 * A Zap allows users to deposit one asset (e.g., USDC) and automatically swap/split it
 * to provide liquidity in a pool that requires multiple assets
 */

export interface ZapQuote {
  /** Amount of input asset to deposit */
  inputAmount: number;
  /** Input asset symbol (e.g., 'USDC') */
  inputAsset: string;
  /** Estimated LP tokens to receive */
  estimatedLPTokens: number;
  /** Breakdown of how assets will be split */
  assetSplit: {
    asset: string;
    amount: number;
  }[];
  /** Estimated slippage in percentage */
  slippage: number;
  /** Expected APY for the LP position */
  apy: number;
}

export interface ZapResult {
  /** Transaction hash/ID */
  txHash: string;
  /** LP tokens received */
  lpTokensReceived: number;
  /** Actual slippage encountered */
  actualSlippage: number;
  /** Success status */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

export interface IZapStrategy {
  /** Strategy name */
  readonly name: string;
  
  /** Supported input assets for zapping */
  readonly supportedAssets: string[];
  
  /**
   * Get a quote for zapping into the liquidity pool
   * @param inputAsset - The asset to deposit (e.g., 'USDC')
   * @param amount - Amount to deposit
   * @returns Quote with estimated output and swap path
   */
  getZapQuote(inputAsset: string, amount: number): Promise<ZapQuote>;
  
  /**
   * Execute the zap transaction
   * @param inputAsset - The asset to deposit
   * @param amount - Amount to deposit
   * @param minLPTokens - Minimum LP tokens to accept (slippage protection)
   * @returns Result of the zap transaction
   */
  executeZap(inputAsset: string, amount: number, minLPTokens: number): Promise<ZapResult>;
  
  /**
   * Check if an asset is supported for zapping
   * @param asset - Asset symbol to check
   */
  isSupportedAsset(asset: string): boolean;
}
