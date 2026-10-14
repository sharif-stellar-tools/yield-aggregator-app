import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { IndexerDatabase, ContractEvent } from '../src/db/database';

async function runTests() {
  console.log('Running SQLite Event Indexer Storage Tests...\n');

  // Test 1: In-memory initialization and schema seeding
  console.log('Test 1: In-memory initialization and schema seeding');
  const memDb = new IndexerDatabase(':memory:');
  const initialEvents = memDb.getEvents();
  assert.strictEqual(initialEvents.length, 3, 'Should seed 3 default events');
  const usdcVault = memDb.getVault('vault-usdc');
  assert.ok(usdcVault, 'Should seed vault-usdc');
  assert.strictEqual(usdcVault?.name, 'Soroban USDC Yield Vault');
  console.log('✓ Passed: In-memory database initialized with default seeded records.\n');

  // Test 2: Event insertion and retrieval
  console.log('Test 2: Event insertion and retrieval');
  const testEvent: ContractEvent = {
    id: 'evt_test_999',
    contractId: 'CD...CUSTOM_VAULT',
    type: 'Deposit',
    user: 'GD...TEST_USER',
    amount: '7500.50',
    timestamp: new Date().toISOString(),
  };
  memDb.insertEvent(testEvent);
  const retrievedEvent = memDb.getEventById('evt_test_999');
  assert.ok(retrievedEvent, 'Should find inserted event by ID');
  assert.strictEqual(retrievedEvent?.amount, '7500.50');
  assert.strictEqual(retrievedEvent?.contractId, 'CD...CUSTOM_VAULT');

  // Test 3: Contract ID filtering
  console.log('Test 3: Contract ID filtering');
  const filteredEvents = memDb.getEvents('CD...CUSTOM_VAULT');
  assert.strictEqual(filteredEvents.length, 1, 'Should return only 1 matching event');
  assert.strictEqual(filteredEvents[0].id, 'evt_test_999');

  const defaultEvents = memDb.getEvents('CD...USDC_VAULT');
  assert.strictEqual(defaultEvents.length, 3, 'Should return 3 USDC vault events');
  console.log('✓ Passed: Event insertion and filtering by contractId operate correctly.\n');

  // Test 4: TVL updates on Vault
  console.log('Test 4: TVL updates on Vault');
  const vaultBefore = memDb.getVault('vault-usdc')!;
  const tvlBefore = vaultBefore.tvl;
  memDb.updateVaultTvl('vault-usdc', 5000);
  const vaultAfterDeposit = memDb.getVault('vault-usdc')!;
  assert.strictEqual(vaultAfterDeposit.tvl, tvlBefore + 5000, 'TVL should increase by 5000 on deposit');

  memDb.updateVaultTvl('vault-usdc', -2000);
  const vaultAfterWithdrawal = memDb.getVault('vault-usdc')!;
  assert.strictEqual(vaultAfterWithdrawal.tvl, tvlBefore + 3000, 'TVL should reflect withdrawal decrease');
  console.log('✓ Passed: Vault TVL updates accurately reflect deposits and withdrawals.\n');

  memDb.close();

  // Test 5: Persistence across server restarts (Disk-backed database)
  console.log('Test 5: Persistence across server restarts (Disk DB)');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yield-indexer-test-'));
  const dbFile = path.join(tmpDir, 'indexer_persistence.db');

  // First session: open DB, insert event, close DB
  const session1Db = new IndexerDatabase(dbFile);
  const persistentEvent: ContractEvent = {
    id: 'evt_persisted_101',
    contractId: 'CD...PERSISTENT_VAULT',
    type: 'StrategyAllocated',
    user: 'GD...ADMIN_PERSIST',
    amount: '12345.00',
    timestamp: new Date().toISOString(),
  };
  session1Db.insertEvent(persistentEvent);
  session1Db.updateVaultTvl('vault-usdc', 9999);
  session1Db.close();

  // Second session (simulating server reboot): reopen same DB file
  const session2Db = new IndexerDatabase(dbFile);
  const fetchedAfterReboot = session2Db.getEventById('evt_persisted_101');
  assert.ok(fetchedAfterReboot, 'Event must persist across database re-open/server restart');
  assert.strictEqual(fetchedAfterReboot?.amount, '12345.00');

  const vaultAfterReboot = session2Db.getVault('vault-usdc');
  assert.ok(vaultAfterReboot, 'Vault state must persist across restart');
  assert.strictEqual(vaultAfterReboot?.tvl, 1250000 + 9999, 'Persisted TVL must reflect prior updates');
  session2Db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log('✓ Passed: Event and vault state successfully persisted across server restart.\n');

  // Test 6: Historical APY snapshots and cumulative rolling metrics calculation
  console.log('Test 6: Historical APY snapshots and cumulative rolling metrics calculation');
  const testDb = new IndexerDatabase(':memory:');
  const usdcMetrics = testDb.getCumulativeApyMetrics('vault-usdc');
  assert.ok(usdcMetrics, 'Cumulative metrics should exist for vault-usdc');
  assert.strictEqual(usdcMetrics?.vaultId, 'vault-usdc');
  assert.strictEqual(usdcMetrics?.sampleCount30d, 30, 'Should have 30 historical samples for 30d window');
  assert.ok(usdcMetrics?.sampleCount7d >= 7, 'Should have at least 7 samples for 7d window');
  assert.ok(usdcMetrics?.rollingAvg7d > 0, 'Rolling 7d APY should be positive');
  assert.ok(usdcMetrics?.rollingAvg30d > 0, 'Rolling 30d APY should be positive');
  console.log(`✓ Passed: Calculated rollingAvg7d = ${usdcMetrics?.rollingAvg7d}%, rollingAvg30d = ${usdcMetrics?.rollingAvg30d}% (samples: 7d=${usdcMetrics?.sampleCount7d}, 30d=${usdcMetrics?.sampleCount30d}).\n`);

  // Test 7: Recording new APY snapshot dynamically recalculates rolling metrics
  console.log('Test 7: Recording new APY snapshot dynamically recalculates metrics');
  const snapResult = testDb.recordApy('vault-usdc', 9.50);
  assert.strictEqual(snapResult.snapshot.apy, 9.50);
  assert.strictEqual(snapResult.snapshot.vaultId, 'vault-usdc');
  assert.strictEqual(snapResult.metrics.currentApy, 9.50);

  const updatedVault = testDb.getVault('vault-usdc');
  assert.strictEqual(updatedVault?.apy, 9.50, 'Vault APY should update to latest snapshot');

  const snapshots = testDb.getApySnapshots('vault-usdc', 5);
  assert.strictEqual(snapshots[0].apy, 9.50, 'Latest snapshot should be 9.50');
  console.log('✓ Passed: Dynamic snapshot recording updates current APY and rolling averages.\n');

  testDb.close();

  // Test 8: APY snapshots and cumulative metrics persistence across reboot
  console.log('Test 8: APY persistence across server restarts (Disk DB)');
  const apyTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yield-apy-test-'));
  const apyDbFile = path.join(apyTmpDir, 'apy_persistence.db');

  const diskDb1 = new IndexerDatabase(apyDbFile);
  diskDb1.recordApy('vault-xlm', 5.25);
  const diskMetricsBefore = diskDb1.getCumulativeApyMetrics('vault-xlm');
  assert.strictEqual(diskMetricsBefore?.currentApy, 5.25);
  diskDb1.close();

  const diskDb2 = new IndexerDatabase(apyDbFile);
  const diskMetricsAfter = diskDb2.getCumulativeApyMetrics('vault-xlm');
  assert.ok(diskMetricsAfter, 'Cumulative metrics must persist across restart');
  assert.strictEqual(diskMetricsAfter?.currentApy, 5.25, 'Current APY must match persisted value');
  assert.strictEqual(diskMetricsAfter?.rollingAvg7d, diskMetricsBefore?.rollingAvg7d);
  assert.strictEqual(diskMetricsAfter?.rollingAvg30d, diskMetricsBefore?.rollingAvg30d);

  const persistedSnaps = diskDb2.getApySnapshots('vault-xlm', 1);
  assert.strictEqual(persistedSnaps[0].apy, 5.25, 'Persisted snapshot must be intact');
  diskDb2.close();

  fs.rmSync(apyTmpDir, { recursive: true, force: true });
  console.log('✓ Passed: APY metrics and history fully persist across database restarts.\n');

  console.log('All SQLite database storage tests passed successfully! (8/8)');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
