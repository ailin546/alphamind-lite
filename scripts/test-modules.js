#!/usr/bin/env node
/**
 * AlphaMind Lite - Module Tests
 * Tests for modular architecture: utils, middleware, routes, SSE
 * Zero dependencies - pure Node.js
 */

const { assert, test } = require('./test-runner');

// ---- Utils Module Tests ----
console.log('\n📋 Utils Module');

test('escapeHtml from utils module works', () => {
  const { escapeHtml } = require('./utils');
  assert.strictEqual(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  assert.strictEqual(escapeHtml('normal text'), 'normal text');
  assert.strictEqual(escapeHtml("it's"), "it&#039;s");
  assert.strictEqual(escapeHtml('a & b'), 'a &amp; b');
});

test('fmtPrice formats prices correctly', () => {
  const { fmtPrice } = require('./utils');
  assert.ok(fmtPrice(67542.30).startsWith('$'), 'Should start with $');
  assert.ok(fmtPrice(67542.30).includes('67'), 'Should contain price digits');
  assert.ok(fmtPrice(0.000123).startsWith('$'), 'Small prices should start with $');
  assert.ok(fmtPrice(0.000123).includes('0.000123'), 'Small prices should show 6 decimal places');
});

test('fmtPct formats percentages correctly', () => {
  const { fmtPct } = require('./utils');
  assert.ok(fmtPct(2.5).startsWith('+'), 'Positive should have + prefix');
  assert.ok(fmtPct(-1.3).startsWith('-'), 'Negative should have - prefix');
  assert.ok(fmtPct(0).includes('0.00%'), 'Zero should be +0.00%');
});

test('isValidSymbol validates correctly', () => {
  const { isValidSymbol } = require('./utils');
  assert.ok(isValidSymbol('BTC'), 'BTC should be valid');
  assert.ok(isValidSymbol('ETHUSDT'), 'ETHUSDT should be valid');
  assert.ok(isValidSymbol('bnb'), 'lowercase bnb should be valid');
  assert.ok(!isValidSymbol(''), 'Empty should be invalid');
  assert.ok(!isValidSymbol('A'), 'Single char should be invalid');
  assert.ok(!isValidSymbol('BTC/USDT'), 'Slash should be invalid');
  assert.ok(!isValidSymbol('<script>'), 'XSS should be invalid');
});

test('isValidInterval validates correctly', () => {
  const { isValidInterval } = require('./utils');
  assert.ok(isValidInterval('1h'), '1h should be valid');
  assert.ok(isValidInterval('4h'), '4h should be valid');
  assert.ok(isValidInterval('1d'), '1d should be valid');
  assert.ok(!isValidInterval('2h'), '2h should be invalid with defaults');
  assert.ok(!isValidInterval(''), 'Empty should be invalid');
  assert.ok(isValidInterval('1h', ['1h', '4h', '1d']), '1h should be valid with custom list');
  assert.ok(!isValidInterval('5m', ['1h', '4h', '1d']), '5m should be invalid with custom list');
});

// ---- Middleware Module Tests ----
console.log('\n📋 Middleware Module');

test('middleware module loads all exports', () => {
  const mw = require('./middleware');
  assert.ok(mw.getCached, 'getCached should exist');
  assert.ok(mw.setCache, 'setCache should exist');
  assert.ok(mw.checkRateLimit, 'checkRateLimit should exist');
  assert.ok(mw.sendJSON, 'sendJSON should exist');
  assert.ok(mw.readBody, 'readBody should exist');
  assert.ok(mw.metrics, 'metrics should exist');
  assert.ok(mw.MIME_TYPES, 'MIME_TYPES should exist');
  assert.ok(mw.SECURITY_HEADERS, 'SECURITY_HEADERS should exist');
  assert.ok(mw.SENSITIVE_PATHS, 'SENSITIVE_PATHS should exist');
});

test('middleware cache get/set works', () => {
  const { getCached, setCache } = require('./middleware');
  setCache('test-key-001', { hello: 'world' }, 5000);
  const result = getCached('test-key-001');
  assert.deepStrictEqual(result, { hello: 'world' });
});

test('middleware cache returns null for expired entries', () => {
  const { getCached, apiCache } = require('./middleware');
  apiCache.set('test-expired', { data: 'old', time: Date.now() - 100000, ttl: 100 });
  const result = getCached('test-expired');
  assert.strictEqual(result, null, 'Expired entry should return null');
});

test('middleware CSP does not include unsafe-inline for script-src', () => {
  const { SECURITY_HEADERS } = require('./middleware');
  const csp = SECURITY_HEADERS['Content-Security-Policy'];
  assert.ok(csp, 'CSP header should exist');
  const scriptSrc = csp.match(/script-src\s+([^;]+)/);
  assert.ok(scriptSrc, 'script-src should exist in CSP');
  assert.ok(!scriptSrc[1].includes("'unsafe-inline'"), 'script-src should NOT contain unsafe-inline');
});

test('middleware security headers are comprehensive', () => {
  const { SECURITY_HEADERS } = require('./middleware');
  const requiredHeaders = [
    'X-Content-Type-Options', 'X-Frame-Options', 'Content-Security-Policy',
    'Referrer-Policy', 'Strict-Transport-Security', 'Permissions-Policy',
    'X-DNS-Prefetch-Control', 'X-Permitted-Cross-Domain-Policies',
  ];
  requiredHeaders.forEach(h => {
    assert.ok(SECURITY_HEADERS[h], `Missing security header: ${h}`);
  });
});

test('middleware sensitive paths cover critical files', () => {
  const { SENSITIVE_PATHS } = require('./middleware');
  const critical = ['/.env', '/.git', '/scripts/', '/package.json', '/config/'];
  critical.forEach(p => {
    assert.ok(SENSITIVE_PATHS.some(sp => sp === p || sp.startsWith(p.slice(0, -1))), `Should protect ${p}`);
  });
});

test('middleware metrics track start time', () => {
  const { metrics } = require('./middleware');
  assert.ok(metrics.startTime > 0, 'Start time should be set');
  assert.strictEqual(typeof metrics.requests, 'number', 'requests should be number');
  assert.strictEqual(typeof metrics.errors, 'number', 'errors should be number');
});

// ---- Demo Data Tests ----
console.log('\n📋 Demo Data Module');

test('demo data has all required price symbols', () => {
  const DEMO_DATA = require('./demo-data');
  const required = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX'];
  required.forEach(s => {
    assert.ok(DEMO_DATA.prices[s], `Missing demo price for ${s}`);
    assert.ok(DEMO_DATA.prices[s] > 0, `Price for ${s} should be positive`);
  });
});

test('demo data market array has correct structure', () => {
  const DEMO_DATA = require('./demo-data');
  assert.ok(Array.isArray(DEMO_DATA.market), 'market should be array');
  assert.ok(DEMO_DATA.market.length >= 8, 'Should have at least 8 market entries');
  DEMO_DATA.market.forEach(m => {
    assert.ok(m.symbol, 'Each entry should have symbol');
    assert.ok(typeof m.price === 'number', 'Price should be number');
    assert.ok(typeof m.change24h === 'number', 'change24h should be number');
  });
});

test('demo data klines have correct count', () => {
  const DEMO_DATA = require('./demo-data');
  assert.strictEqual(DEMO_DATA.klines.length, 24, 'Should have 24 kline entries');
  DEMO_DATA.klines.forEach(k => {
    assert.ok(k.time, 'Kline should have time');
    assert.ok(typeof k.open === 'number', 'Kline should have numeric open');
    assert.ok(typeof k.close === 'number', 'Kline should have numeric close');
  });
});

test('demo data fearGreed has value and sentiment', () => {
  const DEMO_DATA = require('./demo-data');
  assert.ok(typeof DEMO_DATA.fearGreed.value === 'number', 'fearGreed value should be number');
  assert.ok(DEMO_DATA.fearGreed.sentiment, 'fearGreed should have sentiment');
  assert.ok(DEMO_DATA.fearGreed.advice, 'fearGreed should have advice');
});

// ---- Route Module Loading Tests ----
console.log('\n📋 Route Modules');

test('routes-health module loads', () => {
  const mod = require('./routes-health');
  assert.ok(mod.handleHealth, 'handleHealth should exist');
  assert.ok(mod.handleReadiness, 'handleReadiness should exist');
  assert.ok(mod.handleMetrics, 'handleMetrics should exist');
  assert.ok(mod.serveStatic, 'serveStatic should exist');
});

test('routes-market module loads', () => {
  const mod = require('./routes-market');
  assert.ok(mod.handleMarket, 'handleMarket should exist');
  assert.ok(mod.handleSentiment, 'handleSentiment should exist');
  assert.ok(mod.handleCorrelation, 'handleCorrelation should exist');
  assert.ok(mod.handleKlines, 'handleKlines should exist');
  assert.ok(mod.handleIndicators, 'handleIndicators should exist');
  assert.ok(mod.handleMultiTimeframe, 'handleMultiTimeframe should exist');
});

test('routes-portfolio module loads', () => {
  const mod = require('./routes-portfolio');
  assert.ok(mod.handlePortfolio, 'handlePortfolio should exist');
  assert.ok(mod.handlePortfolioAdd, 'handlePortfolioAdd should exist');
  assert.ok(mod.handlePortfolioRemove, 'handlePortfolioRemove should exist');
  assert.ok(mod.handleAlerts, 'handleAlerts should exist');
  assert.ok(mod.handleAlertAdd, 'handleAlertAdd should exist');
  assert.ok(mod.handleAlertRemove, 'handleAlertRemove should exist');
  assert.ok(mod.handleFunding, 'handleFunding should exist');
});

test('routes-trading module loads', () => {
  const mod = require('./routes-trading');
  assert.ok(mod.handleRisk, 'handleRisk should exist');
  assert.ok(mod.handleDCA, 'handleDCA should exist');
  assert.ok(mod.handlePaperTrade, 'handlePaperTrade should exist');
  assert.ok(mod.handlePaperTradeHistory, 'handlePaperTradeHistory should exist');
  assert.ok(mod.handlePaperTradeReset, 'handlePaperTradeReset should exist');
  assert.ok(mod.handleLatestPrices, 'handleLatestPrices should exist');
  assert.ok(mod.setLastPrices, 'setLastPrices should exist');
  assert.ok(mod.getLastPrices, 'getLastPrices should exist');
});

test('routes-ai-chat module loads', () => {
  const mod = require('./routes-ai-chat');
  assert.ok(mod.handleAIChat, 'handleAIChat should exist');
  assert.ok(mod.detectIntents, 'detectIntents should exist');
  assert.ok(mod.extractSymbol, 'extractSymbol should exist');
});

test('routes-bsc module loads', () => {
  const mod = require('./routes-bsc');
  assert.ok(mod.handleBSCData, 'handleBSCData should exist');
});

test('sse module loads', () => {
  const mod = require('./sse');
  assert.ok(mod.handleSSE, 'handleSSE should exist');
  assert.ok(mod.drainClients, 'drainClients should exist');
  assert.ok(mod.onPricesUpdate, 'onPricesUpdate should exist');
  assert.ok(mod.checkAlertsAgainstPrices, 'checkAlertsAgainstPrices should exist');
});

// ---- AI Chat Intent Detection (via module) ----
console.log('\n📋 AI Chat Module');

test('detectIntents from module covers all categories', () => {
  const { detectIntents } = require('./routes-ai-chat');
  assert.ok(detectIntents('should i buy btc').includes('buy_advice'));
  assert.ok(detectIntents('when to sell').includes('sell_advice'));
  assert.ok(detectIntents('check my leverage risk').includes('risk'));
  assert.ok(detectIntents('help me with DCA').includes('dca'));
  assert.ok(detectIntents('help me with DCA').includes('help'));
  assert.ok(detectIntents('我的持仓').includes('portfolio'));
  assert.ok(detectIntents('random text').includes('general'));
  assert.ok(detectIntents('行情怎么样').includes('market_overview'));
});

test('extractSymbol from module works', () => {
  const { extractSymbol } = require('./routes-ai-chat');
  assert.strictEqual(extractSymbol('should i buy btc'), 'BTC');
  assert.strictEqual(extractSymbol('analyze ethereum'), 'ETH');
  assert.strictEqual(extractSymbol('how is solana doing'), 'SOL');
  assert.strictEqual(extractSymbol('no coin here'), null);
});

// ---- SSE Alert Checking Tests ----
console.log('\n📋 SSE Alert Checking');

test('checkAlertsAgainstPrices triggers correctly', () => {
  const { checkAlertsAgainstPrices } = require('./sse');
  const db = require('./db');
  const alert = db.addAlert('BTC', 60000, 'above');
  const triggered = checkAlertsAgainstPrices({ BTC: 65000 });
  assert.ok(triggered.length >= 1, 'Should trigger at least one alert');
  const found = triggered.find(a => a.id === alert.id);
  assert.ok(found, 'Our test alert should be in triggered list');
  assert.strictEqual(found.currentPrice, 65000, 'Should include current price');
  db.removeAlert(alert.id);
});

test('trading module price cache works', () => {
  const { setLastPrices, getLastPrices } = require('./routes-trading');
  setLastPrices({ BTC: 70000, ETH: 3500 });
  const prices = getLastPrices();
  assert.strictEqual(prices.BTC, 70000, 'BTC price should be cached');
  assert.strictEqual(prices.ETH, 3500, 'ETH price should be cached');
});
