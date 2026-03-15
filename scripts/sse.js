#!/usr/bin/env node
/**
 * AlphaMind Lite - SSE (Server-Sent Events) Module
 * Real-time price streaming and alert broadcasting
 * Zero dependencies - pure Node.js
 */

const { getLogger } = require('./logger');
const { fetchMarketData } = require('./api-client');
const { sendJSON } = require('./middleware');
const db = require('./db');

const log = getLogger('sse');

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
const heartbeatTimer = setInterval(() => {
  for (const client of sseClients) {
    try { client.write(':heartbeat\n\n'); } catch { sseClients.delete(client); }
  }
}, 30000);

// Broadcast prices every 15s to SSE clients (with overlap guard)
let _sseBroadcasting = false;

// Callback to update external price cache
let _onPricesUpdate = null;

function onPricesUpdate(callback) {
  _onPricesUpdate = callback;
}

const broadcastTimer = setInterval(async () => {
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

    // Update external price cache
    const prices = {};
    data.forEach(d => { prices[d.symbol] = d.price; });
    if (_onPricesUpdate) _onPricesUpdate(prices);

    // Check alerts against live prices
    const triggeredAlerts = checkAlertsAgainstPrices(prices);

    // Broadcast to SSE clients
    if (sseClients.size > 0) {
      const priceMsg = `event: prices\ndata: ${JSON.stringify(data)}\n\n`;
      for (const client of sseClients) {
        try { client.write(priceMsg); } catch { sseClients.delete(client); }
      }
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

function drainClients() {
  for (const client of sseClients) {
    try { client.write('event: shutdown\ndata: {}\n\n'); client.end(); } catch {}
  }
  sseClients.clear();
}

module.exports = {
  handleSSE,
  heartbeatTimer,
  broadcastTimer,
  sseClients,
  drainClients,
  onPricesUpdate,
  checkAlertsAgainstPrices,
};
