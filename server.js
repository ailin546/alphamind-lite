#!/usr/bin/env node
/**
 * AlphaMind Lite - Web Server
 * Zero-dependency Node.js API server + static file server
 * Wraps all existing CLI functionality into REST API endpoints
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;

// ─── HTTP Helper ───────────────────────────────────────────────────────────────

function fetch(urlStr, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const mod = urlStr.startsWith('https') ? https : http;
    const req = mod.get(urlStr, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(data));
    });
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
  });
}

// ─── Binance API Helpers ───────────────────────────────────────────────────────

async function getBinancePrice(symbol) {
  const raw = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}USDT`);
  const j = JSON.parse(raw);
  if (!j || !j.price) throw new Error('Invalid response');
  return parseFloat(j.price);
}

async function getBinance24hr(symbol) {
  const raw = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}USDT`);
  return JSON.parse(raw);
}

async function getBinanceKlines(symbol, interval = '1h', limit = 120) {
  const raw = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=${interval}&limit=${limit}`);
  return JSON.parse(raw);
}

// ─── API Handlers ──────────────────────────────────────────────────────────────

const API = {};

// GET /api/market - Real-time market overview
API['/api/market'] = async (req, query) => {
  const symbols = (query.symbols || 'BTC,ETH,BNB,SOL,XRP,DOGE,ADA,AVAX').split(',');
  const results = [];
  for (const sym of symbols) {
    try {
      const data = await getBinance24hr(sym.trim());
      results.push({
        symbol: sym.trim(),
        price: parseFloat(data.lastPrice),
        change24h: parseFloat(data.priceChangePercent),
        high24h: parseFloat(data.highPrice),
        low24h: parseFloat(data.lowPrice),
        volume24h: parseFloat(data.quoteVolume),
        weightedAvg: parseFloat(data.weightedAvgPrice),
      });
    } catch (e) {
      results.push({ symbol: sym.trim(), error: e.message });
    }
  }
  return { data: results, timestamp: Date.now() };
};

// GET /api/fear-greed - Fear & Greed Index
API['/api/fear-greed'] = async () => {
  try {
    const raw = await fetch('https://api.alternative.me/fng/?limit=30');
    const json = JSON.parse(raw);
    if (!json.data || !json.data[0]) throw new Error('Invalid');
    const current = json.data[0];
    const value = parseInt(current.value);
    let sentiment, level;
    if (value <= 25) { sentiment = '极度恐慌'; level = 'extreme_fear'; }
    else if (value <= 45) { sentiment = '恐慌'; level = 'fear'; }
    else if (value <= 55) { sentiment = '中性'; level = 'neutral'; }
    else if (value <= 75) { sentiment = '贪婪'; level = 'greed'; }
    else { sentiment = '极度贪婪'; level = 'extreme_greed'; }

    let advice;
    if (value < 25) advice = '极度恐慌可能是买入机会，可考虑分批建仓';
    else if (value < 45) advice = '恐慌情绪，可适当布局优质资产';
    else if (value < 55) advice = '市场中性，观望为主';
    else if (value < 75) advice = '市场贪婪，注意风险控制';
    else advice = '极度贪婪，强烈建议部分止盈';

    return {
      value, sentiment, level, advice,
      timestamp: current.timestamp,
      history: json.data.slice(0, 30).map(d => ({ value: parseInt(d.value), timestamp: d.timestamp })),
    };
  } catch (e) {
    return { value: null, error: e.message };
  }
};

// POST /api/portfolio - Analyze portfolio
API['/api/portfolio'] = async (req, query, body) => {
  const portfolio = body.holdings || [
    { symbol: 'BTC', amount: 0.5, avgPrice: 70000 },
    { symbol: 'ETH', amount: 2.0, avgPrice: 2000 },
    { symbol: 'BNB', amount: 5.0, avgPrice: 600 },
    { symbol: 'SOL', amount: 10.0, avgPrice: 80 },
  ];

  let totalValue = 0, totalCost = 0;
  const holdings = [];

  for (const p of portfolio) {
    try {
      const price = await getBinancePrice(p.symbol);
      const value = p.amount * price;
      const cost = p.amount * p.avgPrice;
      const pnl = value - cost;
      const pnlPercent = cost > 0 ? ((value - cost) / cost) * 100 : 0;
      holdings.push({ ...p, price, value, cost, pnl, pnlPercent });
      totalValue += value;
      totalCost += cost;
    } catch (e) {
      holdings.push({ ...p, error: e.message });
    }
  }

  holdings.sort((a, b) => (b.value || 0) - (a.value || 0));

  const totalPnl = totalValue - totalCost;
  const totalPnlPercent = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;
  const btcHolding = holdings.find(h => h.symbol === 'BTC');
  const btcRatio = btcHolding && totalValue > 0 ? (btcHolding.value / totalValue) * 100 : 0;

  let advice;
  if (btcRatio > 70) advice = '建议适当分散持仓，降低BTC集中风险';
  else if (totalPnlPercent < -10) advice = '当前亏损较大，建议设置止损线';
  else if (totalPnlPercent > 30) advice = '盈利丰厚，可考虑分批止盈锁定收益';
  else advice = '组合健康，继续持有观望';

  return {
    holdings, totalValue, totalCost, totalPnl, totalPnlPercent,
    btcRatio, diversification: btcRatio > 50 ? '集中' : '分散', advice,
  };
};

// POST /api/risk - Position risk calculator
API['/api/risk'] = async (req, query, body) => {
  const { symbol = 'BTC', quantity = 0.5, entryPrice = 70000, leverage = 10 } = body;
  let currentPrice;
  try {
    currentPrice = await getBinancePrice(symbol);
  } catch {
    return { error: 'Failed to get current price' };
  }

  const currentValue = quantity * currentPrice;
  const entryValue = quantity * entryPrice;
  const pnlAmount = currentValue - entryValue;
  const initialMargin = entryValue / leverage;
  const pnlPercentage = (pnlAmount / initialMargin) * 100;
  const liquidationPrice = entryPrice - (initialMargin / quantity);
  let liquidationDistance = currentPrice > liquidationPrice
    ? ((currentPrice - liquidationPrice) / currentPrice) * 100 : 0;

  let riskRating;
  if (liquidationDistance <= 0) riskRating = 'liquidated';
  else if (liquidationDistance < 5) riskRating = 'danger';
  else if (liquidationDistance < 15) riskRating = 'warning';
  else riskRating = 'safe';

  return {
    symbol, quantity, entryPrice, currentPrice, leverage,
    currentValue, entryValue, pnlAmount, pnlPercentage,
    initialMargin, liquidationPrice, liquidationDistance, riskRating,
  };
};

// GET /api/sentiment - Comprehensive market sentiment
API['/api/sentiment'] = async () => {
  // Fear & Greed
  let fgValue = 50;
  try {
    const raw = await fetch('https://api.alternative.me/fng/');
    const j = JSON.parse(raw);
    if (j.data && j.data[0]) fgValue = parseInt(j.data[0].value);
  } catch {}

  // BTC trend
  let btcTrend = null, btcAvg = 0, btcPrice = 0;
  try {
    const raw = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=24');
    const klines = JSON.parse(raw);
    const closes = klines.map(k => parseFloat(k[4]));
    btcAvg = closes.reduce((a, b) => a + b, 0) / closes.length;
    btcPrice = closes[closes.length - 1];
    btcTrend = btcPrice > btcAvg ? 'up' : 'down';
  } catch {}

  // Composite analysis
  let signal, analysis;
  if (fgValue < 30 && btcTrend === 'down') {
    signal = 'buy'; analysis = '极度恐慌+下跌 = 可能是分批买入机会';
  } else if (fgValue > 70 && btcTrend === 'up') {
    signal = 'sell'; analysis = '极度贪婪+上涨 = 注意风险，可考虑部分止盈';
  } else if (fgValue >= 40 && fgValue <= 60) {
    signal = 'hold'; analysis = '市场中性，观望为主';
  } else {
    signal = 'hold'; analysis = '当前市场方向不明朗，建议轻仓观望';
  }

  return { fearGreed: fgValue, btcTrend, btcAvg, btcPrice, signal, analysis };
};

// GET /api/correlation - Market correlation analysis
API['/api/correlation'] = async (req, query) => {
  const symbols = (query.symbols || 'BTC,ETH,SOL,BNB,XRP').split(',').map(s => s.trim());
  const limit = parseInt(query.limit) || 120;

  function calcReturns(series) {
    const out = [];
    for (let i = 1; i < series.length; i++) {
      if (series[i - 1] > 0) out.push((series[i] - series[i - 1]) / series[i - 1]);
    }
    return out;
  }

  function pearson(x, y) {
    const n = Math.min(x.length, y.length);
    if (n < 3) return NaN;
    let sx = 0, sy = 0, sxy = 0, sx2 = 0, sy2 = 0;
    for (let i = 0; i < n; i++) {
      sx += x[i]; sy += y[i]; sxy += x[i] * y[i];
      sx2 += x[i] * x[i]; sy2 += y[i] * y[i];
    }
    const d = Math.sqrt((n * sx2 - sx * sx) * (n * sy2 - sy * sy));
    return d === 0 ? NaN : (n * sxy - sx * sy) / d;
  }

  const priceMap = {};
  for (const sym of symbols) {
    try {
      const klines = await getBinanceKlines(sym, '1h', limit);
      priceMap[sym] = klines.map(k => parseFloat(k[4]));
    } catch {}
  }

  if (!priceMap.BTC) return { error: 'BTC data unavailable' };
  const btcRet = calcReturns(priceMap.BTC);

  const correlations = [];
  for (const sym of symbols) {
    if (sym === 'BTC' || !priceMap[sym]) continue;
    const r = pearson(btcRet, calcReturns(priceMap[sym]));
    let level;
    if (r >= 0.8) level = 'very_high';
    else if (r >= 0.5) level = 'high';
    else if (r >= 0.2) level = 'moderate';
    else if (r > -0.2) level = 'low';
    else level = 'negative';

    correlations.push({ symbol: sym, correlation: isNaN(r) ? null : parseFloat(r.toFixed(4)), level });
  }

  correlations.sort((a, b) => (b.correlation || -999) - (a.correlation || -999));
  return { base: 'BTC', interval: '1h', samples: limit, correlations };
};

// POST /api/dca - DCA Calculator
API['/api/dca'] = async (req, query, body) => {
  const { symbol = 'BTC', monthlyAmount = 100, months = 12 } = body;
  let currentPrice;
  try {
    currentPrice = await getBinancePrice(symbol);
  } catch {
    return { error: 'Failed to get price' };
  }

  const totalInvested = monthlyAmount * months;
  const totalCoins = (monthlyAmount / currentPrice) * months;
  const currentValue = totalCoins * currentPrice;

  return {
    symbol, monthlyAmount, months, currentPrice,
    totalInvested, totalCoins, currentValue,
    profit: currentValue - totalInvested,
    profitPercent: ((currentValue / totalInvested - 1) * 100),
  };
};

// GET /api/klines - K-line data for charts
API['/api/klines'] = async (req, query) => {
  const symbol = query.symbol || 'BTC';
  const interval = query.interval || '1h';
  const limit = parseInt(query.limit) || 100;

  const klines = await getBinanceKlines(symbol, interval, limit);
  return {
    symbol, interval,
    data: klines.map(k => ({
      time: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    })),
  };
};

// POST /api/ai-chat - AI analysis chat
API['/api/ai-chat'] = async (req, query, body) => {
  const { message } = body;
  if (!message) return { error: 'Message required' };

  // Gather market context for AI-like response
  let context = {};
  try {
    const btcData = await getBinance24hr('BTC');
    context.btcPrice = parseFloat(btcData.lastPrice);
    context.btcChange = parseFloat(btcData.priceChangePercent);
  } catch {}

  try {
    const fgRaw = await fetch('https://api.alternative.me/fng/');
    const fgJson = JSON.parse(fgRaw);
    context.fearGreed = parseInt(fgJson.data[0].value);
  } catch {}

  // Generate intelligent response based on context and question
  const response = generateAIResponse(message, context);
  return { reply: response, context, timestamp: Date.now() };
};

function generateAIResponse(message, ctx) {
  const msg = message.toLowerCase();
  const btcStr = ctx.btcPrice ? `$${ctx.btcPrice.toLocaleString()}` : '未知';
  const changeStr = ctx.btcChange ? `${ctx.btcChange >= 0 ? '+' : ''}${ctx.btcChange.toFixed(2)}%` : '';
  const fgStr = ctx.fearGreed || '未知';

  let fgSentiment = '';
  if (ctx.fearGreed) {
    if (ctx.fearGreed <= 25) fgSentiment = '极度恐慌';
    else if (ctx.fearGreed <= 45) fgSentiment = '恐慌';
    else if (ctx.fearGreed <= 55) fgSentiment = '中性';
    else if (ctx.fearGreed <= 75) fgSentiment = '贪婪';
    else fgSentiment = '极度贪婪';
  }

  if (msg.includes('btc') || msg.includes('比特币') || msg.includes('bitcoin')) {
    return `当前BTC价格为 ${btcStr}，24小时涨跌幅 ${changeStr}。\n\n市场恐慌指数为 ${fgStr}/100（${fgSentiment}）。\n\n分析建议：${getAdvice(ctx)}`;
  }

  if (msg.includes('买') || msg.includes('buy') || msg.includes('入场')) {
    return `当前市场恐慌指数为 ${fgStr}/100（${fgSentiment}），BTC价格 ${btcStr}。\n\n${getBuyAdvice(ctx)}\n\n风险提示：以上仅为参考分析，不构成投资建议。请根据自身风险承受能力做出决策。`;
  }

  if (msg.includes('卖') || msg.includes('sell') || msg.includes('止盈') || msg.includes('出场')) {
    return `当前BTC价格 ${btcStr}（${changeStr}），恐慌指数 ${fgStr}。\n\n${getSellAdvice(ctx)}\n\n风险提示：请设置好止损止盈，避免贪心。`;
  }

  if (msg.includes('风险') || msg.includes('risk')) {
    return `当前市场风险评估：\n\n1. 恐慌指数：${fgStr}/100（${fgSentiment}）\n2. BTC 24h变化：${changeStr}\n3. 建议：${getAdvice(ctx)}\n\n风险管理要点：\n- 永远不要投入超过你能承受损失的资金\n- 分散投资，不要把所有资金放在一个币种\n- 设置止损线，严格执行\n- 避免使用高杠杆`;
  }

  if (msg.includes('行情') || msg.includes('market') || msg.includes('市场')) {
    return `市场概览：\n\nBTC价格：${btcStr}（${changeStr}）\n恐慌指数：${fgStr}/100（${fgSentiment}）\n\n${getAdvice(ctx)}\n\n建议关注以下指标：\n1. 交易量变化\n2. 主力资金流向\n3. 重要支撑位和阻力位`;
  }

  return `感谢你的提问！\n\n当前市场数据：\n- BTC价格：${btcStr}（${changeStr}）\n- 恐慌指数：${fgStr}/100（${fgSentiment}）\n\n${getAdvice(ctx)}\n\n如需更详细分析，请尝试询问：\n- "BTC现在该买吗？"\n- "当前市场风险如何？"\n- "帮我分析一下行情"`;
}

function getAdvice(ctx) {
  if (!ctx.fearGreed) return '暂无法获取完整数据，建议观望。';
  if (ctx.fearGreed < 25) return '市场极度恐慌，历史上这往往是较好的买入时机。建议分批建仓，不要一次性投入。';
  if (ctx.fearGreed < 45) return '市场偏恐慌，可以适当布局优质资产，但需控制仓位。';
  if (ctx.fearGreed < 55) return '市场情绪中性，建议保持现有仓位，观望为主。';
  if (ctx.fearGreed < 75) return '市场偏贪婪，注意控制风险，可以考虑适当减仓。';
  return '市场极度贪婪，高度警惕回调风险。建议部分止盈，锁定收益。';
}

function getBuyAdvice(ctx) {
  if (!ctx.fearGreed) return '数据不足，建议谨慎操作。';
  if (ctx.fearGreed < 30) return '当前恐慌指数较低，从逆向投资角度来看可能是布局的时机。建议：\n1. 分3-5批建仓\n2. 每次投入总资金的10-20%\n3. 设置好止损位\n4. 优先选择BTC、ETH等主流币';
  if (ctx.fearGreed < 50) return '市场情绪偏谨慎，可以小仓位试探。建议总投入不超过可投资资金的30%。';
  return '当前市场情绪偏贪婪，不建议大幅加仓。如果一定要买入，建议仅小比例配置，等待回调机会。';
}

function getSellAdvice(ctx) {
  if (!ctx.fearGreed) return '数据不足，建议结合自身盈亏情况决定。';
  if (ctx.fearGreed > 75) return '市场极度贪婪，建议适当止盈：\n1. 可卖出30-50%持仓锁定利润\n2. 剩余部分设置移动止损\n3. 不要一次性全部卖出';
  if (ctx.fearGreed > 55) return '市场偏贪婪，可以考虑分批止盈。建议先卖出20-30%锁定部分利润。';
  return '当前市场情绪偏中性或恐慌，除非有止损需要，否则不建议急于卖出。';
}

// ─── Server ────────────────────────────────────────────────────────────────────

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function parseBody(req) {
  return new Promise((resolve) => {
    if (req.method !== 'POST' && req.method !== 'PUT') return resolve({});
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const query = parsed.query || {};

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // API routes
  if (pathname.startsWith('/api/')) {
    const handler = API[pathname];
    if (handler) {
      try {
        const body = await parseBody(req);
        const result = await handler(req, query, body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
    return;
  }

  // Static files
  let filePath = pathname === '/' ? '/dashboard.html' : pathname;
  filePath = path.join(__dirname, filePath);

  try {
    const data = fs.readFileSync(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'text/plain' });
    res.end(data);
  } catch {
    // Fallback to dashboard
    try {
      const data = fs.readFileSync(path.join(__dirname, 'dashboard.html'));
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  }
});

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║   AlphaMind Lite - AI Trading Partner             ║
║   Server running at http://localhost:${PORT}         ║
╚═══════════════════════════════════════════════════╝

API Endpoints:
  GET  /api/market?symbols=BTC,ETH      Market overview
  GET  /api/fear-greed                   Fear & Greed Index
  GET  /api/sentiment                    Market sentiment
  GET  /api/correlation?symbols=BTC,ETH  Correlation analysis
  GET  /api/klines?symbol=BTC            K-line chart data
  POST /api/portfolio                    Portfolio analysis
  POST /api/risk                         Position risk
  POST /api/dca                          DCA calculator
  POST /api/ai-chat                      AI chat

Dashboard: http://localhost:${PORT}
  `);
});
