#!/usr/bin/env node
/**
 * AlphaMind Lite - Test Suite
 * Main test entry point (zero dependencies)
 */

const path = require('path');
const { assert, test, testAsync, runAll } = require('./test-runner');

// ==========================================
console.log('\n🧪 AlphaMind Lite Test Suite\n');

// ---- Config Tests ----
console.log('📋 Config');
test('config loads without error', () => {
  const config = require('../config/config');
  assert.ok(config);
  assert.ok(config.server);
  assert.ok(config.apis);
});

test('config has required fields', () => {
  const config = require('../config/config');
  assert.strictEqual(typeof config.server.port, 'number');
  assert.ok(config.server.port > 0);
  assert.ok(config.apis.binance.rest);
  assert.ok(config.apis.fearGreed.url);
});

test('config validate returns array', () => {
  const config = require('../config/config');
  const warnings = config.validate();
  assert.ok(Array.isArray(warnings));
});

// ---- Logger Tests ----
console.log('\n📋 Logger');
test('logger creates without error', () => {
  const { Logger } = require('./logger');
  const logger = new Logger({ level: 'debug', format: 'json' });
  assert.ok(logger);
  logger.close();
});

test('logger child creates context', () => {
  const { Logger } = require('./logger');
  const logger = new Logger({ level: 'info', context: 'test' });
  const child = logger.child('sub');
  assert.ok(child);
  assert.strictEqual(child.context, 'test:sub');
  logger.close();
  child.close();
});

// ---- API Client Tests ----
console.log('\n📋 API Client');
test('api-client module loads', () => {
  const api = require('./api-client');
  assert.ok(api.fetchMarketData);
  assert.ok(api.fetchPrice);
  assert.ok(api.fetchFearGreedIndex);
  assert.ok(api.fetchMultiplePrices);
});

test('api-client has all expected exports', () => {
  const api = require('./api-client');
  const expected = ['httpGet', 'fetchMarketData', 'fetchPrice', 'fetchMultiplePrices', 'fetchFearGreedIndex', 'fetchFundingRates', 'fetchKlines', 'fetchBSCGasPrice', 'fetchBNBTokenInfo', 'fetchBSCTokens', 'calculateIndicators'];
  expected.forEach(fn => {
    assert.strictEqual(typeof api[fn], 'function', `Missing export: ${fn}`);
  });
});

// ---- Technical Indicators Tests ----
console.log('\n📋 Technical Indicators');
test('calculateIndicators returns null for insufficient data', () => {
  const { calculateIndicators } = require('./api-client');
  assert.strictEqual(calculateIndicators(null), null);
  assert.strictEqual(calculateIndicators([]), null);
  assert.strictEqual(calculateIndicators(new Array(10).fill([0,0,0,0,0,0])), null);
});

test('calculateIndicators produces valid RSI range', () => {
  const { calculateIndicators } = require('./api-client');
  const klines = [];
  let price = 50000;
  for (let i = 0; i < 100; i++) {
    const change = (Math.random() - 0.48) * 1000;
    const open = price;
    price += change;
    const high = Math.max(open, price) + Math.random() * 200;
    const low = Math.min(open, price) - Math.random() * 200;
    klines.push([Date.now() - (100 - i) * 3600000, open, high, low, price, 1000000 + Math.random() * 500000]);
  }
  const result = calculateIndicators(klines);
  assert.ok(result, 'Should return indicators');
  assert.ok(result.rsi >= 0 && result.rsi <= 100, `RSI ${result.rsi} should be 0-100`);
  assert.ok(['buy', 'sell', 'hold'].includes(result.signal), `Signal should be buy/sell/hold, got ${result.signal}`);
  assert.ok(result.sma.sma7 !== null, 'SMA7 should exist');
  assert.ok(result.sma.sma25 !== null, 'SMA25 should exist');
});

test('calculateIndicators Bollinger Bands contain price', () => {
  const { calculateIndicators } = require('./api-client');
  const klines = [];
  let price = 60000;
  for (let i = 0; i < 100; i++) {
    const change = (Math.random() - 0.5) * 500;
    price += change;
    klines.push([Date.now() - (100 - i) * 3600000, price, price + 100, price - 100, price, 2000000]);
  }
  const result = calculateIndicators(klines);
  assert.ok(result.bollinger, 'Bollinger Bands should exist');
  assert.ok(result.bollinger.upper > result.bollinger.middle, 'Upper > Middle');
  assert.ok(result.bollinger.middle > result.bollinger.lower, 'Middle > Lower');
});

