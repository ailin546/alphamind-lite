#!/usr/bin/env node
/**
 * AlphaMind Lite - AI Chat Routes
 * Context-aware crypto analysis engine with conversation memory
 * Zero dependencies - pure Node.js
 */

const https = require('https');
const { fetchMarketData, fetchFearGreedIndex, fetchKlines, calculateIndicators } = require('./api-client');
const { sendJSON, readBody, getCached } = require('./middleware');
const { fmtPrice, fmtPct } = require('./utils');
const DEMO_DATA = require('./demo-data');
const db = require('./db');

let config;
try {
  config = require('../config/config');
} catch {
  config = { apis: { llm: { provider: '', timeout: 15000 } } };
}

// Conversation memory per session (cleared on restart)
const chatSessions = new Map();
const MAX_CHAT_SESSIONS = 1000;

/**
 * Build a system prompt with all live market data context
 */
function buildSystemPrompt(ctx, portfolio, zh) {
  const b = ctx.btc;
  const ind = ctx.indicators;
  const fg = ctx.fg;

  let prompt = zh
    ? `你是 AlphaMind AI 加密货币分析助手。请用中文回答，基于以下实时市场数据提供专业分析。\n\n`
    : `You are AlphaMind AI, a crypto analysis assistant. Provide professional analysis based on the following live market data.\n\n`;

  prompt += `=== Live Market Data ===\n`;
  prompt += `BTC: $${b.price} (24h: ${b.change > 0 ? '+' : ''}${b.change.toFixed(2)}%, High: $${b.high}, Low: $${b.low})\n`;
  prompt += `ETH: $${ctx.eth.price} (24h: ${ctx.eth.change > 0 ? '+' : ''}${ctx.eth.change.toFixed(2)}%)\n`;
  prompt += `BNB: $${ctx.bnb.price} (24h: ${ctx.bnb.change > 0 ? '+' : ''}${ctx.bnb.change.toFixed(2)}%)\n`;
  prompt += `SOL: $${ctx.sol.price} (24h: ${ctx.sol.change > 0 ? '+' : ''}${ctx.sol.change.toFixed(2)}%)\n`;

  if (fg) {
    prompt += `Fear & Greed Index: ${fg.value}/100 (${fg.label})\n`;
  }

  if (ind) {
    prompt += `\n=== BTC Technical Indicators (4H) ===\n`;
    prompt += `RSI(14): ${ind.rsi || 'N/A'}\n`;
    prompt += `Signal: ${(ind.signal || 'hold').toUpperCase()} (Strength: ${ind.strength || 'N/A'})\n`;
    if (ind.macd) prompt += `MACD Histogram: ${ind.macd.histogram}\n`;
    if (ind.bollinger) prompt += `Bollinger Bands: $${ind.bollinger.lower} - $${ind.bollinger.upper} (Mid: $${ind.bollinger.middle})\n`;
    if (ind.sma) prompt += `SMA7: ${ind.sma.sma7 || 'N/A'}, SMA25: ${ind.sma.sma25 || 'N/A'}\n`;
    if (ind.volume) prompt += `Volume Trend: ${ind.volume.trend || 'normal'}\n`;
  }

  if (portfolio && portfolio.length > 0) {
    prompt += `\n=== User Portfolio ===\n`;
    portfolio.forEach(h => {
      const livePrice = ctx[h.symbol.toLowerCase()]?.price;
      if (livePrice) {
        const pnl = ((livePrice - h.avgPrice) / h.avgPrice * 100).toFixed(1);
        prompt += `${h.symbol}: ${h.amount} units @ $${h.avgPrice} (current: $${livePrice}, PnL: ${pnl}%)\n`;
      }
    });
  }

  // Include whale tracking data if available
  var whaleCache = getCached('whale');
  if (whaleCache) {
    prompt += zh ? `\n=== 巨鲸追踪数据 ===\n` : `\n=== Whale Tracking Data ===\n`;
    var ws = whaleCache.summary;
    prompt += zh
      ? `大额交易: ${ws.tradeCount}笔 | 买入量: $${(ws.buyVolume/1e6).toFixed(1)}M | 卖出量: $${(ws.sellVolume/1e6).toFixed(1)}M | 买卖比: ${ws.buyRatio.toFixed(0)}%/${ws.sellRatio.toFixed(0)}%\n`
      : `Large trades: ${ws.tradeCount} | Buy vol: $${(ws.buyVolume/1e6).toFixed(1)}M | Sell vol: $${(ws.sellVolume/1e6).toFixed(1)}M | Buy ratio: ${ws.buyRatio.toFixed(0)}%\n`;
    prompt += zh
      ? `巨鲸情绪: ${ws.sentiment === 'bullish' ? '看涨' : ws.sentiment === 'bearish' ? '看跌' : '中性'} (评分: ${ws.sentimentScore}) | 资金流向: ${ws.accumulationDistribution === 'accumulation' ? '吸筹' : ws.accumulationDistribution === 'distribution' ? '派发' : '中性'}\n`
      : `Whale sentiment: ${ws.sentiment} (score: ${ws.sentimentScore}) | Flow: ${ws.accumulationDistribution}\n`;
    if (whaleCache.liquidations && whaleCache.liquidations.summary) {
      var ls = whaleCache.liquidations.summary;
      prompt += zh
        ? `爆仓: ${ls.totalCount}笔 | 多单爆仓: $${(ls.longLiqVolume/1e6).toFixed(2)}M | 空单爆仓: $${(ls.shortLiqVolume/1e6).toFixed(2)}M\n`
        : `Liquidations: ${ls.totalCount} | Long liq: $${(ls.longLiqVolume/1e6).toFixed(2)}M | Short liq: $${(ls.shortLiqVolume/1e6).toFixed(2)}M\n`;
    }
    if (whaleCache.orderBook && whaleCache.orderBook.btc) {
      var ob = whaleCache.orderBook.btc;
      prompt += zh
        ? `BTC盘口: 买盘/卖盘不平衡 ${ob.imbalance.toFixed(2)} (${ob.imbalanceSignal === 'strong_buy' ? '强买入' : ob.imbalanceSignal === 'buy' ? '买入' : ob.imbalanceSignal === 'strong_sell' ? '强卖出' : ob.imbalanceSignal === 'sell' ? '卖出' : '中性'})\n`
        : `BTC order book: bid/ask imbalance ${ob.imbalance.toFixed(2)} (${ob.imbalanceSignal})\n`;
    }
  }

  // Include arbitrage data if available
  var arbCache = getCached('arbitrage');
  if (arbCache && arbCache.marketSummary) {
    prompt += zh ? `\n=== 套利扫描数据 ===\n` : `\n=== Arbitrage Scanner Data ===\n`;
    var ms = arbCache.marketSummary;
    prompt += zh
      ? `平均基差: ${ms.avgBasis.toFixed(4)}% | 平均资金费率: ${ms.avgFundingRate.toFixed(4)}% | 基差机会: ${ms.basisOppsCount}个 | 资金费率机会: ${ms.fundingOppsCount}个\n`
      : `Avg basis: ${ms.avgBasis.toFixed(4)}% | Avg funding: ${ms.avgFundingRate.toFixed(4)}% | Basis opps: ${ms.basisOppsCount} | Funding opps: ${ms.fundingOppsCount}\n`;
    if (ms.bestOpportunity) {
      prompt += zh
        ? `最佳机会: ${ms.bestOpportunity.symbol} (评级: ${ms.bestOpportunity.grade}, 收益风险比: ${ms.bestOpportunity.ratio})\n`
        : `Best opportunity: ${ms.bestOpportunity.symbol} (grade: ${ms.bestOpportunity.grade}, ratio: ${ms.bestOpportunity.ratio})\n`;
    }
    if (ms.profitableAfterFeesCount > 0) {
      prompt += zh
        ? `扣费后仍盈利: ${ms.profitableAfterFeesCount}个机会\n`
        : `Profitable after fees: ${ms.profitableAfterFeesCount} opportunities\n`;
    }
    // Top basis opportunities
    if (arbCache.opportunities && arbCache.opportunities.basis && arbCache.opportunities.basis.length > 0) {
      prompt += zh ? `主要基差机会: ` : `Top basis opps: `;
      var topBasis = arbCache.opportunities.basis.slice(0, 3);
      prompt += topBasis.map(function(b) { return b.symbol + ' ' + b.basis.toFixed(3) + '%'; }).join(', ') + '\n';
    }
  }

  // Include funding rate data if available
  var fundingCache = getCached('funding-rate');
  if (fundingCache && fundingCache.marketSentiment) {
    var fms = fundingCache.marketSentiment;
    prompt += zh
      ? `资金费率情绪: ${fms.sentiment === 'bullish' ? '看涨' : fms.sentiment === 'bearish' ? '看跌' : '中性'} (正费率: ${fms.positiveCount}, 负费率: ${fms.negativeCount})\n`
      : `Funding sentiment: ${fms.sentiment} (positive: ${fms.positiveCount}, negative: ${fms.negativeCount})\n`;
  }

  prompt += zh
    ? `\n请根据以上数据回答用户问题。提供具体数字和分析，给出可操作的建议。使用emoji增强可读性。保持简洁但全面。如果用户问到巨鲸动向、爆仓、套利或资金费率，请基于上面的实时数据回答。`
    : `\nAnswer the user's question using the data above. Include specific numbers and analysis. Give actionable advice. Use emoji for readability. Be concise but comprehensive. If the user asks about whale activity, liquidations, arbitrage, or funding rates, use the real-time data above.`;

  return prompt;
}

