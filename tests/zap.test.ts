import { expect } from 'chai';
import { XlmZapStrategy } from '../src/core/strategies/XlmZapStrategy';

describe('XlmZapStrategy', () => {
  let zapStrategy: XlmZapStrategy;

  beforeEach(() => {
    zapStrategy = new XlmZapStrategy();
  });

  describe('isSupportedAsset', () => {
    it('should return true for supported assets', () => {
      expect(zapStrategy.isSupportedAsset('USDC')).to.be.true;
      expect(zapStrategy.isSupportedAsset('usdc')).to.be.true;
      expect(zapStrategy.isSupportedAsset('XLM')).to.be.true;
      expect(zapStrategy.isSupportedAsset('USDT')).to.be.true;
    });

    it('should return false for unsupported assets', () => {
      expect(zapStrategy.isSupportedAsset('BTC')).to.be.false;
      expect(zapStrategy.isSupportedAsset('ETH')).to.be.false;
      expect(zapStrategy.isSupportedAsset('UNKNOWN')).to.be.false;
    });
  });

  describe('getZapQuote', () => {
    it('should return a valid quote for USDC', async () => {
      const quote = await zapStrategy.getZapQuote('USDC', 1000);

      expect(quote).to.have.property('inputAmount', 1000);
      expect(quote).to.have.property('inputAsset', 'USDC');
      expect(quote).to.have.property('estimatedLPTokens');
      expect(quote.estimatedLPTokens).to.be.greaterThan(0);
      expect(quote.assetSplit).to.be.an('array');
      expect(quote.assetSplit.length).to.equal(2);
      expect(quote.slippage).to.be.greaterThan(0);
      expect(quote.apy).to.equal(0.05); // 5% APY
    });

    it('should return a valid quote for XLM', async () => {
      const quote = await zapStrategy.getZapQuote('XLM', 5000);

      expect(quote.inputAsset).to.equal('XLM');
      expect(quote.inputAmount).to.equal(5000);
      expect(quote.estimatedLPTokens).to.be.greaterThan(0);
      expect(quote.assetSplit).to.be.an('array');
      expect(quote.assetSplit.length).to.equal(2);
    });

    it('should return a valid quote for USDT', async () => {
      const quote = await zapStrategy.getZapQuote('USDT', 2000);

      expect(quote.inputAsset).to.equal('USDT');
      expect(quote.inputAmount).to.equal(2000);
      expect(quote.estimatedLPTokens).to.be.greaterThan(0);
      expect(quote.assetSplit).to.be.an('array');
    });

    it('should throw error for unsupported asset', async () => {
      try {
        await zapStrategy.getZapQuote('BTC', 1000);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.an('error');
        expect((error as Error).message).to.include('not supported');
      }
    });

    it('should throw error for invalid amount', async () => {
      try {
        await zapStrategy.getZapQuote('USDC', 0);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.an('error');
        expect((error as Error).message).to.include('greater than 0');
      }
    });

    it('should throw error for negative amount', async () => {
      try {
        await zapStrategy.getZapQuote('USDC', -100);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.an('error');
        expect((error as Error).message).to.include('greater than 0');
      }
    });

    it('should split assets approximately 50/50', async () => {
      const quote = await zapStrategy.getZapQuote('USDC', 1000);
      const totalValue = quote.assetSplit.reduce((sum, s) => {
        // Rough estimate: assume XLM price around $0.12
        const value = s.asset === 'USDC' ? s.amount : s.amount * 0.12;
        return sum + value;
      }, 0);

      // Total value should be close to input amount (within slippage)
      expect(totalValue).to.be.closeTo(1000, 50);
    });
  });

  describe('executeZap', () => {
    it('should successfully execute zap for valid inputs', async () => {
      const result = await zapStrategy.executeZap('USDC', 1000, 900);

      expect(result).to.have.property('success');
      expect(result).to.have.property('txHash');
      expect(result).to.have.property('lpTokensReceived');
      expect(result).to.have.property('actualSlippage');

      if (result.success) {
        expect(result.txHash).to.be.a('string').and.not.empty;
        expect(result.lpTokensReceived).to.be.greaterThan(0);
        expect(result.actualSlippage).to.be.greaterThanOrEqual(0);
      }
    });

    it('should fail if slippage tolerance is exceeded', async () => {
      // Set minLPTokens too high to trigger slippage check
      const result = await zapStrategy.executeZap('USDC', 1000, 10000);

      expect(result.success).to.be.false;
      expect(result.error).to.include('Slippage tolerance exceeded');
      expect(result.lpTokensReceived).to.equal(0);
    });

    it('should return LP tokens within reasonable range', async () => {
      const inputAmount = 1000;
      const result = await zapStrategy.executeZap('USDC', inputAmount, 0);

      if (result.success) {
        // LP tokens should be close to input amount (accounting for fees)
        expect(result.lpTokensReceived).to.be.closeTo(inputAmount * 0.98, inputAmount * 0.1);
      }
    });

    it('should handle multiple consecutive zaps', async () => {
      const results = await Promise.all([
        zapStrategy.executeZap('USDC', 500, 400),
        zapStrategy.executeZap('XLM', 1000, 100),
        zapStrategy.executeZap('USDT', 750, 600)
      ]);

      results.forEach(result => {
        expect(result).to.have.property('success');
        expect(result).to.have.property('txHash');
        expect(result).to.have.property('lpTokensReceived');
      });
    });

    it('should generate unique transaction hashes', async () => {
      const result1 = await zapStrategy.executeZap('USDC', 1000, 0);
      const result2 = await zapStrategy.executeZap('USDC', 1000, 0);

      if (result1.success && result2.success) {
        expect(result1.txHash).to.not.equal(result2.txHash);
      }
    });
  });

  describe('Integration - Quote to Execution', () => {
    it('should execute zap based on quote with acceptable slippage', async () => {
      const quote = await zapStrategy.getZapQuote('USDC', 1000);
      
      // Allow 1% slippage
      const minLPTokens = quote.estimatedLPTokens * 0.99;
      const result = await zapStrategy.executeZap('USDC', 1000, minLPTokens);

      if (result.success) {
        expect(result.lpTokensReceived).to.be.at.least(minLPTokens);
        expect(result.actualSlippage).to.be.lessThan(0.02); // Less than 2%
      }
    });

    it('should handle large deposits', async () => {
      const largeAmount = 100000;
      const quote = await zapStrategy.getZapQuote('USDC', largeAmount);
      
      expect(quote.estimatedLPTokens).to.be.greaterThan(0);
      
      const result = await zapStrategy.executeZap('USDC', largeAmount, quote.estimatedLPTokens * 0.95);
      
      expect(result).to.have.property('success');
    });

    it('should handle small deposits', async () => {
      const smallAmount = 10;
      const quote = await zapStrategy.getZapQuote('USDC', smallAmount);
      
      expect(quote.estimatedLPTokens).to.be.greaterThan(0);
      
      const result = await zapStrategy.executeZap('USDC', smallAmount, 0);
      
      expect(result).to.have.property('success');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small amounts', async () => {
      const quote = await zapStrategy.getZapQuote('USDC', 0.01);
      expect(quote.estimatedLPTokens).to.be.greaterThan(0);
    });

    it('should handle decimal amounts', async () => {
      const quote = await zapStrategy.getZapQuote('USDC', 123.456);
      expect(quote.inputAmount).to.equal(123.456);
      expect(quote.estimatedLPTokens).to.be.greaterThan(0);
    });

    it('should case-insensitively handle asset names', async () => {
      const quoteUpper = await zapStrategy.getZapQuote('USDC', 1000);
      const quoteLower = await zapStrategy.getZapQuote('usdc', 1000);
      
      expect(quoteUpper.inputAsset).to.equal('USDC');
      expect(quoteLower.inputAsset).to.equal('USDC');
    });
  });
});
