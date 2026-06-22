import { expect } from 'chai';
import { StrategyRegistry } from '../src/core/strategies/StrategyRegistry';
import { XlmLiquidityPoolStrategy } from '../src/core/strategies/XlmLiquidityPoolStrategy';

describe('StrategyRegistry', () => {
  let registry: StrategyRegistry;

  beforeEach(() => {
    registry = StrategyRegistry.getInstance();
  });

  it('is a singleton', () => {
    const another = StrategyRegistry.getInstance();
    expect(registry).to.equal(another);
  });

  it('has XLM Liquidity Pool registered by default', () => {
    const names = registry.getNames();
    expect(names).to.include('XLM Liquidity Pool');
  });

  it('returns a strategy by name', () => {
    const strategy = registry.get('XLM Liquidity Pool');
    expect(strategy).to.be.instanceOf(XlmLiquidityPoolStrategy);
  });

  it('returns undefined for unknown strategy', () => {
    expect(registry.get('nonexistent')).to.be.undefined;
  });

  it('lists all registered strategies', () => {
    const all = registry.getAll();
    expect(all.length).to.be.at.least(1);
  });
});

describe('XlmLiquidityPoolStrategy', () => {
  const strategy = new XlmLiquidityPoolStrategy();

  it('has a name', () => {
    expect(strategy.name).to.equal('XLM Liquidity Pool');
  });

  it('returns APY', async () => {
    const apy = await strategy.getAPY();
    expect(apy).to.equal(0.05);
  });

  it('returns TVL', async () => {
    const tvl = await strategy.getTVL();
    expect(tvl).to.equal(1_000_000);
  });

  it('simulates deposit', async () => {
    const result = await strategy.simulateDeposit(1000);
    expect(result).to.equal(50);
  });

  it('returns metrics', async () => {
    const metrics = await strategy.getMetrics();
    expect(metrics).to.deep.equal({ apy: 0.05, tvl: 1_000_000 });
  });
});