import { IYieldStrategy } from './IYieldStrategy';
import { XlmLiquidityPoolStrategy } from './XlmLiquidityPoolStrategy';

export class StrategyRegistry {
  private strategies: Map<string, IYieldStrategy> = new Map();
  private static instance: StrategyRegistry;

  static getInstance(): StrategyRegistry {
    if (!StrategyRegistry.instance) {
      StrategyRegistry.instance = new StrategyRegistry();
    }
    return StrategyRegistry.instance;
  }

  register(strategy: IYieldStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  get(name: string): IYieldStrategy | undefined {
    return this.strategies.get(name);
  }

  getAll(): IYieldStrategy[] {
    return Array.from(this.strategies.values());
  }

  getNames(): string[] {
    return Array.from(this.strategies.keys());
  }
}

// Auto-register built-in strategies
(function registerDefaults() {
  const registry = StrategyRegistry.getInstance();
  registry.register(new XlmLiquidityPoolStrategy());
})();