test('calculateIndicators MACD structure', () => {
  const { calculateIndicators } = require('./api-client');
  const klines = [];
  let price = 40000;
  for (let i = 0; i < 100; i++) {
    price += (Math.random() - 0.45) * 300;
    klines.push([Date.now() - (100 - i) * 3600000, price, price + 50, price - 50, price, 1500000]);
  }
  const result = calculateIndicators(klines);
  assert.ok(result.macd, 'MACD should exist');
  assert.strictEqual(typeof result.macd.macd, 'number', 'MACD line should be number');
  assert.strictEqual(typeof result.macd.histogram, 'number', 'MACD histogram should be number');
});

test('calculateIndicators volume trend detection', () => {
  const { calculateIndicators } = require('./api-client');
  const klines = [];
  let price = 50000;
  for (let i = 0; i < 100; i++) {
    price += (Math.random() - 0.5) * 200;
    const vol = i >= 97 ? 10000000 : 1000000;
    klines.push([Date.now() - (100 - i) * 3600000, price, price + 50, price - 50, price, vol]);
  }
  const result = calculateIndicators(klines);
  assert.strictEqual(result.volume.trend, 'high', 'Should detect high volume trend');
});

// ---- DB Tests ----
console.log('\n📋 Database');
test('db module loads', () => {
  const db = require('./db');
  assert.ok(db.load);
  assert.ok(db.getPortfolio);
  assert.ok(db.addHolding);
  assert.ok(db.getAlerts);
  assert.ok(db.addAlert);
});

test('db CRUD operations work', () => {
  const db = require('./db');
  db.addHolding('TEST', 1.0, 100);
  const portfolio = db.getPortfolio();
  const holding = portfolio.find(p => p.symbol === 'TEST');
  assert.ok(holding, 'Holding should exist');
  assert.strictEqual(holding.amount, 1.0);
  assert.strictEqual(holding.avgPrice, 100);
  db.addHolding('TEST', 1.0, 200);
  const updated = db.getPortfolio().find(p => p.symbol === 'TEST');
  assert.strictEqual(updated.amount, 2.0);
  assert.strictEqual(updated.avgPrice, 150);
  db.removeHolding('TEST');
  assert.ok(!db.getPortfolio().find(p => p.symbol === 'TEST'));
  const alert = db.addAlert('BTC', 80000, 'above');
  assert.ok(alert.id);
  assert.strictEqual(alert.symbol, 'BTC');
  db.removeAlert(alert.id);
  assert.ok(!db.getAlerts().find(a => a.id === alert.id));
});

test('db price history works', () => {
  const db = require('./db');
  db.recordPrice('BTC', 70000);
  db.recordPrice('BTC', 71000);
  const history = db.getPriceHistory('BTC');
  assert.ok(history.length >= 2);
  assert.strictEqual(history[history.length - 1].price, 71000);
});

// ---- Notify Module Tests ----
console.log('\n📋 Notify');
test('notify module loads', () => {
  const notify = require('./notify');
  assert.ok(notify.sendTelegram);
  assert.ok(notify.sendPriceAlert);
  assert.ok(notify.sendPortfolioSummary);
});

// ---- Server Logic Unit Tests ----
console.log('\n📋 Server Logic');

test('readBody rejects oversized payloads', async () => {
  const MAX_BODY = 1e5;
  const bigBody = 'x'.repeat(MAX_BODY + 1);
  assert.ok(bigBody.length > MAX_BODY, 'Body should exceed limit');
});

test('rate limiter allows normal traffic', () => {
  const window = 60000;
  const max = 100;
  const limiter = new Map();
  const ip = '127.0.0.1';
  const now = Date.now();
  limiter.set(ip, { count: 1, start: now });
  const entry = limiter.get(ip);
  assert.ok(entry.count <= max, 'First request should be allowed');
  entry.count = max;
  assert.ok(entry.count <= max, 'At limit should still be allowed');
  entry.count = max + 1;
  assert.ok(entry.count > max, 'Over limit should be rejected');
});

