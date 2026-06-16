#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

fn setup() -> (Env, VaultContractClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(VaultContract, ());
    let client = VaultContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    (env, client, admin)
}

#[test]
fn initialize_sets_admin() {
    let (_env, client, admin) = setup();
    client.initialize(&admin);
    assert_eq!(client.admin(), admin);
}

#[test]
fn version_is_reported() {
    let (_env, client, _admin) = setup();
    assert_eq!(client.version(), symbol_short!("v0_1_0"));
}

#[test]
fn double_initialize_fails() {
    let (_env, client, admin) = setup();
    client.initialize(&admin);
    let result = client.try_initialize(&admin);
    assert_eq!(result, Err(Ok(Error::AlreadyInitialized)));
}

#[test]
fn admin_before_init_errors() {
    let (_env, client, _admin) = setup();
    let result = client.try_admin();
    assert_eq!(result, Err(Ok(Error::NotInitialized)));
}
