/**
 * tests/sim.test.ts
 *
 * CI smoke-test and unit tests for the `yarn sim` vault simulation CLI.
 *
 * Coverage:
 *   • parseScenario  — YAML config validation
 *   • VaultSandbox   — in-memory vault math (deposit / compound / withdraw)
 *   • Integration    — basic.yaml scenario runs end-to-end in < 10 s
 */

import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { parseScenario, ScenarioConfig } from '../src/cli/scenarioParser';
import { VaultSandbox } from '../src/cli/vaultSandbox';

// ─── parseScenario unit tests ─────────────────────────────────────────────────

describe('parseScenario', () => {
  const validRaw = {
    name: 'Test Scenario',
    apy_percent: 10,
    cycles: 5,
    compound_interval_seconds: 86400,
    fee_percent: 0.5,
    users: [
      { name: 'Alice', deposit_amount: 1000 },
    ],
  };

  it('parses a valid scenario without error', () => {
    const config = parseScenario(validRaw);
    expect(config.name).to.equal('Test Scenario');
    expect(config.apy_percent).to.equal(10);
    expect(config.cycles).to.equal(5);
    expect(config.compound_interval_seconds).to.equal(86400);
    expect(config.fee_percent).to.equal(0.5);
    expect(config.users).to.have.length(1);
    expect(config.users[0].name).to.equal('Alice');
    expect(config.users[0].deposit_amount).to.equal(1000);
  });

  it('sets withdraw_after_cycle when provided', () => {
    const raw = {
      ...validRaw,
      users: [{ name: 'Bob', deposit_amount: 500, withdraw_after_cycle: 3 }],
    };
    const config = parseScenario(raw);
    expect(config.users[0].withdraw_after_cycle).to.equal(3);
  });

  it('leaves withdraw_after_cycle undefined when omitted', () => {
    const config = parseScenario(validRaw);
    expect(config.users[0].withdraw_after_cycle).to.be.undefined;
  });

  it('throws when name is missing', () => {
    const raw = { ...validRaw };
    delete (raw as Record<string, unknown>)['name'];
    expect(() => parseScenario(raw)).to.throw(/name/);
  });

  it('throws when apy_percent is missing', () => {
    const raw = { ...validRaw };
    delete (raw as Record<string, unknown>)['apy_percent'];
    expect(() => parseScenario(raw)).to.throw(/apy_percent/);
  });

  it('throws when cycles is not an integer', () => {
    expect(() => parseScenario({ ...validRaw, cycles: 5.5 })).to.throw(/integer/);
  });

  it('throws when apy_percent is zero', () => {
    expect(() => parseScenario({ ...validRaw, apy_percent: 0 })).to.throw(/positive/);
  });

  it('throws when fee_percent >= 100', () => {
    expect(() => parseScenario({ ...validRaw, fee_percent: 100 })).to.throw(/less than 100/);
  });

  it('throws when users array is empty', () => {
    expect(() => parseScenario({ ...validRaw, users: [] })).to.throw(/non-empty/);
  });

  it('throws when a user deposit_amount is zero', () => {
    expect(() => parseScenario({
      ...validRaw,
      users: [{ name: 'X', deposit_amount: 0 }],
    })).to.throw(/positive/);
  });

  it('throws when raw input is not an object', () => {
    expect(() => parseScenario('not an object')).to.throw(/mapping/);
    expect(() => parseScenario(null)).to.throw(/mapping/);
    expect(() => parseScenario([1, 2])).to.throw(/mapping/);
  });
});

// ─── VaultSandbox unit tests ──────────────────────────────────────────────────

