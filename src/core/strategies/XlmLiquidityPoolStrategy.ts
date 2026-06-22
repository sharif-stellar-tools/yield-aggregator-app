import { IYieldStrategy, YieldMetrics } from './IYieldStrategy';

const XLM_APY = 0.05; // 5% APY
const SIMULATED_TVL = 1_000_000;

export class XlmLiquidityPoolStrategy implements IYieldStrategy {
  readonly name = 'XLM Liquidity Pool';

  async getAPY(): Promise<number> {
    return XLM_APY;
  }

  async getTVL(): Promise<number> {
    return SIMULATED_TVL;
  }

  async simulateDeposit(amount: number): Promise<number> {
    return amount * XLM_APY;
  }

  async getMetrics(): Promise<YieldMetrics> {
    const [apy, tvl] = await Promise.all([this.getAPY(), this.getTVL()]);
    return { apy, tvl };
  }
}