export interface ApyDataPoint { timestamp: number; apy: number; tvl: number; }
export interface ApyHistory { pool: string; data: ApyDataPoint[]; }
const STORAGE_KEY_PREFIX = 'apy_history_';
function getStorageKey(pool: string): string { return STORAGE_KEY_PREFIX + pool; }
export function recordApy(pool: string, apy: number, tvl: number): void {
  try {
    const key = getStorageKey(pool); const raw = localStorage.getItem(key);
    const history: ApyHistory = raw ? JSON.parse(raw) : { pool, data: [] };
    history.data.push({ timestamp: Date.now(), apy, tvl });
    if (history.data.length > 365) history.data = history.data.slice(-365);
    localStorage.setItem(key, JSON.stringify(history));
  } catch {}
}
export function getApyHistory(pool: string, days: 7 | 30 | 365 = 30): ApyDataPoint[] {
  try {
    const raw = localStorage.getItem(getStorageKey(pool));
    if (!raw) return generateMockHistory(pool, days);
    const history: ApyHistory = JSON.parse(raw);
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return history.data.filter((d) => d.timestamp >= cutoff);
  } catch { return generateMockHistory(pool, days); }
}
export function getCurrentApy(pool: string): number {
  const history = getApyHistory(pool, 7);
  return history.length === 0 ? 0 : history[history.length - 1].apy;
}
function generateMockHistory(pool: string, days: number): ApyDataPoint[] {
  const data: ApyDataPoint[] = []; const now = Date.now();
  const baseApy = pool.includes('XLM') ? 0.05 : 0.03; const baseTvl = 1000000;
  for (let i = days; i >= 0; i--) {
    const noise = (Math.random() - 0.5) * 0.02;
    data.push({ timestamp: now - i * 86400000, apy: Math.max(0, baseApy + noise), tvl: baseTvl + Math.random() * 500000 });
  }
  return data;
}
