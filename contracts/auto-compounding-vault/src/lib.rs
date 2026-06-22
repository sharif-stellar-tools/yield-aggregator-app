#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env};

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
    UserDeposit(Address),
    UserShares(Address),
}

#[contract]
pub struct AutoCompoundingVault;

#[contractimpl]
impl AutoCompoundingVault {
    pub fn initialize(env: Env, token: Address) {
        let state = VaultState {
            total_deposits: 0,
            total_shares: 0,
            last_compound_ts: env.ledger().timestamp(),
            compound_count: 0,
            total_yield_harvested: 0,
        };
        env.storage().instance().set(&DataKey::VaultState, &state);
        env.storage().instance().set(&DataKey::UserDeposit(token.clone()), &token);
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

    pub fn get_state(env: Env) -> VaultState {
        env.storage().instance().get(&DataKey::VaultState).unwrap()
    }

    pub fn get_user_shares(env: Env, user: Address) -> i128 {
        env.storage().instance().get(&DataKey::UserShares(user)).unwrap_or(0)
    }
}
