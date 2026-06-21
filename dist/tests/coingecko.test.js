"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const coingecko_1 = require("../src/api/coingecko");
describe('formatUsd', () => {
    it('formats a whole number with two decimals', () => {
        (0, chai_1.expect)((0, coingecko_1.formatUsd)(100)).to.equal('$100.00');
    });
    it('formats a decimal number correctly', () => {
        (0, chai_1.expect)((0, coingecko_1.formatUsd)(0.1234)).to.equal('$0.1234');
    });
    it('formats zero', () => {
        (0, chai_1.expect)((0, coingecko_1.formatUsd)(0)).to.equal('$0.00');
    });
    it('formats a very small number', () => {
        (0, chai_1.expect)((0, coingecko_1.formatUsd)(0.000001)).to.equal('$0.000001');
    });
});
describe('convertXlmToUsd', () => {
    it('converts XLM to USD correctly', () => {
        (0, chai_1.expect)((0, coingecko_1.convertXlmToUsd)(100, 0.5)).to.equal(50);
    });
    it('returns 0 for 0 XLM', () => {
        (0, chai_1.expect)((0, coingecko_1.convertXlmToUsd)(0, 0.5)).to.equal(0);
    });
    it('handles small amounts', () => {
        (0, chai_1.expect)((0, coingecko_1.convertXlmToUsd)(1.5, 0.123456)).to.equal(0.185184);
    });
    it('handles zero price', () => {
        (0, chai_1.expect)((0, coingecko_1.convertXlmToUsd)(100, 0)).to.equal(0);
    });
});
describe('fetchXlmPrice', () => {
    it('imports fetchXlmPrice as a function', () => {
        (0, chai_1.expect)(coingecko_1.fetchXlmPrice).to.be.a('function');
    });
});