describe('VaultSandbox', () => {
  function makeScenario(overrides: Partial<ScenarioConfig> = {}): ScenarioConfig {
    return {
      name: 'Unit Test',
      apy_percent: 12,
      cycles: 10,
      compound_interval_seconds: 86400,
      fee_percent: 0,
      users: [{ name: 'Alice', deposit_amount: 1000 }],
      ...overrides,
    };
  }

  it('returns one cycle row per cycle', () => {
    const report = new VaultSandbox(makeScenario({ cycles: 5 })).run();
    expect(report.cycleRows).to.have.length(5);
  });

  it('first deposit mints shares 1:1', () => {
    const report = new VaultSandbox(makeScenario({ cycles: 1 })).run();
    const user = report.userSummaries[0];
    // 1:1 at deposit, shares == deposit_amount
    expect(user.shares).to.equal(1000);
  });

  it('final balance exceeds initial deposit after compounding (no fees)', () => {
    const report = new VaultSandbox(makeScenario({ cycles: 10, fee_percent: 0 })).run();
    const user = report.userSummaries[0];
    expect(user.finalBalance).to.be.greaterThan(user.deposited);
  });

  it('net yield is non-negative', () => {
    const report = new VaultSandbox(makeScenario({ cycles: 10 })).run();
    for (const u of report.userSummaries) {
      expect(u.netYield).to.be.at.least(0);
    }
  });

  it('compound_count equals number of cycles', () => {
    const report = new VaultSandbox(makeScenario({ cycles: 7 })).run();
    expect(report.totals.compoundCount).to.equal(7);
  });

  it('total yield harvested matches sum of cycle yields', () => {
    const report = new VaultSandbox(makeScenario({ cycles: 10, fee_percent: 0 })).run();
    const summedYield = report.cycleRows.reduce((s, r) => s + r.yieldAdded, 0);
    expect(report.totals.totalYieldHarvested).to.be.closeTo(summedYield, 1e-9);
  });

  it('share price increases monotonically when fee_percent = 0', () => {
    const report = new VaultSandbox(makeScenario({ cycles: 10, fee_percent: 0 })).run();
    for (let i = 1; i < report.cycleRows.length; i++) {
      expect(report.cycleRows[i].sharePrice).to.be.greaterThan(report.cycleRows[i - 1].sharePrice);
    }
  });

  it('fee_percent reduces final user balance vs zero-fee scenario', () => {
    const noFee = new VaultSandbox(makeScenario({ cycles: 10, fee_percent: 0 })).run();
    const withFee = new VaultSandbox(makeScenario({ cycles: 10, fee_percent: 1.0 })).run();
    expect(withFee.userSummaries[0].finalBalance).to.be.lessThan(noFee.userSummaries[0].finalBalance);
  });

  it('user who withdraws early gets proportionally less yield', () => {
    const earlyExit = new VaultSandbox(makeScenario({
      cycles: 10,
      fee_percent: 0,
      users: [{ name: 'Alice', deposit_amount: 1000, withdraw_after_cycle: 5 }],
    })).run();
    const fullHold = new VaultSandbox(makeScenario({ cycles: 10, fee_percent: 0 })).run();
    expect(earlyExit.userSummaries[0].finalBalance).to.be.lessThan(fullHold.userSummaries[0].finalBalance);
  });

  it('multiple users get shares proportional to deposits', () => {
    const report = new VaultSandbox(makeScenario({
      cycles: 1,
      users: [
        { name: 'Alice', deposit_amount: 1000 },
        { name: 'Bob', deposit_amount: 500 },
      ],
    })).run();
    const alice = report.userSummaries.find(u => u.name === 'Alice')!;
    const bob = report.userSummaries.find(u => u.name === 'Bob')!;
    // Alice deposited 2x Bob, so should get 2x yield
    expect(alice.netYield).to.be.closeTo(bob.netYield * 2, 1e-6);
  });

  it('matches manual calculation within floating-point tolerance', () => {
    // 1 cycle, 10% APY, 1 day interval, no fees, 1000 deposit
    // rate_per_cycle = (1.10)^(86400/31557600) - 1
    const SECONDS_PER_YEAR = 365.25 * 24 * 3600;
    const rate = Math.pow(1.10, 86400 / SECONDS_PER_YEAR) - 1;
    const expectedYield = 1000 * rate;

    const report = new VaultSandbox(makeScenario({
      apy_percent: 10,
      cycles: 1,
      compound_interval_seconds: 86400,
      fee_percent: 0,
    })).run();

    const actualYield = report.cycleRows[0].yieldAdded;
    expect(actualYield).to.be.closeTo(expectedYield, 1e-10);
  });

  it('simulated_seconds equals cycles * compound_interval_seconds', () => {
    const scenario = makeScenario({ cycles: 20, compound_interval_seconds: 3600 });
    const report = new VaultSandbox(scenario).run();
    expect(report.totals.simulatedSeconds).to.equal(20 * 3600);
  });
});

// ─── CI smoke test: basic.yaml scenario ──────────────────────────────────────

describe('Smoke test — basic.yaml scenario', () => {
  let config: ScenarioConfig;

  before(() => {
    const scenarioPath = path.resolve(__dirname, '..', 'scenarios', 'basic.yaml');
    expect(fs.existsSync(scenarioPath), `basic.yaml must exist at ${scenarioPath}`).to.be.true;
    const raw = yaml.load(fs.readFileSync(scenarioPath, 'utf8'));
    config = parseScenario(raw);
  });

  it('parses basic.yaml without errors', () => {
    expect(config).to.be.an('object');
    expect(config.cycles).to.be.a('number');
    expect(config.users.length).to.be.at.least(1);
  });

  it('completes the basic scenario in under 10 seconds', () => {
    const start = Date.now();
    const report = new VaultSandbox(config).run();
    const elapsed = Date.now() - start;
    expect(elapsed).to.be.lessThan(10_000, `Simulation took ${elapsed}ms (limit: 10,000ms)`);
    expect(report.cycleRows).to.have.length(config.cycles);
  });

  it('all users have positive final balance', () => {
    const report = new VaultSandbox(config).run();
    for (const u of report.userSummaries) {
      expect(u.finalBalance).to.be.greaterThan(0, `${u.name} should have a positive final balance`);
    }
  });
});

// ─── CI smoke test: advanced.yaml 100-cycle scenario ─────────────────────────

describe('Smoke test — advanced.yaml 100-cycle scenario', () => {
  let config: ScenarioConfig;

  before(() => {
    const scenarioPath = path.resolve(__dirname, '..', 'scenarios', 'advanced.yaml');
    expect(fs.existsSync(scenarioPath), `advanced.yaml must exist at ${scenarioPath}`).to.be.true;
    const raw = yaml.load(fs.readFileSync(scenarioPath, 'utf8'));
    config = parseScenario(raw);
  });

  it('parses advanced.yaml without errors', () => {
    expect(config).to.be.an('object');
    expect(config.cycles).to.equal(100);
    expect(config.users.length).to.equal(5);
  });

  it('completes 100 cycles in under 10 seconds', () => {
    const start = Date.now();
    const report = new VaultSandbox(config).run();
    const elapsed = Date.now() - start;
    expect(elapsed).to.be.lessThan(
      10_000,
      `100-cycle simulation took ${elapsed}ms — must complete in under 10,000ms`
    );
    expect(report.cycleRows).to.have.length(100);
  });

  it('total yield harvested is positive', () => {
    const report = new VaultSandbox(config).run();
    expect(report.totals.totalYieldHarvested).to.be.greaterThan(0);
  });
});
