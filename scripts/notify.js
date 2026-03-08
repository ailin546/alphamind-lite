#!/usr/bin/env node
/**
 * AlphaMind Lite - Notification Module
 * 通知系统：支持 Telegram Bot 推送 + 控制台输出
 *
 * Setup:
 *   1. Talk to @BotFather on Telegram, create a bot, get token
 *   2. Get your chat_id from @userinfobot
 *   3. Set env vars or update config:
 *      export TELEGRAM_BOT_TOKEN=xxx
 *      export TELEGRAM_CHAT_ID=xxx
 */

const https = require('https');
const db = require('./db');

let config;
try {
  config = require('../config/config');
} catch {
  config = { notifications: { telegram: { enabled: false } } };
}

/**
 * Send Telegram message
 */
function sendTelegram(message, options = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN || config.notifications?.telegram?.botToken;
  const chatId = process.env.TELEGRAM_CHAT_ID || config.notifications?.telegram?.chatId;

  if (!token || !chatId) {
    return Promise.resolve({ ok: false, reason: 'Telegram not configured' });
  }

  const postData = JSON.stringify({
    chat_id: chatId,
    text: message,
    parse_mode: options.parseMode || 'Markdown',
    disable_web_page_preview: true,
  });

  return new Promise((resolve) => {
    const req = https.request(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
        timeout: 10000,
      },
      (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve({ ok: json.ok, messageId: json.result?.message_id });
          } catch {
            resolve({ ok: false, reason: 'Invalid response' });
          }
        });
      }
    );

    req.on('error', (err) => resolve({ ok: false, reason: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, reason: 'timeout' }); });
    req.write(postData);
    req.end();
  });
}

/**
 * Send price alert notification
 */
async function sendPriceAlert(symbol, currentPrice, alertPrice, direction) {
  const emoji = direction === 'above' ? '🚀' : '📉';
  const action = direction === 'above' ? '突破' : '跌破';

  const message =
    `${emoji} *AlphaMind 价格警报*\n\n` +
    `*${symbol}* ${action} $${alertPrice.toLocaleString()}\n` +
    `当前价格: $${currentPrice.toLocaleString()}\n` +
    `时间: ${new Date().toLocaleString('zh-CN')}`;

  // Console
  console.log(`[Alert] ${symbol} ${action} $${alertPrice} | 当前 $${currentPrice}`);

  // Telegram
  const result = await sendTelegram(message);
  return result;
}

/**
 * Send portfolio summary
 */
async function sendPortfolioSummary(holdings, totalValue, totalPnl, totalPnlPercent) {
  const emoji = totalPnl >= 0 ? '📈' : '📉';
  const sign = totalPnl >= 0 ? '+' : '';

  let lines = [`${emoji} *AlphaMind 持仓报告*\n`];
  for (const h of holdings) {
    const hSign = h.pnl >= 0 ? '+' : '';
    lines.push(`${h.symbol}: $${h.price.toLocaleString()} (${hSign}${h.pnlPercent.toFixed(1)}%)`);
  }
  lines.push(`\n总价值: $${totalValue.toLocaleString()}`);
  lines.push(`${emoji} ${sign}$${totalPnl.toLocaleString()} (${sign}${totalPnlPercent.toFixed(2)}%)`);

  const result = await sendTelegram(lines.join('\n'));
  return result;
}

/**
 * Test Telegram connection
 */
async function testConnection() {
  console.log('🔄 测试 Telegram 连接...\n');

  const token = process.env.TELEGRAM_BOT_TOKEN || config.notifications?.telegram?.botToken;
  const chatId = process.env.TELEGRAM_CHAT_ID || config.notifications?.telegram?.chatId;

  if (!token) {
    console.log('❌ 未设置 TELEGRAM_BOT_TOKEN');
    console.log('\n设置方法:');
    console.log('  export TELEGRAM_BOT_TOKEN=your_bot_token');
    console.log('  export TELEGRAM_CHAT_ID=your_chat_id');
    return;
  }

  if (!chatId) {
    console.log('❌ 未设置 TELEGRAM_CHAT_ID');
    return;
  }

  const result = await sendTelegram('✅ AlphaMind Lite 通知测试成功！');
  if (result.ok) {
    console.log('✅ Telegram 连接成功！已发送测试消息');
  } else {
    console.log(`❌ 发送失败: ${result.reason}`);
  }
}

// CLI: node notify.js test
if (require.main === module) {
  testConnection().catch(console.error);
}

module.exports = { sendTelegram, sendPriceAlert, sendPortfolioSummary, testConnection };
