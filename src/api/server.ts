import express, { Request, Response } from 'express';

const app = express();
app.use(express.json());

// Mock DB/Indexer State
interface VaultState {
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

interface ContractEvent {
  id: string;
  contractId: string;
  type: 'Deposit' | 'WithdrawalInitiated' | 'WithdrawalClaimed' | 'StrategyAllocated' | 'Paused' | 'Unpaused';
  user: string;
  amount: string;
  timestamp: string;
}

const vaults: Record<string, VaultState> = {
  'vault-usdc': {
    id: 'vault-usdc',
    name: 'Soroban USDC Yield Vault',
    token: 'USDC:GA5ZSEAEWZ2AQF0OB5A7B9FEB9342544EFQ22',
    tvl: 1250000,
    apy: 8.45,
    allocations: {
      strategyA: 50,
      strategyB: 30,
      strategyC: 20,
    },
  },
  'vault-xlm': {
    id: 'vault-xlm',
    name: 'Soroban XLM Yield Vault',
    token: 'XLM',
    tvl: 4500000,
    apy: 4.12,
    allocations: {
      strategyA: 70,
      strategyB: 30,
      strategyC: 0,
    },
  },
};

const events: ContractEvent[] = [
  {
    id: 'evt_001',
    contractId: 'CD...USDC_VAULT',
    type: 'Deposit',
    user: 'GD...USER_A',
    amount: '1000.00',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'evt_002',
    contractId: 'CD...USDC_VAULT',
    type: 'StrategyAllocated',
    user: 'GD...ADMIN',
    amount: '500.00',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'evt_003',
    contractId: 'CD...USDC_VAULT',
    type: 'WithdrawalInitiated',
    user: 'GD...USER_B',
    amount: '200.00',
    timestamp: new Date().toISOString(),
  },
];

// Routes
app.get('/api/v1/vaults/:id', (req: Request, res: Response) => {
  const vault = vaults[req.params.id];
  if (!vault) {
    return res.status(404).json({ error: `Vault not found: ${req.params.id}` });
  }
  res.json(vault);
});

app.get('/api/v1/events', (req: Request, res: Response) => {
  const contractId = req.query.contractId as string;
  if (contractId) {
    const filtered = events.filter((e) => e.contractId === contractId);
    return res.json(filtered);
  }
  res.json(events);
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

  events.unshift(newEvent);

  // Update TVL dynamically on deposit/withdrawal
  const vault = vaults['vault-usdc']; // default vault for simulation
  const numAmount = parseFloat(amount);
  if (type === 'Deposit') {
    vault.tvl += numAmount;
  } else if (type === 'WithdrawalClaimed') {
    vault.tvl -= numAmount;
  }

  res.status(201).json(newEvent);
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Yield Aggregator indexer REST API listening at http://localhost:${PORT}`);
  });
}

export { app, vaults, events };
