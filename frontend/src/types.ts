export interface ApyDataPoint {
  date: string;
  apy: number;
}

export interface VaultData {
  id: string;
  name: string;
  asset: string;
  tvl: number;
  currentApy: number;
  historicalApy: ApyDataPoint[];
}

export interface GlobalData {
  totalTvl: number;
  activeVaults: number;
}
