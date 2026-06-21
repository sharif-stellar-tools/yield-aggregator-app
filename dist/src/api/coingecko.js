"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchXlmPrice = fetchXlmPrice;
exports.formatUsd = formatUsd;
exports.convertXlmToUsd = convertXlmToUsd;
const CACHE_KEY = 'xlm_price_cache';
const CACHE_TTL_MS = 5 * 60 * 1000;
function getCachedPrice() {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw)
            return null;
        const cache = JSON.parse(raw);
        if (Date.now() - cache.timestamp < CACHE_TTL_MS) {
            return cache.usd;
        }
        localStorage.removeItem(CACHE_KEY);
        return null;
    }
    catch {
        return null;
    }
}
function setCachedPrice(usd) {
    try {
        const cache = { usd, timestamp: Date.now() };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    }
    catch {
        // localStorage unavailable or full
    }
}
async function fetchXlmPrice() {
    const cached = getCachedPrice();
    if (cached !== null)
        return cached;
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd');
    if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    if (!data || typeof data.stellar?.usd !== 'number' || data.stellar.usd <= 0) {
        throw new Error(`Invalid price data from CoinGecko: ${JSON.stringify(data)}`);
    }
    setCachedPrice(data.stellar.usd);
    return data.stellar.usd;
}
function formatUsd(amount) {
    return `$${amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
    })}`;
}
function convertXlmToUsd(xlmAmount, xlmPrice) {
    return xlmAmount * xlmPrice;
}
