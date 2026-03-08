#!/usr/bin/env node
/**
 * AlphaMind Lite - Price Alerts (Persistent + Notifications)
 * 价格提醒系统：持久化存储 + Telegram 推送
 *
 * Usage:
 *   node alerts.js                           # 检查所有提醒
 *   node alerts.js add BTC 80000 above       # 添加: BTC 突破 $80000
 *   node alerts.js add ETH 2000 below        # 添加: ETH 跌破 $2000
 *   node alerts.js list                      # 查看所有提醒
 *   node alerts.js remove <id>               # 删除提醒
 *   node alerts.js watch                     # 持续监控模式 (每30秒)
 */

const db = require('./db');
const { fetchMultiplePrices } = require('./api-client');
const { sendPriceAlert } = require('./notify');

async function checkAlerts() {
  const alerts = db.getAlerts().filter(a => !a.triggered);

  if (alerts.length === 0) {
    console.log('  📭 没有活跃的价格提醒');
    console.log('  添加: node alerts.js add BTC 80000 above\n');
    return { triggered: [], active: [] };
  }

  const symbols = [...new Set(alerts.map(a => a.symbol))];
  const prices = await fetchMultiplePrices(symbols);
  const priceMap = {};
  prices.forEach(p => { if (p.price) priceMap[p.symbol] = p.price; });

  const triggered = [];
  const active = [];

  for (const alert of alerts) {
    const price = priceMap[alert.symbol];
    if (!price) { active.push(alert); continue; }

    let isTriggered = false;
    if (alert.direction === 'above' && price >= alert.price) isTriggered = true;
    if (alert.direction === 'below' && price <= alert.price) isTriggered = true;

    if (isTriggered) {
      db.triggerAlert(alert.id);
      triggered.push({ ...alert, currentPrice: price });

      // Send notification
      await sendPriceAlert(alert.symbol, price, alert.price, alert.direction);
    } else {
      active.push({ ...alert, currentPrice: price });
    }
  }

  return { triggered, active };
}

function printAlerts() {
  const alerts = db.getAlerts();

  console.log('═══════════════════════════════════════════════════════════');
  console.log('   🔔 AlphaMind - 价格提醒系统');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (alerts.length === 0) {
    console.log('  📭 没有设置任何提醒\n');
    console.log('  添加: node alerts.js add BTC 80000 above');
    console.log('  帮助: node alerts.js --help\n');
    return;
  }

  console.log('  ID         币种    目标价       方向      状态       创建时间');
  console.log('  ' + '─'.repeat(65));

  for (const a of alerts) {
    const dir = a.direction === 'above' ? '⬆️ 突破' : '⬇️ 跌破';
    const status = a.triggered ? '✅ 已触发' : '⏳ 等待中';
    const time = new Date(a.createdAt).toLocaleDateString('zh-CN');
    console.log(
      `  ${a.id.padEnd(10)}` +
      `  ${a.symbol.padEnd(6)}` +
      `  $${a.price.toLocaleString().padEnd(12)}` +
      `  ${dir.padEnd(8)}` +
      `  ${status.padEnd(10)}` +
      `  ${time}`
    );
  }
  console.log('');
}

async function watchMode() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   🔔 AlphaMind - 价格监控模式 (每30秒检查)');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('  按 Ctrl+C 退出\n');

  const check = async () => {
    const now = new Date().toLocaleTimeString('zh-CN');
    const { triggered, active } = await checkAlerts();

    if (triggered.length > 0) {
      for (const t of triggered) {
        const action = t.direction === 'above' ? '突破' : '跌破';
        console.log(`  🎉 [${now}] ${t.symbol} ${action} $${t.price} | 当前 $${t.currentPrice.toLocaleString()}`);
      }
    }

    if (active.length > 0) {
      const summary = active.map(a => {
        const dist = a.currentPrice
          ? ` (距目标 ${((Math.abs(a.currentPrice - a.price) / a.price) * 100).toFixed(2)}%)`
          : '';
        return `${a.symbol}${dist}`;
      }).join('  ');
      console.log(`  ⏳ [${now}] 监控中: ${summary}`);
    }
  };

  await check();
  const interval = setInterval(check, 30000);

  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log('\n  👋 已停止监控\n');
    process.exit(0);
  });
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0]?.toLowerCase();

  if (cmd === 'add' && args.length >= 4) {
    const symbol = args[1].toUpperCase();
    const price = parseFloat(args[2]);
    const direction = args[3].toLowerCase();

    if (isNaN(price) || price <= 0) { console.log('❌ 无效价格'); return; }
    if (direction !== 'above' && direction !== 'below') {
      console.log('❌ 方向必须是 above 或 below'); return;
    }

    const alert = db.addAlert(symbol, price, direction);
    const dir = direction === 'above' ? '突破' : '跌破';
    console.log(`✅ 已添加: ${symbol} ${dir} $${price.toLocaleString()} (ID: ${alert.id})`);
    console.log('   运行 node alerts.js watch 开始监控');
  } else if (cmd === 'remove' && args[1]) {
    db.removeAlert(args[1]);
    console.log(`✅ 已删除提醒 ${args[1]}`);
  } else if (cmd === 'list') {
    printAlerts();
  } else if (cmd === 'watch') {
    await watchMode();
  } else if (cmd === 'check' || !cmd) {
    printAlerts();
    console.log('  🔄 检查触发状态...\n');
    const { triggered, active } = await checkAlerts();
    if (triggered.length > 0) {
      console.log('  🎉 新触发的提醒:');
      for (const t of triggered) {
        console.log(`    ${t.symbol}: 已${t.direction === 'above' ? '突破' : '跌破'} $${t.price} → 当前 $${t.currentPrice.toLocaleString()}`);
      }
    }
    if (active.length > 0) {
      console.log(`  ⏳ ${active.length} 个提醒等待中`);
    }
    console.log('');
  } else if (cmd === '--help' || cmd === '-h') {
    console.log(`
用法:
  node alerts.js                           检查提醒状态
  node alerts.js add <币种> <价格> <方向>    添加 (above/below)
  node alerts.js list                      查看所有提醒
  node alerts.js remove <id>               删除
  node alerts.js watch                     持续监控模式

示例:
  node alerts.js add BTC 80000 above       BTC 突破 $80K 时通知
  node alerts.js add ETH 2000 below        ETH 跌破 $2K 时通知
  node alerts.js watch                     开始监控`);
  }
}

main().catch(console.error);
