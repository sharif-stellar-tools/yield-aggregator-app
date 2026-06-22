export interface YieldMetrics {
  apy: number;
  tvl: number;
}

export interface IYieldStrategy {
  readonly name: string;
  getAPY(): Promise<number>;
  getTVL(): Promise<number>;
  simulateDeposit(amount: number): Promise<number>;
  getMetrics(): Promise<YieldMetrics>;
}