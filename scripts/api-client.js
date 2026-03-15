#!/usr/bin/env node
/**
 * AlphaMind Lite - API Client
 * 统一的外部 API 调用模块，支持超时、重试、错误处理
 * Zero dependencies - pure Node.js
 */

const https = require('https');

let config;
try {
  config = require('../config/config');
} catch {
  config = {
    apis: {
      binance: { rest: 'https://api.binance.com', futures: 'https://fapi.binance.com', timeout: 10000, retries: 3 },
      fearGreed: { url: 'https://api.alternative.me/fng/', timeout: 10000 },
    },
  };
}

/**
 * Make an HTTPS GET request with timeout and retry
 */
function httpGet(url, { timeout = 10000, retries = 3 } = {}) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    function attempt() {
      attempts++;
      const req = https.get(url, { timeout }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch {
              reject(new Error(`Invalid JSON from ${url}`));
            }
          } else if (res.statusCode === 429 && attempts <= retries) {
            // Rate limited - exponential backoff
            const delay = Math.pow(2, attempts) * 1000;
            setTimeout(attempt, delay);
          } else {
            reject(new Error(`HTTP ${res.statusCode} from ${url}`));
          }
        });
      });

      req.on('error', (err) => {
        if (attempts <= retries) {
          const delay = Math.pow(2, attempts) * 500;
          setTimeout(attempt, delay);
        } else {
          reject(new Error(`Request failed after ${attempts} attempts: ${err.message}`));
        }
      });

      req.on('timeout', () => {
        req.destroy();
        if (attempts <= retries) {
          setTimeout(attempt, 1000);
        } else {
          reject(new Error(`Timeout after ${attempts} attempts: ${url}`));
        }
      });
    }

    attempt();
  });
}

/**
 * Fetch market data for a trading pair
 */
async function fetchMarketData(symbol = 'BTCUSDT') {
  const url = `${config.apis.binance.rest}/api/v3/ticker/24hr?symbol=${symbol}`;
  return httpGet(url, {
    timeout: config.apis.binance.timeout,
    retries: config.apis.binance.retries,
  });
}

/**
 * Fetch current price for a symbol
 */
async function fetchPrice(symbol = 'BTCUSDT') {
  const url = `${config.apis.binance.rest}/api/v3/ticker/price?symbol=${symbol}`;
  return httpGet(url, {
    timeout: config.apis.binance.timeout,
    retries: config.apis.binance.retries,
  });
}

/**
 * Fetch multiple symbols at once
 */
async function fetchMultiplePrices(symbols) {
  const promises = symbols.map(s =>
    fetchPrice(`${s}USDT`).then(data => ({ symbol: s, price: parseFloat(data.price) }))
      .catch(() => ({ symbol: s, price: null, error: true }))
  );
  return Promise.all(promises);
}

/**
 * Fetch Fear & Greed Index
 */
async function fetchFearGreedIndex() {
  const url = config.apis.fearGreed.url;
  return httpGet(url, { timeout: config.apis.fearGreed.timeout });
}

/**
 * Fetch funding rates for futures
 */
async function fetchFundingRates(symbol = 'BTCUSDT') {
  const url = `${config.apis.binance.futures}/fapi/v1/premiumIndex?symbol=${symbol}`;
  return httpGet(url, { timeout: config.apis.binance.timeout });
}

/**
 * Fetch klines (candlestick) data
 */
async function fetchKlines(symbol = 'BTCUSDT', interval = '1h', limit = 24) {
  // Validate interval against known values
  const VALID_INTERVALS = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'];
  if (!VALID_INTERVALS.includes(interval)) throw new Error(`Invalid interval: ${interval}`);
  // Validate symbol (alphanumeric only)
  if (!/^[A-Z0-9]{2,20}$/i.test(symbol)) throw new Error(`Invalid symbol: ${symbol}`);
  const url = `${config.apis.binance.rest}/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${Math.min(limit, 1000)}`;
  return httpGet(url, { timeout: config.apis.binance.timeout });
}

/**
 * Fetch BSC (BNB Smart Chain) gas prices
 * Uses Binance's BSC RPC-compatible endpoint
 */
async function fetchBSCGasPrice() {
  const url = 'https://api.bscscan.com/api?module=gastracker&action=gasoracle&apikey=YourApiKeyToken';
  try {
    const data = await httpGet(url, { timeout: 8000, retries: 2 });
    if (data.status === '1' && data.result) {
      return {
        low: parseInt(data.result.SafeGasPrice || data.result.suggestBaseFee || 3),
        standard: parseInt(data.result.ProposeGasPrice || 5),
        fast: parseInt(data.result.FastGasPrice || 7),
      };
    }
  } catch {}
  // Fallback: BSC gas is typically 3-5 Gwei
  return { low: 3, standard: 5, fast: 7 };
}

/**
 * Fetch BNB token info (supply, burn data) from Binance API
 */
async function fetchBNBTokenInfo() {
  const [ticker, supply] = await Promise.all([
    fetchMarketData('BNBUSDT'),
    httpGet(`${config.apis.binance.rest}/api/v3/ticker/24hr?symbol=BNBBTC`, { timeout: 8000, retries: 2 }).catch(() => null),
  ]);

  const price = parseFloat(ticker.lastPrice);
  const volume = parseFloat(ticker.quoteVolume);
  const change = parseFloat(ticker.priceChangePercent);

  // BNB has quarterly burns; total supply started at 200M, current ~145M
  const totalSupply = 145934062; // Updated periodically
  const marketCap = price * totalSupply;

  return {
    price, volume24h: volume, change24h: change,
    totalSupply, marketCap,
    bnbBtcPrice: supply ? parseFloat(supply.lastPrice) : null,
  };
}

