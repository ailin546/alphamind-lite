#!/usr/bin/env node
/**
 * AlphaMind Lite - Price Watcher
 * 价格监控脚本 - 监控多个币种价格变化，超过阈值自动报警
 *
 * 使用方法:
 *   node price-watcher.js                    # 监控默认币种
 *   node price-watcher.js --add BTC 5        # 添加BTC波动5%报警
 *   node price-watcher.js --list             # 查看监控列表
 *   node price-watcher.js --watch            # 持续监控模式
 *   node price-watcher.js --config           # 显示配置
 */

const https = require('https');
const ui = require('./price-watcher-ui');

// ==================== 配置 ====================
const DEFAULT_SYMBOLS = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX'];

const defaultThresholds = {
  BTC: 3, ETH: 5, BNB: 5, SOL: 7, XRP: 7, ADA: 8, DOGE: 10, AVAX: 8
};

const watchConfig = {
  symbols: [...DEFAULT_SYMBOLS],
  thresholds: { ...defaultThresholds },
  history: {},
  alerts: [],
  basePrices: {}
};

// ==================== API ====================

function fetchPrice(symbol) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.binance.com',
      path: `/api/v3/ticker/price?symbol=${symbol}USDT`,
      method: 'GET',
      timeout: 5000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(parseFloat(JSON.parse(data).price)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('Request timeout')); });
    req.end();
  });
}

function fetch24hStats(symbol) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.binance.com',
      path: `/api/v3/ticker/24hr?symbol=${symbol}USDT`,
      method: 'GET',
      timeout: 5000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({
            price: parseFloat(result.lastPrice),
            change: parseFloat(result.priceChangePercent),
            high: parseFloat(result.highPrice),
            low: parseFloat(result.lowPrice),
            volume: parseFloat(result.volume)
          });
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('Request timeout')); });
    req.end();
  });
}

async function fetchAllPrices() {
  const prices = {};
  const stats = {};
  for (const symbol of watchConfig.symbols) {
    try {
      const data = await fetch24hStats(symbol);
      prices[symbol] = data.price;
      stats[symbol] = data;
    } catch (e) {
      console.log(`  ⚠️ ${symbol} 获取失败: ${e.message}`);
    }
  }
  return { prices, stats };
}

// ==================== 监控逻辑 ====================

function calculateChange(symbol, currentPrice) {
  const basePrice = watchConfig.basePrices[symbol];
  if (!basePrice || basePrice === 0) return 0;
  return ((currentPrice - basePrice) / basePrice) * 100;
}

function checkAlerts(symbol, currentPrice, stats) {
  const threshold = watchConfig.thresholds[symbol] || 5;
  const change24h = stats[symbol]?.change || 0;
  const changeFromBase = calculateChange(symbol, currentPrice);
  const alerts = [];

  if (Math.abs(change24h) >= threshold) {
    const direction = change24h > 0 ? '📈暴涨' : '📉暴跌';
    alerts.push({
      type: '24h', symbol,
      level: Math.abs(change24h) >= threshold * 2 ? '🔴紧急' : '🟡注意',
      message: `${direction} ${symbol} 24h变化 ${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%`,
      currentPrice, threshold
    });
  }

  if (Math.abs(changeFromBase) >= threshold) {
    const direction = changeFromBase > 0 ? '📈上涨' : '📉下跌';
    alerts.push({
      type: 'base', symbol,
      level: Math.abs(changeFromBase) >= threshold * 2 ? '🔴紧急' : '🟡注意',
      message: `${direction} ${symbol} 变化 ${changeFromBase >= 0 ? '+' : ''}${changeFromBase.toFixed(2)}% (基准价格: $${watchConfig.basePrices[symbol]?.toLocaleString()})`,
      currentPrice, threshold
    });
  }

  return alerts;
}

// ==================== CLI ====================

