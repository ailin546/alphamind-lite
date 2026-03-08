#!/usr/bin/env node
/**
 * AlphaMind Lite - Price Monitor Worker
 * 后台价格监控进程，支持阈值报警和 Telegram 通知
 */

const { getLogger, createLogger } = require('./logger');
const { fetchMultiplePrices } = require('./api-client');
const https = require('https');

createLogger({ context: 'monitor' });
const log = getLogger('monitor');

let config;
try {
  config = require('../config/config');
} catch {
  config = {
    watchlist: ['BTC', 'ETH', 'BNB', 'SOL'],
    healthCheck: { interval: 30000 },
    notifications: { telegram: { enabled: false } },
  };
}

// Price history for change detection
const priceHistory = new Map();
const ALERT_THRESHOLD = 0.05; // 5% change triggers alert
const CHECK_INTERVAL = config.healthCheck.interval;

/**
 * Send Telegram notification
 */
function sendTelegramAlert(message) {
  const { botToken, chatId, enabled } = config.notifications.telegram;
  if (!enabled) {
    log.debug('Telegram not configured, skipping notification');
    return;
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const postData = JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' });

  const req = https.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': postData.length } }, (res) => {
    if (res.statusCode === 200) {
      log.info('Telegram alert sent');
    } else {
      log.warn('Telegram alert failed', { status: res.statusCode });
    }
    res.resume();
  });

  req.on('error', (err) => {
    log.error('Telegram request error', { error: err.message });
  });

  req.write(postData);
  req.end();
}

/**
 * Check prices and detect significant changes
 */
async function checkPrices() {
  try {
    const prices = await fetchMultiplePrices(config.watchlist);

    prices.forEach(({ symbol, price, error }) => {
      if (error || price === null) {
        log.warn(`Failed to fetch price for ${symbol}`);
        return;
      }

      const prev = priceHistory.get(symbol);
      priceHistory.set(symbol, { price, timestamp: Date.now() });

      if (prev) {
        const change = (price - prev.price) / prev.price;
        const changePercent = (change * 100).toFixed(2);

        if (Math.abs(change) >= ALERT_THRESHOLD) {
          const direction = change > 0 ? 'UP' : 'DOWN';
          const emoji = change > 0 ? '🚀' : '🔻';
          const msg = `${emoji} *${symbol} ALERT*\nPrice: $${price.toLocaleString()}\nChange: ${changePercent}% ${direction}\nTime: ${new Date().toISOString()}`;

          log.warn(`Price alert: ${symbol} ${changePercent}%`, { symbol, price, change: changePercent });
          sendTelegramAlert(msg);
        }
      }

      log.debug(`${symbol}: $${price.toLocaleString()}`);
    });
  } catch (err) {
    log.error('Price check failed', { error: err.message });
  }
}

// ---- Main Loop ----
log.info('Price monitor worker started', { watchlist: config.watchlist, interval: CHECK_INTERVAL });

// Initial check
checkPrices();

// Periodic checks
const intervalId = setInterval(checkPrices, CHECK_INTERVAL);

// Graceful shutdown
function shutdown(signal) {
  log.info(`Monitor received ${signal}, shutting down`);
  clearInterval(intervalId);
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('message', msg => { if (msg === 'shutdown') shutdown('PM2'); });
