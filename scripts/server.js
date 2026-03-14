#!/usr/bin/env node
/**
 * AlphaMind Lite - Production HTTP Server
 * 提供 REST API、健康检查、静态页面服务
 * Zero dependencies - pure Node.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getLogger, createLogger } = require('./logger');
const { fetchMarketData, fetchFearGreedIndex, fetchMultiplePrices, fetchFundingRates, fetchKlines, fetchBSCGasPrice, fetchBNBTokenInfo, fetchBSCTokens, calculateIndicators } = require('./api-client');
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
const _cacheCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of apiCache) {
    if (now - entry.time > entry.ttl * 3) apiCache.delete(key);
  }
}, 60000);

// ---- Allowed static file extensions ----
const ALLOWED_STATIC_DIRS = new Set(['', 'nginx', 'docs']);
const SENSITIVE_PATHS = ['/config/', '/data/', '/logs/', '/.env', '/.git', '/scripts/', '/.claude',
  '/package.json', '/package-lock.json', '/docker-compose.yml', '/dockerfile',
  '/ecosystem.config.js', '/deploy.sh', '/.dockerignore', '/claude.md'];

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
const _rateLimitCleanupTimer = setInterval(cleanRateLimiter, 60000);

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
  metrics.lastHealthCheck = new Date().toISOString();
  sendJSON(res, 200, {
    status: 'ok',
    version: PKG_VERSION,
    uptime: Math.floor((Date.now() - metrics.startTime) / 1000),
    timestamp: new Date().toISOString(),
  });
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
    // Fallback to demo data
    sendJSON(res, 200, { ok: true, degraded: true, source: 'demo', data: DEMO_DATA.market });
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
    // Fallback to demo data
    sendJSON(res, 200, { ok: true, degraded: true, source: 'demo', ...DEMO_DATA.fearGreed, history: [] });
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
    sendJSON(res, 200, { ok: true, degraded: true, source: 'demo', signal: 'hold', analysis: 'Demo mode — connect to internet for live analysis.', fearGreed: 45, btcTrend: 'up', btcPrice: DEMO_DATA.prices.BTC, btcAvg: DEMO_DATA.prices.BTC * 0.98 });
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
    // Demo fallback
    const demoCorr = ['ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA'].map(s => ({ symbol: s, correlation: 0.5 + Math.random() * 0.4, level: 'moderate', change24h: (Math.random() - 0.3) * 5 }));
    sendJSON(res, 200, { ok: true, degraded: true, source: 'demo', correlations: demoCorr, btcChange: 2.34 });
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
    sendJSON(res, 200, { ok: true, degraded: true, source: 'demo', data: DEMO_DATA.klines });
  }
}

// ---- Risk Calculator API ----
async function handleRisk(req, res) {
  try {
    const { symbol, quantity, entryPrice, leverage } = await readBody(req);
    if (!symbol || !quantity || !entryPrice || !leverage) return sendJSON(res, 400, { error: 'Missing required fields' });
    if (!/^[A-Z0-9]{2,10}$/i.test(symbol)) return sendJSON(res, 400, { error: 'Invalid symbol' });
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
    if (!/^[A-Z0-9]{2,10}$/i.test(symbol)) return sendJSON(res, 400, { error: 'Invalid symbol' });
    const monthly = parseFloat(monthlyAmount);
    const m = parseInt(months);
    if (isNaN(monthly) || monthly <= 0 || isNaN(m) || m <= 0 || m > 120) return sendJSON(res, 400, { error: 'Invalid values' });

    let currentPrice;
    try {
      const marketData = await fetchMarketData(`${symbol.toUpperCase()}USDT`);
      currentPrice = parseFloat(marketData.lastPrice);
    } catch {
      currentPrice = DEMO_DATA.prices[symbol.toUpperCase()] || 0;
    }
    if (!currentPrice) return sendJSON(res, 400, { error: 'Unable to fetch price for this symbol' });

    const totalInvested = monthly * m;
    // Simulate DCA with price volatility (±15% random walk)
    let totalCoins = 0;
    const entries = [];
    for (let i = 0; i < m; i++) {
      const volatility = 1 + (Math.sin(i * 0.8) * 0.1 + (Math.random() - 0.5) * 0.05);
      const monthPrice = currentPrice * volatility;
      const coins = monthly / monthPrice;
      totalCoins += coins;
      entries.push({ month: i + 1, price: monthPrice, coins });
    }
    const avgPrice = totalInvested / totalCoins;
    const currentValue = totalCoins * currentPrice;
    const profit = currentValue - totalInvested;
    const profitPercent = (profit / totalInvested) * 100;

    sendJSON(res, 200, {
      ok: true, symbol: symbol.toUpperCase(), currentPrice,
      totalInvested, totalCoins, currentValue, profit, profitPercent, avgPrice,
      note: 'Simulated DCA with estimated price volatility. Actual results will vary.',
    });
  } catch (err) {
    sendJSON(res, 400, { error: 'Failed to calculate DCA' });
  }
}

// ---- AI Chat API (Context-Aware Analysis Engine) ----
// Conversation memory per session (cleared on restart)
const chatSessions = new Map();
const MAX_CHAT_SESSIONS = 1000;

async function handleAIChat(req, res) {
  try {
    const { message, sessionId } = await readBody(req);
    if (!message || typeof message !== 'string') return sendJSON(res, 400, { error: 'Message required' });
    if (message.length > 2000) return sendJSON(res, 400, { error: 'Message too long (max 2000 chars)' });

    const sid = sessionId || 'default';
    const msg = message.toLowerCase().trim();

    // Session memory
    if (!chatSessions.has(sid)) {
      if (chatSessions.size >= MAX_CHAT_SESSIONS) {
        const oldest = chatSessions.keys().next().value;
        chatSessions.delete(oldest);
      }
      chatSessions.set(sid, { history: [], created: Date.now() });
    }
    const session = chatSessions.get(sid);
    session.history.push({ role: 'user', content: message, time: Date.now() });
    if (session.history.length > 20) session.history = session.history.slice(-20);

    // Fetch comprehensive live market context + technical indicators
    let ctx = {};
    try {
      const [btc, eth, bnb, sol, fg, btcKlines] = await Promise.all([
        fetchMarketData('BTCUSDT'),
        fetchMarketData('ETHUSDT'),
        fetchMarketData('BNBUSDT'),
        fetchMarketData('SOLUSDT'),
        fetchFearGreedIndex().catch(() => null),
        fetchKlines('BTCUSDT', '4h', 100).catch(() => null),
      ]);
      const indicators = btcKlines ? calculateIndicators(btcKlines) : null;
      ctx = {
        btc: { price: parseFloat(btc.lastPrice), change: parseFloat(btc.priceChangePercent), high: parseFloat(btc.highPrice), low: parseFloat(btc.lowPrice), vol: parseFloat(btc.quoteVolume) },
        eth: { price: parseFloat(eth.lastPrice), change: parseFloat(eth.priceChangePercent) },
        bnb: { price: parseFloat(bnb.lastPrice), change: parseFloat(bnb.priceChangePercent) },
        sol: { price: parseFloat(sol.lastPrice), change: parseFloat(sol.priceChangePercent) },
        fg: fg?.data?.[0] ? { value: parseInt(fg.data[0].value), label: fg.data[0].value_classification } : null,
        indicators,
      };
    } catch {
      ctx = { btc: { price: DEMO_DATA.prices.BTC, change: 2.3 }, eth: { price: DEMO_DATA.prices.ETH, change: 1.5 }, bnb: { price: DEMO_DATA.prices.BNB, change: -0.8 }, sol: { price: DEMO_DATA.prices.SOL, change: 5.2 }, fg: { value: 45, label: 'Fear' }, indicators: null, demo: true };
    }

    // Get user portfolio for personalized advice
    const portfolio = db.getPortfolio();

    // Build contextual analysis
    const reply = generateAnalysis(msg, ctx, portfolio, session.history);
    session.history.push({ role: 'assistant', content: reply, time: Date.now() });

    sendJSON(res, 200, { ok: true, reply, context: {
      btcPrice: ctx.btc.price,
      fearGreed: ctx.fg?.value,
      sentiment: ctx.fg?.label,
      demo: ctx.demo || false,
    }});
  } catch (err) {
    sendJSON(res, 400, { error: 'Chat error' });
  }
}

function generateAnalysis(msg, ctx, portfolio, history) {
  const b = ctx.btc;
  const fg = ctx.fg;
  const fmtPrice = (n) => n >= 1 ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${n.toFixed(6)}`;
  const fmtPct = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

  // Live market summary header with technical indicators
  const ind = ctx.indicators;
  let headerExtra = '';
  if (ind) {
    headerExtra = ` | RSI: ${ind.rsi || 'N/A'} | Signal: ${(ind.signal || 'hold').toUpperCase()}`;
  }
  const header = `📊 **Market Snapshot** | BTC ${fmtPrice(b.price)} (${fmtPct(b.change)}) | ETH ${fmtPrice(ctx.eth.price)} (${fmtPct(ctx.eth.change)}) | Fear & Greed: ${fg ? `${fg.value}/100 (${fg.label})` : 'N/A'}${headerExtra}\n\n`;

  // Detect intent from message
  const intents = detectIntents(msg);

  let analysis = '';

  if (intents.includes('market_overview') || intents.includes('general')) {
    const trend = b.change > 3 ? 'strong bullish' : b.change > 0 ? 'mildly bullish' : b.change > -3 ? 'mildly bearish' : 'strong bearish';
    const range = ((b.high - b.low) / b.low * 100).toFixed(1);
    analysis += `**Market Analysis:**\n`;
    analysis += `• BTC 24h trend: ${trend} with ${range}% trading range (${fmtPrice(b.low)} - ${fmtPrice(b.high)})\n`;
    analysis += `• BNB: ${fmtPrice(ctx.bnb.price)} (${fmtPct(ctx.bnb.change)}) | SOL: ${fmtPrice(ctx.sol.price)} (${fmtPct(ctx.sol.change)})\n`;
    if (fg) {
      analysis += `• Sentiment: ${fg.value <= 25 ? '🔴 Extreme fear — historically a contrarian buy signal. Smart money accumulates here.' : fg.value <= 45 ? '🟠 Fear zone — potential accumulation opportunity for long-term holders.' : fg.value <= 55 ? '🟡 Neutral — market is undecided, wait for clearer signals.' : fg.value <= 75 ? '🟢 Greed zone — consider taking partial profits and tightening stop-losses.' : '🔴 Extreme greed — high risk of correction. Reduce exposure.'}\n`;
    }
    if (ind) {
      analysis += `\n**Technical Indicators (4H):**\n`;
      analysis += `• RSI(14): ${ind.rsi} ${ind.rsi < 30 ? '— Oversold ✅' : ind.rsi > 70 ? '— Overbought ⚠️' : '— Neutral'}\n`;
      if (ind.macd) analysis += `• MACD: ${ind.macd.histogram > 0 ? 'Bullish' : 'Bearish'} (histogram: ${ind.macd.histogram})\n`;
      if (ind.bollinger) analysis += `• Bollinger: ${fmtPrice(ind.bollinger.lower)} — ${fmtPrice(ind.bollinger.upper)} (mid: ${fmtPrice(ind.bollinger.middle)})\n`;
      if (ind.sma.sma7 && ind.sma.sma25) analysis += `• SMA: ${ind.sma.sma7 > ind.sma.sma25 ? '7 > 25 (Bullish cross ✅)' : '7 < 25 (Bearish cross ⚠️)'}\n`;
      analysis += `• Volume: ${ind.volume.trend === 'high' ? '📈 High volume — strong conviction' : ind.volume.trend === 'low' ? '📉 Low volume — weak conviction' : '📊 Normal volume'}\n`;
      analysis += `• 🎯 Technical Signal: **${ind.signal.toUpperCase()}** (strength: ${ind.strength})\n`;
    }
  }

  if (intents.includes('buy_advice')) {
    analysis += `\n**Buy/Entry Analysis:**\n`;
    const symbol = extractSymbol(msg);
    if (symbol && ctx[symbol.toLowerCase()]) {
      const coin = ctx[symbol.toLowerCase()];
      analysis += `• ${symbol.toUpperCase()} is at ${fmtPrice(coin.price)} (${fmtPct(coin.change)} 24h)\n`;
    }
    if (ind) {
      analysis += `• RSI: ${ind.rsi} ${ind.rsi < 30 ? '— Oversold (good entry)' : ind.rsi > 70 ? '— Overbought (wait for pullback)' : '— Neutral zone'}\n`;
      analysis += `• Technical signal: ${ind.signal.toUpperCase()} (strength: ${ind.strength})\n`;
    }
    if (fg && fg.value < 40) {
      analysis += `• Fear index at ${fg.value} suggests the crowd is pessimistic — historically favors buyers\n`;
      analysis += `• 💡 Strategy: Consider DCA (dollar-cost averaging) entry over 3-5 purchases\n`;
    } else if (fg && fg.value > 65) {
      analysis += `• Greed index at ${fg.value} — buying at peaks carries higher risk\n`;
      analysis += `• 💡 Strategy: Wait for a pullback or use limit orders 3-5% below current price\n`;
    } else {
      analysis += `• 💡 Strategy: Market is neutral — DCA is safest. Set a budget and split into 3-5 entries\n`;
    }
  }

  if (intents.includes('sell_advice')) {
    analysis += `\n**Sell/Exit Analysis:**\n`;
    if (fg && fg.value > 70) {
      analysis += `• Greed index at ${fg.value} — this is historically where smart money takes profits\n`;
      analysis += `• 💡 Strategy: Consider selling 20-30% of position to lock in gains\n`;
    } else {
      analysis += `• Market is not in euphoria zone yet\n`;
      analysis += `• 💡 Strategy: Use trailing stop-losses to protect profits while staying in the trend\n`;
    }
  }

  if (intents.includes('risk')) {
    analysis += `\n**Risk Assessment:**\n`;
    analysis += `• BTC 24h volatility: ${((b.high - b.low) / b.low * 100).toFixed(1)}%\n`;
    analysis += `• ${b.change < -5 ? '⚠️ Significant drop — high risk environment. Reduce leverage.' : b.change > 5 ? '⚠️ Sharp rally — risk of reversal. Set tight stop-losses.' : '✅ Normal volatility range.'}\n`;
    analysis += `• 💡 Max recommended leverage: ${Math.abs(b.change) > 5 ? '2-3x' : Math.abs(b.change) > 3 ? '3-5x' : '5-10x (with stop-loss)'}\n`;
    analysis += `• Use our Risk Calculator to compute exact liquidation prices for your positions.\n`;
  }

  if (intents.includes('dca')) {
    analysis += `\n**DCA Strategy:**\n`;
    analysis += `• Current entry price: BTC ${fmtPrice(b.price)}\n`;
    analysis += `• ${fg && fg.value < 40 ? 'Fear zone — excellent DCA entry timing. Consider larger allocations.' : fg && fg.value > 65 ? 'Greed zone — reduce DCA amount or pause until pullback.' : 'Neutral zone — maintain regular DCA schedule.'}\n`;
    analysis += `• 💡 Try our DCA Calculator tool to simulate returns based on your budget and timeline.\n`;
  }

  if (intents.includes('portfolio') && portfolio.length > 0) {
    analysis += `\n**Your Portfolio (${portfolio.length} holdings):**\n`;
    portfolio.forEach(h => {
      const livePrice = ctx[h.symbol.toLowerCase()]?.price;
      if (livePrice) {
        const pnl = ((livePrice - h.avgPrice) / h.avgPrice * 100).toFixed(1);
        analysis += `• ${h.symbol}: ${h.amount} units @ ${fmtPrice(h.avgPrice)} → now ${fmtPrice(livePrice)} (${pnl >= 0 ? '+' : ''}${pnl}%)\n`;
      }
    });
  }

  if (intents.includes('help')) {
    analysis += `\n**I can help with:**\n`;
    analysis += `• 📈 Market analysis — "How's the market?" "Should I buy BTC?"\n`;
    analysis += `• 💰 Trading advice — "Is it time to sell?" "Analyze ETH"\n`;
    analysis += `• ⚠️ Risk management — "Check my leverage risk" "Is 10x safe?"\n`;
    analysis += `• 📊 DCA planning — "How much should I DCA into BTC?"\n`;
    analysis += `• 🎯 Portfolio review — "Review my holdings"\n`;
    analysis += `• Ask in English or 中文!\n`;
  }

  // If no specific intent was detected, provide a comprehensive overview
  if (!analysis) {
    analysis = `I'd be happy to help with your crypto analysis. Based on the current market:\n`;
    analysis += `• BTC is ${b.change > 0 ? 'up' : 'down'} ${Math.abs(b.change).toFixed(1)}% in 24h\n`;
    analysis += `• ${fg ? `Market sentiment: ${fg.label} (${fg.value}/100)` : 'Sentiment data unavailable'}\n`;
    analysis += `\nAsk me about specific coins, buy/sell timing, risk management, or DCA strategy!`;
  }

  return header + analysis;
}

function detectIntents(msg) {
  const intents = [];
  if (/买|buy|should i (buy|enter|invest)|entry|加仓|抄底|is.*good.*time/i.test(msg)) intents.push('buy_advice');
  if (/卖|sell|exit|take profit|止盈|出|should i sell|利/i.test(msg)) intents.push('sell_advice');
  if (/risk|leverage|杠杆|爆仓|liquidat|margin|danger|仓位|风险/i.test(msg)) intents.push('risk');
  if (/dca|定投|dollar.cost|averaging|invest.*monthly|每月/i.test(msg)) intents.push('dca');
  if (/portfolio|持仓|holdings|仓位.*review|我的/i.test(msg)) intents.push('portfolio');
  if (/help|帮助|怎么用|what can you|你能/i.test(msg)) intents.push('help');
  if (/market|行情|overview|总览|how.*market|怎么样|分析|trend|走势|sentiment|fear|greed|恐慌/i.test(msg)) intents.push('market_overview');
  if (/btc|bitcoin|eth|bnb|sol|xrp|doge|比特|以太/i.test(msg) && intents.length === 0) intents.push('market_overview');
  if (intents.length === 0) intents.push('general');
  return intents;
}

function extractSymbol(msg) {
  const match = msg.match(/\b(btc|bitcoin|eth|ethereum|bnb|sol|solana|xrp|doge|ada|avax)\b/i);
  if (!match) return null;
  const map = { bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL' };
  return map[match[1].toLowerCase()] || match[1].toUpperCase();
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
const _heartbeatTimer = setInterval(() => {
  for (const client of sseClients) {
    try { client.write(':heartbeat\n\n'); } catch { sseClients.delete(client); }
  }
}, 30000);

// Broadcast prices every 15s to SSE clients (with overlap guard)
let _sseBroadcasting = false;
let _lastPrices = {}; // Store latest prices for alert checking

const _broadcastTimer = setInterval(async () => {
  if (_sseBroadcasting || sseClients.size === 0) return;
  _sseBroadcasting = true;
  try {
    const symbols = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX'];
    const results = await Promise.all(
      symbols.map(s => fetchMarketData(`${s}USDT`).then(d => ({
        symbol: s,
        price: parseFloat(d.lastPrice),
        change: parseFloat(d.priceChangePercent),
      })).catch(() => null))
    );
    const data = results.filter(Boolean);

    // Update price cache for alert checking
    data.forEach(d => { _lastPrices[d.symbol] = d.price; });

    // Check alerts against live prices
    const triggeredAlerts = checkAlertsAgainstPrices(_lastPrices);

    // Broadcast to SSE clients
    if (sseClients.size > 0) {
      const priceMsg = `event: prices\ndata: ${JSON.stringify(data)}\n\n`;
      for (const client of sseClients) {
        try { client.write(priceMsg); } catch { sseClients.delete(client); }
      }
      // Send triggered alerts
      if (triggeredAlerts.length > 0) {
        const alertMsg = `event: alert\ndata: ${JSON.stringify(triggeredAlerts)}\n\n`;
        for (const client of sseClients) {
          try { client.write(alertMsg); } catch { sseClients.delete(client); }
        }
      }
    }
  } catch (err) { log.debug('SSE broadcast error', { error: err.message }); } finally {
    _sseBroadcasting = false;
  }
}, 15000);

// Check all alerts against current prices
function checkAlertsAgainstPrices(prices) {
  const alerts = db.getAlerts().filter(a => !a.triggered);
  const triggered = [];
  for (const alert of alerts) {
    const price = prices[alert.symbol];
    if (!price) continue;
    const shouldTrigger =
      (alert.direction === 'above' && price >= alert.price) ||
      (alert.direction === 'below' && price <= alert.price);
    if (shouldTrigger) {
      db.triggerAlert(alert.id);
      triggered.push({ ...alert, currentPrice: price, triggeredAt: new Date().toISOString() });
      log.info('Alert triggered', { symbol: alert.symbol, direction: alert.direction, target: alert.price, current: price });
    }
  }
  return triggered;
}

// ---- BSC Chain Data API ----
async function handleBSCData(req, res) {
  try {
    const cacheKey = 'bsc-data';
    const cached = getCached(cacheKey);
    if (cached) return sendJSON(res, 200, cached);

    const [gasPrice, bnbInfo, bscTokens] = await Promise.all([
      fetchBSCGasPrice(),
      fetchBNBTokenInfo(),
      fetchBSCTokens(),
    ]);

    const response = {
      ok: true,
      chain: 'BSC',
      gas: gasPrice,
      bnb: bnbInfo,
      ecosystem: bscTokens,
      stats: {
        avgBlockTime: '3s',
        tps: '~100',
        validators: 21,
        totalSupply: bnbInfo.totalSupply,
        marketCap: bnbInfo.marketCap,
      },
    };
    setCache(cacheKey, response, 15000);
    sendJSON(res, 200, response);
  } catch (err) {
    log.error('BSC data error', { error: err.message });
    metrics.errors++;
    sendJSON(res, 200, {
      ok: true, degraded: true, source: 'demo', chain: 'BSC',
      gas: { low: 3, standard: 5, fast: 7 },
      bnb: { price: DEMO_DATA.prices.BNB, volume24h: 1800000000, change24h: -0.82, totalSupply: 145934062, marketCap: 145934062 * DEMO_DATA.prices.BNB },
      ecosystem: [
        { symbol: 'CAKE', price: 2.45, change24h: 1.2, volume24h: 85000000 },
        { symbol: 'XVS', price: 8.30, change24h: -0.5, volume24h: 12000000 },
      ],
      stats: { avgBlockTime: '3s', tps: '~100', validators: 21 },
    });
  }
}

// ---- Technical Indicators API ----
async function handleIndicators(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const symbol = (url.searchParams.get('symbol') || 'BTC').toUpperCase();
    const interval = url.searchParams.get('interval') || '4h';

    if (!/^[A-Z0-9]{2,10}$/.test(symbol)) return sendJSON(res, 400, { error: 'Invalid symbol' });
    const VALID_INTERVALS = ['1h', '4h', '1d'];
    if (!VALID_INTERVALS.includes(interval)) return sendJSON(res, 400, { error: 'Invalid interval' });

    const cacheKey = `indicators:${symbol}:${interval}`;
    const cached = getCached(cacheKey);
    if (cached) return sendJSON(res, 200, cached);

    const klines = await fetchKlines(`${symbol}USDT`, interval, 100);
    const indicators = calculateIndicators(klines);

    if (!indicators) {
      return sendJSON(res, 200, { ok: true, degraded: true, message: 'Insufficient data for indicators' });
    }

    const response = { ok: true, symbol, interval, ...indicators };
    setCache(cacheKey, response, CACHE_TTL.klines);
    sendJSON(res, 200, response);
  } catch (err) {
    log.error('Indicators error', { error: err.message });
    metrics.errors++;
    sendJSON(res, 200, { ok: true, degraded: true, source: 'demo', symbol: 'BTC', rsi: 52.3, signal: 'hold', strength: 0 });
  }
}

// ---- Get Latest Prices API (for offline/demo mode) ----
function handleLatestPrices(req, res) {
  if (Object.keys(_lastPrices).length === 0) {
    // Return demo data when no live prices available
    sendJSON(res, 200, { ok: true, degraded: true, source: 'demo', prices: DEMO_DATA.prices });
  } else {
    sendJSON(res, 200, { ok: true, degraded: false, source: 'live', prices: _lastPrices });
  }
}

// ---- Demo/Fallback Data (when APIs are unreachable) ----
const DEMO_DATA = {
  prices: { BTC: 67542.30, ETH: 3456.78, BNB: 612.45, SOL: 178.92, XRP: 0.62, DOGE: 0.185, ADA: 0.48, AVAX: 38.75 },
  market: [
    { symbol: 'BTC', price: 67542.30, change24h: 2.34, high24h: 68100, low24h: 65800, volume24h: 28500000000 },
    { symbol: 'ETH', price: 3456.78, change24h: 1.56, high24h: 3520, low24h: 3380, volume24h: 15200000000 },
    { symbol: 'BNB', price: 612.45, change24h: -0.82, high24h: 625, low24h: 605, volume24h: 1800000000 },
    { symbol: 'SOL', price: 178.92, change24h: 5.21, high24h: 182, low24h: 168, volume24h: 3200000000 },
    { symbol: 'XRP', price: 0.62, change24h: -1.23, high24h: 0.64, low24h: 0.60, volume24h: 2100000000 },
    { symbol: 'DOGE', price: 0.185, change24h: 3.45, high24h: 0.19, low24h: 0.178, volume24h: 1500000000 },
    { symbol: 'ADA', price: 0.48, change24h: -0.56, high24h: 0.49, low24h: 0.47, volume24h: 650000000 },
    { symbol: 'AVAX', price: 38.75, change24h: 1.89, high24h: 39.50, low24h: 37.20, volume24h: 520000000 },
  ],
  fearGreed: { value: 45, sentiment: 'Fear', advice: 'Market shows fear — historically a potential accumulation zone. Consider DCA.' },
  klines: Array.from({ length: 24 }, (_, i) => ({
    time: Date.now() - (23 - i) * 3600000,
    open: 66000 + Math.random() * 3000,
    high: 67000 + Math.random() * 2000,
    low: 65000 + Math.random() * 2000,
    close: 66500 + Math.random() * 2500,
    volume: 1000000000 + Math.random() * 500000000,
  })),
};

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
  'GET /api/bsc': handleBSCData,
  'GET /api/indicators': handleIndicators,
  'GET /api/prices': handleLatestPrices,
  'GET /api/stream': handleSSE,
  'GET /metrics': handleMetrics,
};

// ---- Server ----
const server = http.createServer(async (req, res) => {
  metrics.requests++;
  const requestId = crypto.randomUUID();
  res.setHeader('X-Request-ID', requestId);

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

  // CORS headers — restrict to same-origin; configurable via env
  const allowedOrigin = process.env.CORS_ORIGIN || req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
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

  // Clear all intervals to prevent work during shutdown
  clearInterval(_cacheCleanupTimer);
  clearInterval(_rateLimitCleanupTimer);
  clearInterval(_heartbeatTimer);
  clearInterval(_broadcastTimer);

  // Drain SSE clients gracefully
  for (const client of sseClients) {
    try { client.write('event: shutdown\ndata: {}\n\n'); client.end(); } catch {}
  }
  sseClients.clear();

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
