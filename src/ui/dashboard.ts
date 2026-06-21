import { fetchXlmPrice, formatUsd, convertXlmToUsd } from '../api/coingecko';

const XLM_BALANCE_KEY = 'xlm_balance';

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
        <span class="loading-text">Fetching yield data\u2026</span>
      </div>
    </div>
  `;
}

function renderDashboardContent(xlmBalance: number): string {
  return `
    <div id="dashboard">
      <h2>Dashboard</h2>
      <div id="balance-section">
        <p id="xlm-balance">XLM Balance: <span id="xlm-amount">${xlmBalance.toLocaleString()} XLM</span></p>
        <p id="usd-subtitle" style="font-size: 0.9em; color: #666;"></p>
      </div>
      <p id="price-info">Current XLM Price: <span id="xlm-price">Loading...</span></p>
      <p id="error-msg" style="color: #c00; display: none;"></p>
    </div>
  `;
}

export async function renderDashboard(containerId: string): Promise<void> {
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Container #${containerId} not found`);
  }

  let isLoading = true;
  const xlmBalance = getXlmBalance();

  // Show skeleton while data is loading
  container.innerHTML = renderLoadingSkeleton();

  // Fetch price data
  let price: number;
  try {
    price = await fetchXlmPrice();
  } catch (err) {
    isLoading = false;
    container.innerHTML = renderDashboardContent(xlmBalance);
    const xlmPriceEl = document.getElementById('xlm-price')!;
    const errorMsgEl = document.getElementById('error-msg')!;
    xlmPriceEl.textContent = 'Unavailable';
    errorMsgEl.textContent = `Could not fetch XLM price: ${err instanceof Error ? err.message : 'Unknown error'}`;
    errorMsgEl.style.display = 'block';
    return;
  }

  // Data loaded — swap skeleton for real content
  isLoading = false;
  container.innerHTML = renderDashboardContent(xlmBalance);

  const xlmPriceEl = document.getElementById('xlm-price')!;
  const usdSubtitleEl = document.getElementById('usd-subtitle')!;

  xlmPriceEl.textContent = formatUsd(price);
  const usdValue = convertXlmToUsd(xlmBalance, price);
  usdSubtitleEl.textContent = `\u2248 ${formatUsd(usdValue)} USD`;
}
