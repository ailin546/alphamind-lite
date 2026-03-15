#!/usr/bin/env node
/**
 * AlphaMind Lite - Trading Routes
 * Risk calculator, DCA simulator, paper trading, latest prices
 * Zero dependencies - pure Node.js
 */

const { fetchMarketData } = require('./api-client');
const { sendJSON, readBody } = require('./middleware');
const { isValidSymbol } = require('./utils');
const DEMO_DATA = require('./demo-data');
const db = require('./db');

async function handleRisk(req, res) {
  try {
    const { symbol, quantity, entryPrice, leverage } = await readBody(req);
    if (!symbol || !quantity || !entryPrice || !leverage) return sendJSON(res, 400, { error: 'Missing required fields' });
    if (!isValidSymbol(symbol)) return sendJSON(res, 400, { error: 'Invalid symbol' });
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

async function handleDCA(req, res) {
  try {
    const { symbol, monthlyAmount, months } = await readBody(req);
    if (!symbol || !monthlyAmount || !months) return sendJSON(res, 400, { error: 'Missing required fields' });
    if (!isValidSymbol(symbol)) return sendJSON(res, 400, { error: 'Invalid symbol' });
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

async function handlePaperTrade(req, res) {
  try {
    const { symbol, side, quantity } = await readBody(req);
    if (!symbol || !side || !quantity) return sendJSON(res, 400, { error: 'symbol, side, quantity required' });
    if (!isValidSymbol(symbol)) return sendJSON(res, 400, { error: 'Invalid symbol' });
    if (!['buy', 'sell'].includes(side)) return sendJSON(res, 400, { error: 'side must be buy or sell' });
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) return sendJSON(res, 400, { error: 'Invalid quantity' });

    const marketData = await fetchMarketData(`${symbol.toUpperCase()}USDT`);
    const price = parseFloat(marketData.lastPrice);

    const result = db.addPaperTrade(symbol.toUpperCase(), side, qty, price);
    if (!result) return sendJSON(res, 400, { error: 'Insufficient paper balance' });

    sendJSON(res, 200, { ok: true, ...result });
  } catch (err) {
    sendJSON(res, 400, { error: 'Paper trade failed: ' + err.message });
  }
}

function handlePaperTradeHistory(req, res) {
  const trades = db.getPaperTrades();
  const balance = db.getPaperBalance();
  sendJSON(res, 200, { ok: true, trades: trades.slice(-50), balance, totalTrades: trades.length });
}

async function handlePaperTradeReset(req, res) {
  const result = db.resetPaperTrading();
  sendJSON(res, 200, { ok: true, ...result, message: 'Paper trading reset to $10,000' });
}

// Latest prices from SSE broadcast cache
let _lastPrices = {};

function setLastPrices(prices) {
  _lastPrices = prices;
}

function getLastPrices() {
  return _lastPrices;
}

function handleLatestPrices(req, res) {
  if (Object.keys(_lastPrices).length === 0) {
    sendJSON(res, 200, { ok: true, degraded: true, source: 'demo', prices: DEMO_DATA.prices });
  } else {
    sendJSON(res, 200, { ok: true, degraded: false, source: 'live', prices: _lastPrices });
  }
}

module.exports = {
  handleRisk,
  handleDCA,
  handlePaperTrade,
  handlePaperTradeHistory,
  handlePaperTradeReset,
  handleLatestPrices,
  setLastPrices,
  getLastPrices,
};
