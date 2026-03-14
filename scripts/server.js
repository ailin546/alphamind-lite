#!/usr/bin/env node
/**
 * AlphaMind Lite - Production HTTP Server
 * 提供 REST API、健康检查、静态页面服务
 * Zero dependencies - pure Node.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { getLogger, createLogger } = require('./logger');
const { fetchMarketData, fetchFearGreedIndex, fetchMultiplePrices, fetchFundingRates, fetchKlines } = require('./api-client');
const db = require('./db');

createLogger({ context: 'server' });
const log = getLogger('server');

const PKG_VERSION = require('../package.json').version;
const STATIC_ROOT = path.resolve(__dirname, '..');

// ---- API Response Cache (short-lived TTL) ----
const apiCache = new Map();
const CACHE_TTL = { market: 5000, sentiment: 30000, funding: 15000, klines: 10000 };

function getCached(key) {
  const entry = apiCache.get(key);
  if (entry && Date.now() - entry.time < entry.ttl) return entry.data;
  return null;
}

function setCache(key, data, ttl) {
  apiCache.set(key, { data, time: Date.now(), ttl });
}

// Clean stale cache entries every 60s
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of apiCache) {
    if (now - entry.time > entry.ttl * 3) apiCache.delete(key);
  }
}, 60000);

// ---- Allowed static file extensions ----
const ALLOWED_STATIC_DIRS = new Set(['', 'nginx', 'docs']);
const SENSITIVE_PATHS = ['/config/', '/data/', '/logs/', '/.env', '/.git', '/scripts/'];

let config;
try {
  config = require('../config/config');
} catch {
  config = { server: { port: 3000, host: '0.0.0.0' }, rateLimit: { windowMs: 60000, maxRequests: 100 } };
}

// ---- Rate Limiter ----
const rateLimiter = new Map();
const RATE_LIMITER_MAX_SIZE = 100000;

function checkRateLimit(ip) {
  const now = Date.now();
  const window = config.rateLimit.windowMs;
  const max = config.rateLimit.maxRequests;

  // Prevent memory DoS: cap map size
  if (rateLimiter.size > RATE_LIMITER_MAX_SIZE) {
    cleanRateLimiter();
    if (rateLimiter.size > RATE_LIMITER_MAX_SIZE) return false;
  }

  if (!rateLimiter.has(ip)) {
    rateLimiter.set(ip, { count: 1, start: now });
    return true;
  }

  const entry = rateLimiter.get(ip);
  if (now - entry.start > window) {
    entry.count = 1;
    entry.start = now;
    return true;
  }

  entry.count++;
  return entry.count <= max;
}

function cleanRateLimiter() {
  const now = Date.now();
  for (const [ip, entry] of rateLimiter) {
    if (now - entry.start > config.rateLimit.windowMs * 2) {
      rateLimiter.delete(ip);
    }
  }
}

// Clean up rate limiter periodically
setInterval(cleanRateLimiter, 60000);

// ---- Metrics ----
const metrics = {
  startTime: Date.now(),
  requests: 0,
  errors: 0,
  lastHealthCheck: null,
};

// ---- Content Types ----
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// ---- Route Handlers ----
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    ...SECURITY_HEADERS,
  });
  res.end(JSON.stringify(data));
}

async function handleHealth(req, res) {
  const uptime = Math.floor((Date.now() - metrics.startTime) / 1000);
  const memUsage = process.memoryUsage();

  const health = {
    status: 'ok',
    version: PKG_VERSION,
    uptime,
    timestamp: new Date().toISOString(),
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
    },
    metrics: {
      totalRequests: metrics.requests,
      totalErrors: metrics.errors,
    },
  };

  metrics.lastHealthCheck = new Date().toISOString();
  sendJSON(res, 200, health);
}

// Cached readiness result (TTL 30s to avoid hitting Binance on every k8s probe)
let _readyCache = { ready: false, checkedAt: 0 };
const READY_TTL = 30000;

async function handleReadiness(req, res) {
  const now = Date.now();
  if (now - _readyCache.checkedAt < READY_TTL) {
    sendJSON(res, _readyCache.ready ? 200 : 503, { status: _readyCache.ready ? 'ready' : 'not ready' });
    return;
  }
  try {
    await fetchMarketData('BTCUSDT');
    _readyCache = { ready: true, checkedAt: now };
    sendJSON(res, 200, { status: 'ready' });
  } catch {
    _readyCache = { ready: false, checkedAt: now };
    sendJSON(res, 503, { status: 'not ready', reason: 'API unreachable' });
  }
}

async function handleMarket(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const symbolsParam = url.searchParams.get('symbols');
    const symbol = url.searchParams.get('symbol') || 'BTCUSDT';

    // Multi-symbol market data for dashboard
    if (symbolsParam) {
      const symbols = symbolsParam.split(',').filter(s => /^[A-Z0-9]{2,10}$/i.test(s)).slice(0, 20);
      const cacheKey = `market:${symbols.join(',')}`;
      const cached = getCached(cacheKey);
      if (cached) return sendJSON(res, 200, cached);

      const results = await Promise.all(
        symbols.map(s => fetchMarketData(`${s.toUpperCase()}USDT`).then(d => ({
          symbol: s.toUpperCase(),
          price: parseFloat(d.lastPrice),
          change24h: parseFloat(d.priceChangePercent),
          high24h: parseFloat(d.highPrice),
          low24h: parseFloat(d.lowPrice),
          volume24h: parseFloat(d.quoteVolume),
        })).catch(() => ({ symbol: s.toUpperCase(), error: true })))
      );
      const response = { ok: true, data: results };
      setCache(cacheKey, response, CACHE_TTL.market);
      return sendJSON(res, 200, response);
    }

    // Single symbol
    if (!/^[A-Z0-9]{2,20}$/i.test(symbol)) {
      sendJSON(res, 400, { error: 'Invalid symbol' });
      return;
    }

    const cacheKey = `market:${symbol.toUpperCase()}`;
    const cached = getCached(cacheKey);
    if (cached) return sendJSON(res, 200, cached);

    const data = await fetchMarketData(symbol.toUpperCase());
    const response = { ok: true, symbol: symbol.toUpperCase(), ...data };
    setCache(cacheKey, response, CACHE_TTL.market);
    sendJSON(res, 200, response);
  } catch (err) {
    log.error('Market data error', { error: err.message });
    metrics.errors++;
    sendJSON(res, 502, { error: 'Failed to fetch market data' });
  }
}

async function handleSentiment(req, res) {
  try {
    const cacheKey = 'sentiment';
    const cached = getCached(cacheKey);
    if (cached) return sendJSON(res, 200, cached);

    const data = await fetchFearGreedIndex();
    // Parse and enrich sentiment data
    const fgData = data.data ? data.data[0] : null;
    const history = data.data || [];
    const value = fgData ? parseInt(fgData.value) : null;
    const sentiment = fgData ? fgData.value_classification : 'Unknown';

    let advice = '';
    if (value !== null) {
      if (value <= 25) advice = 'Extreme fear — historically a good buying opportunity. Consider DCA.';
      else if (value <= 45) advice = 'Fear in the market — potential accumulation zone.';
      else if (value <= 55) advice = 'Neutral sentiment — market is undecided.';
      else if (value <= 75) advice = 'Greed detected — consider taking partial profits.';
      else advice = 'Extreme greed — high risk zone. Be cautious with new positions.';
    }

    const response = {
      ok: true, value, sentiment, advice,
      history: history.slice(0, 30).map(h => ({ value: parseInt(h.value), timestamp: parseInt(h.timestamp) })),
    };
    setCache(cacheKey, response, CACHE_TTL.sentiment);
    sendJSON(res, 200, response);
  } catch (err) {
    log.error('Sentiment data error', { error: err.message });
    metrics.errors++;
    sendJSON(res, 502, { error: 'Failed to fetch sentiment data' });
  }
}

// ---- Market Sentiment Analysis ----
async function handleSentimentAnalysis(req, res) {
  try {
    const cacheKey = 'sentiment-analysis';
    const cached = getCached(cacheKey);
    if (cached) return sendJSON(res, 200, cached);

    const [btcData, fgData] = await Promise.all([
      fetchMarketData('BTCUSDT'),
      fetchFearGreedIndex().catch(() => null),
    ]);

    const btcPrice = parseFloat(btcData.lastPrice);
    const btcChange = parseFloat(btcData.priceChangePercent);
    const btcAvg = parseFloat(btcData.weightedAvgPrice);
    const fgValue = fgData?.data?.[0] ? parseInt(fgData.data[0].value) : 50;
    const btcTrend = btcPrice > btcAvg ? 'up' : 'down';

    // Simple signal logic
    let signal = 'hold';
    let analysis = '';
    if (fgValue <= 25 && btcTrend === 'down') { signal = 'buy'; analysis = 'Extreme fear + oversold conditions suggest accumulation opportunity.'; }
    else if (fgValue <= 40 && btcChange < -3) { signal = 'buy'; analysis = 'Market fear with significant dip — consider buying on weakness.'; }
    else if (fgValue >= 75 && btcTrend === 'up') { signal = 'sell'; analysis = 'Extreme greed + overbought — consider taking profits.'; }
    else if (fgValue >= 60 && btcChange > 5) { signal = 'sell'; analysis = 'Market euphoria with strong rally — risk of correction.'; }
    else { analysis = 'Market conditions are mixed — hold current positions and monitor.'; }

    const response = { ok: true, signal, analysis, fearGreed: fgValue, btcTrend, btcPrice, btcAvg };
    setCache(cacheKey, response, CACHE_TTL.sentiment);
    sendJSON(res, 200, response);
  } catch (err) {
    log.error('Sentiment analysis error', { error: err.message });
    metrics.errors++;
    sendJSON(res, 502, { error: 'Failed to analyze sentiment' });
  }
}

// ---- Correlation API ----
async function handleCorrelation(req, res) {
  try {
    const cacheKey = 'correlation';
    const cached = getCached(cacheKey);
    if (cached) return sendJSON(res, 200, cached);

    const symbols = ['ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA'];
    const results = await Promise.all(
      symbols.map(s => fetchMarketData(`${s}USDT`).then(d => ({
        symbol: s,
        change: parseFloat(d.priceChangePercent),
      })).catch(() => null))
    );

    const btcData = await fetchMarketData('BTCUSDT');
    const btcChange = parseFloat(btcData.priceChangePercent);

    const correlations = results.filter(Boolean).map(r => {
      // Simple correlation approximation based on price change similarity
      const diff = Math.abs(r.change - btcChange);
      const correlation = Math.max(0, 1 - diff / 20);
      const level = correlation > 0.8 ? 'very_high' : correlation > 0.6 ? 'high' : correlation > 0.4 ? 'moderate' : correlation > 0.2 ? 'low' : 'very_low';
      return { symbol: r.symbol, correlation: parseFloat(correlation.toFixed(3)), level, change24h: r.change };
    });

    const response = { ok: true, correlations, btcChange };
    setCache(cacheKey, response, CACHE_TTL.sentiment);
    sendJSON(res, 200, response);
  } catch (err) {
    log.error('Correlation error', { error: err.message });
    metrics.errors++;
    sendJSON(res, 502, { error: 'Failed to calculate correlations' });
  }
}

// ---- Klines API ----
async function handleKlines(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const symbol = (url.searchParams.get('symbol') || 'BTC').toUpperCase();
    const interval = url.searchParams.get('interval') || '1h';
    const limit = Math.min(parseInt(url.searchParams.get('limit')) || 24, 500);

    if (!/^[A-Z0-9]{2,10}$/.test(symbol)) return sendJSON(res, 400, { error: 'Invalid symbol' });
    const VALID_INTERVALS = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];
    if (!VALID_INTERVALS.includes(interval)) return sendJSON(res, 400, { error: 'Invalid interval' });

    const cacheKey = `klines:${symbol}:${interval}:${limit}`;
    const cached = getCached(cacheKey);
    if (cached) return sendJSON(res, 200, cached);

    const klines = await fetchKlines(`${symbol}USDT`, interval, limit);
    const data = klines.map(k => ({
      time: k[0], open: parseFloat(k[1]), high: parseFloat(k[2]),
      low: parseFloat(k[3]), close: parseFloat(k[4]), volume: parseFloat(k[5]),
    }));

    const response = { ok: true, data };
    setCache(cacheKey, response, CACHE_TTL.klines);
    sendJSON(res, 200, response);
  } catch (err) {
    log.error('Klines error', { error: err.message });
    metrics.errors++;
    sendJSON(res, 502, { error: 'Failed to fetch klines' });
  }
}

// ---- Risk Calculator API ----
async function handleRisk(req, res) {
  try {
    const { symbol, quantity, entryPrice, leverage } = await readBody(req);
    if (!symbol || !quantity || !entryPrice || !leverage) return sendJSON(res, 400, { error: 'Missing required fields' });
    const qty = parseFloat(quantity);
    const entry = parseFloat(entryPrice);
    const lev = parseInt(leverage);
    if (isNaN(qty) || isNaN(entry) || isNaN(lev)) return sendJSON(res, 400, { error: 'Invalid numeric values' });
    if (lev < 1 || lev > 125) return sendJSON(res, 400, { error: 'Leverage must be 1-125' });

    const marketData = await fetchMarketData(`${symbol.toUpperCase()}USDT`);
    const currentPrice = parseFloat(marketData.lastPrice);
    const positionValue = qty * currentPrice;
    const initialMargin = (qty * entry) / lev;
    const pnlAmount = (currentPrice - entry) * qty;
    const pnlPercentage = ((currentPrice - entry) / entry) * 100;
    const liquidationPrice = entry * (1 - 1 / lev * 0.95);
    const liquidationDistance = ((currentPrice - liquidationPrice) / currentPrice) * 100;

    let riskRating;
    if (liquidationDistance < 0) riskRating = 'liquidated';
    else if (liquidationDistance < 5) riskRating = 'danger';
    else if (liquidationDistance < 15) riskRating = 'warning';
    else riskRating = 'safe';

    sendJSON(res, 200, {
      ok: true, symbol: symbol.toUpperCase(), currentPrice, currentValue: positionValue,
      initialMargin, pnlAmount, pnlPercentage, liquidationPrice, liquidationDistance, riskRating,
    });
  } catch (err) {
    sendJSON(res, 400, { error: 'Failed to calculate risk' });
  }
}

// ---- DCA Calculator API ----
async function handleDCA(req, res) {
  try {
    const { symbol, monthlyAmount, months } = await readBody(req);
    if (!symbol || !monthlyAmount || !months) return sendJSON(res, 400, { error: 'Missing required fields' });
    const monthly = parseFloat(monthlyAmount);
    const m = parseInt(months);
    if (isNaN(monthly) || monthly <= 0 || isNaN(m) || m <= 0 || m > 120) return sendJSON(res, 400, { error: 'Invalid values' });

    const marketData = await fetchMarketData(`${symbol.toUpperCase()}USDT`);
    const currentPrice = parseFloat(marketData.lastPrice);
    const totalInvested = monthly * m;
    const totalCoins = totalInvested / currentPrice;
    const currentValue = totalCoins * currentPrice;
    const profit = currentValue - totalInvested;
    const profitPercent = (profit / totalInvested) * 100;

    sendJSON(res, 200, {
      ok: true, symbol: symbol.toUpperCase(), currentPrice,
      totalInvested, totalCoins, currentValue, profit, profitPercent,
    });
  } catch (err) {
    sendJSON(res, 400, { error: 'Failed to calculate DCA' });
  }
}

// ---- AI Chat API ----
async function handleAIChat(req, res) {
  try {
    const { message } = await readBody(req);
    if (!message || typeof message !== 'string') return sendJSON(res, 400, { error: 'Message required' });

    const msg = message.toLowerCase().trim();
    let reply = '';

    // Fetch live context
    let btcPrice, ethPrice, fgValue;
    try {
      const [btc, eth, fg] = await Promise.all([
        fetchMarketData('BTCUSDT'), fetchMarketData('ETHUSDT'),
        fetchFearGreedIndex().catch(() => null),
      ]);
      btcPrice = parseFloat(btc.lastPrice);
      ethPrice = parseFloat(eth.lastPrice);
      fgValue = fg?.data?.[0] ? parseInt(fg.data[0].value) : null;
    } catch { btcPrice = null; ethPrice = null; fgValue = null; }

    const priceContext = btcPrice ? `Current BTC: $${btcPrice.toLocaleString()}, ETH: $${ethPrice.toLocaleString()}${fgValue ? `, Fear & Greed: ${fgValue}/100` : ''}. ` : '';

    if (msg.includes('btc') || msg.includes('bitcoin') || msg.includes('买')) {
      reply = `${priceContext}BTC is the market leader. ${fgValue && fgValue < 40 ? 'Fear levels suggest potential buying opportunity via DCA.' : fgValue && fgValue > 70 ? 'Greed levels are high — exercise caution.' : 'Current conditions are neutral — DCA remains a solid strategy.'}`;
    } else if (msg.includes('eth') || msg.includes('ethereum')) {
      reply = `${priceContext}ETH powers the DeFi ecosystem. Consider your overall portfolio allocation and risk tolerance.`;
    } else if (msg.includes('fear') || msg.includes('greed') || msg.includes('sentiment') || msg.includes('恐慌')) {
      reply = `${priceContext}${fgValue ? (fgValue < 30 ? 'Extreme fear — historically a contrarian buy signal.' : fgValue > 70 ? 'Extreme greed — consider taking profits.' : 'Neutral territory — markets are undecided.') : 'Unable to fetch current sentiment data.'}`;
    } else if (msg.includes('dca') || msg.includes('定投')) {
      reply = `${priceContext}DCA (Dollar-Cost Averaging) is proven to reduce timing risk. Our calculator can simulate returns — try the DCA tool!`;
    } else if (msg.includes('risk') || msg.includes('leverage') || msg.includes('杠杆') || msg.includes('爆仓')) {
      reply = `${priceContext}High leverage amplifies both gains and losses. Use our Risk Calculator to check your liquidation price before entering positions.`;
    } else {
      reply = `${priceContext}I can help with market analysis, trading strategies, risk management, and DCA planning. Try asking about BTC, ETH, sentiment, DCA, or risk management!`;
    }

    sendJSON(res, 200, { ok: true, reply });
  } catch (err) {
    sendJSON(res, 400, { error: 'Chat error' });
  }
}

async function handleMetrics(req, res) {
  const uptime = Math.floor((Date.now() - metrics.startTime) / 1000);
  const mem = process.memoryUsage();

  // Prometheus-compatible format
  const lines = [
    `# HELP alphamind_uptime_seconds Application uptime`,
    `# TYPE alphamind_uptime_seconds gauge`,
    `alphamind_uptime_seconds ${uptime}`,
    `# HELP alphamind_requests_total Total HTTP requests`,
    `# TYPE alphamind_requests_total counter`,
    `alphamind_requests_total ${metrics.requests}`,
    `# HELP alphamind_errors_total Total errors`,
    `# TYPE alphamind_errors_total counter`,
    `alphamind_errors_total ${metrics.errors}`,
    `# HELP alphamind_memory_rss_bytes RSS memory usage`,
    `# TYPE alphamind_memory_rss_bytes gauge`,
    `alphamind_memory_rss_bytes ${mem.rss}`,
    `# HELP alphamind_memory_heap_used_bytes Heap memory used`,
    `# TYPE alphamind_memory_heap_used_bytes gauge`,
    `alphamind_memory_heap_used_bytes ${mem.heapUsed}`,
  ];

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(lines.join('\n') + '\n');
}

function serveStatic(req, res) {
  const urlPath = req.url.split('?')[0];
  const filePath = urlPath === '/'
    ? path.join(STATIC_ROOT, 'dashboard.html')
    : path.resolve(STATIC_ROOT, '.' + path.normalize(urlPath));

  // Prevent path traversal: resolved path must be within STATIC_ROOT
  if (!filePath.startsWith(STATIC_ROOT + path.sep) && filePath !== path.join(STATIC_ROOT, 'dashboard.html')) {
    sendJSON(res, 403, { error: 'Forbidden' });
    return;
  }

  // Block access to sensitive paths
  const normalizedUrl = urlPath.toLowerCase();
  if (SENSITIVE_PATHS.some(p => normalizedUrl.startsWith(p))) {
    sendJSON(res, 404, { error: 'Not found' });
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  // Only serve known file types
  if (!MIME_TYPES[ext]) {
    sendJSON(res, 404, { error: 'Not found' });
    return;
  }
  const contentType = MIME_TYPES[ext];

  fs.readFile(filePath, (err, content) => {
    if (err) {
      sendJSON(res, 404, { error: 'Not found' });
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
      ...SECURITY_HEADERS,
    });
    res.end(content);
  });
}

// ---- Portfolio API ----
async function handlePortfolio(req, res) {
  try {
    let portfolioData;

    // Support both GET (server DB) and POST (client-sent holdings)
    if (req.method === 'POST') {
      const body = await readBody(req);
      portfolioData = body.holdings || [];
    } else {
      portfolioData = db.getPortfolio();
    }

    if (portfolioData.length === 0) {
      sendJSON(res, 200, { ok: true, holdings: [], totalValue: 0, totalCost: 0, totalPnl: 0, totalPnlPercent: 0 });
      return;
    }

    const symbols = portfolioData.map(p => p.symbol);
    const prices = await fetchMultiplePrices(symbols);
    const priceMap = {};
    prices.forEach(p => { if (p.price) priceMap[p.symbol] = p.price; });

    let totalValue = 0, totalCost = 0;
    const holdings = [];
    let btcValue = 0;

    for (const p of portfolioData) {
      const price = priceMap[p.symbol];
      if (!price) continue;
      const value = p.amount * price;
      const cost = p.amount * p.avgPrice;
      const pnl = value - cost;
      const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;
      totalValue += value;
      totalCost += cost;
      if (p.symbol === 'BTC') btcValue = value;
      holdings.push({ symbol: p.symbol, amount: p.amount, avgPrice: p.avgPrice, price, value, cost, pnl, pnlPercent });
    }

    const totalPnl = totalValue - totalCost;
    const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
    const btcRatio = totalValue > 0 ? (btcValue / totalValue) * 100 : 0;
    const diversification = holdings.length >= 5 ? 'Good' : holdings.length >= 3 ? 'Moderate' : 'Low';

    let advice = '';
    if (btcRatio > 70) advice = 'Portfolio is BTC-heavy. Consider diversifying into ETH and altcoins.';
    else if (btcRatio < 20 && holdings.length > 0) advice = 'Low BTC allocation. BTC provides stability in volatile markets.';
    else advice = 'Portfolio allocation looks balanced. Continue monitoring market conditions.';

    sendJSON(res, 200, { ok: true, holdings, totalValue, totalCost, totalPnl, totalPnlPercent, btcRatio, diversification, advice });
  } catch (err) {
    log.error('Portfolio error', { error: err.message });
    metrics.errors++;
    sendJSON(res, 500, { error: 'Failed to load portfolio' });
  }
}

// ---- Body Parser Helper ----
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e5) { req.destroy(); reject(new Error('Body too large')); }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

// ---- Portfolio Mutation API ----
async function handlePortfolioAdd(req, res) {
  try {
    const { symbol, amount, avgPrice } = await readBody(req);
    if (!symbol || typeof symbol !== 'string') return sendJSON(res, 400, { error: 'symbol required' });
    const amt = parseFloat(amount);
    const price = parseFloat(avgPrice);
    if (isNaN(amt) || amt <= 0) return sendJSON(res, 400, { error: 'Invalid amount' });
    if (isNaN(price) || price <= 0) return sendJSON(res, 400, { error: 'Invalid avgPrice' });
    db.addHolding(symbol.toUpperCase(), amt, price);
    sendJSON(res, 200, { ok: true, message: `Added ${symbol.toUpperCase()}` });
  } catch (err) {
    sendJSON(res, 400, { error: err.message });
  }
}

async function handlePortfolioRemove(req, res) {
  try {
    const { symbol } = await readBody(req);
    if (!symbol) return sendJSON(res, 400, { error: 'symbol required' });
    const result = db.removeHolding(symbol.toUpperCase());
    if (!result) return sendJSON(res, 404, { error: `${symbol.toUpperCase()} not found` });
    sendJSON(res, 200, { ok: true, message: `Removed ${symbol.toUpperCase()}` });
  } catch (err) {
    sendJSON(res, 400, { error: err.message });
  }
}

// ---- Alerts API ----
function handleAlerts(req, res) {
  const alerts = db.getAlerts();
  sendJSON(res, 200, { alerts });
}

async function handleAlertAdd(req, res) {
  try {
    const { symbol, price, direction } = await readBody(req);
    if (!symbol || typeof symbol !== 'string') return sendJSON(res, 400, { error: 'symbol required' });
    const p = parseFloat(price);
    if (isNaN(p) || p <= 0) return sendJSON(res, 400, { error: 'Invalid price' });
    if (!['above', 'below'].includes(direction)) return sendJSON(res, 400, { error: 'direction must be above or below' });
    const alert = db.addAlert(symbol.toUpperCase(), p, direction);
    sendJSON(res, 200, { ok: true, alert });
  } catch (err) {
    sendJSON(res, 400, { error: err.message });
  }
}

async function handleAlertRemove(req, res) {
  try {
    const { id } = await readBody(req);
    if (!id) return sendJSON(res, 400, { error: 'id required' });
    const result = db.removeAlert(id);
    if (!result) return sendJSON(res, 404, { error: 'Alert not found' });
    sendJSON(res, 200, { ok: true });
  } catch (err) {
    sendJSON(res, 400, { error: err.message });
  }
}

// ---- Funding Rates API ----
async function handleFunding(req, res) {
  try {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT'];
    const results = await Promise.all(
      symbols.map(s => fetchFundingRates(s).then(d => ({
        symbol: s,
        rate: parseFloat(d.lastFundingRate),
        markPrice: parseFloat(d.markPrice),
        apy: parseFloat(d.lastFundingRate) * 3 * 365 * 100,
      })).catch(() => null))
    );
    const rates = results.filter(Boolean).sort((a, b) => Math.abs(b.rate) - Math.abs(a.rate));
    sendJSON(res, 200, { rates });
  } catch (err) {
    log.error('Funding error', { error: err.message });
    metrics.errors++;
    sendJSON(res, 502, { error: 'Failed to fetch funding rates' });
  }
}

// ---- SSE Stream ----
const sseClients = new Set();
const MAX_SSE_CLIENTS = 100;

function handleSSE(req, res) {
  if (sseClients.size >= MAX_SSE_CLIENTS) {
    sendJSON(res, 503, { error: 'Too many SSE connections' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  res.write('event: connected\ndata: ok\n\n');
  sseClients.add(res);

  req.on('close', () => { sseClients.delete(res); });
}

// SSE heartbeat every 30s to prevent proxy timeouts
setInterval(() => {
  for (const client of sseClients) {
    try { client.write(':heartbeat\n\n'); } catch { sseClients.delete(client); }
  }
}, 30000);

// Broadcast prices every 15s to SSE clients (with overlap guard)
let _sseBroadcasting = false;

setInterval(async () => {
  if (sseClients.size === 0 || _sseBroadcasting) return;
  _sseBroadcasting = true;
  try {
    const symbols = ['BTC', 'ETH', 'BNB', 'SOL'];
    const results = await Promise.all(
      symbols.map(s => fetchMarketData(`${s}USDT`).then(d => ({
        symbol: s,
        price: parseFloat(d.lastPrice),
        change: parseFloat(d.priceChangePercent),
      })).catch(() => null))
    );
    const data = results.filter(Boolean);
    const msg = `event: prices\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) {
      try { client.write(msg); } catch { sseClients.delete(client); }
    }
  } catch {} finally {
    _sseBroadcasting = false;
  }
}, 15000);

// ---- Router ----
const routes = {
  'GET /health': handleHealth,
  'GET /ready': handleReadiness,
  'GET /api/market': handleMarket,
  'GET /api/sentiment': handleSentimentAnalysis,
  'GET /api/fear-greed': handleSentiment,
  'GET /api/correlation': handleCorrelation,
  'GET /api/klines': handleKlines,
  'GET /api/portfolio': handlePortfolio,
  'POST /api/portfolio': handlePortfolio,
  'GET /api/alerts': handleAlerts,
  'POST /api/portfolio/add': handlePortfolioAdd,
  'POST /api/portfolio/remove': handlePortfolioRemove,
  'POST /api/alerts/add': handleAlertAdd,
  'POST /api/alerts/remove': handleAlertRemove,
  'GET /api/funding': handleFunding,
  'POST /api/risk': handleRisk,
  'POST /api/dca': handleDCA,
  'POST /api/ai-chat': handleAIChat,
  'GET /api/stream': handleSSE,
  'GET /metrics': handleMetrics,
};

// ---- Server ----
const server = http.createServer(async (req, res) => {
  metrics.requests++;

  // Only trust X-Forwarded-For when behind a trusted proxy
  const trustProxy = config.server.trustProxy || false;
  const clientIP = trustProxy
    ? (req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress)
    : req.socket.remoteAddress;

  // Rate limiting
  if (!checkRateLimit(clientIP)) {
    log.warn('Rate limit exceeded', { ip: clientIP });
    sendJSON(res, 429, { error: 'Too many requests' });
    return;
  }

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const routeKey = `${req.method} ${req.url.split('?')[0]}`;
  const handler = routes[routeKey];

  if (handler) {
    try {
      await handler(req, res);
    } catch (err) {
      log.error('Unhandled route error', { route: routeKey, error: err.message });
      metrics.errors++;
      sendJSON(res, 500, { error: 'Internal server error' });
    }
  } else if (req.method === 'GET') {
    serveStatic(req, res);
  } else {
    sendJSON(res, 405, { error: 'Method not allowed' });
  }

  log.debug('Request', { method: req.method, url: req.url, status: res.statusCode, ip: clientIP });
});

// ---- Graceful Shutdown ----
let isShuttingDown = false;

function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log.info(`Received ${signal}, starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(() => {
    log.info('Server closed, exiting');
    process.exit(0);
  });

  // Force exit after timeout
  setTimeout(() => {
    log.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// PM2 graceful shutdown
process.on('message', msg => {
  if (msg === 'shutdown') shutdown('PM2');
});

// Unhandled errors
process.on('uncaughtException', (err) => {
  log.error('Uncaught exception', { error: err.message, stack: err.stack });
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled rejection', { reason: String(reason) });
});

// ---- Start ----
const PORT = config.server.port;
const HOST = config.server.host;

// Set request timeouts to prevent slow clients
server.timeout = 30000;
server.requestTimeout = 10000;

server.listen(PORT, HOST, () => {
  log.info(`AlphaMind Lite server running`, { host: HOST, port: PORT, env: config.env });

  // Validate config on startup
  const warnings = config.validate ? config.validate() : [];
  warnings.forEach(w => log.warn(`Config: ${w}`));
});
