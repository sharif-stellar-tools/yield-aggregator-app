export interface TvlDataPoint {
  timestamp: string;
  tvlUSD: number;
  totalShares: number;
}

export interface ApyHistoryPoint {
  timestamp: string;
  apyPercent: number;
  strategyAllocations: {
    strategyName: string;
    percentage: number;
    currentApr: number;
  }[];
}

export interface DepositQueueItem {
  id: string;
  userAddress: string;
  amount: string;
  asset: string;
  status: 'queued' | 'processing' | 'settled';
  timestamp: string;
  estimatedSettlement: string;
}

export interface VaultMetrics {
  vaultId: string;
  vaultName: string;
  assetSymbol: string;
  currentTvl: number;
  tvlChange24hPercent: number;
  currentApy: number;
  averageApy30d: number;
  totalActiveDepositors: number;
  pendingQueueVolume: number;
}

export interface VaultDashboardData {
  metrics: VaultMetrics;
  tvlHistory: TvlDataPoint[];
  apyHistory: ApyHistoryPoint[];
  activeQueue: DepositQueueItem[];
}
