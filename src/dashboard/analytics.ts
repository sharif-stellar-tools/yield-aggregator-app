import { IndexerDatabase } from '../db/database';
import {
  VaultDashboardData,
  VaultMetrics,
  TvlDataPoint,
  ApyHistoryPoint,
  DepositQueueItem,
} from './types';

export function getMockTvlHistory(baseTvl: number): TvlDataPoint[] {
  const points: TvlDataPoint[] = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = 14; i >= 0; i--) {
    const timestamp = new Date(now - i * dayMs).toISOString().split('T')[0];
    const variance = 1 + (Math.sin(i / 2) * 0.08) - (i * 0.005);
    const tvlUSD = Math.round(baseTvl * variance);
    points.push({
      timestamp,
      tvlUSD,
      totalShares: Math.round(tvlUSD * 0.95),
    });
  }
  return points;
}

export function getMockApyHistory(): ApyHistoryPoint[] {
  const points: ApyHistoryPoint[] = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = 14; i >= 0; i--) {
    const timestamp = new Date(now - i * dayMs).toISOString().split('T')[0];
    const baseApy = 11.5 + (Math.cos(i / 3) * 1.8);
    points.push({
      timestamp,
      apyPercent: parseFloat(baseApy.toFixed(2)),
      strategyAllocations: [
        { strategyName: 'Aqua AMM Liquidity', percentage: 45, currentApr: 14.2 },
        { strategyName: 'Soroswap LP Yield', percentage: 35, currentApr: 10.8 },
        { strategyName: 'Stellar Blend Lending', percentage: 20, currentApr: 7.5 },
      ],
    });
  }
  return points;
}

export function getMockActiveQueue(): DepositQueueItem[] {
  return [
    {
      id: 'dep_q_101',
      userAddress: 'GD...ALICE',
      amount: '5000.00',
      asset: 'USDC',
      status: 'processing',
      timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
      estimatedSettlement: '< 1 min',
    },
    {
      id: 'dep_q_102',
      userAddress: 'GD...BOB',
      amount: '12500.50',
      asset: 'USDC',
      status: 'queued',
      timestamp: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
      estimatedSettlement: '~ 3 mins',
    },
    {
      id: 'dep_q_103',
      userAddress: 'GD...CHARLIE',
      amount: '800.00',
      asset: 'USDC',
      status: 'queued',
      timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      estimatedSettlement: '~ 5 mins',
    },
    {
      id: 'dep_q_104',
      userAddress: 'GD...DAVE',
      amount: '25000.00',
      asset: 'USDC',
      status: 'settled',
      timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
      estimatedSettlement: 'Settled',
    },
  ];
}

export function compileVaultAnalytics(
  vaultId: string,
  db?: IndexerDatabase
): VaultDashboardData {
  let baseTvl = 1_250_000;
  let vaultName = 'Soroban Multi-Strategy Yield Vault';

  if (db) {
    const vault = db.getVault(vaultId);
    if (vault) {
      baseTvl = vault.tvl;
      vaultName = vault.name;
    }
  }

  const tvlHistory = getMockTvlHistory(baseTvl);
  const apyHistory = getMockApyHistory();
  const activeQueue = getMockActiveQueue();

  const prevTvl = tvlHistory[tvlHistory.length - 2]?.tvlUSD || baseTvl;
  const currentTvl = tvlHistory[tvlHistory.length - 1]?.tvlUSD || baseTvl;
  const tvlChange24hPercent = parseFloat(
    (((currentTvl - prevTvl) / prevTvl) * 100).toFixed(2)
  );

  const pendingQueueVolume = activeQueue
    .filter((q) => q.status === 'queued' || q.status === 'processing')
    .reduce((sum, q) => sum + parseFloat(q.amount), 0);

  const metrics: VaultMetrics = {
    vaultId,
    vaultName,
    assetSymbol: 'USDC',
    currentTvl,
    tvlChange24hPercent,
    currentApy: apyHistory[apyHistory.length - 1].apyPercent,
    averageApy30d: 11.2,
    totalActiveDepositors: 142,
    pendingQueueVolume,
  };

  return {
    metrics,
    tvlHistory,
    apyHistory,
    activeQueue,
  };
}
