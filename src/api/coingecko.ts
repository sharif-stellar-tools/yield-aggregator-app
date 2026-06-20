export interface PriceCache {
  usd: number;
  timestamp: number;
}

const CACHE_KEY = 'xlm_price_cache';
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCachedPrice(): number | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache: PriceCache = JSON.parse(raw);
    if (Date.now() - cache.timestamp < CACHE_TTL_MS) {
      return cache.usd;
    }
    localStorage.removeItem(CACHE_KEY);
    return null;
  } catch {
    return null;
  }
}

function setCachedPrice(usd: number): void {
  try {
    const cache: PriceCache = { usd, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage unavailable or full
  }
}

export async function fetchXlmPrice(): Promise<number> {
  const cached = getCachedPrice();
  if (cached !== null) return cached;

  const response = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd'
  );

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

export function formatUsd(amount: number): string {
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })}`;
}

export function convertXlmToUsd(xlmAmount: number, xlmPrice: number): number {
  return xlmAmount * xlmPrice;
}
