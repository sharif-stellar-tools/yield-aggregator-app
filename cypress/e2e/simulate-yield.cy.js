describe('Yield Aggregator Simulation', () => {
  it('should simulate yield correctly', () => {
    cy.visit('/public/dashboard.html');
    cy.get('#deposit-amount').type('1000');
    cy.get('#estimated-yield').should('not.be.empty');
  });
});