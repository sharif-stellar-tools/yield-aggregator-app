/**
 * VaultSandbox — in-memory simulation of the AutoCompoundingVault Soroban contract.
 *
 * Mirrors the on-chain logic from contracts/auto-compounding-vault/src/lib.rs:
 *   • deposit  — mints shares proportional to current total_deposits/total_shares
 *   • compound — adds yield to total_deposits (before fee deduction)
 *   • withdraw — redeems shares for a proportional amount of total_deposits
 *
 * The simulation advances a virtual clock by `compound_interval_seconds` on
 * each cycle, computing per-cycle yield from the annualised APY.
 */

import { ScenarioConfig } from './scenarioParser';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Mirrors VaultState in the Soroban contract */
interface VaultState {
  total_deposits: number;
  total_shares: number;
  last_compound_ts: number;
  compound_count: number;
  total_yield_harvested: number;
}

/** Per-user runtime state */
interface UserState {
  name: string;
  deposit_amount: number;
  shares: number;
  withdraw_after_cycle: number;
  withdrawn: boolean;
  final_balance: number;
  fee_paid: number;
}

/** One row in the per-cycle output table */
export interface CycleRow {
  cycle: number;
  timestamp: Date;
  yieldAdded: number;
  totalDeposits: number;
  totalShares: number;
  sharePrice: number;
  effectiveApy: number;
  totalYieldHarvested: number;
}

/** Per-user withdrawal summary */
export interface UserSummary {
  name: string;
  deposited: number;
  shares: number;
  finalBalance: number;
  netYield: number;
  effectiveApy: number;
  feePaid: number;
}

/** Top-level simulation report returned by VaultSandbox.run() */
export interface SimulationReport {
  cycleRows: CycleRow[];
  userSummaries: UserSummary[];
  totals: {
    totalDeposited: number;
    finalTvl: number;
    totalYieldHarvested: number;
    totalFees: number;
    compoundCount: number;
    simulatedSeconds: number;
  };
}

// ─── VaultSandbox ─────────────────────────────────────────────────────────────

export class VaultSandbox {
  private scenario: ScenarioConfig;

  constructor(scenario: ScenarioConfig) {
    this.scenario = scenario;
  }

