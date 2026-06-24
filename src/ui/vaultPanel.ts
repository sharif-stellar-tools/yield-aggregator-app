export interface VaultInfo { totalDeposits: number; totalShares: number; apy: number; compoundCount: number; }

export function renderVaultPanel(containerId: string, vault: VaultInfo, onDeposit: (amount: number) => void, onWithdraw: (shares: number) => void): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  const sharePrice = vault.totalShares > 0 ? vault.totalDeposits / vault.totalShares : 1;

  container.innerHTML = '<div id="vault-panel">' +
    '<h3>Auto-Compounding Vault</h3>' +
    '<div class="vault-stats">' +
      '<span>TVL: <strong>' + vault.totalDeposits.toLocaleString() + '</strong></span>' +
      '<span>APY: <strong>' + (vault.apy * 100).toFixed(2) + '%</strong></span>' +
      '<span>Share Price: <strong>' + sharePrice.toFixed(6) + '</strong></span>' +
      '<span>Compounds: <strong>' + vault.compoundCount + '</strong></span>' +
    '</div>' +
    '<div class="vault-actions">' +
      '<div><input type="number" id="vault-deposit-amount" placeholder="Amount to deposit" /><button id="vault-deposit-btn">Deposit</button></div>' +
      '<div><input type="number" id="vault-withdraw-shares" placeholder="Shares to withdraw" /><button id="vault-withdraw-btn">Withdraw</button></div>' +
    '</div>' +
    '<p id="vault-msg"></p>' +
    '<style>' +
      '#vault-panel { padding: 16px; background: var(--card-bg, #1a1a2e); border-radius: 12px; margin-top: 16px; }' +
      '#vault-panel h3 { color: #e0e0e0; margin: 0 0 12px; }' +
      '.vault-stats { display: flex; gap: 16px; margin-bottom: 12px; font-size: 13px; color: #aaa; }' +
      '.vault-stats strong { color: #00d4aa; }' +
      '.vault-actions { display: flex; flex-direction: column; gap: 8px; }' +
      '.vault-actions input { padding: 6px 10px; border: 1px solid #333; border-radius: 6px; background: #0d0d1a; color: #e0e0e0; width: 180px; }' +
      '.vault-actions button { padding: 6px 14px; background: #00d4aa; color: #000; border: none; border-radius: 6px; cursor: pointer; margin-left: 8px; }' +
      '#vault-msg { font-size: 12px; color: #00d4aa; margin-top: 8px; }' +
    '</style>' +
  '</div>';

  document.getElementById('vault-deposit-btn')?.addEventListener('click', () => {
    const amount = parseFloat((document.getElementById('vault-deposit-amount') as HTMLInputElement).value);
    if (amount > 0) { onDeposit(amount); (document.getElementById('vault-msg')!).textContent = 'Deposited ' + amount; }
  });

  document.getElementById('vault-withdraw-btn')?.addEventListener('click', () => {
    const shares = parseFloat((document.getElementById('vault-withdraw-shares') as HTMLInputElement).value);
    if (shares > 0) { onWithdraw(shares); (document.getElementById('vault-msg')!).textContent = 'Withdrawn ' + shares + ' shares'; }
  });
}
