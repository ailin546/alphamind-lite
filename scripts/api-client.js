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

module.exports = {
  httpGet,
  fetchMarketData,
  fetchPrice,
  fetchMultiplePrices,
  fetchFearGreedIndex,
  fetchFundingRates,
  fetchKlines,
};
