// Integration test suite
//
// Migrated to the standard Hardhat toolbox testing format (Mocha + Chai +
// ethers.js helpers) so the suite runs cleanly under `npx hardhat test`.
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Contract } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { verifySignature } from '../../src/core/engine';

// Real signature: Hardhat account #0 signing "hello"
const VALID_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const VALID_SIG = '0xf16ea9a3478698f695fd1401bfe27e9e4a7e8e3da94aa72b021125e31fa899cc573c48ea3fe1d4ab61a9db10c19032026e3ed2dbccba5a178235ac27f94504311c';

describe('Vault deposit/withdraw flow', () => {
  let usdc: Contract;
  let vault: Contract;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;

  // MockUSDC uses ERC20's default 18 decimals; the vault mirrors the asset.
  const DECIMALS = 18;
  const toUnits = (value: string) => ethers.utils.parseUnits(value, DECIMALS);

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory('MockUSDC');
    usdc = await MockUSDC.deploy();
    await usdc.deployed();

    const Vault = await ethers.getContractFactory('Vault');
    vault = await Vault.deploy(usdc.address);
    await vault.deployed();

    // Seed the user with USDC so they can deposit.
    await usdc.transfer(user.address, toUnits('1000'));
  });

  it('deploys the vault against the underlying asset', async () => {
    expect(await vault.name()).to.equal('Yield Vault');
    expect(await vault.symbol()).to.equal('yVault');
    expect(await vault.asset()).to.equal(usdc.address);
    expect(await vault.decimals()).to.equal(DECIMALS);
  });

  it('mints shares 1:1 on the first deposit', async () => {
    const amount = toUnits('100');

    await usdc.connect(user).approve(vault.address, amount);
    await vault.connect(user).deposit(amount, user.address);

    // First deposit into an empty ERC4626 vault mints shares 1:1.
    expect(await vault.balanceOf(user.address)).to.equal(amount);
    expect(await vault.totalAssets()).to.equal(amount);
    expect(await usdc.balanceOf(vault.address)).to.equal(amount);
  });

  it('lets a depositor withdraw their full balance', async () => {
    const amount = toUnits('100');
    const balanceBefore = await usdc.balanceOf(user.address);

    await usdc.connect(user).approve(vault.address, amount);
    await vault.connect(user).deposit(amount, user.address);

    // Redeem every share back to the underlying asset.
    const shares = await vault.balanceOf(user.address);
    await vault.connect(user).redeem(shares, user.address, user.address);

    expect(await vault.balanceOf(user.address)).to.equal(0);
    expect(await vault.totalAssets()).to.equal(0);
    expect(await usdc.balanceOf(user.address)).to.equal(balanceBefore);
  });

  it('increases share value when yield is distributed', async () => {
    const deposit = toUnits('100');
    const yieldAmount = toUnits('50');

    await usdc.connect(user).approve(vault.address, deposit);
    await vault.connect(user).deposit(deposit, user.address);

    // Owner distributes yield into the vault, raising the share price.
    await usdc.connect(owner).approve(vault.address, yieldAmount);
    await vault.connect(owner).distributeYield(yieldAmount);

    const shares = await vault.balanceOf(user.address);
    const expected = deposit.add(yieldAmount);
    const preview = await vault.previewRedeem(shares);

    // Shares are unchanged but now redeem for ~(deposit + yield). ERC4626
    // rounds in the vault's favour, so allow a 1-wei rounding tolerance.
    expect(shares).to.equal(deposit);
    expect(await vault.totalAssets()).to.equal(expected);
    expect(preview).to.be.gt(deposit);
    expect(expected.sub(preview)).to.be.lte(1);
  });

  it('reverts a deposit without sufficient allowance', async () => {
    const amount = toUnits('100');
    // No approve() call — the transferFrom inside deposit must revert.
    await expect(vault.connect(user).deposit(amount, user.address)).to.be.reverted;
  });
});

describe('verifySignature', () => {
  it('returns true for a valid signature', () => {
    expect(verifySignature('hello', VALID_SIG, VALID_ADDRESS)).to.equal(true);
  });

  it('returns false for empty message', () => {
    expect(verifySignature('', VALID_SIG, VALID_ADDRESS)).to.equal(false);
  });

  it('returns false for empty signature', () => {
    expect(verifySignature('hello', '', VALID_ADDRESS)).to.equal(false);
  });

  it('returns false for empty address', () => {
    expect(verifySignature('hello', VALID_SIG, '')).to.equal(false);
  });

  it('returns false for short (malformed) signature', () => {
    expect(verifySignature('hello', '0xdeadbeef', VALID_ADDRESS)).to.equal(false);
  });

  it('returns false when address does not match signer', () => {
    expect(verifySignature('hello', VALID_SIG, '0x0000000000000000000000000000000000000001')).to.equal(false);
  });

  it('returns false for a signature on a different message', () => {
    expect(verifySignature('different message', VALID_SIG, VALID_ADDRESS)).to.equal(false);
  });

  it('is case-insensitive for the address comparison', () => {
    expect(verifySignature('hello', VALID_SIG, VALID_ADDRESS.toUpperCase())).to.equal(true);
  });
});