  /**
   * Execute the full simulation and return a structured report.
   * Runs entirely in-memory — no network calls are made.
   */
  run(): SimulationReport {
    const { apy_percent, cycles, compound_interval_seconds, fee_percent, users } = this.scenario;

    // ── Vault state (mirrors Soroban contract struct) ──────────────────────────
    const state: VaultState = {
      total_deposits: 0,
      total_shares: 0,
      last_compound_ts: 0,
      compound_count: 0,
      total_yield_harvested: 0,
    };

    // ── Virtual clock — starts at epoch 0 ─────────────────────────────────────
    let currentTs = 0;

    // ── Per-user state ─────────────────────────────────────────────────────────
    const userStates: UserState[] = users.map(u => ({
      name: u.name,
      deposit_amount: u.deposit_amount,
      shares: 0,
      withdraw_after_cycle: u.withdraw_after_cycle ?? cycles,
      withdrawn: false,
      final_balance: 0,
      fee_paid: 0,
    }));

    // ── Deposit all users at t = 0 ─────────────────────────────────────────────
    for (const us of userStates) {
      const shares = this._deposit(state, us.deposit_amount);
      us.shares = shares;
    }

    // ── Cycle tracking ────────────────────────────────────────────────────────
    const cycleRows: CycleRow[] = [];

    // ── Compound cycles ───────────────────────────────────────────────────────
    // Per-cycle yield rate derived from APY:
    //   rate_per_cycle = (1 + APY)^(interval / SECONDS_PER_YEAR) - 1
    const SECONDS_PER_YEAR = 365.25 * 24 * 3600;
    const cycleRateGross =
      Math.pow(1 + apy_percent / 100, compound_interval_seconds / SECONDS_PER_YEAR) - 1;
    const feeRate = fee_percent / 100;

    for (let cycle = 1; cycle <= cycles; cycle++) {
      currentTs += compound_interval_seconds;

      // Gross yield on current deposits
      const grossYield = state.total_deposits * cycleRateGross;
      // Protocol fee deducted from yield
      const fee = grossYield * feeRate;
      // Net yield added to vault
      const netYield = grossYield - fee;

      // Mirrors contract compound():
      //   state.total_deposits += yield_amount
      //   state.total_yield_harvested += yield_amount
      //   state.compound_count += 1
      //   state.last_compound_ts = env.ledger().timestamp()
      this._compound(state, netYield, currentTs);

      // Track fees separately (not in vault state — collected by protocol)
      const totalFeesSoFar = cycleRows.reduce((acc, r) => acc + (r.yieldAdded * feeRate / (1 - feeRate)), 0) + fee;
      void totalFeesSoFar; // will aggregate at report time

      // Share price = total_deposits / total_shares
      const sharePrice = state.total_shares > 0 ? state.total_deposits / state.total_shares : 1;

      // Effective APY at this cycle: annualise the per-cycle growth
      const cyclesPerYear = SECONDS_PER_YEAR / compound_interval_seconds;
      const effectiveApy = (Math.pow(sharePrice, cyclesPerYear) - 1) * 100;

      cycleRows.push({
        cycle,
        timestamp: new Date(currentTs * 1000),
        yieldAdded: netYield,
        totalDeposits: state.total_deposits,
        totalShares: state.total_shares,
        sharePrice,
        effectiveApy,
        totalYieldHarvested: state.total_yield_harvested,
      });

      // ── Process any user withdrawals scheduled for this cycle ──────────────
      for (const us of userStates) {
        if (!us.withdrawn && us.withdraw_after_cycle === cycle) {
          const assets = this._withdraw(state, us.shares);
          us.final_balance = assets;
          us.fee_paid = (assets - us.deposit_amount) * feeRate;
          us.withdrawn = true;
        }
      }
    }

    // ── Withdraw remaining users (those with no explicit withdraw_after_cycle) ─
    for (const us of userStates) {
      if (!us.withdrawn && us.shares > 0 && state.total_shares > 0) {
        const assets = this._withdraw(state, us.shares);
        us.final_balance = assets;
        us.fee_paid = Math.max(0, (assets - us.deposit_amount) * feeRate);
        us.withdrawn = true;
      }
    }

    // ── Build report ──────────────────────────────────────────────────────────
    const totalDeposited = userStates.reduce((s, u) => s + u.deposit_amount, 0);
    const totalFees = userStates.reduce((s, u) => s + u.fee_paid, 0);

    const SECONDS_PER_YEAR_FLOAT = SECONDS_PER_YEAR;
    const cyclesPerYear = SECONDS_PER_YEAR_FLOAT / compound_interval_seconds;
    const simulatedSeconds = cycles * compound_interval_seconds;

    const userSummaries: UserSummary[] = userStates.map(us => {
      const netYieldUser = us.final_balance - us.deposit_amount;
      const holdDuration = us.withdraw_after_cycle * compound_interval_seconds;
      const holdYears = holdDuration / SECONDS_PER_YEAR_FLOAT;
      const effectiveApy =
        holdYears > 0 && us.deposit_amount > 0
          ? (Math.pow(us.final_balance / us.deposit_amount, 1 / holdYears) - 1) * 100
          : 0;
      return {
        name: us.name,
        deposited: us.deposit_amount,
        shares: us.shares,
        finalBalance: us.final_balance,
        netYield: netYieldUser,
        effectiveApy,
        feePaid: us.fee_paid,
      };
    });

    return {
      cycleRows,
      userSummaries,
      totals: {
        totalDeposited,
        finalTvl: state.total_deposits,
        totalYieldHarvested: state.total_yield_harvested,
        totalFees,
        compoundCount: state.compound_count,
        simulatedSeconds,
      },
    };
  }

  // ─── Private helpers (mirror contract functions) ─────────────────────────────

  /**
   * Mirrors AutoCompoundingVault::deposit()
   * Returns the number of shares minted.
   */
  private _deposit(state: VaultState, amount: number): number {
    const shares =
      state.total_deposits === 0
        ? amount                                              // first deposit: 1:1
        : (amount * state.total_shares) / state.total_deposits; // proportional
    state.total_deposits += amount;
    state.total_shares += shares;
    return shares;
  }

  /**
   * Mirrors AutoCompoundingVault::compound()
   * Adds net yield to total_deposits and increments counters.
   */
  private _compound(state: VaultState, yieldAmount: number, ts: number): void {
    state.total_deposits += yieldAmount;
    state.total_yield_harvested += yieldAmount;
    state.compound_count += 1;
    state.last_compound_ts = ts;
  }

  /**
   * Mirrors AutoCompoundingVault::withdraw()
   * Burns `shares` and returns the proportional asset amount.
   */
  private _withdraw(state: VaultState, shares: number): number {
    if (state.total_shares === 0) return 0;
    const amount = (shares * state.total_deposits) / state.total_shares;
    state.total_deposits -= amount;
    state.total_shares -= shares;
    return amount;
  }
}
