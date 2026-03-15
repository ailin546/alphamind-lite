#!/usr/bin/env node
/**
 * AlphaMind Lite - AI Chat Routes
 * Context-aware crypto analysis engine with conversation memory
 * Zero dependencies - pure Node.js
 */

const { fetchMarketData, fetchFearGreedIndex, fetchKlines, calculateIndicators } = require('./api-client');
const { sendJSON, readBody } = require('./middleware');
const { fmtPrice, fmtPct } = require('./utils');
const DEMO_DATA = require('./demo-data');
const db = require('./db');

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

    const portfolio = db.getPortfolio();
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
  const ind = ctx.indicators;

  // Live market summary header with technical indicators
  let headerExtra = '';
  if (ind) {
    headerExtra = ` | RSI: ${ind.rsi || 'N/A'} | Signal: ${(ind.signal || 'hold').toUpperCase()}`;
  }
  const header = `📊 **Market Snapshot** | BTC ${fmtPrice(b.price)} (${fmtPct(b.change)}) | ETH ${fmtPrice(ctx.eth.price)} (${fmtPct(ctx.eth.change)}) | Fear & Greed: ${fg ? `${fg.value}/100 (${fg.label})` : 'N/A'}${headerExtra}\n\n`;

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

module.exports = { handleAIChat, detectIntents, extractSymbol };
