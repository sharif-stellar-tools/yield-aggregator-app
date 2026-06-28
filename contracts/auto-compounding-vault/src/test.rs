use super::*;
use soroban_sdk::{
    contract, contractimpl, symbol_short, testutils::{Address as _, Ledger}, token, Address, Env, Symbol
};

#[contract]
pub struct MockOracle;

#[contractimpl]
impl MockOracle {
    pub fn price(env: Env, token: Symbol) -> (u128, u64) {
        let price: u128 = env.storage().instance().get(&token).unwrap_or(0);
        let timestamp: u64 = env.storage().instance().get(&symbol_short!("ts")).unwrap_or(0);
        (price, timestamp)
    }

    pub fn set_price(env: Env, token: Symbol, price: u128, timestamp: u64) {
        env.storage().instance().set(&token, &price);
        env.storage().instance().set(&symbol_short!("ts"), &timestamp);
    }
}

fn setup_test_env<'a>(env: &'a Env) -> (Address, AutoCompoundingVaultClient<'a>, Address, MockOracleClient<'a>, MockOracleClient<'a>, Address) {
    env.mock_all_auths();

    let admin = Address::generate(env);
    let user = Address::generate(env);

    // Register vault contract
    let vault_id = env.register(AutoCompoundingVault, ());
    let vault_client = AutoCompoundingVaultClient::new(env, &vault_id);

    // Register token
    let token_admin = Address::generate(env);
    let token_id = env.register_stellar_asset_contract(token_admin);
    let token_client = token::StellarAssetClient::new(env, &token_id);
    // Mint initial tokens to user
    token_client.mint(&user, &1000);

    // Initialize vault
    vault_client.initialize(&token_id, &admin);

    // Register mock primary and fallback oracles
    let primary_oracle_id = env.register(MockOracle, ());
    let primary_oracle = MockOracleClient::new(env, &primary_oracle_id);

    let fallback_oracle_id = env.register(MockOracle, ());
    let fallback_oracle = MockOracleClient::new(env, &fallback_oracle_id);

    // Set oracles on vault (requires admin auth)
    vault_client.set_oracles(&primary_oracle_id, &fallback_oracle_id);

    (token_id, vault_client, user, primary_oracle, fallback_oracle, admin)
}

#[test]
fn test_successful_deposit_and_withdraw() {
    let env = Env::default();
    let (token_id, vault, user, primary_oracle, fallback_oracle, _admin) = setup_test_env(&env);
    let token_client = token::Client::new(&env, &token_id);

    let token_symbol = Symbol::new(&env, "USDC");
    let current_ts = 1000;
    env.ledger().set_timestamp(current_ts);

    // Set fresh price on primary oracle
    primary_oracle.set_price(&token_symbol, &500_000, &current_ts);
    fallback_oracle.set_price(&token_symbol, &490_000, &current_ts);

    // User deposits 100 tokens, expecting at least 90 shares
    let shares = vault.deposit(&user, &100, &90, &token_symbol);
    assert_eq!(shares, 100);
    assert_eq!(token_client.balance(&vault.address), 100);
    assert_eq!(token_client.balance(&user), 900);
    assert_eq!(vault.get_user_shares(&user), 100);

    // TVL is deposits * price = 100 * 500_000 = 50,000,000
    assert_eq!(vault.get_tvl(&token_symbol), 50_000_000);

    // User withdraws 50 shares, expecting at least 45 tokens
    let assets = vault.withdraw(&user, &50, &45, &token_symbol);
    assert_eq!(assets, 50);
    assert_eq!(token_client.balance(&vault.address), 50);
    assert_eq!(token_client.balance(&user), 950);
    assert_eq!(vault.get_user_shares(&user), 50);
}

