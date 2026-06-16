#![no_std]
//! Minimal Soroban vault contract for the yield-aggregator-app.
//!
//! This contract intentionally exposes a small, well-defined surface so that the
//! Soroban deployment flow (build -> optimize -> deploy -> initialize) can be
//! exercised end-to-end on Testnet. It mirrors the `Vault` concept from
//! `contracts/Vault.sol`: a single administrator is configured once at
//! initialization time.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env, Symbol,
};

/// Keys for the contract's instance storage.
#[contracttype]
pub enum DataKey {
    /// The vault administrator.
    Admin,
}

/// Errors returned by [`VaultContract`].
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// `initialize` was called on a vault that is already initialized.
    AlreadyInitialized = 1,
    /// A read was attempted before the vault was initialized.
    NotInitialized = 2,
}

#[contract]
pub struct VaultContract;

#[contractimpl]
impl VaultContract {
    /// Initialize the vault, setting its administrator.
    ///
    /// Can only be called once: subsequent calls return
    /// [`Error::AlreadyInitialized`]. Requires authorization from `admin`.
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        Ok(())
    }

    /// Return the configured administrator.
    ///
    /// Returns [`Error::NotInitialized`] if [`Self::initialize`] has not been
    /// called yet.
    pub fn admin(env: Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)
    }

    /// Return the contract version as a short symbol.
    pub fn version(_env: Env) -> Symbol {
        symbol_short!("v0_1_0")
    }
}

#[cfg(test)]
mod test;
