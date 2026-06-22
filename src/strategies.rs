#![no_std]

use soroban_sdk::{Env, Symbol};

pub trait YieldStrategy {
    fn name(&self, env: &Env) -> Symbol;
    fn get_apy(&self, env: &Env) -> u32;
    fn get_tvl(&self, env: &Env) -> u64;
    fn simulate_deposit(&self, env: &Env, amount: u64) -> u64;
}

pub struct XlmLiquidityPool;

impl YieldStrategy for XlmLiquidityPool {
    fn name(&self, env: &Env) -> Symbol {
        Symbol::new(env, "XLM LP")
    }

    fn get_apy(&self, _env: &Env) -> u32 {
        500
    }

    fn get_tvl(&self, _env: &Env) -> u64 {
        1_000_000_000_000
    }

    fn simulate_deposit(&self, _env: &Env, amount: u64) -> u64 {
        amount * 500 / 10000
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_xlm_apy() {
        let pool = XlmLiquidityPool;
        let env = Env::default();
        assert_eq!(pool.get_apy(&env), 500);
    }

    #[test]
    fn test_xlm_tvl() {
        let pool = XlmLiquidityPool;
        let env = Env::default();
        assert_eq!(pool.get_tvl(&env), 1_000_000_000_000);
    }

    #[test]
    fn test_xlm_simulate_deposit() {
        let pool = XlmLiquidityPool;
        let env = Env::default();
        assert_eq!(pool.simulate_deposit(&env, 1000), 50);
    }

    #[test]
    fn test_xlm_name() {
        let pool = XlmLiquidityPool;
        let env = Env::default();
        assert_eq!(pool.name(&env), Symbol::new(&env, "XLM LP"));
    }
}