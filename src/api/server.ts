import express, { Request, Response } from 'express';
import { defaultDb, ContractEvent, VaultState, IndexerDatabase } from '../db/database';

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

import { compileVaultAnalytics } from '../dashboard/analytics';
import { generateDashboardHtml } from '../dashboard/prototype';

// Routes
app.get('/api/v1/vaults/:id/analytics', (req: Request, res: Response) => {
  const analytics = compileVaultAnalytics(req.params.id, defaultDb);
  res.json(analytics);
});

app.get('/api/v1/vaults/:id/dashboard', (req: Request, res: Response) => {
  const analytics = compileVaultAnalytics(req.params.id, defaultDb);
  const html = generateDashboardHtml(analytics);
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

app.get('/api/v1/vaults/:id', (req: Request, res: Response) => {
  const vault = defaultDb.getVault(req.params.id);
  if (!vault) {
    return res.status(404).json({ error: `Vault not found: ${req.params.id}` });
  }
  res.json(vault);
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
