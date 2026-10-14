import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export interface VaultState {
  id: string;
  name: string;
  token: string;
  tvl: number;
  apy: number;
  allocations: {
    strategyA: number; // Percentage
    strategyB: number;
    strategyC: number;
  };
}

export interface ContractEvent {
  id: string;
  contractId: string;
  type: 'Deposit' | 'WithdrawalInitiated' | 'WithdrawalClaimed' | 'StrategyAllocated' | 'Paused' | 'Unpaused';
  user: string;
  amount: string;
  timestamp: string;
}

export interface ApySnapshot {
  id: string;
  vaultId: string;
  apy: number;
  timestamp: string;
}

export interface CumulativeApyMetrics {
  vaultId: string;
  currentApy: number;
  rollingAvg7d: number;
  rollingAvg30d: number;
  sampleCount7d: number;
  sampleCount30d: number;
  calculatedAt: string;
}

interface EventRow {
  id: string;
  contract_id: string;
  type: string;
  user: string;
  amount: string;
  timestamp: string;
}

interface VaultRow {
  id: string;
  name: string;
  token: string;
  tvl: number;
  apy: number;
  allocations_json: string;
}

interface ApySnapshotRow {
  id: string;
  vault_id: string;
  apy: number;
  timestamp: string;
}

interface CumulativeApyRow {
  vault_id: string;
  current_apy: number;
  rolling_avg_7d: number;
  rolling_avg_30d: number;
  sample_count_7d: number;
  sample_count_30d: number;
  calculated_at: string;
}

