import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('Vault', function () {
  it('should deploy Vault and MockUSDC', async function () {
    const MockUSDC = await ethers.getContractFactory('MockUSDC');
    const usdc = await MockUSDC.deploy();
    await usdc.deployed();

    const Vault = await ethers.getContractFactory('Vault');
    const vault = await Vault.deploy(usdc.address);
    await vault.deployed();

    expect(await vault.name()).to.equal('Yield Vault');
  });

  it('should allow distributeYield', async function () {
    const MockUSDC = await ethers.getContractFactory('MockUSDC');
    const usdc = await MockUSDC.deploy();
    await usdc.deployed();

    const Vault = await ethers.getContractFactory('Vault');
    const vault = await Vault.deploy(usdc.address);
    await vault.deployed();

    const [owner] = await ethers.getSigners();
    await usdc.approve(vault.address, ethers.utils.parseUnits('1000', 6));
    await vault.distributeYield(ethers.utils.parseUnits('100', 6));

    expect(await usdc.balanceOf(vault.address)).to.equal(ethers.utils.parseUnits('100', 6));
  });
});