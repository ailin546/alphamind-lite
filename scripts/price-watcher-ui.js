#!/usr/bin/env node
/**
 * AlphaMind Lite - Price Watcher UI
 * Display and CLI helper functions for the price watcher
 * Zero dependencies - pure Node.js
 */

function printPriceTable(symbols, prices, stats, thresholds, calculateChange) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    📊 价格监控面板');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('  币种     当前价格        24h变化      阈值      状态');
  console.log('────────────────────────────────────────────────────────────────');

  for (const symbol of symbols) {
    const price = prices[symbol];
    const stat = stats[symbol];
    const threshold = thresholds[symbol];
    const change = stat?.change || 0;
    const changeStr = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
    const changeColor = change >= 0 ? '🟢' : '🔴';

    const baseChange = calculateChange(symbol, price);
    let status = '⏳正常';
    if (Math.abs(baseChange) >= threshold) {
      status = baseChange > 0 ? '🔥上涨📈' : '🥶下跌📉';
    }

    console.log(
      `  ${symbol.padEnd(7)} $${price.toLocaleString().padEnd(14)} ${changeColor}${changeStr.padEnd(10)} ±${threshold}%    ${status}`
    );
  }

  console.log('────────────────────────────────────────────────────────────────\n');
}

function printAlerts(alerts, alertHistory) {
  if (alerts.length === 0) {
    console.log('✅ 目前无报警\n');
    return;
  }

  console.log('🚨 触发报警:');
  console.log('────────────────────────────────────────────────────────────────');

  for (const alert of alerts) {
    console.log(`  ${alert.level} ${alert.message}`);
    alertHistory.push(alert);
  }

  console.log('');
}

function printBasePrices(basePrices, history, calculateChange) {
  const bases = Object.entries(basePrices);
  if (bases.length === 0) {
    console.log('💡 未设置基准价格，使用 --set-base 设置\n');
    return;
  }

  console.log('📌 基准价格:');
  for (const [symbol, price] of bases) {
    const change = calculateChange(symbol, history[symbol]?.price || price);
    console.log(`  ${symbol}: $${price.toLocaleString()} (变化: ${change >= 0 ? '+' : ''}${change.toFixed(2)}%)`);
  }
  console.log('');
}

function showHelp() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                  AlphaMind Lite - Price Watcher                     ║
║                        价格监控脚本                                  ║
╚═══════════════════════════════════════════════════════════════════╝

使用方法:
  node price-watcher.js [命令]

命令:
  --check, -c          检查当前价格和报警 (默认)
  --watch, -w          持续监控模式 (每30秒)
  --set-base           将当前价格设为基准价格
  --add <币种> <阈值>  添加/更新监控币种和阈值
  --remove <币种>      移除监控币种
  --list               显示监控列表
  --alerts             显示报警历史
  --clear-alerts       清除报警历史
  --config             显示当前配置
  --help, -h           显示帮助

示例:
  node price-watcher.js --check
  node price-watcher.js --add BTC 3
  node price-watcher.js --add ETH 5
  node price-watcher.js --set-base
  node price-watcher.js --watch
`);
}

function showConfig(watchConfig, printBasePricesFn) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    ⚙️  当前配置');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('📋 监控币种:', watchConfig.symbols.join(', '));
  console.log('');
  console.log('📊 阈值配置:');
  for (const [symbol, threshold] of Object.entries(watchConfig.thresholds)) {
    console.log(`  ${symbol}: ±${threshold}%`);
  }
  console.log('');
  printBasePricesFn();
}

function showList(watchConfig) {
  console.log('📋 监控列表:');
  console.log('────────────────────────────────────────────────────────────────');
  for (const symbol of watchConfig.symbols) {
    const threshold = watchConfig.thresholds[symbol];
    const basePrice = watchConfig.basePrices[symbol];
    console.log(`  ${symbol}: 阈值 ±${threshold}% ${basePrice ? `(基准: $${basePrice.toLocaleString()})` : '(无基准)'}`);
  }
  console.log('');
}

function showAlertHistory(alerts) {
  if (alerts.length === 0) {
    console.log('📭 无报警记录\n');
    return;
  }

  console.log('🚨 报警历史:');
  console.log('────────────────────────────────────────────────────────────────');
  for (const alert of alerts.slice(-10).reverse()) {
    console.log(`  [${alert.type}] ${alert.level} ${alert.message}`);
  }
  console.log('');
}

module.exports = {
  printPriceTable,
  printAlerts,
  printBasePrices,
  showHelp,
  showConfig,
  showList,
  showAlertHistory,
};
