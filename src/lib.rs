#![no_std]
use soroban_sdk::{contract, contractimpl, contracterror, contracttype, Env, Address, token};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    ContractPaused = 3,
    NoPendingWithdrawal = 4,
    WithdrawalLocked = 5,
    NotAuthorized = 6,
}

#[contracttype]
#[derive(Clone)]
pub enum StorageKey {
    Admin,
    Token,
    LockPeriod,
    Paused,
    Initialized,
    PendingWithdrawal(Address),
    Balances(Address),
    StrategyAllocations(Address),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WithdrawalRecord {
    pub amount: i128,
    pub unlock_time: u64,
}

#[contract]
pub struct TimeLockVault;

#[contractimpl]
impl TimeLockVault {
    /// Initialize the vault with admin, token, and withdrawal lock period (in seconds)
    pub fn initialize(env: Env, admin: Address, token: Address, lock_period: u64) -> Result<(), Error> {
        let storage = env.storage().persistent();
        if storage.has(&StorageKey::Initialized) {
            return Err(Error::AlreadyInitialized);
        }

        storage.set(&StorageKey::Admin, &admin);
        storage.set(&StorageKey::Token, &token);
        storage.set(&StorageKey::LockPeriod, &lock_period);
        storage.set(&StorageKey::Paused, &false);
        storage.set(&StorageKey::Initialized, &true);

        Ok(())
    }

    /// Deposits underlying tokens into the vault and mints virtual shares (1:1 for simplicity)
    pub fn deposit(env: Env, from: Address, amount: i128) -> Result<(), Error> {
        from.require_auth();
        Self::check_active(&env)?;

        let storage = env.storage().persistent();
        let token_addr: Address = storage.get(&StorageKey::Token).unwrap();

        // Transfer tokens from user to vault
        let client = token::Client::new(&env, &token_addr);
        client.transfer(&from, &env.current_contract_address(), &amount);

        // Update user's share balance
        let user_key = StorageKey::Balances(from.clone());
        let current_balance: i128 = storage.get(&user_key).unwrap_or(0);
        storage.set(&user_key, &(current_balance + amount));

        Ok(())
    }

    /// Initiates withdrawal queueing. Deducts share balances and starts the time-lock timer.
    pub fn initiate_withdrawal(env: Env, from: Address, amount: i128) -> Result<(), Error> {
        from.require_auth();
        Self::check_active(&env)?;

        let storage = env.storage().persistent();
        let user_key = StorageKey::Balances(from.clone());
        let current_balance: i128 = storage.get(&user_key).unwrap_or(0);

        if current_balance < amount {
            return Err(Error::NotAuthorized); // Insufficient shares
        }

        // Deduct balance from user
        storage.set(&user_key, &(current_balance - amount));

        // Create pending withdrawal record
        let lock_period: u64 = storage.get(&StorageKey::LockPeriod).unwrap();
        let unlock_time = env.ledger().timestamp() + lock_period;

        let record_key = StorageKey::PendingWithdrawal(from.clone());
        let current_pending: WithdrawalRecord = storage.get(&record_key).unwrap_or(WithdrawalRecord {
            amount: 0,
            unlock_time: 0,
        });

        // Update record
        storage.set(&record_key, &WithdrawalRecord {
            amount: current_pending.amount + amount,
            unlock_time,
        });

        Ok(())
    }

    /// Claims a pending withdrawal once the lock period has expired.
    pub fn claim_withdrawal(env: Env, from: Address) -> Result<(), Error> {
        from.require_auth();
        Self::check_active(&env)?;

        let storage = env.storage().persistent();
        let record_key = StorageKey::PendingWithdrawal(from.clone());
        
        if !storage.has(&record_key) {
            return Err(Error::NoPendingWithdrawal);
        }

        let record: WithdrawalRecord = storage.get(&record_key).unwrap();
        
        if env.ledger().timestamp() < record.unlock_time {
            return Err(Error::WithdrawalLocked);
        }

        // Clear pending withdrawal record
        storage.remove(&record_key);

        // Transfer tokens back to user
        let token_addr: Address = storage.get(&StorageKey::Token).unwrap();
        let client = token::Client::new(&env, &token_addr);
        client.transfer(&env.current_contract_address(), &from, &record.amount);

        Ok(())
    }

    /// Allocates vault capital to yield strategies (restricted to Admin)
    pub fn allocate_strategy(env: Env, admin: Address, strategy: Address, amount: i128) -> Result<(), Error> {
        admin.require_auth();
        
        let storage = env.storage().persistent();
        let saved_admin: Address = storage.get(&StorageKey::Admin).unwrap();
        if admin != saved_admin {
            return Err(Error::NotAuthorized);
        }

        let token_addr: Address = storage.get(&StorageKey::Token).unwrap();
        let client = token::Client::new(&env, &token_addr);
        
        // Transfer to strategy address
        client.transfer(&env.current_contract_address(), &strategy, &amount);

        // Update strategy allocation record
        let strategy_key = StorageKey::StrategyAllocations(strategy.clone());
        let current_alloc: i128 = storage.get(&strategy_key).unwrap_or(0);
        storage.set(&strategy_key, &(current_alloc + amount));

        Ok(())
    }

    /// Pauses/unpauses vault operations (restricted to Admin)
    pub fn set_paused(env: Env, admin: Address, paused: bool) -> Result<(), Error> {
        admin.require_auth();

        let storage = env.storage().persistent();
        let saved_admin: Address = storage.get(&StorageKey::Admin).unwrap();
        if admin != saved_admin {
            return Err(Error::NotAuthorized);
        }

        storage.set(&StorageKey::Paused, &paused);
        Ok(())
    }

    // Helper checks
    fn check_active(env: &Env) -> Result<(), Error> {
        let storage = env.storage().persistent();
        let paused: bool = storage.get(&StorageKey::Paused).unwrap_or(false);
        if paused {
            return Err(Error::ContractPaused);
        }
        Ok(())
    }
}

mod test;
