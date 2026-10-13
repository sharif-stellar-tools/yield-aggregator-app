import assert from 'assert';
import { compileVaultAnalytics } from '../src/dashboard/analytics';
import { generateDashboardHtml } from '../src/dashboard/prototype';
import { IndexerDatabase } from '../src/db/database';

async function runDashboardTests() {
  console.log('Running Vault Analytics Dashboard Tests...\n');

  const memDb = new IndexerDatabase(':memory:');

  // Test 1: Compile vault analytics from database
  console.log('Test 1: Compile vault analytics data structure');
  const dashboardData = compileVaultAnalytics('vault-usdc', memDb);

  assert.strictEqual(dashboardData.metrics.vaultId, 'vault-usdc');
  assert.strictEqual(dashboardData.metrics.assetSymbol, 'USDC');
  assert.strictEqual(dashboardData.metrics.currentTvl, 1_250_000);
  assert.strictEqual(dashboardData.tvlHistory.length, 15, 'Should generate 15-day TVL history');
  assert.strictEqual(dashboardData.apyHistory.length, 15, 'Should generate 15-day APY history');
  assert.ok(dashboardData.activeQueue.length >= 3, 'Should have active deposit queue items');
  console.log('✓ Passed: Vault analytics data compiled correctly.\n');

  // Test 2: Deposit queue validation
  console.log('Test 2: Deposit queue items and pending volume');
  assert.ok(dashboardData.metrics.pendingQueueVolume > 0, 'Pending queue volume should be greater than 0');
  const processingItem = dashboardData.activeQueue.find(q => q.status === 'processing');
  assert.ok(processingItem, 'Should contain item with processing status');
  console.log('✓ Passed: Deposit queue volume and statuses validated.\n');

  // Test 3: Generate responsive HTML dashboard mockup
  console.log('Test 3: Generate responsive UI HTML dashboard prototype');
  const html = generateDashboardHtml(dashboardData);
  assert.ok(html.includes('<!DOCTYPE html>'), 'Must produce valid HTML document');
  assert.ok(html.includes('Total Value Locked (TVL)'), 'Must contain TVL header card');
  assert.ok(html.includes('Current Net APY'), 'Must contain APY card');
  assert.ok(html.includes('Active Deposit &amp; Rebalance Queue') || html.includes('Active Deposit & Rebalance Queue'), 'Must contain Deposit Queue section');
  assert.ok(html.includes('<svg'), 'Must include SVG chart representation');
  console.log('✓ Passed: Responsive dashboard HTML prototype rendered successfully.\n');

  memDb.close();
  console.log('All Vault Analytics Dashboard tests passed! (3/3)\n');
}

runDashboardTests().catch(err => {
  console.error('Dashboard tests failed:', err);
  process.exit(1);
});
