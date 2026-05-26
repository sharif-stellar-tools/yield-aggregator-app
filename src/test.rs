#![cfg(test)]

use super::{TimeLockVault, TimeLockVaultClient, Error};
use soroban_sdk::{Env, Address, testutils::Address as _, token};

fn create_token_contract<'a>(env: &Env, admin: &Address) -> token::Client<'a> {
    token::Client::new(env, &env.register_stellar_asset_contract(admin.clone()))
}

#[test]
fn test_vault_flow() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    
    // Deploy mock token
    let token = create_token_contract(&env, &admin);
    token.mint(&user, &1000);

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
    
    let token = create_token_contract(&env, &admin);
    let vault_id = env.register_contract(None, TimeLockVault);
    let vault_client = TimeLockVaultClient::new(&env, &vault_id);

    vault_client.initialize(&admin, &token.address, &3600);

    // Pause vault
    vault_client.set_paused(&admin, &true);

    // Deposit should fail when paused
    let deposit_fail = vault_client.try_deposit(&user, &100);
    assert_eq!(deposit_fail, Err(Ok(Error::ContractPaused)));
}
