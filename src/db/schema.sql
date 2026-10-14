-- SQLite schema for Yield Aggregator Event Indexer

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

