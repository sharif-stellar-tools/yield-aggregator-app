use super::*;
use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env};

/// Register a fresh contract instance and return the env + contract id.
///
/// The `VaultContractClient` is constructed inside each test (it owns a clone of
/// the `Env`) so the helper does not return a value that appears to borrow a
/// local `Env`.
fn setup() -> (Env, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(VaultContract, ());
    (env, contract_id)
}

#[test]
fn initialize_sets_admin() {
    let (env, contract_id) = setup();
    let client = VaultContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    assert_eq!(client.admin(), admin);
}

#[test]
fn version_is_reported() {
    let (env, contract_id) = setup();
    let client = VaultContractClient::new(&env, &contract_id);
    assert_eq!(client.version(), symbol_short!("v0_1_0"));
}

#[test]
fn double_initialize_fails() {
    let (env, contract_id) = setup();
    let client = VaultContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    let result = client.try_initialize(&admin);
    assert_eq!(result, Err(Ok(Error::AlreadyInitialized)));
}

#[test]
fn admin_before_init_errors() {
    let (env, contract_id) = setup();
    let client = VaultContractClient::new(&env, &contract_id);
    let result = client.try_admin();
    assert_eq!(result, Err(Ok(Error::NotInitialized)));
}