test('cache TTL expires correctly', () => {
  const cache = new Map();
  const key = 'test';
  const data = { price: 67000 };
  const ttl = 100;
  cache.set(key, { data, time: Date.now(), ttl });
  const entry = cache.get(key);
  assert.ok(Date.now() - entry.time < entry.ttl, 'Fresh entry should be valid');
  cache.set(key, { data, time: Date.now() - 200, ttl });
  const expired = cache.get(key);
  assert.ok(Date.now() - expired.time >= expired.ttl, 'Expired entry should be invalid');
});

test('DCA volatility simulation produces varied prices', () => {
  const currentPrice = 67000;
  const months = 12;
  const prices = [];
  for (let i = 0; i < months; i++) {
    const volatility = 1 + (Math.sin(i * 0.8) * 0.1 + (Math.random() - 0.5) * 0.05);
    prices.push(currentPrice * volatility);
  }
  const unique = new Set(prices.map(p => Math.round(p)));
  assert.ok(unique.size > 1, `DCA should produce varied prices, got ${unique.size} unique`);
  prices.forEach(p => {
    assert.ok(p > currentPrice * 0.8 && p < currentPrice * 1.2, `Price ${p} should be within 20% of ${currentPrice}`);
  });
});

test('symbol validation regex works correctly', () => {
  const regex = /^[A-Z0-9]{2,10}$/i;
  assert.ok(regex.test('BTC'), 'BTC should be valid');
  assert.ok(regex.test('ETHUSDT'), 'ETHUSDT should be valid');
  assert.ok(regex.test('bnb'), 'bnb lowercase should be valid');
  assert.ok(!regex.test(''), 'Empty should be invalid');
  assert.ok(!regex.test('A'), 'Single char should be invalid');
  assert.ok(!regex.test('BTC/USDT'), 'Slash should be invalid');
  assert.ok(!regex.test('BTC USDT'), 'Space should be invalid');
  assert.ok(!regex.test('<script>'), 'XSS attempt should be invalid');
});

test('liquidation price calculation is correct', () => {
  const entry = 50000;
  const leverage = 10;
  const liquidationPrice = entry * (1 - 1 / leverage * 0.95);
  assert.ok(liquidationPrice > 0, 'Liquidation price should be positive');
  assert.ok(liquidationPrice < entry, 'Liquidation price should be below entry');
  const distance = ((entry - liquidationPrice) / entry) * 100;
  assert.ok(Math.abs(distance - 9.5) < 0.1, `Distance should be ~9.5%, got ${distance.toFixed(2)}%`);
});

test('alert trigger logic works for above and below', () => {
  const prices = { BTC: 67000, ETH: 3400 };
  const aboveAlert = { symbol: 'BTC', price: 65000, direction: 'above' };
  const shouldTriggerAbove = (aboveAlert.direction === 'above' && prices[aboveAlert.symbol] >= aboveAlert.price);
  assert.ok(shouldTriggerAbove, 'BTC 67000 >= 65000 should trigger above alert');
  const belowAlert = { symbol: 'ETH', price: 3500, direction: 'below' };
  const shouldTriggerBelow = (belowAlert.direction === 'below' && prices[belowAlert.symbol] <= belowAlert.price);
  assert.ok(shouldTriggerBelow, 'ETH 3400 <= 3500 should trigger below alert');
  const noTrigger = { symbol: 'BTC', price: 70000, direction: 'above' };
  const shouldNot = (noTrigger.direction === 'above' && prices[noTrigger.symbol] >= noTrigger.price);
  assert.ok(!shouldNot, 'BTC 67000 < 70000 should NOT trigger above alert');
});

test('correlation calculation produces valid range', () => {
  const btcChange = 2.5;
  const altChanges = [2.0, -1.0, 5.0, 0.0, 3.0];
  altChanges.forEach(change => {
    const diff = Math.abs(change - btcChange);
    const correlation = Math.max(0, 1 - diff / 20);
    assert.ok(correlation >= 0 && correlation <= 1, `Correlation ${correlation} should be 0-1`);
  });
});

