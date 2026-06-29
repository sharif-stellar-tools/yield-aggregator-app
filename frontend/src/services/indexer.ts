import type { VaultData, GlobalData } from '../types';

// Generate 30 days of mock historical APY data
const generateHistoricalApy = (baseApy: number, volatility: number) => {
  const data = [];
  const now = new Date();
  let currentApy = baseApy;

  for (let i = 30; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // Random walk for APY
    const change = (Math.random() - 0.5) * volatility;
    currentApy = Math.max(0.1, currentApy + change);
    
    data.push({
      date: date.toISOString().split('T')[0],
      apy: Number(currentApy.toFixed(2))
    });
  }
  return data;
};

const MOCK_VAULTS: VaultData[] = [
  {
    id: 'vault-xlm-1',
    name: 'XLM Liquidity Pool',
    asset: 'XLM',
    tvl: 2500000,
    currentApy: 12.5,
    historicalApy: generateHistoricalApy(12.5, 0.8)
  },
  {
    id: 'vault-usdc-1',
    name: 'USDC Yield Strategy',
    asset: 'USDC',
    tvl: 5400000,
    currentApy: 8.2,
    historicalApy: generateHistoricalApy(8.2, 0.3)
  },
  {
    id: 'vault-btc-1',
    name: 'Wrapped BTC Vault',
    asset: 'wBTC',
    tvl: 1200000,
    currentApy: 4.5,
    historicalApy: generateHistoricalApy(4.5, 0.2)
  }
];

export class IndexerService {
  static async getVaults(): Promise<VaultData[]> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));
    return MOCK_VAULTS;
  }

  static async getGlobalData(): Promise<GlobalData> {
    await new Promise(resolve => setTimeout(resolve, 600));
    const totalTvl = MOCK_VAULTS.reduce((sum, vault) => sum + vault.tvl, 0);
    return {
      totalTvl,
      activeVaults: MOCK_VAULTS.length
    };
  }
}
