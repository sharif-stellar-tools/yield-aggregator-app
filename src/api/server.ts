import express, { Request, Response } from 'express';
import { defaultDb, ContractEvent, VaultState, IndexerDatabase, ApySnapshot, CumulativeApyMetrics } from '../db/database';

const app = express();
app.use(express.json());

// In-memory aliases backed by SQLite for backward compatibility
const vaults: Record<string, VaultState> = {
  get 'vault-usdc'() {
    return defaultDb.getVault('vault-usdc')!;
  },
  get 'vault-xlm'() {
    return defaultDb.getVault('vault-xlm')!;
  },
};

// Getter proxy array for in-memory events access
const events: ContractEvent[] = defaultDb.getEvents();

// Routes
app.get('/api/v1/vaults/:id', (req: Request, res: Response) => {
  const vault = defaultDb.getVault(req.params.id);
  if (!vault) {
    return res.status(404).json({ error: `Vault not found: ${req.params.id}` });
  }
  const metrics = defaultDb.getCumulativeApyMetrics(req.params.id);
  res.json({ ...vault, metrics });
});

app.get('/api/v1/vaults/:id/apy/metrics', (req: Request, res: Response) => {
  const metrics = defaultDb.getCumulativeApyMetrics(req.params.id);
  if (!metrics) {
    return res.status(404).json({ error: `Vault not found: ${req.params.id}` });
  }
  res.json(metrics);
});

app.get('/api/v1/vaults/:id/apy/history', (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
  const history = defaultDb.getApySnapshots(req.params.id, limit);
  res.json(history);
});

app.post('/api/v1/vaults/:id/apy', (req: Request, res: Response) => {
  const { apy, timestamp } = req.body;
  if (apy === undefined || isNaN(parseFloat(apy))) {
    return res.status(400).json({ error: 'Valid apy value is required' });
  }
  const result = defaultDb.recordApy(req.params.id, parseFloat(apy), timestamp);
  res.status(201).json(result);
});

app.get('/api/v1/events', (req: Request, res: Response) => {
  const contractId = req.query.contractId as string;
  const result = defaultDb.getEvents(contractId);
  res.json(result);
});

app.post('/api/v1/events', (req: Request, res: Response) => {
  const { contractId, type, user, amount } = req.body;
  if (!contractId || !type || !user || !amount) {
    return res.status(400).json({ error: 'Missing required event fields' });
  }

  const newEvent: ContractEvent = {
    id: `evt_${Math.random().toString(36).substring(2, 9)}`,
    contractId,
    type,
    user,
    amount,
    timestamp: new Date().toISOString(),
  };

  defaultDb.insertEvent(newEvent);

  // Update TVL dynamically on deposit/withdrawal
  const numAmount = parseFloat(amount);
  if (type === 'Deposit') {
    defaultDb.updateVaultTvl('vault-usdc', numAmount);
  } else if (type === 'WithdrawalClaimed') {
    defaultDb.updateVaultTvl('vault-usdc', -numAmount);
  }

  res.status(201).json(newEvent);
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Yield Aggregator indexer REST API listening at http://localhost:${PORT}`);
  });
}

export { app, vaults, events, defaultDb as db, IndexerDatabase };