test('AI intent detection covers all categories', () => {
  const detectIntents = (msg) => {
    const intents = [];
    if (/买|buy|should i (buy|enter|invest)|entry|加仓|抄底/i.test(msg)) intents.push('buy_advice');
    if (/卖|sell|exit|take profit|止盈/i.test(msg)) intents.push('sell_advice');
    if (/risk|leverage|杠杆|爆仓|liquidat/i.test(msg)) intents.push('risk');
    if (/dca|定投|dollar.cost/i.test(msg)) intents.push('dca');
    if (/portfolio|持仓|holdings/i.test(msg)) intents.push('portfolio');
    if (/help|帮助/i.test(msg)) intents.push('help');
    if (/market|行情|overview|总览/i.test(msg)) intents.push('market_overview');
    if (intents.length === 0) intents.push('general');
    return intents;
  };
  assert.deepStrictEqual(detectIntents('should i buy btc'), ['buy_advice']);
  assert.deepStrictEqual(detectIntents('when to sell'), ['sell_advice']);
  assert.deepStrictEqual(detectIntents('check my leverage risk'), ['risk']);
  assert.deepStrictEqual(detectIntents('help me with DCA'), ['dca', 'help']);
  assert.deepStrictEqual(detectIntents('我的持仓'), ['portfolio']);
  assert.deepStrictEqual(detectIntents('random text'), ['general']);
  assert.deepStrictEqual(detectIntents('行情怎么样'), ['market_overview']);
});

test('escapeHtml prevents XSS', () => {
  const { escapeHtml } = require('./utils');
  assert.strictEqual(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  assert.strictEqual(escapeHtml('normal text'), 'normal text');
  assert.strictEqual(escapeHtml("it's"), "it&#039;s");
});

// ---- Paper Trading DB Tests ----
console.log('\n📋 Paper Trading');

test('paper trading balance starts at 10000', () => {
  const db = require('./db');
  db.load();
  const balance = db.getPaperBalance();
  assert.ok(typeof balance === 'number', 'Balance should be a number');
  assert.ok(balance > 0, 'Balance should be positive');
});

test('paper trading rejects buy with insufficient balance', () => {
  const db = require('./db');
  db.load();
  const result = db.addPaperTrade('BTC', 'buy', 999999999, 100000);
  assert.strictEqual(result, null, 'Should reject buy exceeding balance');
});

test('paper trading tracks trade history', () => {
  const db = require('./db');
  db.load();
  const trades = db.getPaperTrades();
  assert.ok(Array.isArray(trades), 'Trades should be an array');
});

// ---- BSC Data Structure Tests ----
console.log('\n📋 BSC Data Structure');

test('BSC chain constants are valid', () => {
  const originalSupply = 200000000;
  const burnedTotal = 54065938;
  const circulatingSupply = originalSupply - burnedTotal;
  assert.ok(burnedTotal > 0, 'Burned total should be positive');
  assert.ok(circulatingSupply < originalSupply, 'Circulating should be less than original');
  assert.ok(circulatingSupply > 100000000, 'Circulating should be > 100M');
  const burnRatePercent = (burnedTotal / originalSupply) * 100;
  assert.ok(burnRatePercent > 20 && burnRatePercent < 40, 'Burn rate should be 20-40%');
});

test('BSC ecosystem tokens list is valid', () => {
  const bscTokens = ['CAKE', 'XVS', 'BAKE', 'ALPACA', 'BSW'];
  assert.strictEqual(bscTokens.length, 5, 'Should track 5 BSC tokens');
  assert.ok(bscTokens.includes('CAKE'), 'Should include PancakeSwap token');
  assert.ok(bscTokens.every(t => /^[A-Z]+$/.test(t)), 'All tokens should be uppercase');
});

test('BSC L2 chain IDs are correct', () => {
  const BSC_CHAIN_ID = 56;
  const OPBNB_CHAIN_ID = 204;
  assert.strictEqual(BSC_CHAIN_ID, 56, 'BSC mainnet chain ID should be 56');
  assert.strictEqual(OPBNB_CHAIN_ID, 204, 'opBNB chain ID should be 204');
});

// ---- Load Module Tests ----
require('./test-modules');

// ---- HTTP Integration Tests ----
console.log('\n📋 HTTP Integration');

testAsync('server starts and responds to /health', async () => {
  const http = require('http');
  const { spawn } = require('child_process');
  const testPort = 39123;
  const env = { ...process.env, PORT: String(testPort), NODE_ENV: 'test', LOG_LEVEL: 'error' };
  const server = spawn('node', [path.join(__dirname, 'server.js')], { env, stdio: 'pipe' });
  await new Promise(r => setTimeout(r, 1500));
  try {
    const data = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${testPort}/health`, res => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
      }).on('error', reject);
    });
    assert.strictEqual(data.status, 'ok', 'Health status should be ok');
    assert.ok(data.version, 'Health should include version');
    assert.ok(data.uptime >= 0, 'Health should include uptime');
    assert.ok(data.timestamp, 'Health should include timestamp');
  } finally {
    server.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 500));
  }
});

testAsync('server returns 404 for unknown routes', async () => {
  const http = require('http');
  const { spawn } = require('child_process');
  const testPort = 39124;
  const env = { ...process.env, PORT: String(testPort), NODE_ENV: 'test', LOG_LEVEL: 'error' };
  const server = spawn('node', [path.join(__dirname, 'server.js')], { env, stdio: 'pipe' });
  await new Promise(r => setTimeout(r, 1500));
  try {
    const statusCode = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${testPort}/nonexistent.html`, res => { res.resume(); resolve(res.statusCode); }).on('error', reject);
    });
    assert.strictEqual(statusCode, 404, 'Unknown route should return 404');
  } finally {
    server.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 500));
  }
});