/**
 * Make an HTTPS POST request to an LLM API
 */
function llmPost(url, headers, body, timeout) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const postData = JSON.stringify(body);
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      timeout,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...headers,
      },
    };

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('Invalid JSON from LLM API')); }
        } else {
          reject(new Error(`LLM API error ${res.statusCode}: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('LLM API timeout')); });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Call a free LLM API (Gemini, Groq, or DeepSeek) with market context
 */
async function callLLM(userMessage, systemPrompt) {
  const llmCfg = config.apis?.llm || {};
  const provider = llmCfg.provider;
  const timeout = llmCfg.timeout || 15000;

  if (!provider) return null;

  if (provider === 'gemini' && llmCfg.geminiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${llmCfg.geminiKey}`;
    const body = {
      contents: [{ parts: [{ text: `${systemPrompt}\n\nUser: ${userMessage}` }] }],
      generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
    };
    const resp = await llmPost(url, {}, body, timeout);
    return resp?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  }

  if (provider === 'groq' && llmCfg.groqKey) {
    const url = 'https://api.groq.com/openai/v1/chat/completions';
    const body = {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 1024,
      temperature: 0.7,
    };
    const resp = await llmPost(url, { Authorization: `Bearer ${llmCfg.groqKey}` }, body, timeout);
    return resp?.choices?.[0]?.message?.content || null;
  }

  if (provider === 'deepseek' && llmCfg.deepseekKey) {
    const url = 'https://api.deepseek.com/chat/completions';
    const body = {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 1024,
      temperature: 0.7,
    };
    const resp = await llmPost(url, { Authorization: `Bearer ${llmCfg.deepseekKey}` }, body, timeout);
    return resp?.choices?.[0]?.message?.content || null;
  }

  return null;
}

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

    const portfolio = db.getPortfolio();
    const zh = detectChinese(message);

    // Try LLM first, fallback to rule-based analysis
    let reply;
    try {
      const systemPrompt = buildSystemPrompt(ctx, portfolio, zh);
      const llmReply = await callLLM(message, systemPrompt);
      if (llmReply) {
        // Prepend market snapshot header to LLM response
        const ind = ctx.indicators;
        const b = ctx.btc;
        const fg = ctx.fg;
        let headerExtra = '';
        if (ind) {
          headerExtra = ` | RSI: ${ind.rsi || 'N/A'} | ${zh ? '信号' : 'Signal'}: ${(ind.signal || 'hold').toUpperCase()}`;
        }
        const header = zh
          ? `📊 **市场快照** | BTC ${fmtPrice(b.price)} (${fmtPct(b.change)}) | ETH ${fmtPrice(ctx.eth.price)} (${fmtPct(ctx.eth.change)}) | 恐慌贪婪指数: ${fg ? `${fg.value}/100 (${fg.label})` : '暂无'}${headerExtra}\n\n`
          : `📊 **Market Snapshot** | BTC ${fmtPrice(b.price)} (${fmtPct(b.change)}) | ETH ${fmtPrice(ctx.eth.price)} (${fmtPct(ctx.eth.change)}) | Fear & Greed: ${fg ? `${fg.value}/100 (${fg.label})` : 'N/A'}${headerExtra}\n\n`;
        reply = header + llmReply;
      }
    } catch {
      // LLM failed, fall through to rule-based
    }

    if (!reply) {
      reply = generateAnalysis(msg, ctx, portfolio, session.history);
    }
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

function detectChinese(msg) {
  return /[\u4e00-\u9fff]/.test(msg);
}

function generateAnalysis(msg, ctx, portfolio, history) {
  const b = ctx.btc;
  const fg = ctx.fg;
  const ind = ctx.indicators;
  const zh = detectChinese(msg);

  // Live market summary header with technical indicators
  let headerExtra = '';
  if (ind) {
    headerExtra = ` | RSI: ${ind.rsi || 'N/A'} | ${zh ? '信号' : 'Signal'}: ${(ind.signal || 'hold').toUpperCase()}`;
  }
  const header = zh
    ? `📊 **市场快照** | BTC ${fmtPrice(b.price)} (${fmtPct(b.change)}) | ETH ${fmtPrice(ctx.eth.price)} (${fmtPct(ctx.eth.change)}) | 恐慌贪婪指数: ${fg ? `${fg.value}/100 (${fg.label})` : '暂无'}${headerExtra}\n\n`
    : `📊 **Market Snapshot** | BTC ${fmtPrice(b.price)} (${fmtPct(b.change)}) | ETH ${fmtPrice(ctx.eth.price)} (${fmtPct(ctx.eth.change)}) | Fear & Greed: ${fg ? `${fg.value}/100 (${fg.label})` : 'N/A'}${headerExtra}\n\n`;

  const intents = detectIntents(msg);
  let analysis = '';

  if (intents.includes('market_overview') || intents.includes('general')) {
    const range = ((b.high - b.low) / b.low * 100).toFixed(1);
    if (zh) {
      const trend = b.change > 3 ? '强势上涨' : b.change > 0 ? '小幅上涨' : b.change > -3 ? '小幅下跌' : '强势下跌';
      analysis += `**市场分析：**\n`;
      analysis += `• BTC 24h 趋势：${trend}，波动范围 ${range}%（${fmtPrice(b.low)} - ${fmtPrice(b.high)}）\n`;
      analysis += `• BNB: ${fmtPrice(ctx.bnb.price)} (${fmtPct(ctx.bnb.change)}) | SOL: ${fmtPrice(ctx.sol.price)} (${fmtPct(ctx.sol.change)})\n`;
      if (fg) {
        analysis += `• 市场情绪: ${fg.value <= 25 ? '🔴 极度恐慌 — 历史上常见的抄底信号，聪明资金正在积累。' : fg.value <= 45 ? '🟠 恐慌区间 — 长期持有者的潜在建仓机会。' : fg.value <= 55 ? '🟡 中性 — 市场方向不明，等待更清晰信号。' : fg.value <= 75 ? '🟢 贪婪区间 — 考虑部分止盈并收紧止损。' : '🔴 极度贪婪 — 回调风险较高，建议减仓。'}\n`;
      }
      if (ind) {
        analysis += `\n**技术指标 (4H)：**\n`;
        analysis += `• RSI(14): ${ind.rsi} ${ind.rsi < 30 ? '— 超卖 ✅' : ind.rsi > 70 ? '— 超买 ⚠️' : '— 中性'}\n`;
        if (ind.macd) analysis += `• MACD: ${ind.macd.histogram > 0 ? '看涨' : '看跌'} (柱状图: ${ind.macd.histogram})\n`;
        if (ind.bollinger) analysis += `• 布林带: ${fmtPrice(ind.bollinger.lower)} — ${fmtPrice(ind.bollinger.upper)} (中轨: ${fmtPrice(ind.bollinger.middle)})\n`;
        if (ind.sma.sma7 && ind.sma.sma25) analysis += `• SMA: ${ind.sma.sma7 > ind.sma.sma25 ? '7日 > 25日（金叉 ✅）' : '7日 < 25日（死叉 ⚠️）'}\n`;
        analysis += `• 成交量: ${ind.volume.trend === 'high' ? '📈 放量 — 趋势确认' : ind.volume.trend === 'low' ? '📉 缩量 — 信号较弱' : '📊 正常成交量'}\n`;
        analysis += `• 🎯 技术信号: **${ind.signal.toUpperCase()}** (强度: ${ind.strength})\n`;
      }
    } else {
      const trend = b.change > 3 ? 'strong bullish' : b.change > 0 ? 'mildly bullish' : b.change > -3 ? 'mildly bearish' : 'strong bearish';
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
  }

  if (intents.includes('buy_advice')) {
    const symbol = extractSymbol(msg);
    if (zh) {
      analysis += `\n**买入分析：**\n`;
      if (symbol && ctx[symbol.toLowerCase()]) {
        const coin = ctx[symbol.toLowerCase()];
        analysis += `• ${symbol.toUpperCase()} 当前价格 ${fmtPrice(coin.price)}（24h ${fmtPct(coin.change)}）\n`;
      }
      if (ind) {
        analysis += `• RSI: ${ind.rsi} ${ind.rsi < 30 ? '— 超卖（好的入场点）' : ind.rsi > 70 ? '— 超买（建议等回调）' : '— 中性区间'}\n`;
        analysis += `• 技术信号: ${ind.signal.toUpperCase()}（强度: ${ind.strength}）\n`;
      }
      if (fg && fg.value < 40) {
        analysis += `• 恐慌指数 ${fg.value}，市场悲观情绪浓厚 — 历史上利好买方\n`;
        analysis += `• 💡 策略: 建议分 3-5 次定投（DCA）买入\n`;
      } else if (fg && fg.value > 65) {
        analysis += `• 贪婪指数 ${fg.value} — 追高风险较大\n`;
        analysis += `• 💡 策略: 等待回调或用限价单在当前价格下方 3-5% 挂单\n`;
      } else {
        analysis += `• 💡 策略: 市场处于中性区间 — 定投最安全，设定预算分 3-5 次买入\n`;
      }
    } else {
      analysis += `\n**Buy/Entry Analysis:**\n`;
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
  }

  if (intents.includes('sell_advice')) {
    if (zh) {
      analysis += `\n**卖出分析：**\n`;
      if (fg && fg.value > 70) {
        analysis += `• 贪婪指数 ${fg.value} — 历史上聪明资金在此区间获利了结\n`;
        analysis += `• 💡 策略: 考虑卖出 20-30% 的仓位锁定利润\n`;
      } else {
        analysis += `• 市场尚未进入极度贪婪区间\n`;
        analysis += `• 💡 策略: 使用移动止损保护利润，同时留在趋势中\n`;
      }
    } else {
      analysis += `\n**Sell/Exit Analysis:**\n`;
      if (fg && fg.value > 70) {
        analysis += `• Greed index at ${fg.value} — this is historically where smart money takes profits\n`;
        analysis += `• 💡 Strategy: Consider selling 20-30% of position to lock in gains\n`;
      } else {
        analysis += `• Market is not in euphoria zone yet\n`;
        analysis += `• 💡 Strategy: Use trailing stop-losses to protect profits while staying in the trend\n`;
      }
    }
  }

  if (intents.includes('risk')) {
    if (zh) {
      analysis += `\n**风险评估：**\n`;
      analysis += `• BTC 24h 波动率: ${((b.high - b.low) / b.low * 100).toFixed(1)}%\n`;
      analysis += `• ${b.change < -5 ? '⚠️ 大幅下跌 — 高风险环境，建议降低杠杆。' : b.change > 5 ? '⚠️ 急速拉升 — 有回调风险，设置紧密止损。' : '✅ 波动在正常范围内。'}\n`;
      analysis += `• 💡 建议最大杠杆: ${Math.abs(b.change) > 5 ? '2-3倍' : Math.abs(b.change) > 3 ? '3-5倍' : '5-10倍（需设止损）'}\n`;
      analysis += `• 使用风控中心的杠杆计算器可以精确计算爆仓价格。\n`;
    } else {
      analysis += `\n**Risk Assessment:**\n`;
      analysis += `• BTC 24h volatility: ${((b.high - b.low) / b.low * 100).toFixed(1)}%\n`;
      analysis += `• ${b.change < -5 ? '⚠️ Significant drop — high risk environment. Reduce leverage.' : b.change > 5 ? '⚠️ Sharp rally — risk of reversal. Set tight stop-losses.' : '✅ Normal volatility range.'}\n`;
      analysis += `• 💡 Max recommended leverage: ${Math.abs(b.change) > 5 ? '2-3x' : Math.abs(b.change) > 3 ? '3-5x' : '5-10x (with stop-loss)'}\n`;
      analysis += `• Use our Risk Calculator to compute exact liquidation prices for your positions.\n`;
    }
  }

  if (intents.includes('dca')) {
    if (zh) {
      analysis += `\n**定投策略：**\n`;
      analysis += `• 当前入场价: BTC ${fmtPrice(b.price)}\n`;
      analysis += `• ${fg && fg.value < 40 ? '恐慌区间 — 极佳的定投时机，考虑加大投入。' : fg && fg.value > 65 ? '贪婪区间 — 减少定投金额或暂停等待回调。' : '中性区间 — 维持常规定投节奏。'}\n`;
      analysis += `• 💡 使用工具页面的定投计算器，模拟不同预算和周期的收益。\n`;
    } else {
      analysis += `\n**DCA Strategy:**\n`;
      analysis += `• Current entry price: BTC ${fmtPrice(b.price)}\n`;
      analysis += `• ${fg && fg.value < 40 ? 'Fear zone — excellent DCA entry timing. Consider larger allocations.' : fg && fg.value > 65 ? 'Greed zone — reduce DCA amount or pause until pullback.' : 'Neutral zone — maintain regular DCA schedule.'}\n`;
      analysis += `• 💡 Try our DCA Calculator tool to simulate returns based on your budget and timeline.\n`;
    }
  }

  if (intents.includes('portfolio') && portfolio.length > 0) {
    analysis += zh ? `\n**您的持仓（${portfolio.length} 个币种）：**\n` : `\n**Your Portfolio (${portfolio.length} holdings):**\n`;
    portfolio.forEach(h => {
      const livePrice = ctx[h.symbol.toLowerCase()]?.price;
      if (livePrice) {
        const pnl = ((livePrice - h.avgPrice) / h.avgPrice * 100).toFixed(1);
        analysis += `• ${h.symbol}: ${h.amount} ${zh ? '个' : 'units'} @ ${fmtPrice(h.avgPrice)} → ${zh ? '现价' : 'now'} ${fmtPrice(livePrice)} (${pnl >= 0 ? '+' : ''}${pnl}%)\n`;
      }
    });
  }

  if (intents.includes('whale')) {
    var whaleCache = getCached('whale');
    if (whaleCache && whaleCache.summary) {
      var ws = whaleCache.summary;
      if (zh) {
        analysis += `\n**🐋 巨鲸动向分析：**\n`;
        analysis += `• 最近大额交易: ${ws.tradeCount}笔（≥$50K: ${ws.tier100k}笔, ≥$500K: ${ws.tier500k}笔）\n`;
        analysis += `• 买入量: $${(ws.buyVolume/1e6).toFixed(1)}M | 卖出量: $${(ws.sellVolume/1e6).toFixed(1)}M\n`;
        analysis += `• 买卖比: 买${ws.buyRatio.toFixed(0)}% / 卖${ws.sellRatio.toFixed(0)}%\n`;
        analysis += `• 巨鲸情绪: ${ws.sentiment === 'bullish' ? '🟢 看涨' : ws.sentiment === 'bearish' ? '🔴 看跌' : '🟡 中性'}（评分: ${ws.sentimentScore}）\n`;
        analysis += `• 资金流向: ${ws.accumulationDistribution === 'accumulation' ? '📈 吸筹 — 大资金在买入，可能预示上涨' : ws.accumulationDistribution === 'distribution' ? '📉 派发 — 大资金在卖出，注意风险' : '📊 中性流向'}\n`;
        if (whaleCache.orderBook && whaleCache.orderBook.btc) {
          var ob = whaleCache.orderBook.btc;
          analysis += `• BTC盘口: 买卖不平衡 ${ob.imbalance.toFixed(2)} (${ob.imbalanceSignal === 'strong_buy' ? '强力买盘支撑' : ob.imbalanceSignal === 'buy' ? '偏买盘' : ob.imbalanceSignal === 'strong_sell' ? '强力卖压' : ob.imbalanceSignal === 'sell' ? '偏卖盘' : '均衡'})\n`;
        }
        analysis += `• 💡 建议: ${ws.sentiment === 'bullish' ? '巨鲸在买入，短期看涨，可考虑跟单或加仓。' : ws.sentiment === 'bearish' ? '巨鲸在卖出，短期谨慎，考虑降低仓位。' : '等待巨鲸方向明确后再做决策。'}\n`;
      } else {
        analysis += `\n**🐋 Whale Activity Analysis:**\n`;
        analysis += `• Recent large trades: ${ws.tradeCount} (≥$50K: ${ws.tier100k}, ≥$500K: ${ws.tier500k})\n`;
        analysis += `• Buy volume: $${(ws.buyVolume/1e6).toFixed(1)}M | Sell volume: $${(ws.sellVolume/1e6).toFixed(1)}M\n`;
        analysis += `• Buy/sell ratio: ${ws.buyRatio.toFixed(0)}% / ${ws.sellRatio.toFixed(0)}%\n`;
        analysis += `• Whale sentiment: ${ws.sentiment === 'bullish' ? '🟢 Bullish' : ws.sentiment === 'bearish' ? '🔴 Bearish' : '🟡 Neutral'} (score: ${ws.sentimentScore})\n`;
        analysis += `• Flow: ${ws.accumulationDistribution === 'accumulation' ? '📈 Accumulation — smart money buying' : ws.accumulationDistribution === 'distribution' ? '📉 Distribution — smart money selling' : '📊 Neutral'}\n`;
        analysis += `• 💡 Tip: ${ws.sentiment === 'bullish' ? 'Whales are accumulating — consider entries.' : ws.sentiment === 'bearish' ? 'Whales are distributing — exercise caution.' : 'Wait for clearer whale direction.'}\n`;
      }
    } else {
      analysis += zh ? `\n**🐋 巨鲸数据:** 暂无缓存数据，请先打开巨鲸追踪页面加载。\n` : `\n**🐋 Whale Data:** No cached data yet. Visit the Whale Tracker page first.\n`;
    }
  }

  if (intents.includes('liquidation')) {
    var whaleCache2 = getCached('whale');
    if (whaleCache2 && whaleCache2.liquidations) {
      var ls = whaleCache2.liquidations.summary;
      if (zh) {
        analysis += `\n**💥 爆仓数据分析：**\n`;
        analysis += `• 总爆仓: ${ls.totalCount}笔\n`;
        analysis += `• 多单爆仓: $${(ls.longLiqVolume/1e6).toFixed(2)}M (${ls.longLiqCount}笔)\n`;
        analysis += `• 空单爆仓: $${(ls.shortLiqVolume/1e6).toFixed(2)}M (${ls.shortLiqCount}笔)\n`;
        analysis += `• 主导方: ${ls.dominantSide === 'long_liq' ? '📉 多单爆仓为主 — 市场偏空' : '📈 空单爆仓为主 — 市场偏多'}\n`;
        analysis += `• 💡 建议: ${ls.longLiqVolume > ls.shortLiqVolume * 2 ? '大量多单被清算，短期恐慌可能带来抄底机会。' : ls.shortLiqVolume > ls.longLiqVolume * 2 ? '大量空单被清算，短期轧空行情可能延续。' : '多空爆仓相对均衡，市场在寻找方向。'}\n`;
      } else {
        analysis += `\n**💥 Liquidation Analysis:**\n`;
        analysis += `• Total: ${ls.totalCount} liquidations\n`;
        analysis += `• Long liq: $${(ls.longLiqVolume/1e6).toFixed(2)}M (${ls.longLiqCount})\n`;
        analysis += `• Short liq: $${(ls.shortLiqVolume/1e6).toFixed(2)}M (${ls.shortLiqCount})\n`;
        analysis += `• Dominant: ${ls.dominantSide === 'long_liq' ? 'Long liquidations — bearish pressure' : 'Short liquidations — bullish squeeze'}\n`;
      }
    } else {
      analysis += zh ? `\n**💥 爆仓数据:** 暂无数据，请先打开巨鲸追踪页面。\n` : `\n**💥 Liquidation Data:** Not loaded yet. Visit Whale Tracker page.\n`;
    }
  }

  if (intents.includes('arbitrage')) {
    var arbCache = getCached('arbitrage');
    if (arbCache && arbCache.marketSummary) {
      var ms = arbCache.marketSummary;
      if (zh) {
        analysis += `\n**📐 套利扫描分析：**\n`;
        analysis += `• 扫描币种: ${ms.coinsScanned}个\n`;
        analysis += `• 平均基差: ${ms.avgBasis.toFixed(4)}% | 平均资金费率: ${ms.avgFundingRate.toFixed(4)}%\n`;
        analysis += `• 基差机会: ${ms.basisOppsCount}个 | 资金费率机会: ${ms.fundingOppsCount}个\n`;
        analysis += `• 扣费后可盈利: ${ms.profitableAfterFeesCount}个机会\n`;
        if (ms.bestOpportunity) {
          analysis += `• 🎯 最佳机会: ${ms.bestOpportunity.symbol}（评级: ${ms.bestOpportunity.grade}, 收益风险比: ${ms.bestOpportunity.ratio}）\n`;
        }
        // Show top basis opportunities
        if (arbCache.opportunities && arbCache.opportunities.basis) {
          var topB = arbCache.opportunities.basis.slice(0, 3);
          if (topB.length > 0) {
            analysis += `• 主要基差:\n`;
            topB.forEach(function(b) {
              analysis += `  - ${b.symbol}: 基差 ${b.basis.toFixed(3)}% (${b.direction === 'premium' ? '溢价' : '折价'}) | 评级 ${b.grade}\n`;
            });
          }
        }
        analysis += `• 💡 建议: ${ms.profitableAfterFeesCount > 0 ? '有扣费后可盈利的套利机会，前往套利扫描页面查看详情。' : '当前基差较小，建议观望等待更好的机会。'}\n`;
      } else {
        analysis += `\n**📐 Arbitrage Scanner:**\n`;
        analysis += `• Coins scanned: ${ms.coinsScanned}\n`;
        analysis += `• Avg basis: ${ms.avgBasis.toFixed(4)}% | Avg funding: ${ms.avgFundingRate.toFixed(4)}%\n`;
        analysis += `• Basis opps: ${ms.basisOppsCount} | Funding opps: ${ms.fundingOppsCount}\n`;
        analysis += `• Profitable after fees: ${ms.profitableAfterFeesCount}\n`;
        if (ms.bestOpportunity) {
          analysis += `• 🎯 Best: ${ms.bestOpportunity.symbol} (grade: ${ms.bestOpportunity.grade}, ratio: ${ms.bestOpportunity.ratio})\n`;
        }
        analysis += `• 💡 Tip: ${ms.profitableAfterFeesCount > 0 ? 'Profitable opportunities available — check the Arbitrage Scanner.' : 'Basis spreads are thin — wait for better opportunities.'}\n`;
      }
    } else {
      analysis += zh ? `\n**📐 套利数据:** 暂无缓存数据，请先打开套利扫描页面。\n` : `\n**📐 Arbitrage Data:** Not loaded yet. Visit the Arbitrage Scanner.\n`;
    }
  }

  if (intents.includes('help')) {
    if (zh) {
      analysis += `\n**我可以帮您：**\n`;
      analysis += `• 📈 市场分析 — "现在行情怎么样？" "BTC 走势分析"\n`;
      analysis += `• 💰 买卖建议 — "该买BTC吗？" "现在要卖吗？"\n`;
      analysis += `• ⚠️ 风险评估 — "杠杆风险" "10倍安全吗？"\n`;
      analysis += `• 📊 定投规划 — "BTC定投策略"\n`;
      analysis += `• 🎯 持仓分析 — "分析我的持仓"\n`;
      analysis += `• 🐋 巨鲸追踪 — "巨鲸在买还是卖？" "大额交易分析"\n`;
      analysis += `• 📐 套利分析 — "有什么套利机会？" "基差分析"\n`;
      analysis += `• 💥 爆仓监控 — "最近爆仓情况" "多空清算"\n`;
      analysis += `• 支持中文和英文提问！\n`;
    } else {
      analysis += `\n**I can help with:**\n`;
      analysis += `• 📈 Market analysis — "How's the market?" "Should I buy BTC?"\n`;
      analysis += `• 💰 Trading advice — "Is it time to sell?" "Analyze ETH"\n`;
      analysis += `• ⚠️ Risk management — "Check my leverage risk" "Is 10x safe?"\n`;
      analysis += `• 📊 DCA planning — "How much should I DCA into BTC?"\n`;
      analysis += `• 🎯 Portfolio review — "Review my holdings"\n`;
      analysis += `• 🐋 Whale tracking — "What are whales doing?" "Large trades"\n`;
      analysis += `• 📐 Arbitrage — "Any arb opportunities?" "Basis analysis"\n`;
      analysis += `• 💥 Liquidations — "Recent liquidations" "Who got rekt?"\n`;
      analysis += `• Ask in English or 中文!\n`;
    }
  }

  if (!analysis) {
    if (zh) {
      analysis = `很高兴为您提供加密货币分析。当前市场情况：\n`;
      analysis += `• BTC 24h ${b.change > 0 ? '上涨' : '下跌'} ${Math.abs(b.change).toFixed(1)}%\n`;
      analysis += `• ${fg ? `市场情绪: ${fg.label}（${fg.value}/100）` : '情绪数据暂不可用'}\n`;
      analysis += `\n您可以问我具体币种、买卖时机、风险管理或定投策略！`;
    } else {
      analysis = `I'd be happy to help with your crypto analysis. Based on the current market:\n`;
      analysis += `• BTC is ${b.change > 0 ? 'up' : 'down'} ${Math.abs(b.change).toFixed(1)}% in 24h\n`;
      analysis += `• ${fg ? `Market sentiment: ${fg.label} (${fg.value}/100)` : 'Sentiment data unavailable'}\n`;
      analysis += `\nAsk me about specific coins, buy/sell timing, risk management, or DCA strategy!`;
    }
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
  if (/whale|巨鲸|大单|大额|鲸鱼|聪明钱|smart money|accumul|吸筹|派发/i.test(msg)) intents.push('whale');
  if (/arb|套利|基差|funding|资金费率|cash.carry|对冲|hedge|期现/i.test(msg)) intents.push('arbitrage');
  if (/liquidat|爆仓|清算|强平|清仓/i.test(msg)) intents.push('liquidation');
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

module.exports = { handleAIChat, detectIntents, extractSymbol };
