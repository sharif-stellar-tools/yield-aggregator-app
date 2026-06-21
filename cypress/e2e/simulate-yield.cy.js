describe('Yield Aggregator Simulation', () => {
  it('should simulate yield correctly', () => {
    cy.visit('/public/dashboard.html');
    cy.get('#deposit-amount').type('1000');
    cy.get('#simulate-yield-btn').click();
    cy.get('#estimated-yield').should('contain', 'Estimated yield: 50.00 XLM');
  });
});