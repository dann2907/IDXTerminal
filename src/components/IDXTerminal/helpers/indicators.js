// src/components/IDXTerminal/helpers/indicators.js
export function calcIndicators(candles) {
  if (!candles || candles.length < 14) {
    return { ma20: null, ma50: null, rsi: null, macd: null };
  }
  const closes = candles.map(c => c.close);
  const sma = (arr, n) => {
    if (arr.length < n) return null;
    return arr.slice(-n).reduce((s, v) => s + v, 0) / n;
  };
  const ma20 = sma(closes, 20);
  const ma50 = sma(closes, 50);

  let gains = 0, losses = 0;
  const slice = closes.slice(-15);
  for (let i = 1; i < slice.length; i++) {
    const d = slice[i] - slice[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  const avgG = gains / 14, avgL = losses / 14;
  const rsi = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);

  const ema12 = sma(closes, 12);
  const ema26 = sma(closes, 26);
  const macd = ema12 !== null && ema26 !== null ? ema12 - ema26 : null;

  return {
    ma20: ma20 ? Math.round(ma20) : null,
    ma50: ma50 ? Math.round(ma50) : null,
    rsi: rsi ? Math.round(rsi * 10) / 10 : null,
    macd: macd ? Math.round(macd * 10) / 10 : null,
  };
}