import axios from 'axios';

const API_URL = 'http://localhost:3000/api/v1';

async function logVaultState(vaultId: string) {
  try {
    const response = await axios.get(`${API_URL}/vaults/${vaultId}`);
    console.log(`\n=== Vault State for ${vaultId} ===`);
    console.log(`Name: ${response.data.name}`);
    console.log(`TVL: $${response.data.tvl.toLocaleString()}`);
    console.log(`APY: ${response.data.apy}%`);
    console.log(`Allocations:`);
    console.log(`  Strategy A (AMM): ${response.data.allocations.strategyA}%`);
    console.log(`  Strategy B (Lending): ${response.data.allocations.strategyB}%`);
    console.log(`  Strategy C (Staking): ${response.data.allocations.strategyC}%`);
  } catch (error: any) {
    console.error(`Error fetching vault state: ${error.message}`);
  }
}

async function simulateEvent(contractId: string, type: string, user: string, amount: string) {
  try {
    const response = await axios.post(`${API_URL}/events`, {
      contractId,
      type,
      user,
      amount,
    });
    console.log(`[SIM] Action: ${type} | User: ${user} | Amount: ${amount} | Result: Success (Event ID: ${response.data.id})`);
  } catch (error: any) {
    console.error(`[SIM] Failed to post event: ${error.message}`);
  }
}

async function run() {
  console.log('Starting Yield Aggregator Scenario Simulation...');
  
  // 1. Initial State
  await logVaultState('vault-usdc');

  // 2. Deposit Event
  console.log('\n--- Scenario Phase 1: User Deposits ---');
  await simulateEvent('CD...USDC_VAULT', 'Deposit', 'GD...USER_C', '250000.00');
  await logVaultState('vault-usdc');

  // 3. Strategy Allocation Event
  console.log('\n--- Scenario Phase 2: Allocating to Strategies ---');
  await simulateEvent('CD...USDC_VAULT', 'StrategyAllocated', 'GD...ADMIN', '150000.00');

  // 4. Withdrawal Request
  console.log('\n--- Scenario Phase 3: User Requests Time-Locked Withdrawal ---');
  await simulateEvent('CD...USDC_VAULT', 'WithdrawalInitiated', 'GD...USER_A', '50000.00');
  
  // 5. Withdrawal Claim (completed after lock period)
  console.log('\n--- Scenario Phase 4: User Claims Withdrawal ---');
  await simulateEvent('CD...USDC_VAULT', 'WithdrawalClaimed', 'GD...USER_A', '50000.00');
  await logVaultState('vault-usdc');

  console.log('\nSimulation completed successfully!');
}

if (require.main === module) {
  run();
}

export { run };