function addSymbol(symbol, threshold) {
  symbol = symbol.toUpperCase();
  threshold = parseFloat(threshold);
  if (isNaN(threshold) || threshold <= 0) { console.log('❌ 阈值必须是正数'); return; }
  if (!watchConfig.symbols.includes(symbol)) watchConfig.symbols.push(symbol);
  watchConfig.thresholds[symbol] = threshold;
  console.log(`✅ 已添加/更新 ${symbol} 阈值: ±${threshold}%`);
}

function removeSymbol(symbol) {
  symbol = symbol.toUpperCase();
  const index = watchConfig.symbols.indexOf(symbol);
  if (index > -1) {
    watchConfig.symbols.splice(index, 1);
    delete watchConfig.thresholds[symbol];
    delete watchConfig.basePrices[symbol];
    console.log(`✅ 已移除 ${symbol}`);
  } else {
    console.log(`❌ ${symbol} 不在监控列表中`);
  }
}

// ==================== 主程序 ====================

async function checkPrices() {
  console.log('🔄 正在获取价格...\n');
  const { prices, stats } = await fetchAllPrices();

  for (const [symbol, price] of Object.entries(prices)) {
    if (!watchConfig.history[symbol]) watchConfig.history[symbol] = {};
    watchConfig.history[symbol].price = price;
    watchConfig.history[symbol].time = Date.now();
  }

  if (Object.keys(watchConfig.basePrices).length === 0) {
    for (const [symbol, price] of Object.entries(prices)) {
      watchConfig.basePrices[symbol] = price;
    }
  }

  const allAlerts = [];
  for (const symbol of watchConfig.symbols) {
    allAlerts.push(...checkAlerts(symbol, prices[symbol], stats));
  }

  ui.printPriceTable(watchConfig.symbols, prices, stats, watchConfig.thresholds, calculateChange);
  ui.printAlerts(allAlerts, watchConfig.alerts);

  console.log('💡 小贴士:');
  console.log('  • 使用 --set-base 设置新的基准价格');
  console.log('  • 使用 --add BTC 3 添加/修改监控阈值');
  console.log('  • 使用 --watch 持续监控\n');
}

async function watchMode() {
  console.log('🔄 启动持续监控模式 (每30秒更新, Ctrl+C 退出)\n');
  await checkPrices();
  const interval = setInterval(async () => {
    console.log('\n' + '='.repeat(64));
    await checkPrices();
  }, 30000);
  process.on('SIGINT', () => { clearInterval(interval); console.log('\n\n👋 监控已停止'); process.exit(0); });
}

async function setBase() {
  console.log('🔄 正在获取当前价格...\n');
  const { prices } = await fetchAllPrices();
  for (const [symbol, price] of Object.entries(prices)) {
    watchConfig.basePrices[symbol] = price;
    console.log(`✅ 已设置 ${symbol} 基准价格: $${price.toLocaleString()}`);
  }
  console.log('\n✅ 基准价格已更新');
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || '--check';
  const printBases = () => ui.printBasePrices(watchConfig.basePrices, watchConfig.history, calculateChange);

  switch (command) {
    case '--check': case '-c': await checkPrices(); break;
    case '--watch': case '-w': await watchMode(); break;
    case '--set-base': await setBase(); break;
    case '--add':
      if (args.length >= 3) addSymbol(args[1], args[2]);
      else console.log('❌ 用法: --add <币种> <阈值>');
      break;
    case '--remove':
      if (args.length >= 2) removeSymbol(args[1]);
      else console.log('❌ 用法: --remove <币种>');
      break;
    case '--list': ui.showList(watchConfig); break;
    case '--alerts': ui.showAlertHistory(watchConfig.alerts); break;
    case '--clear-alerts': watchConfig.alerts = []; console.log('✅ 报警历史已清除'); break;
    case '--config': ui.showConfig(watchConfig, printBases); break;
    case '--help': case '-h': ui.showHelp(); break;
    default: console.log(`❌ 未知命令: ${command}`); console.log('使用 --help 查看帮助');
  }
}

main().catch(console.error);
