import { IYieldStrategy, YieldMetrics } from './IYieldStrategy';

const PROTOCOL_APY = 0.083; // 8.3% APY
const PROTOCOL_TVL = 2_000_000; // $2M TVL

export class YourProtocolStrategy implements IYieldStrategy {
  readonly name = 'Your Protocol';

  async getAPY(): Promise<number> {
    return PROTOCOL_APY;
  }

  async getTVL(): Promise<number> {
    return PROTOCOL_TVL;
  }

  async simulateDeposit(amount: number): Promise<number> {
    if (amount < 0) {
      throw new Error('Amount must be non-negative');
    }
    return amount * PROTOCOL_APY;
  }

  async getMetrics(): Promise<YieldMetrics> {
    const [apy, tvl] = await Promise.all([this.getAPY(), this.getTVL()]);
    return { apy, tvl };
  }
}