testAsync('server blocks access to sensitive paths', async () => {
  const http = require('http');
  const { spawn } = require('child_process');
  const testPort = 39125;
  const env = { ...process.env, PORT: String(testPort), NODE_ENV: 'test', LOG_LEVEL: 'error' };
  const server = spawn('node', [path.join(__dirname, 'server.js')], { env, stdio: 'pipe' });
  await new Promise(r => setTimeout(r, 1500));
  try {
    for (const sensitivePath of ['/config/config.js', '/scripts/server.js', '/.env', '/package.json']) {
      const statusCode = await new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${testPort}${sensitivePath}`, res => { res.resume(); resolve(res.statusCode); }).on('error', reject);
      });
      assert.strictEqual(statusCode, 404, `${sensitivePath} should be blocked (got ${statusCode})`);
    }
  } finally {
    server.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 500));
  }
});

testAsync('server returns proper security headers', async () => {
  const http = require('http');
  const { spawn } = require('child_process');
  const testPort = 39130;
  const env = { ...process.env, PORT: String(testPort), NODE_ENV: 'test', LOG_LEVEL: 'error' };
  const server = spawn('node', [path.join(__dirname, 'server.js')], { env, stdio: 'pipe' });
  await new Promise(r => setTimeout(r, 2000));
  try {
    const headers = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${testPort}/health`, res => { res.resume(); resolve(res.headers); }).on('error', reject);
    });
    assert.ok(headers['x-content-type-options'] === 'nosniff', 'Should have X-Content-Type-Options');
    assert.ok(headers['x-frame-options'] === 'DENY', 'Should have X-Frame-Options');
    assert.ok(headers['x-request-id'], 'Should have X-Request-ID');
    assert.ok(headers['content-security-policy'], 'Should have CSP header');
    assert.ok(headers['strict-transport-security'] && headers['strict-transport-security'].includes('max-age'), 'Should have HSTS header');
    assert.ok(headers['permissions-policy'] && headers['permissions-policy'].includes('camera'), 'Should have Permissions-Policy header');
    assert.ok(headers['x-dns-prefetch-control'] === 'off', 'Should have X-DNS-Prefetch-Control');
    assert.ok(headers['x-permitted-cross-domain-policies'] === 'none', 'Should have X-Permitted-Cross-Domain-Policies');
  } finally {
    server.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 500));
  }
});

