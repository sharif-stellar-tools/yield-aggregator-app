import { VaultDashboardData } from './types';

/**
 * Generates responsive HTML/CSS prototype markup for the Vault Analytics Dashboard.
 */
export function generateDashboardHtml(data: VaultDashboardData): string {
  const { metrics, tvlHistory, apyHistory, activeQueue } = data;

  const tvlPointsSvg = tvlHistory.map((pt, idx) => {
    const x = 30 + (idx * 55);
    const minTvl = Math.min(...tvlHistory.map(p => p.tvlUSD));
    const maxTvl = Math.max(...tvlHistory.map(p => p.tvlUSD));
    const normalizedY = 160 - ((pt.tvlUSD - minTvl) / (maxTvl - minTvl || 1)) * 120;
    return `${x},${normalizedY.toFixed(1)}`;
  }).join(' ');

  const queueRows = activeQueue.map(q => {
    const statusColor = q.status === 'processing' ? '#f59e0b' : q.status === 'queued' ? '#3b82f6' : '#10b981';
    return `
      <tr style="border-bottom: 1px solid #334155;">
        <td style="padding: 12px; font-family: monospace;">${q.id}</td>
        <td style="padding: 12px; font-family: monospace;">${q.userAddress}</td>
        <td style="padding: 12px; font-weight: bold;">${parseFloat(q.amount).toLocaleString()} ${q.asset}</td>
        <td style="padding: 12px;">
          <span style="background: ${statusColor}22; color: ${statusColor}; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
            ${q.status}
          </span>
        </td>
        <td style="padding: 12px; color: #94a3b8;">${q.estimatedSettlement}</td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${metrics.vaultName} - Analytics Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #0b0f19;
      color: #f8fafc;
      padding: 24px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; }
    .title { font-size: 24px; font-weight: 700; color: #38bdf8; }
    .badge { background: #1e293b; padding: 6px 14px; border-radius: 8px; font-size: 13px; color: #94a3b8; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card { background: #131b2e; border: 1px solid #1e293b; border-radius: 12px; padding: 20px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2); }
    .card-title { font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 8px; }
    .card-value { font-size: 28px; font-weight: 700; color: #f8fafc; }
    .card-trend { font-size: 13px; font-weight: 600; margin-top: 6px; }
    .trend-pos { color: #10b981; }
    .trend-neg { color: #ef4444; }
    .chart-section { background: #131b2e; border: 1px solid #1e293b; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
    .chart-container { width: 100%; overflow-x: auto; }
    svg { width: 100%; height: 200px; }
    .table-container { width: 100%; overflow-x: auto; background: #131b2e; border: 1px solid #1e293b; border-radius: 12px; }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th { padding: 14px 12px; background: #1e293b; color: #94a3b8; font-size: 12px; text-transform: uppercase; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1 class="title">${metrics.vaultName}</h1>
        <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Vault ID: ${metrics.vaultId} | Underlying Asset: ${metrics.assetSymbol}</p>
      </div>
      <div class="badge">Live Soroban Ledger Feed</div>
    </div>

    <!-- Analytics Metric Cards -->
    <div class="grid">
      <div class="card">
        <div class="card-title">Total Value Locked (TVL)</div>
        <div class="card-value">$${metrics.currentTvl.toLocaleString()}</div>
        <div class="card-trend ${metrics.tvlChange24hPercent >= 0 ? 'trend-pos' : 'trend-neg'}">
          ${metrics.tvlChange24hPercent >= 0 ? '+' : ''}${metrics.tvlChange24hPercent}% (24h)
        </div>
      </div>
      <div class="card">
        <div class="card-title">Current Net APY</div>
        <div class="card-value" style="color: #38bdf8;">${metrics.currentApy}%</div>
        <div class="card-trend" style="color: #94a3b8;">30d Avg: ${metrics.averageApy30d}%</div>
      </div>
      <div class="card">
        <div class="card-title">Active Depositors</div>
        <div class="card-value">${metrics.totalActiveDepositors}</div>
        <div class="card-trend" style="color: #94a3b8;">Across 3 protocol strategies</div>
      </div>
      <div class="card">
        <div class="card-title">Deposit Queue Volume</div>
        <div class="card-value">$${metrics.pendingQueueVolume.toLocaleString()}</div>
        <div class="card-trend" style="color: #f59e0b;">${activeQueue.filter(q => q.status !== 'settled').length} Pending Batches</div>
      </div>
    </div>

    <!-- TVL Historical Chart Visualization -->
    <div class="chart-section">
      <div class="header" style="margin-bottom: 12px;">
        <h2 style="font-size: 18px; color: #f8fafc;">TVL Performance (14-Day Trajectory)</h2>
        <span style="font-size: 13px; color: #38bdf8;">Peak: $${Math.max(...tvlHistory.map(p => p.tvlUSD)).toLocaleString()}</span>
      </div>
      <div class="chart-container">
        <svg viewBox="0 0 850 180">
          <defs>
            <linearGradient id="tvlGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.3"/>
              <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.0"/>
            </linearGradient>
          </defs>
          <polyline fill="none" stroke="#38bdf8" stroke-width="3" points="${tvlPointsSvg}" />
        </svg>
      </div>
    </div>

    <!-- Active Deposit Queue Table -->
    <div class="table-container">
      <div style="padding: 16px; border-bottom: 1px solid #1e293b;">
        <h2 style="font-size: 18px; color: #f8fafc;">Active Deposit & Rebalance Queue</h2>
      </div>
      <table>
        <thead>
          <tr>
            <th>Queue ID</th>
            <th>Depositor Address</th>
            <th>Amount</th>
            <th>Queue Status</th>
            <th>Estimated Settlement</th>
          </tr>
        </thead>
        <tbody>
          ${queueRows}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
}