/**
 * Fetch top BSC DeFi tokens data
 */
async function fetchBSCTokens() {
  const bscTokens = ['CAKE', 'XVS', 'BAKE', 'ALPACA', 'BSW'];
  const results = await Promise.all(
    bscTokens.map(s =>
      fetchMarketData(`${s}USDT`)
        .then(d => ({
          symbol: s, price: parseFloat(d.lastPrice),
          change24h: parseFloat(d.priceChangePercent),
          volume24h: parseFloat(d.quoteVolume),
        }))
        .catch(() => null)
    )
  );
  return results.filter(Boolean);
}

/**
 * Calculate technical indicators from kline data
 * @param {Array} klines - Array of [time, open, high, low, close, volume]
 * @returns {Object} Technical indicators
 */
function calculateIndicators(klines) {
  if (!klines || klines.length < 14) return null;

  const closes = klines.map(k => parseFloat(k[4]));
  const highs = klines.map(k => parseFloat(k[2]));
  const lows = klines.map(k => parseFloat(k[3]));
  const volumes = klines.map(k => parseFloat(k[5]));

  // SMA (Simple Moving Average)
  const sma = (data, period) => {
    if (data.length < period) return null;
    const slice = data.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  };

  // EMA (Exponential Moving Average)
  const ema = (data, period) => {
    if (data.length < period) return null;
    const k = 2 / (period + 1);
    let em = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < data.length; i++) {
      em = data[i] * k + em * (1 - k);
    }
    return em;
  };

  // RSI (Relative Strength Index)
  const calcRSI = (data, period = 14) => {
    if (data.length < period + 1) return null;
    let gains = 0, losses = 0;
    for (let i = data.length - period; i < data.length; i++) {
      const diff = data[i] - data[i - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  };

  // MACD
  const calcMACD = (data) => {
    const ema12 = ema(data, 12);
    const ema26 = ema(data, 26);
    if (ema12 === null || ema26 === null) return null;
    const macdLine = ema12 - ema26;
    // Signal line approximation (9-period EMA of MACD)
    return { macd: macdLine, signal: macdLine * 0.8, histogram: macdLine * 0.2 };
  };

  // Bollinger Bands
  const calcBollinger = (data, period = 20) => {
    const middle = sma(data, period);
    if (middle === null) return null;
    const slice = data.slice(-period);
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - middle, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    return { upper: middle + 2 * stdDev, middle, lower: middle - 2 * stdDev };
  };

  // Volume analysis
  const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const recentVolume = volumes.slice(-3).reduce((a, b) => a + b, 0) / 3;
  const volumeTrend = recentVolume > avgVolume * 1.5 ? 'high' : recentVolume < avgVolume * 0.5 ? 'low' : 'normal';

  const currentPrice = closes[closes.length - 1];
  const rsi = calcRSI(closes);
  const macd = calcMACD(closes);
  const bollinger = calcBollinger(closes);
  const sma7 = sma(closes, 7);
  const sma25 = sma(closes, 25);
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);

  // Overall signal
  let signal = 'hold';
  let strength = 0;
  if (rsi !== null) {
    if (rsi < 30) { signal = 'buy'; strength += 2; }
    else if (rsi > 70) { signal = 'sell'; strength += 2; }
  }
  if (sma7 && sma25) {
    if (sma7 > sma25) strength += 1;
    else strength -= 1;
  }
  if (macd) {
    if (macd.histogram > 0) strength += 1;
    else strength -= 1;
  }
  if (bollinger && currentPrice < bollinger.lower) { signal = 'buy'; strength += 1; }
  if (bollinger && currentPrice > bollinger.upper) { signal = 'sell'; strength += 1; }

  if (strength >= 2) signal = 'buy';
  else if (strength <= -2) signal = 'sell';
  else signal = 'hold';

  return {
    price: currentPrice,
    rsi: rsi !== null ? parseFloat(rsi.toFixed(2)) : null,
    macd: macd ? { macd: parseFloat(macd.macd.toFixed(2)), signal: parseFloat(macd.signal.toFixed(2)), histogram: parseFloat(macd.histogram.toFixed(2)) } : null,
    bollinger: bollinger ? { upper: parseFloat(bollinger.upper.toFixed(2)), middle: parseFloat(bollinger.middle.toFixed(2)), lower: parseFloat(bollinger.lower.toFixed(2)) } : null,
    sma: { sma7: sma7 ? parseFloat(sma7.toFixed(2)) : null, sma25: sma25 ? parseFloat(sma25.toFixed(2)) : null },
    ema: { ema12: ema12 ? parseFloat(ema12.toFixed(2)) : null, ema26: ema26 ? parseFloat(ema26.toFixed(2)) : null },
    volume: { average: avgVolume, recent: recentVolume, trend: volumeTrend },
    signal,
    strength,
  };
}

module.exports = {
  httpGet,
  fetchMarketData,
  fetchPrice,
  fetchMultiplePrices,
  fetchFearGreedIndex,
  fetchFundingRates,
  fetchKlines,
  fetchBSCGasPrice,
  fetchBNBTokenInfo,
  fetchBSCTokens,
  calculateIndicators,
};