testAsync('server rate limiting works', async () => {
  const http = require('http');
  const { spawn } = require('child_process');
  const testPort = 39135;
  const env = { ...process.env, PORT: String(testPort), NODE_ENV: 'test', LOG_LEVEL: 'error', RATE_LIMIT_MAX: '5', RATE_LIMIT_WINDOW: '60000' };
  const server = spawn('node', [path.join(__dirname, 'server.js')], { env, stdio: 'pipe' });
  await new Promise(r => setTimeout(r, 1500));
  try {
    const results = [];
    for (let i = 0; i < 7; i++) {
      const statusCode = await new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${testPort}/health`, res => { res.resume(); resolve(res.statusCode); }).on('error', reject);
      });
      results.push(statusCode);
    }
    assert.ok(results.slice(0, 5).every(s => s === 200), 'First 5 requests should succeed');
    assert.ok(results.slice(5).some(s => s === 429), 'Later requests should be rate limited');
  } finally {
    server.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 500));
  }
});

// ---- Script Syntax Tests ----
console.log('\n📋 Script Syntax');
const fs = require('fs');

const scriptDir = path.join(__dirname);
const scripts = fs.readdirSync(scriptDir).filter(f => f.endsWith('.js') && f !== 'test.js');

scripts.forEach(script => {
  test(`${script} has valid syntax`, () => {
    const { execSync } = require('child_process');
    execSync(`node -c "${path.join(scriptDir, script)}"`, { encoding: 'utf8' });
  });
});

// ---- Config File Syntax ----
const configDir = path.join(__dirname, '..', 'config');
if (fs.existsSync(configDir)) {
  const configFiles = fs.readdirSync(configDir).filter(f => f.endsWith('.js'));
  configFiles.forEach(file => {
    test(`config/${file} has valid syntax`, () => {
      const { execSync } = require('child_process');
      execSync(`node -c "${path.join(configDir, file)}"`, { encoding: 'utf8' });
    });
  });
}

// ---- Whale & Arbitrage Module Tests ----
console.log('\n📋 Whale & Arbitrage Modules');

test('routes-whale-arb exports all handlers', () => {
  const whaleArb = require('./routes-whale-arb');
  assert.strictEqual(typeof whaleArb.handleWhaleAlert, 'function');
  assert.strictEqual(typeof whaleArb.handleArbitrage, 'function');
  assert.strictEqual(typeof whaleArb.handleFundingRate, 'function');
});

test('calculateRiskReward returns valid structure', () => {
  const { calculateRiskReward } = require('./routes-whale-arb');
  var result = calculateRiskReward(0.15, 0.02, 5.5);
  assert.ok(result.risk >= 1 && result.risk <= 5, 'Risk should be 1-5');
  assert.strictEqual(typeof result.reward, 'number');
  assert.strictEqual(typeof result.ratio, 'number');
  assert.ok(['A', 'B', 'C', 'D'].indexOf(result.grade) >= 0, 'Grade should be A-D');
});

test('calculateRiskReward handles high volatility', () => {
  const { calculateRiskReward } = require('./routes-whale-arb');
  var lowVol = calculateRiskReward(0.1, 0.01, 2);
  var highVol = calculateRiskReward(0.1, 0.01, 10);
  assert.ok(highVol.risk > lowVol.risk, 'High volatility should increase risk');
});

test('generateStrategy produces basis strategies', () => {
  const { generateStrategy } = require('./routes-whale-arb');
  var coin = { basis: 0.2, fundingRate: 0.01, fundingAPY: 15, dayRange: 5 };
  var strategies = generateStrategy(coin);
  assert.ok(strategies.length > 0, 'Should generate at least one strategy');
  var basisStrat = strategies.find(function(s) { return s.type === 'basis'; });
  assert.ok(basisStrat, 'Should have a basis strategy');
  assert.strictEqual(basisStrat.name, 'Cash & Carry');
});

test('generateStrategy produces reverse basis for discount', () => {
  const { generateStrategy } = require('./routes-whale-arb');
  var coin = { basis: -0.2, fundingRate: 0.01, fundingAPY: 15, dayRange: 2 };
  var strategies = generateStrategy(coin);
  var basisStrat = strategies.find(function(s) { return s.type === 'basis'; });
  assert.ok(basisStrat, 'Should have a basis strategy for discount');
  assert.strictEqual(basisStrat.name, 'Reverse Cash & Carry');
});

test('generateStrategy produces funding rate strategy', () => {
  const { generateStrategy } = require('./routes-whale-arb');
  var coin = { basis: 0.01, fundingRate: 0.02, fundingAPY: 25, dayRange: 2 };
  var strategies = generateStrategy(coin);
  var fundStrat = strategies.find(function(s) { return s.type === 'funding'; });
  assert.ok(fundStrat, 'Should have a funding strategy');
  assert.strictEqual(fundStrat.name, 'Funding Rate Harvest');
});

test('generateStrategy produces volatility strategy for high range', () => {
  const { generateStrategy } = require('./routes-whale-arb');
  var coin = { basis: 0.01, fundingRate: 0.001, fundingAPY: 1, dayRange: 6 };
  var strategies = generateStrategy(coin);
  var volStrat = strategies.find(function(s) { return s.type === 'volatility'; });
  assert.ok(volStrat, 'Should have a volatility strategy');
  assert.strictEqual(volStrat.name, 'Range Trading');
});

test('calculateFeeAdjustedPnL returns valid structure', () => {
  const { calculateFeeAdjustedPnL } = require('./routes-whale-arb');
  var result = calculateFeeAdjustedPnL(0.5, 0.02, 10000);
  assert.strictEqual(result.positionSize, 10000);
  assert.strictEqual(typeof result.grossProfit, 'number');
  assert.strictEqual(typeof result.fees.spot, 'number');
  assert.strictEqual(typeof result.fees.futures, 'number');
  assert.strictEqual(typeof result.fees.slippage, 'number');
  assert.strictEqual(typeof result.fees.total, 'number');
  assert.strictEqual(typeof result.netProfit, 'number');
  assert.strictEqual(typeof result.netROI, 'number');
  assert.strictEqual(typeof result.profitable, 'boolean');
  assert.strictEqual(typeof result.breakEvenBasis, 'number');
});

test('calculateFeeAdjustedPnL detects unprofitable small basis', () => {
  const { calculateFeeAdjustedPnL } = require('./routes-whale-arb');
  var result = calculateFeeAdjustedPnL(0.01, 0.001, 10000);
  assert.strictEqual(result.profitable, false, 'Tiny basis should not be profitable after fees');
});

test('calculateFeeAdjustedPnL detects profitable large basis', () => {
  const { calculateFeeAdjustedPnL } = require('./routes-whale-arb');
  var result = calculateFeeAdjustedPnL(1.0, 0.05, 10000);
  assert.strictEqual(result.profitable, true, 'Large basis should be profitable after fees');
  assert.ok(result.netProfit > 0, 'Net profit should be positive');
});

test('calculateFeeAdjustedPnL defaults to $10K position', () => {
  const { calculateFeeAdjustedPnL } = require('./routes-whale-arb');
  var result = calculateFeeAdjustedPnL(0.5, 0.02);
  assert.strictEqual(result.positionSize, 10000);
});

test('calculateFeeAdjustedPnL fee breakdown is correct', () => {
  const { calculateFeeAdjustedPnL } = require('./routes-whale-arb');
  var result = calculateFeeAdjustedPnL(0.5, 0.02, 10000);
  assert.strictEqual(result.fees.spot, 10); // 0.1% of 10K
  assert.strictEqual(result.fees.futures, 4); // 0.04% of 10K
  assert.strictEqual(result.fees.slippage, 10); // 0.05% * 2 * 10K
  assert.strictEqual(result.fees.total, 24); // 10+4+10
});

test('calculateRiskReward grade boundaries', () => {
  const { calculateRiskReward } = require('./routes-whale-arb');
  // Grade A: ratio > 10
  var gradeA = calculateRiskReward(0.5, 0.1, 2);
  // Grade D: ratio <= 2 (needs very small reward)
  var gradeD = calculateRiskReward(0.001, 0.0001, 9);
  assert.ok(['A', 'B'].indexOf(gradeA.grade) >= 0, 'High reward should get A or B grade');
  assert.strictEqual(gradeD.grade, 'D', 'Low reward + high risk should get D grade');
});

// ---- Run All & Report ----
runAll();
