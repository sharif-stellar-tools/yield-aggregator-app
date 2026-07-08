#!/usr/bin/env ts-node
/**
 * yarn sim — In-memory Soroban vault simulation CLI
 *
 * Runs deposit → compound → withdraw cycles against an in-memory sandbox
 * that mirrors the AutoCompoundingVault contract logic, then prints a
 * detailed per-cycle report of balances, APY, and fees.
 *
 * Usage:
 *   yarn sim --scenario scenarios/basic.yaml
 *   yarn sim --scenario scenarios/advanced.yaml --cycles 50
 */

import * as fs from 'fs';
import * as path from 'path';
import { Command } from 'commander';
import * as yaml from 'js-yaml';
import Table from 'cli-table3';
import { ScenarioConfig, parseScenario } from './scenarioParser';
import { VaultSandbox } from './vaultSandbox';

const program = new Command();

program
  .name('sim')
  .description('Simulate Soroban vault deposit/compound/withdraw cycles in-memory')
  .requiredOption('-s, --scenario <path>', 'Path to a YAML scenario file')
  .option('-c, --cycles <number>', 'Override the number of compound cycles in the scenario')
  .option('--no-color', 'Disable colored output')
  .parse(process.argv);

const opts = program.opts<{ scenario: string; cycles?: string; color: boolean }>();

// ─── Load & parse scenario ────────────────────────────────────────────────────

const scenarioPath = path.resolve(process.cwd(), opts.scenario);
if (!fs.existsSync(scenarioPath)) {
  console.error(`Error: scenario file not found: ${scenarioPath}`);
  process.exit(1);
}

let rawConfig: unknown;
try {
  rawConfig = yaml.load(fs.readFileSync(scenarioPath, 'utf8'));
} catch (err) {
  console.error(`Error: failed to parse YAML scenario: ${(err as Error).message}`);
  process.exit(1);
}

let scenario: ScenarioConfig;
try {
  scenario = parseScenario(rawConfig);
} catch (err) {
  console.error(`Error: invalid scenario config: ${(err as Error).message}`);
  process.exit(1);
}

// CLI --cycles flag overrides scenario value
if (opts.cycles !== undefined) {
  const override = parseInt(opts.cycles, 10);
  if (isNaN(override) || override < 1) {
    console.error('Error: --cycles must be a positive integer');
    process.exit(1);
  }
  scenario.cycles = override;
}

// ─── Run simulation ───────────────────────────────────────────────────────────

console.log(`\n🚀  Soroban Vault Simulation`);
console.log(`   Scenario : ${scenario.name}`);
console.log(`   Cycles   : ${scenario.cycles}`);
console.log(`   APY      : ${(scenario.apy_percent).toFixed(2)}%`);
console.log(`   Compound : every ${scenario.compound_interval_seconds}s`);
console.log(`   Deposits : ${scenario.users.map(u => `${u.name} → ${u.deposit_amount}`).join(', ')}\n`);

const sandbox = new VaultSandbox(scenario);
const start = Date.now();
const report = sandbox.run();
const elapsed = Date.now() - start;

// ─── Render per-cycle table ───────────────────────────────────────────────────

const cycleTable = new Table({
  head: ['Cycle', 'Timestamp', 'Yield Added', 'Total Deposits', 'Total Shares', 'Share Price', 'Eff. APY %', 'Yield Harvested'],
  colAligns: ['right', 'right', 'right', 'right', 'right', 'right', 'right', 'right'],
  style: { head: opts.color ? ['cyan'] : [] },
});

for (const row of report.cycleRows) {
  cycleTable.push([
    row.cycle.toString(),
    row.timestamp.toLocaleString(),
    row.yieldAdded.toFixed(6),
    row.totalDeposits.toFixed(6),
    row.totalShares.toFixed(6),
    row.sharePrice.toFixed(8),
    row.effectiveApy.toFixed(4),
    row.totalYieldHarvested.toFixed(6),
  ]);
}

console.log('📊  Cycle-by-Cycle Report\n');
console.log(cycleTable.toString());

// ─── Render per-user withdrawal summary ──────────────────────────────────────

const userTable = new Table({
  head: ['User', 'Deposited', 'Shares', 'Final Balance', 'Net Yield', 'Effective APY %', 'Fee Paid'],
  colAligns: ['left', 'right', 'right', 'right', 'right', 'right', 'right'],
  style: { head: opts.color ? ['green'] : [] },
});

for (const u of report.userSummaries) {
  userTable.push([
    u.name,
    u.deposited.toFixed(6),
    u.shares.toFixed(6),
    u.finalBalance.toFixed(6),
    u.netYield.toFixed(6),
    u.effectiveApy.toFixed(4),
    u.feePaid.toFixed(6),
  ]);
}

console.log('\n👤  User Withdrawal Summary\n');
console.log(userTable.toString());

// ─── Totals ───────────────────────────────────────────────────────────────────

const summaryTable = new Table({
  head: ['Metric', 'Value'],
  style: { head: opts.color ? ['yellow'] : [] },
});

summaryTable.push(
  ['Total Deposited', report.totals.totalDeposited.toFixed(6)],
  ['Total Final TVL', report.totals.finalTvl.toFixed(6)],
  ['Total Yield Harvested', report.totals.totalYieldHarvested.toFixed(6)],
  ['Total Fees Collected', report.totals.totalFees.toFixed(6)],
  ['Compound Cycles', report.totals.compoundCount.toString()],
  ['Simulation Duration (simulated time)', `${report.totals.simulatedSeconds}s`],
  ['Wall-clock time', `${elapsed}ms`],
);

console.log('\n📈  Simulation Summary\n');
console.log(summaryTable.toString());

// ─── Acceptance-criteria check ────────────────────────────────────────────────

if (elapsed > 10_000) {
  console.warn(`\n⚠️  Warning: simulation took ${elapsed}ms (target < 10,000ms)`);
} else {
  console.log(`\n✅  Completed ${scenario.cycles} cycles in ${elapsed}ms (target < 10,000ms)`);
}
