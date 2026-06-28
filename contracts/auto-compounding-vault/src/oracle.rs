// oracle.rs – price oracle abstraction for Yield Aggregator
use soroban_sdk::{Address, Env, Symbol, IntoVal, symbol_short};

/// Result type used by oracle implementations.
pub type OracleResult = Result<PriceData, OracleError>;

/// Struct representing a price reading.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PriceData {
    pub price: u128,
    pub timestamp: u64,
}

/// Errors that can be returned by an oracle.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum OracleError {
    Unavailable,
    Stale,
    InvalidResponse,
}

/// Trait that all oracle providers must implement.
pub trait OracleProvider {
    fn get_price(env: &Env, token: Symbol) -> OracleResult;
}

/// Primary oracle implementation – invokes a Soroban price‑feed contract.
pub struct PrimaryOracle;
impl OracleProvider for PrimaryOracle {
    fn get_price(env: &Env, token: Symbol) -> OracleResult {
        // Expect the price‑feed contract to expose a `price` method returning (price, timestamp).
        let oracle_addr: Address = env.storage().instance().get(&crate::DataKey::PrimaryOracle).ok_or(OracleError::Unavailable)?;
        // Invoke the external contract safely.
        let args = soroban_sdk::vec![env, token.into_val(env)];
        let res = env.try_invoke_contract::<(u128, u64), soroban_sdk::Error>(&oracle_addr, &symbol_short!("price"), args);
        let (price, ts): (u128, u64) = match res {
            Ok(Ok(val)) => val,
            _ => return Err(OracleError::InvalidResponse),
        };
        Ok(PriceData { price, timestamp: ts })
    }
}

/// Fallback oracle implementation – can be another on‑chain feed or a static value.
pub struct FallbackOracle;
impl OracleProvider for FallbackOracle {
    fn get_price(env: &Env, token: Symbol) -> OracleResult {
        let oracle_addr: Address = env.storage().instance().get(&crate::DataKey::FallbackOracle).ok_or(OracleError::Unavailable)?;
        let args = soroban_sdk::vec![env, token.into_val(env)];
        let res = env.try_invoke_contract::<(u128, u64), soroban_sdk::Error>(&oracle_addr, &symbol_short!("price"), args);
        let (price, ts): (u128, u64) = match res {
            Ok(Ok(val)) => val,
            _ => return Err(OracleError::InvalidResponse),
        };
        Ok(PriceData { price, timestamp: ts })
    }
}

// Helper constant – maximum allowed age (in seconds) for a price reading.
pub const MAX_PRICE_AGE: u64 = 300; // 5 minutes

// Utility to fetch a fresh price, applying fallback and freshness validation.
pub fn fetch_price(env: &Env, token: Symbol) -> Result<u128, OracleError> {
    // Try primary oracle first.
    match PrimaryOracle::get_price(env, token.clone()) {
        Ok(data) => {
            let age = env.ledger().timestamp().saturating_sub(data.timestamp);
            if age <= MAX_PRICE_AGE {
                // Emit event for successful primary fetch.
                let topic = Symbol::new(env, "PriceFetched");
                env.events().publish((topic,), (token, data.price, 0_u32, true));
                return Ok(data.price);
            }
            // Primary stale – fall through to fallback.
        }
        Err(_) => {}
    }
    // Try fallback.
    match FallbackOracle::get_price(env, token.clone()) {
        Ok(data) => {
            let age = env.ledger().timestamp().saturating_sub(data.timestamp);
            if age <= MAX_PRICE_AGE {
                let topic = Symbol::new(env, "PriceFetched");
                env.events().publish((topic,), (token.clone(), data.price, 1_u32, true));
                return Ok(data.price);
            }
            let topic = Symbol::new(env, "PriceFetched");
            env.events().publish((topic,), (token, data.price, 1_u32, false));
            Err(OracleError::Stale)
        }
        Err(_) => Err(OracleError::Unavailable),
    }
}
