#!/usr/bin/env node
/**
 * AlphaMind Lite - JSON File Persistence Layer
 * 轻量级数据持久化（零依赖，基于 JSON 文件）
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'alphamind.json');

// Default schema
const DEFAULT_DATA = {
  portfolio: [],
  alerts: [],
  watchlist: ['BTC', 'ETH', 'BNB', 'SOL'],
  dcaPlans: [],
  paperTrades: [],
  paperBalance: 10000, // Start with $10,000 USDT
  priceHistory: {},
  settings: {
    currency: 'USDT',
    telegram: { enabled: false, botToken: '', chatId: '' },
  },
  _meta: { version: 1, created: null, updated: null },
};

let _cache = null;
let _dirEnsured = false;

function ensureDir() {
  if (_dirEnsured) return;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
  _dirEnsured = true;
}

function load() {
  if (_cache) return _cache;
  ensureDir();
  try {
    _cache = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    return _cache;
  } catch (err) {
    if (err.code !== 'ENOENT') {
      // Corrupted file, backup and reset
      try {
        const backup = DB_FILE + '.bak.' + Date.now();
        fs.copyFileSync(DB_FILE, backup);
        console.error(`[db] Corrupted data file, backed up to ${backup}`);
      } catch {}
    }
  }
  _cache = { ...DEFAULT_DATA, _meta: { ...DEFAULT_DATA._meta, created: new Date().toISOString() } };
  save();
  return _cache;
}

function save() {
  if (!_cache) return;
  ensureDir();
  _cache._meta.updated = new Date().toISOString();
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(_cache, null, 2), 'utf8');
  fs.renameSync(tmp, DB_FILE); // atomic write
}

// ---- Portfolio ----
function getPortfolio() {
  return load().portfolio.map(p => ({ ...p })); // return copies
}

function addHolding(symbol, amount, avgPrice) {
  const db = load();
  const existing = db.portfolio.find(p => p.symbol === symbol.toUpperCase());
  if (existing) {
    const totalCost = existing.amount * existing.avgPrice + amount * avgPrice;
    existing.amount += amount;
    existing.avgPrice = totalCost / existing.amount;
    existing.updatedAt = new Date().toISOString();
  } else {
    db.portfolio.push({
      symbol: symbol.toUpperCase(),
      amount,
      avgPrice,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  save();
  return db.portfolio;
}

function removeHolding(symbol) {
  const db = load();
  const before = db.portfolio.length;
  db.portfolio = db.portfolio.filter(p => p.symbol !== symbol.toUpperCase());
  if (db.portfolio.length === before) return false;
  save();
  return db.portfolio;
}

function updateHolding(symbol, amount, avgPrice) {
  const db = load();
  const holding = db.portfolio.find(p => p.symbol === symbol.toUpperCase());
  if (!holding) return null;
  if (amount !== undefined) holding.amount = amount;
  if (avgPrice !== undefined) holding.avgPrice = avgPrice;
  holding.updatedAt = new Date().toISOString();
  save();
  return holding;
}

// ---- Alerts ----
function getAlerts() {
  return load().alerts.map(a => ({ ...a })); // return copies
}

function addAlert(symbol, price, direction) {
  const db = load();
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const alert = {
    id,
    symbol: symbol.toUpperCase(),
    price,
    direction,
    triggered: false,
    createdAt: new Date().toISOString(),
  };
  db.alerts.push(alert);
  save();
  return alert;
}

function removeAlert(id) {
  const db = load();
  const before = db.alerts.length;
  db.alerts = db.alerts.filter(a => a.id !== id);
  if (db.alerts.length === before) return false;
  save();
  return true;
}

function triggerAlert(id) {
  const db = load();
  const alert = db.alerts.find(a => a.id === id);
  if (alert) {
    alert.triggered = true;
    alert.triggeredAt = new Date().toISOString();
    save();
  }
}

// ---- Watchlist ----
function getWatchlist() {
  return [...load().watchlist]; // return copy
}

function setWatchlist(symbols) {
  const db = load();
  db.watchlist = symbols.map(s => s.toUpperCase());
  save();
}

// ---- DCA Plans ----
function getDCAPlans() {
  return load().dcaPlans.map(p => ({ ...p }));
}

function addDCAPlan(symbol, monthlyAmount, months) {
  const db = load();
  const plan = {
    id: Date.now().toString(36),
    symbol: symbol.toUpperCase(),
    monthlyAmount,
    months,
    createdAt: new Date().toISOString(),
  };
  db.dcaPlans.push(plan);
  save();
  return plan;
}

// ---- Price History ----
function recordPrice(symbol, price, autoSave = true) {
  const db = load();
  if (!db.priceHistory[symbol]) {
    db.priceHistory[symbol] = [];
  }
  db.priceHistory[symbol].push({ price, time: Date.now() });
  // Keep last 1000 entries per symbol
  if (db.priceHistory[symbol].length > 1000) {
    db.priceHistory[symbol] = db.priceHistory[symbol].slice(-1000);
  }
  if (autoSave) save();
}

function getPriceHistory(symbol, limit = 100) {
  const db = load();
  const history = db.priceHistory[symbol] || [];
  return history.slice(-limit);
}

// ---- Settings ----
function getSettings() {
  const s = load().settings;
  return { ...s, telegram: { ...s.telegram } }; // deep-ish copy
}

function updateSettings(newSettings) {
  const db = load();
  db.settings = { ...db.settings, ...newSettings };
  save();
  return db.settings;
}

// ---- Reset ----
function resetAll() {
  _cache = { ...DEFAULT_DATA, _meta: { ...DEFAULT_DATA._meta, created: new Date().toISOString() } };
  save();
}

// ---- Paper Trading ----
function getPaperTrades() {
  return load().paperTrades.map(t => ({ ...t }));
}

function getPaperBalance() {
  return load().paperBalance || 10000;
}

function addPaperTrade(symbol, side, quantity, price) {
  const db = load();
  const cost = quantity * price;
  if (side === 'buy' && cost > db.paperBalance) return null;

  const trade = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    symbol: symbol.toUpperCase(),
    side,
    quantity,
    price,
    cost,
    createdAt: new Date().toISOString(),
  };

  if (side === 'buy') {
    db.paperBalance -= cost;
  } else {
    db.paperBalance += cost;
  }

  db.paperTrades.push(trade);
  // Keep last 500 trades
  if (db.paperTrades.length > 500) db.paperTrades = db.paperTrades.slice(-500);
  save();
  return { trade, balance: db.paperBalance };
}

function resetPaperTrading() {
  const db = load();
  db.paperTrades = [];
  db.paperBalance = 10000;
  save();
  return { balance: 10000 };
}

module.exports = {
  load, save,
  getPortfolio, addHolding, removeHolding, updateHolding,
  getAlerts, addAlert, removeAlert, triggerAlert,
  getWatchlist, setWatchlist,
  getDCAPlans, addDCAPlan,
  recordPrice, getPriceHistory,
  getPaperTrades, getPaperBalance, addPaperTrade, resetPaperTrading,
  getSettings, updateSettings,
  resetAll,
};
