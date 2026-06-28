#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, Symbol};
mod oracle;

#[contracttype]
#[derive(Clone)]
pub struct VaultState {
    pub total_deposits: i128,
    pub total_shares: i128,
    pub last_compound_ts: u64,
    pub compound_count: u64,
    pub total_yield_harvested: i128,
}

#[contracttype]
pub enum DataKey {
    VaultState,
    Token,
    Admin,
    UserShares(Address),
    PrimaryOracle,
    FallbackOracle,
}

#[contract]
pub struct AutoCompoundingVault;

#[contractimpl]
impl AutoCompoundingVault {
    pub fn initialize(env: Env, token: Address, admin: Address) {
        let state = VaultState {
            total_deposits: 0,
            total_shares: 0,
            last_compound_ts: env.ledger().timestamp(),
            compound_count: 0,
            total_yield_harvested: 0,
        };
        env.storage().instance().set(&DataKey::VaultState, &state);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn set_oracles(env: Env, primary: Address, fallback: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::PrimaryOracle, &primary);
        env.storage().instance().set(&DataKey::FallbackOracle, &fallback);
    }

    pub fn deposit(env: Env, user: Address, amount: i128) -> i128 {
        user.require_auth();
        let mut state: VaultState = env.storage().instance().get(&DataKey::VaultState).unwrap();
        let shares = if state.total_deposits == 0 { amount } else { (amount * state.total_shares) / state.total_deposits };
        state.total_deposits += amount;
        state.total_shares += shares;
        let user_key = DataKey::UserShares(user.clone());
        let current: i128 = env.storage().instance().get(&user_key).unwrap_or(0);
        env.storage().instance().set(&user_key, &(current + shares));
        env.storage().instance().set(&DataKey::VaultState, &state);
        shares
    }

    pub fn withdraw(env: Env, user: Address, shares: i128) -> i128 {
        user.require_auth();
        let state: VaultState = env.storage().instance().get(&DataKey::VaultState).unwrap();
        let user_key = DataKey::UserShares(user.clone());
        let user_shares: i128 = env.storage().instance().get(&user_key).unwrap_or(0);
        let amount = (shares * state.total_deposits) / state.total_shares;
        let mut new_state = state;
        new_state.total_deposits -= amount;
        new_state.total_shares -= shares;
        env.storage().instance().set(&user_key, &(user_shares - shares));
        env.storage().instance().set(&DataKey::VaultState, &new_state);
        amount
    }

    pub fn compound(env: Env, yield_amount: i128) {
        let mut state: VaultState = env.storage().instance().get(&DataKey::VaultState).unwrap();
        state.total_deposits += yield_amount;
        state.total_yield_harvested += yield_amount;
        state.compound_count += 1;
        state.last_compound_ts = env.ledger().timestamp();
        env.storage().instance().set(&DataKey::VaultState, &state);
    }

    pub fn get_tvl(env: Env, token: Symbol) -> u128 {
        // Fetch the latest price for the token using the oracle module.
        match oracle::fetch_price(&env, token) {
            Ok(price) => {
                // total_deposits is in the *native* token units; we multiply by price.
                // price is assumed to be scaled appropriately (e.g., price * 1e7).
                let state: VaultState = env.storage().instance().get(&DataKey::VaultState).unwrap();
                state.total_deposits as u128 * price
            }
            Err(_) => 0, // If price is unavailable or stale we return 0 to avoid misleading TVL.
        }
    }

    pub fn get_user_shares(env: Env, user: Address) -> i128 {
        env.storage().instance().get(&DataKey::UserShares(user)).unwrap_or(0)
    }
}
