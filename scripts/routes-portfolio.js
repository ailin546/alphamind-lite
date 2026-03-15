#!/usr/bin/env node
/**
 * AlphaMind Lite - Portfolio & Alert Routes
 * Portfolio CRUD, alerts, funding rates
 * Zero dependencies - pure Node.js
 */

const { getLogger } = require('./logger');
const { fetchMultiplePrices, fetchFundingRates } = require('./api-client');
const { sendJSON, readBody, metrics } = require('./middleware');
const { isValidSymbol } = require('./utils');
const db = require('./db');

const log = getLogger('portfolio');

async function handlePortfolio(req, res) {
  try {
    let portfolioData;

    if (req.method === 'POST') {
      const body = await readBody(req);
      portfolioData = body.holdings || [];
    } else {
      portfolioData = db.getPortfolio();
    }

    if (portfolioData.length === 0) {
      return sendJSON(res, 200, { ok: true, holdings: [], totalValue: 0, totalCost: 0, totalPnl: 0, totalPnlPercent: 0 });
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

async function handlePortfolioAdd(req, res) {
  try {
    const { symbol, amount, avgPrice } = await readBody(req);
    if (!symbol || typeof symbol !== 'string' || !isValidSymbol(symbol)) return sendJSON(res, 400, { error: 'Invalid symbol' });
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
    if (!symbol || !isValidSymbol(symbol)) return sendJSON(res, 400, { error: 'Invalid symbol' });
    const result = db.removeHolding(symbol.toUpperCase());
    if (!result) return sendJSON(res, 404, { error: `${symbol.toUpperCase()} not found` });
    sendJSON(res, 200, { ok: true, message: `Removed ${symbol.toUpperCase()}` });
  } catch (err) {
    sendJSON(res, 400, { error: err.message });
  }
}

function handleAlerts(req, res) {
  const alerts = db.getAlerts();
  sendJSON(res, 200, { alerts });
}

async function handleAlertAdd(req, res) {
  try {
    const { symbol, price, direction } = await readBody(req);
    if (!symbol || typeof symbol !== 'string' || !isValidSymbol(symbol)) return sendJSON(res, 400, { error: 'Invalid symbol' });
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

module.exports = {
  handlePortfolio,
  handlePortfolioAdd,
  handlePortfolioRemove,
  handleAlerts,
  handleAlertAdd,
  handleAlertRemove,
  handleFunding,
};
