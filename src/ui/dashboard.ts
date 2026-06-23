import { fetchXlmPrice, formatUsd, convertXlmToUsd } from '../api/coingecko';
import { StrategyRegistry } from '../core/strategies/StrategyRegistry';
import { ZapModal } from './ZapModal';

const XLM_BALANCE_KEY = 'xlm_balance';
const LP_TOKENS_KEY = 'lp_tokens';

function getXlmBalance(): number {
  try {
    const raw = localStorage.getItem(XLM_BALANCE_KEY);
    if (raw) {
      const val = parseFloat(raw);
      if (!isNaN(val) && val >= 0) return val;
    }
  } catch {
    // ignore
  }
  return 1000; // default demo balance
}

export function setXlmBalance(amount: number): void {
  try {
    localStorage.setItem(XLM_BALANCE_KEY, String(amount));
  } catch {
    // ignore
  }
}

function getLPTokens(): number {
  try {
    const raw = localStorage.getItem(LP_TOKENS_KEY);
    if (raw) {
      const val = parseFloat(raw);
      if (!isNaN(val) && val >= 0) return val;
    }
  } catch {
    // ignore
  }
  return 0;
}

function setLPTokens(amount: number): void {
  try {
    localStorage.setItem(LP_TOKENS_KEY, String(amount));
  } catch {
    // ignore
  }
}

function renderLoadingSkeleton(): string {
  return `
    <div id="dashboard">
      <h2>Dashboard</h2>
      <div id="balance-section">
        <div class="skeleton skeleton-balance"></div>
        <div class="skeleton skeleton-subtitle"></div>
      </div>
      <div style="margin-top:1rem;">
        <div class="skeleton skeleton-price"></div>
      </div>
      <div class="loading-container">
        <div class="spinner"></div>
        <span class="loading-text">Fetching yield data…</span>
      </div>
    </div>
  `;
}

function renderDashboardContent(xlmBalance: number, lpTokens: number): string {
  return `
    <div id="dashboard">
      <h2>Dashboard</h2>
      <div id="balance-section">
        <p id="xlm-balance">XLM Balance: <span id="xlm-amount">${xlmBalance.toLocaleString()} XLM</span></p>
        <p id="usd-subtitle" style="font-size: 0.9em; color: #666;"></p>
        <p id="lp-tokens">LP Tokens: <span id="lp-amount">${lpTokens.toFixed(4)}</span></p>
      </div>
      <p id="price-info">Current XLM Price: <span id="xlm-price">Loading...</span></p>
      <p id="error-msg" style="color: #c00; display: none;"></p>
      
      <!-- Zap Feature Section -->
      <div id="zap-section" style="margin-top: 1.5rem; padding: 1rem; background: #f0f9ff; border-radius: 8px; border: 2px solid #0ea5e9;">
        <h3 style="margin-top: 0; color: #0369a1;">⚡ Zap into Liquidity Pool</h3>
        <p style="font-size: 0.9rem; color: #555;">Deposit a single asset and automatically add liquidity in one click!</p>
        <button id="zap-open-btn" style="padding: 0.75rem 1.5rem; background: #0ea5e9; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 1rem; margin-top: 0.5rem;">
          Open Zap Modal
        </button>
      </div>
      
      <div id="simulation-section" style="margin-top: 1.5rem;">
        <h3>Yield Simulation</h3>
        <input type="number" id="deposit-amount" placeholder="Enter amount to deposit" style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem; border: 1px solid #ccc; border-radius: 4px;" />
        <button id="simulate-yield-btn" style="padding: 0.5rem 1rem; background: #1a1a2e; color: white; border: none; border-radius: 4px; cursor: pointer;">Simulate</button>
        <p id="estimated-yield" style="margin-top: 0.5rem; font-weight: 500;"></p>
      </div>
    </div>
  `;
}

export async function renderDashboard(containerId: string): Promise<void> {
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Container #${containerId} not found`);
  }

  const xlmBalance = getXlmBalance();
  const lpTokens = getLPTokens();
  const strategy = StrategyRegistry.getInstance().get('XLM Liquidity Pool');

  // Show skeleton while data is loading
  container.innerHTML = renderLoadingSkeleton();

  // Fetch price data
  let price: number;
  try {
    price = await fetchXlmPrice();
  } catch (err) {
    container.innerHTML = renderDashboardContent(xlmBalance, lpTokens);
    const xlmPriceEl = document.getElementById('xlm-price')!;
    const errorMsgEl = document.getElementById('error-msg')!;
    xlmPriceEl.textContent = 'Unavailable';
    errorMsgEl.textContent = `Could not fetch XLM price: ${err instanceof Error ? err.message : 'Unknown error'}`;
    errorMsgEl.style.display = 'block';
    attachEventListeners(strategy);
    return;
  }

  // Data loaded — swap skeleton for real content
  container.innerHTML = renderDashboardContent(xlmBalance, lpTokens);

  const xlmPriceEl = document.getElementById('xlm-price')!;
  const usdSubtitleEl = document.getElementById('usd-subtitle')!;

  xlmPriceEl.textContent = formatUsd(price);
  const usdValue = convertXlmToUsd(xlmBalance, price);
  usdSubtitleEl.textContent = `≈ ${formatUsd(usdValue)} USD`;

  attachEventListeners(strategy);
}

function attachEventListeners(strategy: any): void {
  const simulateBtn = document.getElementById('simulate-yield-btn')!;
  const depositAmountEl = document.getElementById('deposit-amount') as HTMLInputElement;
  const estimatedYieldEl = document.getElementById('estimated-yield')!;
  const zapOpenBtn = document.getElementById('zap-open-btn')!;

  // Simulation logic
  if (strategy) {
    simulateBtn.addEventListener('click', async () => {
      const amount = parseFloat(depositAmountEl.value);
      if (!isNaN(amount) && amount > 0) {
        const { apy } = await strategy.getMetrics();
        const estimatedYield = await strategy.simulateDeposit(amount);
        estimatedYieldEl.textContent = `Estimated yield: ${estimatedYield.toFixed(2)} XLM (${(apy * 100).toFixed(1)}% APY)`;
      } else {
        estimatedYieldEl.textContent = 'Please enter a valid amount';
      }
    });
  } else {
    simulateBtn.addEventListener('click', () => {
      estimatedYieldEl.textContent = 'No strategy available';
    });
  }

  // Zap modal logic
  zapOpenBtn.addEventListener('click', () => {
    const zapModal = new ZapModal();
    zapModal.open((lpTokensReceived, txHash) => {
      // Update LP tokens in localStorage
      const currentLPTokens = getLPTokens();
      const newLPTokens = currentLPTokens + lpTokensReceived;
      setLPTokens(newLPTokens);
      
      // Update display
      const lpAmountEl = document.getElementById('lp-amount');
      if (lpAmountEl) {
        lpAmountEl.textContent = newLPTokens.toFixed(4);
      }
      
      // Show success notification
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
      `;
      notification.textContent = `✓ Successfully received ${lpTokensReceived.toFixed(4)} LP tokens!`;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
      }, 3000);
    });
  });
}
