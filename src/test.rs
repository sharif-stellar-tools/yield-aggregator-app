#![cfg(test)]

use super::{TimeLockVault, TimeLockVaultClient, Error};
use soroban_sdk::{Env, Address, testutils::Address as _, testutils::Ledger as _, token};

fn create_token_contract<'a>(env: &Env, admin: &Address) -> (token::Client<'a>, token::StellarAssetClient<'a>) {
    let contract_id = env.register_stellar_asset_contract(admin.clone());
    (token::Client::new(env, &contract_id), token::StellarAssetClient::new(env, &contract_id))
}

#[test]
fn test_vault_flow() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    
    // Deploy mock token
    let (token, token_admin) = create_token_contract(&env, &admin);
    token_admin.mint(&user, &1000);

    // Deploy vault
    let vault_id = env.register_contract(None, TimeLockVault);
    let vault_client = TimeLockVaultClient::new(&env, &vault_id);

    // 1. Initialize
    let lock_period = 3600u64; // 1 hour
    vault_client.initialize(&admin, &token.address, &lock_period);

    // 2. Deposit
    vault_client.deposit(&user, &500);
    assert_eq!(token.balance(&user), 500);
    assert_eq!(token.balance(&vault_id), 500);

    // 3. Initiate Withdrawal
    vault_client.initiate_withdrawal(&user, &200);
    
    // 4. Try Claiming immediately - should fail (WithdrawalLocked)
    let claim_fail = vault_client.try_claim_withdrawal(&user);
    assert_eq!(claim_fail, Err(Ok(Error::WithdrawalLocked)));

    // 5. Jump ledger time forward 1 hour
    env.ledger().with_mut(|li| {
        li.timestamp += 3601;
    });

    // 6. Claim withdrawal - should succeed
    vault_client.claim_withdrawal(&user);
    assert_eq!(token.balance(&user), 700);
    assert_eq!(token.balance(&vault_id), 300);
}

#[test]
fn test_paused_state() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    
    let (token, _token_admin) = create_token_contract(&env, &admin);
    let vault_id = env.register_contract(None, TimeLockVault);
    let vault_client = TimeLockVaultClient::new(&env, &vault_id);

    vault_client.initialize(&admin, &token.address, &3600);

    // Pause vault
    vault_client.set_paused(&admin, &true);

    // Deposit should fail when paused
    let deposit_fail = vault_client.try_deposit(&user, &100);
    assert_eq!(deposit_fail, Err(Ok(Error::ContractPaused)));
}

#[test]
fn test_multi_strategy_allocation_success() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let strategy_a = Address::generate(&env);
    let strategy_b = Address::generate(&env);

    let (token, token_admin) = create_token_contract(&env, &admin);
    token_admin.mint(&user, &1000);

    let vault_id = env.register_contract(None, TimeLockVault);
    let vault_client = TimeLockVaultClient::new(&env, &vault_id);

    vault_client.initialize(&admin, &token.address, &3600);
    vault_client.deposit(&user, &1000);

    assert_eq!(token.balance(&vault_id), 1000);

    // Allocate 40% (4000 bps) to Strategy A, 60% (6000 bps) to Strategy B
    let mut allocations = soroban_sdk::Vec::new(&env);
    allocations.push_back(crate::StrategyAllocation {
        strategy: strategy_a.clone(),
        percentage_bps: 4000,
    });
    allocations.push_back(crate::StrategyAllocation {
        strategy: strategy_b.clone(),
        percentage_bps: 6000,
    });

    vault_client.allocate_multi_strategy(&admin, &allocations);

    assert_eq!(token.balance(&strategy_a), 400);
    assert_eq!(token.balance(&strategy_b), 600);
    assert_eq!(token.balance(&vault_id), 0);
}

#[test]
fn test_multi_strategy_allocation_invalid_percentages() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let strategy_a = Address::generate(&env);
    let strategy_b = Address::generate(&env);

    let (token, token_admin) = create_token_contract(&env, &admin);
    token_admin.mint(&user, &1000);

    let vault_id = env.register_contract(None, TimeLockVault);
    let vault_client = TimeLockVaultClient::new(&env, &vault_id);

    vault_client.initialize(&admin, &token.address, &3600);
    vault_client.deposit(&user, &1000);

    // Sum is 6000 + 5000 = 11000 bps (> 100%)
    let mut allocations = soroban_sdk::Vec::new(&env);
    allocations.push_back(crate::StrategyAllocation {
        strategy: strategy_a.clone(),
        percentage_bps: 6000,
    });
    allocations.push_back(crate::StrategyAllocation {
        strategy: strategy_b.clone(),
        percentage_bps: 5000,
    });

    let res = vault_client.try_allocate_multi_strategy(&admin, &allocations);
    assert_eq!(res, Err(Ok(Error::InvalidPercentageSum)));
}

#[test]
fn test_single_strategy_allocation_exceeds_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let strategy = Address::generate(&env);

    let (token, token_admin) = create_token_contract(&env, &admin);
    token_admin.mint(&user, &1000);

    let vault_id = env.register_contract(None, TimeLockVault);
    let vault_client = TimeLockVaultClient::new(&env, &vault_id);

    vault_client.initialize(&admin, &token.address, &3600);
    vault_client.deposit(&user, &500);

    // Vault only has 500, admin tries to allocate 600
    let res = vault_client.try_allocate_strategy(&admin, &strategy, &600);
    assert_eq!(res, Err(Ok(Error::AllocationExceedsBalance)));
}
