#!/usr/bin/env node
/**
 * AlphaMind Lite - SSE (Server-Sent Events) Module
 * Real-time price streaming and alert broadcasting
 * Zero dependencies - pure Node.js
 */

const { getLogger } = require('./logger');
const { httpGet, fetchMarketData } = require('./api-client');
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

// ---- Whale Alert Broadcasting (every 60s) ----
var _whaleChecking = false;
var _lastWhaleTrades = new Set(); // deduplicate by time+symbol+usd

var whaleAlertTimer = setInterval(async () => {
  if (_whaleChecking || sseClients.size === 0) return;
  _whaleChecking = true;
  try {
    // Check BTC and ETH large trades
    var symbols = [
      { pair: 'BTCUSDT', min: 200000 },
      { pair: 'ETHUSDT', min: 100000 },
    ];
    var allAlerts = [];

    var results = await Promise.all(symbols.map(function(s) {
      return httpGet('https://api.binance.com/api/v3/aggTrades?symbol=' + s.pair + '&limit=200', { timeout: 10000, retries: 1 })
        .then(function(trades) {
          var alerts = [];
          // Aggregate trades within 100ms windows
          var current = null;
          for (var i = 0; i < trades.length; i++) {
            var t = trades[i];
            var price = parseFloat(t.p);
            var qty = parseFloat(t.q);
            var side = t.m ? 'sell' : 'buy';
            var ts = t.T;
            if (current && current.side === side && Math.abs(ts - current.ts) <= 100) {
              current.qty += qty;
              current.usd += price * qty;
              current.fills++;
            } else {
              if (current && current.usd >= s.min) {
                var key = current.ts + '_' + s.pair + '_' + Math.round(current.usd);
                if (!_lastWhaleTrades.has(key)) {
                  _lastWhaleTrades.add(key);
                  alerts.push({
                    type: 'whale_trade',
                    symbol: s.pair.replace('USDT', ''),
                    side: current.side,
                    usd: Math.round(current.usd),
                    price: price,
                    fills: current.fills,
                    time: new Date(current.ts).toISOString(),
                    tier: current.usd >= 1000000 ? 'mega' : current.usd >= 500000 ? 'large' : 'medium',
                  });
                }
              }
              current = { side: side, qty: qty, usd: price * qty, ts: ts, fills: 1 };
            }
          }
          if (current && current.usd >= s.min) {
            var lastKey = current.ts + '_' + s.pair + '_' + Math.round(current.usd);
            if (!_lastWhaleTrades.has(lastKey)) {
              _lastWhaleTrades.add(lastKey);
              alerts.push({
                type: 'whale_trade',
                symbol: s.pair.replace('USDT', ''),
                side: current.side,
                usd: Math.round(current.usd),
                price: parseFloat(trades[trades.length - 1].p),
                fills: current.fills,
                time: new Date(current.ts).toISOString(),
                tier: current.usd >= 1000000 ? 'mega' : current.usd >= 500000 ? 'large' : 'medium',
              });
            }
          }
          return alerts;
        })
        .catch(function() { return []; });
    }));

    results.forEach(function(r) { allAlerts = allAlerts.concat(r); });

    // Also check liquidations
    try {
      var liqData = await httpGet('https://fapi.binance.com/fapi/v1/allForceOrders?symbol=BTCUSDT&limit=10', { timeout: 8000, retries: 1 });
      (liqData || []).forEach(function(liq) {
        var price = parseFloat(liq.price);
        var qty = parseFloat(liq.origQty);
        var usd = price * qty;
        if (usd >= 100000) {
          var lKey = liq.time + '_liq_' + Math.round(usd);
          if (!_lastWhaleTrades.has(lKey)) {
            _lastWhaleTrades.add(lKey);
            allAlerts.push({
              type: 'liquidation',
              symbol: 'BTC',
              side: liq.side === 'BUY' ? 'short_liq' : 'long_liq',
              usd: Math.round(usd),
              price: price,
              time: new Date(liq.time).toISOString(),
              tier: usd >= 1000000 ? 'mega' : usd >= 500000 ? 'large' : 'medium',
            });
          }
        }
      });
    } catch (e) { /* ignore */ }

    // Broadcast whale alerts
    if (allAlerts.length > 0 && sseClients.size > 0) {
      var msg = 'event: whale_alert\ndata: ' + JSON.stringify(allAlerts) + '\n\n';
      for (var client of sseClients) {
        try { client.write(msg); } catch { sseClients.delete(client); }
      }
      log.info('Whale alerts broadcast', { count: allAlerts.length });
    }

    // Cleanup old keys (keep last 500)
    if (_lastWhaleTrades.size > 500) {
      var arr = Array.from(_lastWhaleTrades);
      _lastWhaleTrades = new Set(arr.slice(-300));
    }
  } catch (err) {
    log.debug('Whale alert check error', { error: err.message });
  } finally {
    _whaleChecking = false;
  }
}, 60000);

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
  whaleAlertTimer,
  sseClients,
  drainClients,
  onPricesUpdate,
  checkAlertsAgainstPrices,
};
