describe('Transaction Simulation Feature', () => {
  beforeEach(() => {
    cy.visit('/public/dashboard.html');
  });

  it('should display Preview Transaction button after getting quote', () => {
    // Open Zap modal
    cy.get('#zap-open-btn').click();
    
    // Select asset and enter amount
    cy.get('#zap-asset-select').select('USDC');
    cy.get('#zap-amount-input').type('1000');
    
    // Get quote
    cy.get('#zap-get-quote-btn').click();
    
    // Wait for quote to load
    cy.get('#zap-quote-section', { timeout: 5000 }).should('be.visible');
    
    // Verify Preview Transaction button is now visible
    cy.get('#zap-simulate-btn').should('be.visible');
  });

  it('should simulate transaction and display results', () => {
    // Open Zap modal
    cy.get('#zap-open-btn').click();
    
    // Select asset and enter amount
    cy.get('#zap-asset-select').select('USDC');
    cy.get('#zap-amount-input').type('1000');
    
    // Get quote
    cy.get('#zap-get-quote-btn').click();
    cy.get('#zap-quote-section', { timeout: 5000 }).should('be.visible');
    
    // Click Preview Transaction
    cy.get('#zap-simulate-btn').click();
    
    // Wait for simulation to complete
    cy.get('#zap-simulation-section', { timeout: 5000 }).should('be.visible');
    
    // Verify simulation results are displayed
    cy.get('#zap-sim-lp-tokens').should('not.contain', '--');
    cy.get('#zap-sim-fee').should('not.contain', '--');
    cy.get('#zap-sim-state-changes').should('be.visible');
  });

  it('should handle simulation errors gracefully', () => {
    // Open Zap modal
    cy.get('#zap-modal-btn').click();
    
    // Select asset and enter amount
    cy.get('#zap-asset-select').select('USDC');
    cy.get('#zap-amount-input').type('1000');
    
    // Get quote
    cy.get('#zap-get-quote-btn').click();
    cy.get('#zap-quote-section', { timeout: 5000 }).should('be.visible');
    
    // Click Preview Transaction (may randomly fail in mock)
    cy.get('#zap-simulate-btn').click();
    
    // Either simulation succeeds or shows error
    cy.get('#zap-simulation-section').should('be.visible').then(() => {
      // Simulation succeeded
      cy.get('#zap-sim-lp-tokens').should('not.contain', '--');
    }).or(() => {
      // Simulation failed with error
      cy.get('#zap-error').should('be.visible');
      cy.get('#zap-error').should('contain.text', 'Insufficient balance');
    });
  });

  it('should not show simulate button without quote', () => {
    // Open Zap modal
    cy.get('#zap-open-btn').click();
    
    // Verify simulate button is hidden initially
    cy.get('#zap-simulate-btn').should('not.be.visible');
  });

  it('should display state changes in user-friendly format', () => {
    // Open Zap modal
    cy.get('#zap-open-btn').click();
    
    // Select asset and enter amount
    cy.get('#zap-asset-select').select('XLM');
    cy.get('#zap-amount-input').type('500');
    
    // Get quote
    cy.get('#zap-get-quote-btn').click();
    cy.get('#zap-quote-section', { timeout: 5000 }).should('be.visible');
    
    // Click Preview Transaction
    cy.get('#zap-simulate-btn').click();
    cy.get('#zap-simulation-section', { timeout: 5000 }).should('be.visible');
    
    // Verify state changes are displayed with proper formatting
    cy.get('.zap-state-change-item').should('exist');
    cy.get('.zap-state-change-type').should('exist');
    cy.get('.zap-state-change-values').should('exist');
    cy.get('.zap-state-before').should('exist');
    cy.get('.zap-state-after').should('exist');
  });
});
