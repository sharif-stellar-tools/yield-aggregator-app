import { expect } from 'chai';
import { formatUsd, convertXlmToUsd } from '../src/api/coingecko';

describe('formatUsd', () => {
  it('formats a whole number with two decimals', () => {
    expect(formatUsd(100)).to.equal('$100.00');
  });

  it('formats a decimal number correctly', () => {
    expect(formatUsd(0.1234)).to.equal('$0.1234');
  });

  it('formats zero', () => {
    expect(formatUsd(0)).to.equal('$0.00');
  });

  it('formats a very small number', () => {
    expect(formatUsd(0.000001)).to.equal('$0.000001');
  });
});

describe('convertXlmToUsd', () => {
  it('converts XLM to USD correctly', () => {
    expect(convertXlmToUsd(100, 0.5)).to.equal(50);
  });

  it('returns 0 for 0 XLM', () => {
    expect(convertXlmToUsd(0, 0.5)).to.equal(0);
  });

  it('handles small amounts', () => {
    expect(convertXlmToUsd(1.5, 0.123456)).to.equal(0.185184);
  });

  it('handles zero price', () => {
    expect(convertXlmToUsd(100, 0)).to.equal(0);
  });
});

describe('fetchXlmPrice', () => {
  it('imports fetchXlmPrice as a function', () => {
    const mod = require('../src/api/coingecko');
    expect(mod.fetchXlmPrice).to.be.a('function');
  });
});
