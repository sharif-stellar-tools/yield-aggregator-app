#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token, Address, Env, Symbol, Vec,
};
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
    /// Whether the vault is currently paused (blocks all state-mutating entrypoints).
    Paused,
    /// The set of addresses authorized to co-sign a pause/unpause.
    AdminSigners,
    /// Minimum number of distinct `AdminSigners` required to pause/unpause (M-of-N).
    Threshold,
}

/// Errors returned by [`AutoCompoundingVault`].
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// A state-mutating entrypoint was called while the vault is paused.
    ContractPaused = 1,
    /// A supplied signer is not in the configured `AdminSigners` set.
    NotAdminSigner = 2,
    /// The same signer address was supplied more than once in a single call.
    DuplicateSigner = 3,
    /// Fewer distinct valid signers were supplied than the configured threshold.
    InsufficientSignatures = 4,
    /// `set_admin_signers` was called with an invalid (zero or > N) threshold.
    InvalidThreshold = 5,
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

        // Default emergency-pause governance: the sole admin is a 1-of-1 signer
        // until `set_admin_signers` configures a real M-of-N multi-sig.
        env.storage().instance().set(&DataKey::Paused, &false);
        let default_signers = Vec::from_array(&env, [admin]);
        env.storage().instance().set(&DataKey::AdminSigners, &default_signers);
        env.storage().instance().set(&DataKey::Threshold, &1u32);
    }

    /// Configure the multi-sig signer set and M-of-N threshold used by
    /// [`Self::pause`] / [`Self::unpause`]. Callable only by the vault admin.
    pub fn set_admin_signers(env: Env, signers: Vec<Address>, threshold: u32) -> Result<(), Error> {
        Self::require_not_paused(&env)?;
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        if threshold == 0 || threshold > signers.len() {
            return Err(Error::InvalidThreshold);
        }

        let mut unique: Vec<Address> = Vec::new(&env);
        for signer in signers.iter() {
            if unique.contains(&signer) {
                return Err(Error::DuplicateSigner);
            }
            unique.push_back(signer);
        }

        env.storage().instance().set(&DataKey::AdminSigners, &signers);
        env.storage().instance().set(&DataKey::Threshold, &threshold);
        Ok(())
    }

    /// Verify that `signers` contains at least `Threshold` distinct addresses
    /// drawn from `AdminSigners`, each having authorized this invocation.
    /// Returns the first (initiating) signer on success.
    fn require_multisig_authorized(env: &Env, signers: &Vec<Address>) -> Result<Address, Error> {
        if signers.is_empty() {
            return Err(Error::InsufficientSignatures);
        }

        let admin_signers: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::AdminSigners)
            .unwrap_or_else(|| Vec::new(env));
        let threshold: u32 = env
            .storage()
            .instance()
            .get(&DataKey::Threshold)
            .unwrap_or(1);

        let mut approved: Vec<Address> = Vec::new(env);
        for signer in signers.iter() {
            if approved.contains(&signer) {
                return Err(Error::DuplicateSigner);
            }
            if !admin_signers.contains(&signer) {
                return Err(Error::NotAdminSigner);
            }
            signer.require_auth();
            approved.push_back(signer);
        }

        if approved.len() < threshold {
            return Err(Error::InsufficientSignatures);
        }

        Ok(approved.get(0).unwrap())
    }

    /// Halt all state-mutating vault entrypoints. Requires `Threshold`-of-N
    /// signatures from the configured `AdminSigners`.
    pub fn pause(env: Env, signers: Vec<Address>) -> Result<(), Error> {
        let initiator = Self::require_multisig_authorized(&env, &signers)?;
        env.storage().instance().set(&DataKey::Paused, &true);
        env.events()
            .publish((Symbol::new(&env, "ProtocolPaused"),), initiator);
        Ok(())
    }

    /// Resume vault operations. Requires `Threshold`-of-N signatures from the
    /// configured `AdminSigners`.
    pub fn unpause(env: Env, signers: Vec<Address>) -> Result<(), Error> {
        let initiator = Self::require_multisig_authorized(&env, &signers)?;
        env.storage().instance().set(&DataKey::Paused, &false);
        env.events()
            .publish((Symbol::new(&env, "ProtocolUnpaused"),), initiator);
        Ok(())
    }

    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
    }

    fn require_not_paused(env: &Env) -> Result<(), Error> {
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        if paused {
            return Err(Error::ContractPaused);
        }
        Ok(())
    }

    pub fn set_oracles(env: Env, primary: Address, fallback: Address) -> Result<(), Error> {
        Self::require_not_paused(&env)?;
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::PrimaryOracle, &primary);
        env.storage().instance().set(&DataKey::FallbackOracle, &fallback);
        Ok(())
    }

    pub fn deposit(env: Env, user: Address, amount: i128, min_shares: i128, token_symbol: Symbol) -> Result<i128, Error> {
        Self::require_not_paused(&env)?;
        user.require_auth();

        // Fetch price first to ensure the oracle is active and the price is fresh.
        // This acts as a security check before execution.
        let _price = oracle::fetch_price(&env, token_symbol).unwrap();

        let mut state: VaultState = env.storage().instance().get(&DataKey::VaultState).unwrap();
        let shares = if state.total_deposits == 0 { amount } else { (amount * state.total_shares) / state.total_deposits };
        
        if shares < min_shares {
            panic!("slippage limit exceeded");
        }

        // Perform token transfer from user to the vault contract
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&user, &env.current_contract_address(), &amount);

        state.total_deposits += amount;
        state.total_shares += shares;
        let user_key = DataKey::UserShares(user.clone());
        let current: i128 = env.storage().instance().get(&user_key).unwrap_or(0);
        env.storage().instance().set(&user_key, &(current + shares));
        env.storage().instance().set(&DataKey::VaultState, &state);
        Ok(shares)
    }

    pub fn withdraw(env: Env, user: Address, shares: i128, min_assets: i128, token_symbol: Symbol) -> Result<i128, Error> {
        Self::require_not_paused(&env)?;
        user.require_auth();

        // Fetch price first to ensure the oracle is active and the price is fresh.
        let _price = oracle::fetch_price(&env, token_symbol).unwrap();

        let state: VaultState = env.storage().instance().get(&DataKey::VaultState).unwrap();
        let user_key = DataKey::UserShares(user.clone());
        let user_shares: i128 = env.storage().instance().get(&user_key).unwrap_or(0);
        if user_shares < shares {
            panic!("insufficient shares");
        }

        let amount = (shares * state.total_deposits) / state.total_shares;
        if amount < min_assets {
            panic!("slippage limit exceeded");
        }

        // Perform token transfer from the vault contract to the user
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&env.current_contract_address(), &user, &amount);

        let mut new_state = state;
        new_state.total_deposits -= amount;
        new_state.total_shares -= shares;
        env.storage().instance().set(&user_key, &(user_shares - shares));
        env.storage().instance().set(&DataKey::VaultState, &new_state);
        Ok(amount)
    }

    pub fn compound(env: Env, yield_amount: i128) -> Result<(), Error> {
        Self::require_not_paused(&env)?;
        let mut state: VaultState = env.storage().instance().get(&DataKey::VaultState).unwrap();
        state.total_deposits += yield_amount;
        state.total_yield_harvested += yield_amount;
        state.compound_count += 1;
        state.last_compound_ts = env.ledger().timestamp();
        env.storage().instance().set(&DataKey::VaultState, &state);
        Ok(())
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

#[cfg(test)]
mod test;