#[test]
#[should_panic(expected = "slippage limit exceeded")]
fn test_deposit_slippage_protection() {
    let env = Env::default();
    let (_token_id, vault, user, primary_oracle, _fallback_oracle, _admin) = setup_test_env(&env);
    let token_symbol = Symbol::new(&env, "USDC");
    let current_ts = 1000;
    env.ledger().set_timestamp(current_ts);

    primary_oracle.set_price(&token_symbol, &500_000, &current_ts);

    // Reverts because expected shares (100) is less than min_shares (101)
    vault.deposit(&user, &100, &101, &token_symbol);
}

#[test]
#[should_panic(expected = "slippage limit exceeded")]
fn test_withdraw_slippage_protection() {
    let env = Env::default();
    let (_token_id, vault, user, primary_oracle, _fallback_oracle, _admin) = setup_test_env(&env);
    let token_symbol = Symbol::new(&env, "USDC");
    let current_ts = 1000;
    env.ledger().set_timestamp(current_ts);

    primary_oracle.set_price(&token_symbol, &500_000, &current_ts);

    vault.deposit(&user, &100, &90, &token_symbol);

    // Reverts because expected assets (50) is less than min_assets (51)
    vault.withdraw(&user, &50, &51, &token_symbol);
}

#[test]
fn test_fallback_when_primary_stale() {
    let env = Env::default();
    let (token_id, vault, user, primary_oracle, fallback_oracle, _admin) = setup_test_env(&env);
    let token_client = token::Client::new(&env, &token_id);
    let token_symbol = Symbol::new(&env, "USDC");

    let current_ts = 1000;
    env.ledger().set_timestamp(current_ts);

    // Primary oracle is stale (timestamp = 690, age = 310 > 300)
    primary_oracle.set_price(&token_symbol, &500_000, &690);
    // Fallback oracle is fresh
    fallback_oracle.set_price(&token_symbol, &490_000, &950);

    // Should succeed because fallback oracle is fresh, using fallback price 490_000
    let shares = vault.deposit(&user, &100, &90, &token_symbol);
    assert_eq!(shares, 100);
    assert_eq!(token_client.balance(&vault.address), 100);
    assert_eq!(vault.get_tvl(&token_symbol), 49_000_000);
}

#[test]
fn test_fallback_when_primary_fails() {
    let env = Env::default();
    let (token_id, vault, user, _primary_oracle, fallback_oracle, _admin) = setup_test_env(&env);
    let token_client = token::Client::new(&env, &token_id);
    let token_symbol = Symbol::new(&env, "USDC");

    let current_ts = 1000;
    env.ledger().set_timestamp(current_ts);

    // Primary oracle has no price stored (will fail/trap or return 0, which we treat as fail)
    // Fallback oracle is fresh
    fallback_oracle.set_price(&token_symbol, &480_000, &current_ts);

    let shares = vault.deposit(&user, &100, &90, &token_symbol);
    assert_eq!(shares, 100);
    assert_eq!(token_client.balance(&vault.address), 100);
    assert_eq!(vault.get_tvl(&token_symbol), 48_000_000);
}

#[test]
#[should_panic]
fn test_panic_when_both_oracles_stale() {
    let env = Env::default();
    let (_token_id, vault, user, primary_oracle, fallback_oracle, _admin) = setup_test_env(&env);
    let token_symbol = Symbol::new(&env, "USDC");

    let current_ts = 1000;
    env.ledger().set_timestamp(current_ts);

    // Both primary and fallback are stale
    primary_oracle.set_price(&token_symbol, &500_000, &690);
    fallback_oracle.set_price(&token_symbol, &490_000, &690);

    // Reverts due to price freshness check failure
    vault.deposit(&user, &100, &90, &token_symbol);
}

#[test]
#[should_panic]
fn test_panic_when_both_oracles_unavailable() {
    let env = Env::default();
    let (_token_id, vault, user, _primary_oracle, _fallback_oracle, _admin) = setup_test_env(&env);
    let token_symbol = Symbol::new(&env, "USDC");

    let current_ts = 1000;
    env.ledger().set_timestamp(current_ts);

    // Neither oracle has prices configured

    // Reverts due to unavailability of price feed
    vault.deposit(&user, &100, &90, &token_symbol);
}