export class IndexerDatabase {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const finalPath = dbPath || process.env.DB_PATH || path.join(process.cwd(), 'data', 'indexer.db');
    if (finalPath !== ':memory:') {
      const dir = path.dirname(finalPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    this.db = new Database(finalPath);
    this.db.pragma('journal_mode = WAL');
    this.initSchema();
    this.seedIfEmpty();
  }

  private initSchema(): void {
    const schemaSql = `
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        contract_id TEXT NOT NULL,
        type TEXT NOT NULL,
        user TEXT NOT NULL,
        amount TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_events_contract_id ON events (contract_id);
      CREATE INDEX IF NOT EXISTS idx_events_type ON events (type);
      CREATE INDEX IF NOT EXISTS idx_events_user ON events (user);
      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events (timestamp);

      CREATE TABLE IF NOT EXISTS vaults (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        token TEXT NOT NULL,
        tvl REAL NOT NULL,
        apy REAL NOT NULL,
        allocations_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS apy_snapshots (
        id TEXT PRIMARY KEY,
        vault_id TEXT NOT NULL,
        apy REAL NOT NULL,
        timestamp TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_apy_snapshots_vault_id ON apy_snapshots (vault_id);
      CREATE INDEX IF NOT EXISTS idx_apy_snapshots_timestamp ON apy_snapshots (timestamp);

      CREATE TABLE IF NOT EXISTS cumulative_apy_metrics (
        vault_id TEXT PRIMARY KEY,
        current_apy REAL NOT NULL,
        rolling_avg_7d REAL NOT NULL,
        rolling_avg_30d REAL NOT NULL,
        sample_count_7d INTEGER NOT NULL,
        sample_count_30d INTEGER NOT NULL,
        calculated_at TEXT NOT NULL
      );
    `;
    this.db.exec(schemaSql);
  }

  private seedIfEmpty(): void {
    const eventCount = (this.db.prepare('SELECT COUNT(*) as count FROM events').get() as { count: number }).count;
    if (eventCount === 0) {
      const insertEvent = this.db.prepare(`
        INSERT INTO events (id, contract_id, type, user, amount, timestamp)
        VALUES (@id, @contract_id, @type, @user, @amount, @timestamp)
      `);

      const defaultEvents: EventRow[] = [
        {
          id: 'evt_001',
          contract_id: 'CD...USDC_VAULT',
          type: 'Deposit',
          user: 'GD...USER_A',
          amount: '1000.00',
          timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
        },
        {
          id: 'evt_002',
          contract_id: 'CD...USDC_VAULT',
          type: 'StrategyAllocated',
          user: 'GD...ADMIN',
          amount: '500.00',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 'evt_003',
          contract_id: 'CD...USDC_VAULT',
          type: 'WithdrawalInitiated',
          user: 'GD...USER_B',
          amount: '200.00',
          timestamp: new Date().toISOString(),
        },
      ];

      const seedEventsTx = this.db.transaction((rows: EventRow[]) => {
        for (const row of rows) {
          insertEvent.run(row);
        }
      });
      seedEventsTx(defaultEvents);
    }

    const vaultCount = (this.db.prepare('SELECT COUNT(*) as count FROM vaults').get() as { count: number }).count;
    if (vaultCount === 0) {
      const insertVault = this.db.prepare(`
        INSERT INTO vaults (id, name, token, tvl, apy, allocations_json)
        VALUES (@id, @name, @token, @tvl, @apy, @allocations_json)
      `);

      const defaultVaults: VaultRow[] = [
        {
          id: 'vault-usdc',
          name: 'Soroban USDC Yield Vault',
          token: 'USDC:GA5ZSEAEWZ2AQF0OB5A7B9FEB9342544EFQ22',
          tvl: 1250000,
          apy: 8.45,
          allocations_json: JSON.stringify({ strategyA: 50, strategyB: 30, strategyC: 20 }),
        },
        {
          id: 'vault-xlm',
          name: 'Soroban XLM Yield Vault',
          token: 'XLM',
          tvl: 4500000,
          apy: 4.12,
          allocations_json: JSON.stringify({ strategyA: 70, strategyB: 30, strategyC: 0 }),
        },
      ];

      const seedVaultsTx = this.db.transaction((rows: VaultRow[]) => {
        for (const row of rows) {
          insertVault.run(row);
        }
      });
      seedVaultsTx(defaultVaults);
    }

    const apyCount = (this.db.prepare('SELECT COUNT(*) as count FROM apy_snapshots').get() as { count: number }).count;
    if (apyCount === 0) {
      const insertApy = this.db.prepare(`
        INSERT INTO apy_snapshots (id, vault_id, apy, timestamp)
        VALUES (@id, @vault_id, @apy, @timestamp)
      `);

      const now = Date.now();
      const dayMs = 86400 * 1000;
      const seedApyRows: ApySnapshotRow[] = [];

      // Seed 30 days of historical APY snapshots for vault-usdc
      const usdcApyPoints = [
        8.10, 8.15, 8.20, 8.25, 8.18, 8.30, 8.35,
        8.28, 8.32, 8.40, 8.38, 8.42, 8.45, 8.50,
        8.48, 8.52, 8.55, 8.47, 8.42, 8.39, 8.41,
        8.44, 8.46, 8.50, 8.48, 8.45, 8.47, 8.46, 8.44, 8.45
      ];
      for (let i = 0; i < usdcApyPoints.length; i++) {
        const daysAgo = 29 - i;
        seedApyRows.push({
          id: `snap_usdc_${i + 1}`,
          vault_id: 'vault-usdc',
          apy: usdcApyPoints[i],
          timestamp: new Date(now - daysAgo * dayMs).toISOString(),
        });
      }

      // Seed 30 days of historical APY snapshots for vault-xlm
      const xlmApyPoints = [
        3.95, 3.98, 4.02, 4.00, 4.05, 4.08, 4.05,
        4.10, 4.12, 4.09, 4.11, 4.14, 4.15, 4.10,
        4.08, 4.12, 4.15, 4.18, 4.12, 4.09, 4.11,
        4.13, 4.15, 4.12, 4.10, 4.11, 4.14, 4.13, 4.11, 4.12
      ];
      for (let i = 0; i < xlmApyPoints.length; i++) {
        const daysAgo = 29 - i;
        seedApyRows.push({
          id: `snap_xlm_${i + 1}`,
          vault_id: 'vault-xlm',
          apy: xlmApyPoints[i],
          timestamp: new Date(now - daysAgo * dayMs).toISOString(),
        });
      }

      const seedApyTx = this.db.transaction((rows: ApySnapshotRow[]) => {
        for (const row of rows) {
          insertApy.run(row);
        }
      });
      seedApyTx(seedApyRows);

      this.calculateCumulativeApyMetrics('vault-usdc');
      this.calculateCumulativeApyMetrics('vault-xlm');
    }
  }

  public getEvents(contractId?: string): ContractEvent[] {
    let rows: EventRow[];
    if (contractId) {
      rows = this.db
        .prepare('SELECT id, contract_id, type, user, amount, timestamp FROM events WHERE contract_id = ? ORDER BY timestamp DESC')
        .all(contractId) as EventRow[];
    } else {
      rows = this.db
        .prepare('SELECT id, contract_id, type, user, amount, timestamp FROM events ORDER BY timestamp DESC')
        .all() as EventRow[];
    }

    return rows.map((r) => ({
      id: r.id,
      contractId: r.contract_id,
      type: r.type as ContractEvent['type'],
      user: r.user,
      amount: r.amount,
      timestamp: r.timestamp,
    }));
  }

  public getEventById(id: string): ContractEvent | undefined {
    const row = this.db
      .prepare('SELECT id, contract_id, type, user, amount, timestamp FROM events WHERE id = ?')
      .get(id) as EventRow | undefined;

    if (!row) return undefined;
    return {
      id: row.id,
      contractId: row.contract_id,
      type: row.type as ContractEvent['type'],
      user: row.user,
      amount: row.amount,
      timestamp: row.timestamp,
    };
  }

  public insertEvent(event: ContractEvent): ContractEvent {
    this.db
      .prepare(`
        INSERT INTO events (id, contract_id, type, user, amount, timestamp)
        VALUES (@id, @contract_id, @type, @user, @amount, @timestamp)
      `)
      .run({
        id: event.id,
        contract_id: event.contractId,
        type: event.type,
        user: event.user,
        amount: event.amount,
        timestamp: event.timestamp,
      });

    return event;
  }

  public getVault(id: string): VaultState | undefined {
    const row = this.db
      .prepare('SELECT id, name, token, tvl, apy, allocations_json FROM vaults WHERE id = ?')
      .get(id) as VaultRow | undefined;

    if (!row) return undefined;
    return {
      id: row.id,
      name: row.name,
      token: row.token,
      tvl: row.tvl,
      apy: row.apy,
      allocations: JSON.parse(row.allocations_json),
    };
  }

  public getAllVaults(): VaultState[] {
    const rows = this.db
      .prepare('SELECT id, name, token, tvl, apy, allocations_json FROM vaults')
      .all() as VaultRow[];

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      token: row.token,
      tvl: row.tvl,
      apy: row.apy,
      allocations: JSON.parse(row.allocations_json),
    }));
  }

  public updateVaultTvl(id: string, tvlDelta: number): VaultState | undefined {
    const vault = this.getVault(id);
    if (!vault) return undefined;

    const newTvl = vault.tvl + tvlDelta;
    this.db.prepare('UPDATE vaults SET tvl = ? WHERE id = ?').run(newTvl, id);
    vault.tvl = newTvl;
    return vault;
  }

  public insertApySnapshot(snapshot: ApySnapshot): ApySnapshot {
    this.db
      .prepare(`
        INSERT INTO apy_snapshots (id, vault_id, apy, timestamp)
        VALUES (@id, @vault_id, @apy, @timestamp)
      `)
      .run({
        id: snapshot.id,
        vault_id: snapshot.vaultId,
        apy: snapshot.apy,
        timestamp: snapshot.timestamp,
      });

    return snapshot;
  }

  public recordApy(vaultId: string, apy: number, timestamp?: string): { snapshot: ApySnapshot; metrics: CumulativeApyMetrics } {
    const snapshot: ApySnapshot = {
      id: `snap_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`,
      vaultId,
      apy,
      timestamp: timestamp || new Date().toISOString(),
    };
    this.insertApySnapshot(snapshot);

    // Update current vault APY if vault exists
    const vault = this.getVault(vaultId);
    if (vault) {
      this.db.prepare('UPDATE vaults SET apy = ? WHERE id = ?').run(apy, vaultId);
    }

    const metrics = this.calculateCumulativeApyMetrics(vaultId);
    return { snapshot, metrics };
  }

  public getApySnapshots(vaultId: string, limit: number = 100): ApySnapshot[] {
    const rows = this.db
      .prepare('SELECT id, vault_id, apy, timestamp FROM apy_snapshots WHERE vault_id = ? ORDER BY timestamp DESC LIMIT ?')
      .all(vaultId, limit) as ApySnapshotRow[];

    return rows.map((r) => ({
      id: r.id,
      vaultId: r.vault_id,
      apy: r.apy,
      timestamp: r.timestamp,
    }));
  }

  public calculateCumulativeApyMetrics(vaultId: string, asOfDate?: Date): CumulativeApyMetrics {
    const now = asOfDate ? asOfDate.getTime() : Date.now();
    const sevenDaysAgo = new Date(now - 7 * 86400 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now - 30 * 86400 * 1000).toISOString();
    const asOfIso = new Date(now).toISOString();

    const vault = this.getVault(vaultId);
    const fallbackApy = vault ? vault.apy : 0;

    // Get 7-day stats
    const stats7d = this.db
      .prepare(`
        SELECT AVG(apy) as avg_apy, COUNT(*) as sample_count
        FROM apy_snapshots
        WHERE vault_id = ? AND timestamp >= ? AND timestamp <= ?
      `)
      .get(vaultId, sevenDaysAgo, asOfIso) as { avg_apy: number | null; sample_count: number };

    // Get 30-day stats
    const stats30d = this.db
      .prepare(`
        SELECT AVG(apy) as avg_apy, COUNT(*) as sample_count
        FROM apy_snapshots
        WHERE vault_id = ? AND timestamp >= ? AND timestamp <= ?
      `)
      .get(vaultId, thirtyDaysAgo, asOfIso) as { avg_apy: number | null; sample_count: number };

    // Get latest snapshot apy or fallback to vault apy
    const latestSnapshot = this.db
      .prepare('SELECT apy FROM apy_snapshots WHERE vault_id = ? ORDER BY timestamp DESC LIMIT 1')
      .get(vaultId) as { apy: number } | undefined;

    const currentApy = latestSnapshot ? latestSnapshot.apy : fallbackApy;
    const rollingAvg7d = stats7d.avg_apy !== null ? Number(stats7d.avg_apy.toFixed(2)) : currentApy;
    const rollingAvg30d = stats30d.avg_apy !== null ? Number(stats30d.avg_apy.toFixed(2)) : currentApy;

    const metrics: CumulativeApyMetrics = {
      vaultId,
      currentApy,
      rollingAvg7d,
      rollingAvg30d,
      sampleCount7d: stats7d.sample_count,
      sampleCount30d: stats30d.sample_count,
      calculatedAt: asOfIso,
    };

    this.db
      .prepare(`
        INSERT INTO cumulative_apy_metrics (vault_id, current_apy, rolling_avg_7d, rolling_avg_30d, sample_count_7d, sample_count_30d, calculated_at)
        VALUES (@vault_id, @current_apy, @rolling_avg_7d, @rolling_avg_30d, @sample_count_7d, @sample_count_30d, @calculated_at)
        ON CONFLICT(vault_id) DO UPDATE SET
          current_apy = excluded.current_apy,
          rolling_avg_7d = excluded.rolling_avg_7d,
          rolling_avg_30d = excluded.rolling_avg_30d,
          sample_count_7d = excluded.sample_count_7d,
          sample_count_30d = excluded.sample_count_30d,
          calculated_at = excluded.calculated_at
      `)
      .run({
        vault_id: metrics.vaultId,
        current_apy: metrics.currentApy,
        rolling_avg_7d: metrics.rollingAvg7d,
        rolling_avg_30d: metrics.rollingAvg30d,
        sample_count_7d: metrics.sampleCount7d,
        sample_count_30d: metrics.sampleCount30d,
        calculated_at: metrics.calculatedAt,
      });

    return metrics;
  }

  public getCumulativeApyMetrics(vaultId: string): CumulativeApyMetrics | undefined {
    const row = this.db
      .prepare('SELECT vault_id, current_apy, rolling_avg_7d, rolling_avg_30d, sample_count_7d, sample_count_30d, calculated_at FROM cumulative_apy_metrics WHERE vault_id = ?')
      .get(vaultId) as CumulativeApyRow | undefined;

    if (!row) {
      if (this.getVault(vaultId)) {
        return this.calculateCumulativeApyMetrics(vaultId);
      }
      return undefined;
    }

    return {
      vaultId: row.vault_id,
      currentApy: row.current_apy,
      rollingAvg7d: row.rolling_avg_7d,
      rollingAvg30d: row.rolling_avg_30d,
      sampleCount7d: row.sample_count_7d,
      sampleCount30d: row.sample_count_30d,
      calculatedAt: row.calculated_at,
    };
  }

  public close(): void {
    this.db.close();
  }
}

// Global instance
export const defaultDb = new IndexerDatabase();
