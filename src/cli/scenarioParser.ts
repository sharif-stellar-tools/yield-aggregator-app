/**
 * Scenario configuration parser and validator.
 *
 * A scenario YAML file has the following shape:
 *
 * ```yaml
 * name: "Basic 10-cycle simulation"
 * apy_percent: 12.0            # Annual Percentage Yield applied each compound
 * cycles: 10                   # Number of compound cycles to simulate
 * compound_interval_seconds: 86400  # Seconds between each compound (simulated time)
 * fee_percent: 0.5             # Protocol performance fee taken on each yield harvest
 * users:
 *   - name: Alice
 *     deposit_amount: 1000     # Amount of tokens deposited
 *     withdraw_after_cycle: 10 # Which cycle to withdraw on (omit = withdraw at end)
 *   - name: Bob
 *     deposit_amount: 500
 * ```
 */

export interface UserConfig {
  /** Human-readable label for the user. */
  name: string;
  /** Amount of tokens deposited into the vault. */
  deposit_amount: number;
  /**
   * The cycle number after which this user withdraws.
   * If omitted the user withdraws at the end of the simulation.
   */
  withdraw_after_cycle?: number;
}

export interface ScenarioConfig {
  /** Display name for the scenario. */
  name: string;
  /** Annual Percentage Yield (e.g. 12.0 means 12%). */
  apy_percent: number;
  /** Number of compound cycles to simulate. */
  cycles: number;
  /** Simulated seconds between each compound cycle. */
  compound_interval_seconds: number;
  /** Protocol performance fee as a percentage taken from each yield harvest. */
  fee_percent: number;
  /** List of users participating in the simulation. */
  users: UserConfig[];
}

// ─── Validation helpers ───────────────────────────────────────────────────────

function assertField(obj: Record<string, unknown>, field: string, type: string): void {
  if (!(field in obj)) {
    throw new Error(`Missing required field "${field}"`);
  }
  // eslint-disable-next-line valid-typeof
  if (typeof obj[field] !== type) {
    throw new Error(`Field "${field}" must be a ${type}, got ${typeof obj[field]}`);
  }
}

function assertPositive(value: number, field: string): void {
  if (value <= 0) {
    throw new Error(`Field "${field}" must be positive, got ${value}`);
  }
}

function assertNonNegative(value: number, field: string): void {
  if (value < 0) {
    throw new Error(`Field "${field}" must be non-negative, got ${value}`);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse and validate a raw YAML-loaded object into a typed ScenarioConfig.
 * Throws a descriptive Error if validation fails.
 */
export function parseScenario(raw: unknown): ScenarioConfig {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Scenario must be a YAML mapping (object) at the top level');
  }

  const obj = raw as Record<string, unknown>;

  assertField(obj, 'name', 'string');
  assertField(obj, 'apy_percent', 'number');
  assertField(obj, 'cycles', 'number');
  assertField(obj, 'compound_interval_seconds', 'number');
  assertField(obj, 'fee_percent', 'number');

  const apy_percent = obj['apy_percent'] as number;
  const cycles = obj['cycles'] as number;
  const compound_interval_seconds = obj['compound_interval_seconds'] as number;
  const fee_percent = obj['fee_percent'] as number;

  assertPositive(apy_percent, 'apy_percent');
  assertPositive(cycles, 'cycles');
  assertPositive(compound_interval_seconds, 'compound_interval_seconds');
  assertNonNegative(fee_percent, 'fee_percent');

  if (!Number.isInteger(cycles)) {
    throw new Error(`Field "cycles" must be an integer, got ${cycles}`);
  }

  if (fee_percent >= 100) {
    throw new Error(`Field "fee_percent" must be less than 100, got ${fee_percent}`);
  }

  if (!Array.isArray(obj['users']) || obj['users'].length === 0) {
    throw new Error('Field "users" must be a non-empty array');
  }

  const users: UserConfig[] = (obj['users'] as unknown[]).map((u, idx) => {
    if (typeof u !== 'object' || u === null) {
      throw new Error(`users[${idx}] must be a mapping`);
    }
    const user = u as Record<string, unknown>;

    if (typeof user['name'] !== 'string' || (user['name'] as string).trim() === '') {
      throw new Error(`users[${idx}].name must be a non-empty string`);
    }
    if (typeof user['deposit_amount'] !== 'number') {
      throw new Error(`users[${idx}].deposit_amount must be a number`);
    }
    assertPositive(user['deposit_amount'] as number, `users[${idx}].deposit_amount`);

    let withdraw_after_cycle: number | undefined;
    if ('withdraw_after_cycle' in user) {
      const wac = user['withdraw_after_cycle'];
      if (typeof wac !== 'number' || !Number.isInteger(wac) || wac < 1) {
        throw new Error(`users[${idx}].withdraw_after_cycle must be a positive integer`);
      }
      withdraw_after_cycle = wac as number;
    }

    return {
      name: (user['name'] as string).trim(),
      deposit_amount: user['deposit_amount'] as number,
      withdraw_after_cycle,
    };
  });

  return {
    name: (obj['name'] as string).trim(),
    apy_percent,
    cycles,
    compound_interval_seconds,
    fee_percent,
    users,
  };
}
