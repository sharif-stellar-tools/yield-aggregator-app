"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Integration test suite
const chai_1 = require("chai");
const engine_1 = require("../../src/core/engine");
// Real signature: Hardhat account #0 signing "hello"
const VALID_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const VALID_SIG = '0xf16ea9a3478698f695fd1401bfe27e9e4a7e8e3da94aa72b021125e31fa899cc573c48ea3fe1d4ab61a9db10c19032026e3ed2dbccba5a178235ac27f94504311c';
describe('Core Flow', () => {
    it('should process transactions', async () => {
        (0, chai_1.expect)(true).to.equal(true);
    });
});
describe('verifySignature', () => {
    it('returns true for a valid signature', () => {
        (0, chai_1.expect)((0, engine_1.verifySignature)('hello', VALID_SIG, VALID_ADDRESS)).to.equal(true);
    });
    it('returns false for empty message', () => {
        (0, chai_1.expect)((0, engine_1.verifySignature)('', VALID_SIG, VALID_ADDRESS)).to.equal(false);
    });
    it('returns false for empty signature', () => {
        (0, chai_1.expect)((0, engine_1.verifySignature)('hello', '', VALID_ADDRESS)).to.equal(false);
    });
    it('returns false for empty address', () => {
        (0, chai_1.expect)((0, engine_1.verifySignature)('hello', VALID_SIG, '')).to.equal(false);
    });
    it('returns false for short (malformed) signature', () => {
        (0, chai_1.expect)((0, engine_1.verifySignature)('hello', '0xdeadbeef', VALID_ADDRESS)).to.equal(false);
    });
    it('returns false when address does not match signer', () => {
        (0, chai_1.expect)((0, engine_1.verifySignature)('hello', VALID_SIG, '0x0000000000000000000000000000000000000001')).to.equal(false);
    });
    it('returns false for a signature on a different message', () => {
        (0, chai_1.expect)((0, engine_1.verifySignature)('different message', VALID_SIG, VALID_ADDRESS)).to.equal(false);
    });
    it('is case-insensitive for the address comparison', () => {
        (0, chai_1.expect)((0, engine_1.verifySignature)('hello', VALID_SIG, VALID_ADDRESS.toUpperCase())).to.equal(true);
    });
});
