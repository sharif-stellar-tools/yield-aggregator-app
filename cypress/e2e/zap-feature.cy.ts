/// <reference types="cypress" />

describe('Zap Feature - Single Asset Deposit', () => {
  beforeEach(() => {
    // Visit dashboard and wait for it to load
    cy.visit('/public/dashboard.html');
    cy.wait(2000); // Wait for dashboard to initialize
  });

  it('should display the Zap section on the dashboard', () => {
    cy.get('#zap-section').should('be.visible');
    cy.get('#zap-section h3').should('contain.text', 'Zap into Liquidity Pool');
    cy.get('#zap-open-btn').should('be.visible').and('contain.text', 'Open Zap Modal');
  });

  it('should open Zap modal when clicking the button', () => {
    cy.get('#zap-open-btn').click();
    cy.get('#zap-modal').should('be.visible');
    cy.get('.zap-modal-header h3').should('contain.text', 'Zap into Liquidity Pool');
  });

  it('should close Zap modal when clicking close button', () => {
    cy.get('#zap-open-btn').click();
    cy.get('#zap-modal').should('be.visible');
    cy.get('#zap-close-btn').click();
    cy.get('#zap-modal').should('not.exist');
  });

  it('should close Zap modal when clicking overlay', () => {
    cy.get('#zap-open-btn').click();
    cy.get('#zap-modal').should('be.visible');
    cy.get('#zap-modal-overlay').click({ force: true });
    cy.get('#zap-modal').should('not.exist');
  });

  it('should display all supported assets in dropdown', () => {
    cy.get('#zap-open-btn').click();
    cy.get('#zap-asset-select').should('be.visible');
    cy.get('#zap-asset-select option').should('have.length', 4); // Including placeholder
    cy.get('#zap-asset-select option[value="USDC"]').should('exist');
    cy.get('#zap-asset-select option[value="XLM"]').should('exist');
    cy.get('#zap-asset-select option[value="USDT"]').should('exist');
  });

  it('should show error when getting quote without selecting asset', () => {
    cy.get('#zap-open-btn').click();
    cy.get('#zap-amount-input').type('1000');
    cy.get('#zap-get-quote-btn').click();
    cy.get('#zap-error').should('be.visible').and('contain.text', 'select an asset');
  });

  it('should show error when getting quote without entering amount', () => {
    cy.get('#zap-open-btn').click();
    cy.get('#zap-asset-select').select('USDC');
    cy.get('#zap-get-quote-btn').click();
    cy.get('#zap-error').should('be.visible').and('contain.text', 'valid amount');
  });

  it('should show error for invalid amount (zero)', () => {
    cy.get('#zap-open-btn').click();
    cy.get('#zap-asset-select').select('USDC');
    cy.get('#zap-amount-input').type('0');
    cy.get('#zap-get-quote-btn').click();
    cy.get('#zap-error').should('be.visible').and('contain.text', 'greater than 0');
  });

  it('should successfully get a quote for USDC deposit', () => {
    cy.get('#zap-open-btn').click();
    cy.get('#zap-asset-select').select('USDC');
    cy.get('#zap-amount-input').type('1000');
    cy.get('#zap-get-quote-btn').click();
    
    // Wait for loading to finish
    cy.get('#zap-loading', { timeout: 10000 }).should('not.be.visible');
    
    // Check quote section is visible
    cy.get('#zap-quote-section').should('be.visible');
    cy.get('#zap-estimated-lp').should('not.contain.text', '--');
    cy.get('#zap-expected-apy').should('contain.text', '%');
    cy.get('#zap-asset-split').should('not.contain.text', '--');
    cy.get('#zap-execute-btn').should('be.visible');
  });

  it('should successfully get a quote for XLM deposit', () => {
    cy.get('#zap-open-btn').click();
    cy.get('#zap-asset-select').select('XLM');
    cy.get('#zap-amount-input').type('5000');
    cy.get('#zap-get-quote-btn').click();
    
    cy.get('#zap-loading', { timeout: 10000 }).should('not.be.visible');
    cy.get('#zap-quote-section').should('be.visible');
    cy.get('#zap-estimated-lp').should('not.contain.text', '--');
  });

  it('should display quote details correctly', () => {
    cy.get('#zap-open-btn').click();
    cy.get('#zap-asset-select').select('USDC');
    cy.get('#zap-amount-input').type('1000');
    cy.get('#zap-get-quote-btn').click();
    
    cy.get('#zap-loading', { timeout: 10000 }).should('not.be.visible');
    cy.get('#zap-quote-section').should('be.visible');
    
    // Verify all quote fields are populated
    cy.get('#zap-estimated-lp').invoke('text').should('match', /\d+\.\d+/);
    cy.get('#zap-expected-apy').should('contain.text', '5.00%'); // 5% APY
    cy.get('#zap-asset-split').children().should('have.length.greaterThan', 0);
    cy.get('#zap-estimated-slippage').invoke('text').should('match', /\d+\.\d+%/);
  });

  it('should execute zap successfully', () => {
    cy.get('#zap-open-btn').click();
    cy.get('#zap-asset-select').select('USDC');
    cy.get('#zap-amount-input').type('500');
    cy.get('#zap-get-quote-btn').click();
    
    cy.get('#zap-loading', { timeout: 10000 }).should('not.be.visible');
    cy.get('#zap-quote-section').should('be.visible');
    cy.get('#zap-execute-btn').click();
    
    // Wait for execution
    cy.get('#zap-loading', { timeout: 10000 }).should('be.visible');
    cy.get('#zap-loading', { timeout: 10000 }).should('not.be.visible');
    
    // Check for success message
    cy.get('#zap-result', { timeout: 5000 }).should('be.visible');
    cy.get('.zap-success').should('be.visible');
    cy.get('.zap-success h4').should('contain.text', 'Successful');
    cy.get('.zap-tx-hash').should('be.visible').and('contain.text', '0x');
  });

  it('should update LP tokens on dashboard after successful zap', () => {
    // Get initial LP tokens
    cy.get('#lp-amount').invoke('text').then((initialLP) => {
      const initialValue = parseFloat(initialLP);
      
      // Execute zap
      cy.get('#zap-open-btn').click();
      cy.get('#zap-asset-select').select('USDC');
      cy.get('#zap-amount-input').type('1000');
      cy.get('#zap-get-quote-btn').click();
      cy.get('#zap-loading', { timeout: 10000 }).should('not.be.visible');
      cy.get('#zap-execute-btn').click();
      cy.get('#zap-result', { timeout: 10000 }).should('be.visible');
      cy.get('#zap-close-success-btn').click();
      
      // Wait for modal to close and check LP tokens increased
      cy.get('#zap-modal').should('not.exist');
      cy.get('#lp-amount').invoke('text').then((finalLP) => {
        const finalValue = parseFloat(finalLP);
        expect(finalValue).to.be.greaterThan(initialValue);
      });
    });
  });

  it('should show notification after successful zap', () => {
    cy.get('#zap-open-btn').click();
    cy.get('#zap-asset-select').select('USDC');
    cy.get('#zap-amount-input').type('500');
    cy.get('#zap-get-quote-btn').click();
    cy.get('#zap-loading', { timeout: 10000 }).should('not.be.visible');
    cy.get('#zap-execute-btn').click();
    cy.get('#zap-result', { timeout: 10000 }).should('be.visible');
    cy.get('#zap-close-success-btn').click();
    
    // Check for notification
    cy.contains('Successfully received').should('be.visible');
    cy.contains('LP tokens').should('be.visible');
  });

  it('should handle slippage tolerance setting', () => {
    cy.get('#zap-open-btn').click();
    cy.get('#zap-slippage-input').should('have.value', '0.5'); // Default 0.5%
    cy.get('#zap-slippage-input').clear().type('1.0');
    cy.get('#zap-slippage-input').should('have.value', '1.0');
  });

  it('should handle different deposit amounts', () => {
    const amounts = ['100', '500', '1000', '5000'];
    
    amounts.forEach((amount) => {
      cy.get('#zap-open-btn').click();
      cy.get('#zap-asset-select').select('USDC');
      cy.get('#zap-amount-input').clear().type(amount);
      cy.get('#zap-get-quote-btn').click();
      cy.get('#zap-loading', { timeout: 10000 }).should('not.be.visible');
      cy.get('#zap-quote-section').should('be.visible');
      cy.get('#zap-estimated-lp').should('not.contain.text', '--');
      cy.get('#zap-close-btn').click();
    });
  });

  it('should handle all supported assets', () => {
    const assets = ['USDC', 'XLM', 'USDT'];
    
    assets.forEach((asset) => {
      cy.get('#zap-open-btn').click();
      cy.get('#zap-asset-select').select(asset);
      cy.get('#zap-amount-input').clear().type('1000');
      cy.get('#zap-get-quote-btn').click();
      cy.get('#zap-loading', { timeout: 10000 }).should('not.be.visible');
      cy.get('#zap-quote-section').should('be.visible');
      cy.get('#zap-close-btn').click();
    });
  });

  it('should maintain state when switching between assets', () => {
    cy.get('#zap-open-btn').click();
    cy.get('#zap-asset-select').select('USDC');
    cy.get('#zap-amount-input').type('1000');
    cy.get('#zap-asset-select').select('XLM');
    cy.get('#zap-amount-input').should('have.value', '1000');
  });

  it('should show loading state during quote fetch', () => {
    cy.get('#zap-open-btn').click();
    cy.get('#zap-asset-select').select('USDC');
    cy.get('#zap-amount-input').type('1000');
    cy.get('#zap-get-quote-btn').click();
    cy.get('#zap-loading').should('be.visible');
    cy.get('#zap-loading-text').should('contain.text', 'Fetching quote');
  });

  it('should show loading state during zap execution', () => {
    cy.get('#zap-open-btn').click();
    cy.get('#zap-asset-select').select('USDC');
    cy.get('#zap-amount-input').type('500');
    cy.get('#zap-get-quote-btn').click();
    cy.get('#zap-loading', { timeout: 10000 }).should('not.be.visible');
    cy.get('#zap-execute-btn').click();
    cy.get('#zap-loading').should('be.visible');
    cy.get('#zap-loading-text').should('contain.text', 'Executing');
  });
});
