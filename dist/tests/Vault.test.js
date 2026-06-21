"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const hardhat_1 = require("hardhat");
describe('Vault', function () {
    it('should deploy Vault and MockUSDC', async function () {
        const MockUSDC = await hardhat_1.ethers.getContractFactory('MockUSDC');
        const usdc = await MockUSDC.deploy();
        await usdc.deployed();
        const Vault = await hardhat_1.ethers.getContractFactory('Vault');
        const vault = await Vault.deploy(usdc.address);
        await vault.deployed();
        (0, chai_1.expect)(await vault.name()).to.equal('Yield Vault');
    });
    it('should allow distributeYield', async function () {
        const MockUSDC = await hardhat_1.ethers.getContractFactory('MockUSDC');
        const usdc = await MockUSDC.deploy();
        await usdc.deployed();
        const Vault = await hardhat_1.ethers.getContractFactory('Vault');
        const vault = await Vault.deploy(usdc.address);
        await vault.deployed();
        const [owner] = await hardhat_1.ethers.getSigners();
        await usdc.approve(vault.address, hardhat_1.ethers.utils.parseUnits('1000', 6));
        await vault.distributeYield(hardhat_1.ethers.utils.parseUnits('100', 6));
        (0, chai_1.expect)(await usdc.balanceOf(vault.address)).to.equal(hardhat_1.ethers.utils.parseUnits('100', 6));
    });
});
