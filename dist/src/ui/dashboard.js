"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setXlmBalance = setXlmBalance;
exports.renderDashboard = renderDashboard;
const coingecko_1 = require("../api/coingecko");
const XLM_BALANCE_KEY = 'xlm_balance';
function getXlmBalance() {
    try {
        const raw = localStorage.getItem(XLM_BALANCE_KEY);
        if (raw) {
            const val = parseFloat(raw);
            if (!isNaN(val) && val >= 0)
                return val;
        }
    }
    catch {
        // ignore
    }
    return 1000; // default demo balance
}
function setXlmBalance(amount) {
    try {
        localStorage.setItem(XLM_BALANCE_KEY, String(amount));
    }
    catch {
        // ignore
    }
}
async function renderDashboard(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        throw new Error(`Container #${containerId} not found`);
    }
    container.innerHTML = `
    <div id="dashboard">
      <h2>Dashboard</h2>
      <div id="balance-section">
        <p id="xlm-balance">XLM Balance: <span id="xlm-amount">—</span></p>
        <p id="usd-subtitle" style="font-size: 0.9em; color: #666;"></p>
      </div>
      <p id="price-info">Current XLM Price: <span id="xlm-price">Loading...</span></p>
      <p id="error-msg" style="color: #c00; display: none;"></p>
      <div id="simulation-section">
        <h3>Yield Simulation</h3>
        <input type="number" id="deposit-amount" placeholder="Enter amount to deposit" />
        <button id="simulate-yield-btn">Simulate</button>
        <p id="estimated-yield"></p>
      </div>
    </div>
  `;
    const xlmAmountEl = document.getElementById('xlm-amount');
    const usdSubtitleEl = document.getElementById('usd-subtitle');
    const xlmPriceEl = document.getElementById('xlm-price');
    const errorMsgEl = document.getElementById('error-msg');
    const simulateBtn = document.getElementById('simulate-yield-btn');
    const depositAmountEl = document.getElementById('deposit-amount');
    const estimatedYieldEl = document.getElementById('estimated-yield');
    simulateBtn.addEventListener('click', () => {
        const amount = parseFloat(depositAmountEl.value);
        if (!isNaN(amount) && amount > 0) {
            const estimatedYield = amount * 0.05; // 5% APY
            estimatedYieldEl.textContent = `Estimated yield: ${estimatedYield.toFixed(2)} XLM`;
        }
        else {
            estimatedYieldEl.textContent = 'Please enter a valid amount';
        }
    });
    const xlmBalance = getXlmBalance();
    xlmAmountEl.textContent = `${xlmBalance.toLocaleString()} XLM`;
    try {
        const price = await (0, coingecko_1.fetchXlmPrice)();
        xlmPriceEl.textContent = (0, coingecko_1.formatUsd)(price);
        const usdValue = (0, coingecko_1.convertXlmToUsd)(xlmBalance, price);
        usdSubtitleEl.textContent = `≈ ${(0, coingecko_1.formatUsd)(usdValue)} USD`;
    }
    catch (err) {
        xlmPriceEl.textContent = 'Unavailable';
        errorMsgEl.textContent = `Could not fetch XLM price: ${err instanceof Error ? err.message : 'Unknown error'}`;
        errorMsgEl.style.display = 'block';
    }
}
