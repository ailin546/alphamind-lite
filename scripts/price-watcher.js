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

// ==================== 配置 ====================
const DEFAULT_SYMBOLS = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX'];

// 默认配置：币种 -> 阈值(百分比)
const defaultThresholds = {
  BTC: 3,
  ETH: 5,
  BNB: 5,
  SOL: 7,
  XRP: 7,
  ADA: 8,
  DOGE: 10,
  AVAX: 8
};

// 监控配置
const watchConfig = {
  symbols: [...DEFAULT_SYMBOLS],
  thresholds: { ...defaultThresholds },
  history: {},  // 存储历史价格用于计算变化
  alerts: [],   // 报警记录
  basePrices: {} // 基准价格
};

// ==================== API ====================

// 获取单个币种价格
function fetchPrice(symbol) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.binance.com',
      path: `/api/v3/ticker/price?symbol=${symbol}USDT`,
      method: 'GET',
      timeout: 5000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(parseFloat(result.price));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

// 获取24小时统计
function fetch24hStats(symbol) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.binance.com',
      path: `/api/v3/ticker/24hr?symbol=${symbol}USDT`,
      method: 'GET',
      timeout: 5000
    };

    const req = https.request(options, (res) => {
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
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

// 获取所有配置币种的价格
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

// 计算价格变化百分比
function calculateChange(symbol, currentPrice) {
  const basePrice = watchConfig.basePrices[symbol];
  if (!basePrice || basePrice === 0) return 0;
  
  return ((currentPrice - basePrice) / basePrice) * 100;
}

// 检查是否触发报警
function checkAlerts(symbol, currentPrice, stats) {
  const threshold = watchConfig.thresholds[symbol] || 5;
  const change24h = stats[symbol]?.change || 0;
  const changeFromBase = calculateChange(symbol, currentPrice);
  
  const alerts = [];
  
  // 24小时涨跌幅报警
  if (Math.abs(change24h) >= threshold) {
    const direction = change24h > 0 ? '📈暴涨' : '📉暴跌';
    alerts.push({
      type: '24h',
      symbol,
      level: Math.abs(change24h) >= threshold * 2 ? '🔴紧急' : '🟡注意',
      message: `${direction} ${symbol} 24h变化 ${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%`,
      currentPrice,
      threshold
    });
  }
  
  // 相对基准价格变化报警
  if (Math.abs(changeFromBase) >= threshold) {
    const direction = changeFromBase > 0 ? '📈上涨' : '📉下跌';
    alerts.push({
      type: 'base',
      symbol,
      level: Math.abs(changeFromBase) >= threshold * 2 ? '🔴紧急' : '🟡注意',
      message: `${direction} ${symbol} 变化 ${changeFromBase >= 0 ? '+' : ''}${changeFromBase.toFixed(2)}% (基准价格: $${watchConfig.basePrices[symbol]?.toLocaleString()})`,
      currentPrice,
      threshold
    });
  }
  
  return alerts;
}

// 设置基准价格
function setBasePrice(symbol, price) {
  watchConfig.basePrices[symbol] = price;
  console.log(`✅ 已设置 ${symbol} 基准价格: $${price.toLocaleString()}`);
}

// ==================== 打印输出 ====================

// 打印价格表格
function printPriceTable(prices, stats) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    📊 价格监控面板');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  console.log('  币种     当前价格        24h变化      阈值      状态');
  console.log('────────────────────────────────────────────────────────────────');
  
  for (const symbol of watchConfig.symbols) {
    const price = prices[symbol];
    const stat = stats[symbol];
    const threshold = watchConfig.thresholds[symbol];
    const change = stat?.change || 0;
    const changeStr = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
    const changeColor = change >= 0 ? '🟢' : '🔴';
    
    // 计算从基准价格的变化
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

// 打印报警
function printAlerts(alerts) {
  if (alerts.length === 0) {
    console.log('✅ 目前无报警\n');
    return;
  }
  
  console.log('🚨 触发报警:');
  console.log('────────────────────────────────────────────────────────────────');
  
  for (const alert of alerts) {
    console.log(`  ${alert.level} ${alert.message}`);
    watchConfig.alerts.push(alert);
  }
  
  console.log('');
}

// 打印基准价格
function printBasePrices() {
  const bases = Object.entries(watchConfig.basePrices);
  if (bases.length === 0) {
    console.log('💡 未设置基准价格，使用 --set-base 设置\n');
    return;
  }
  
  console.log('📌 基准价格:');
  for (const [symbol, price] of bases) {
    const change = calculateChange(symbol, watchConfig.history[symbol]?.price || price);
    console.log(`  ${symbol}: $${price.toLocaleString()} (变化: ${change >= 0 ? '+' : ''}${change.toFixed(2)}%)`);
  }
  console.log('');
}

// ==================== CLI 命令 ====================

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

function showConfig() {
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
  printBasePrices();
}

function showList() {
  console.log('📋 监控列表:');
  console.log('────────────────────────────────────────────────────────────────');
  for (const symbol of watchConfig.symbols) {
    const threshold = watchConfig.thresholds[symbol];
    const basePrice = watchConfig.basePrices[symbol];
    console.log(`  ${symbol}: 阈值 ±${threshold}% ${basePrice ? `(基准: $${basePrice.toLocaleString()})` : '(无基准)'}`);
  }
  console.log('');
}

function showAlerts() {
  if (watchConfig.alerts.length === 0) {
    console.log('📭 无报警记录\n');
    return;
  }
  
  console.log('🚨 报警历史:');
  console.log('────────────────────────────────────────────────────────────────');
  for (const alert of watchConfig.alerts.slice(-10).reverse()) {
    console.log(`  [${alert.type}] ${alert.level} ${alert.message}`);
  }
  console.log('');
}

// 添加/更新币种
function addSymbol(symbol, threshold) {
  symbol = symbol.toUpperCase();
  threshold = parseFloat(threshold);
  
  if (isNaN(threshold) || threshold <= 0) {
    console.log('❌ 阈值必须是正数');
    return;
  }
  
  if (!watchConfig.symbols.includes(symbol)) {
    watchConfig.symbols.push(symbol);
  }
  
  watchConfig.thresholds[symbol] = threshold;
  console.log(`✅ 已添加/更新 ${symbol} 阈值: ±${threshold}%`);
}

// 移除币种
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

// 清除报警
function clearAlerts() {
  watchConfig.alerts = [];
  console.log('✅ 报警历史已清除');
}

// ==================== 主程序 ====================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || '--check';
  
  switch (command) {
    case '--check':
    case '-c':
      await checkPrices();
      break;
      
    case '--watch':
    case '-w':
      await watchMode();
      break;
      
    case '--set-base':
      await setBase();
      break;
      
    case '--add':
      if (args.length >= 3) {
        addSymbol(args[1], args[2]);
      } else {
        console.log('❌ 用法: --add <币种> <阈值>');
      }
      break;
      
    case '--remove':
      if (args.length >= 2) {
        removeSymbol(args[1]);
      } else {
        console.log('❌ 用法: --remove <币种>');
      }
      break;
      
    case '--list':
      showList();
      break;
      
    case '--alerts':
      showAlerts();
      break;
      
    case '--clear-alerts':
      clearAlerts();
      break;
      
    case '--config':
      showConfig();
      break;
      
    case '--help':
    case '-h':
      showHelp();
      break;
      
    default:
      console.log(`❌ 未知命令: ${command}`);
      console.log('使用 --help 查看帮助');
  }
}

// 检查价格
async function checkPrices() {
  console.log('🔄 正在获取价格...\n');
  
  const { prices, stats } = await fetchAllPrices();
  
  // 保存历史价格
  for (const [symbol, price] of Object.entries(prices)) {
    if (!watchConfig.history[symbol]) {
      watchConfig.history[symbol] = {};
    }
    watchConfig.history[symbol].price = price;
    watchConfig.history[symbol].time = Date.now();
  }
  
  // 如果没有基准价格，设置当前价格为基准
  if (Object.keys(watchConfig.basePrices).length === 0) {
    for (const [symbol, price] of Object.entries(prices)) {
      watchConfig.basePrices[symbol] = price;
    }
  }
  
  // 检查报警
  const allAlerts = [];
  for (const symbol of watchConfig.symbols) {
    const alerts = checkAlerts(symbol, prices[symbol], stats);
    allAlerts.push(...alerts);
  }
  
  // 打印结果
  printPriceTable(prices, stats);
  printAlerts(allAlerts);
  
  console.log('💡 小贴士:');
  console.log('  • 使用 --set-base 设置新的基准价格');
  console.log('  • 使用 --add BTC 3 添加/修改监控阈值');
  console.log('  • 使用 --watch 持续监控\n');
}

// 持续监控模式
async function watchMode() {
  console.log('🔄 启动持续监控模式 (每30秒更新, Ctrl+C 退出)\n');
  
  await checkPrices();
  
  const interval = setInterval(async () => {
    console.log('\n' + '='.repeat(64));
    await checkPrices();
  }, 30000);
  
  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log('\n\n👋 监控已停止');
    process.exit(0);
  });
}

// 设置基准价格
async function setBase() {
  console.log('🔄 正在获取当前价格...\n');
  
  const { prices } = await fetchAllPrices();
  
  for (const [symbol, price] of Object.entries(prices)) {
    setBasePrice(symbol, price);
  }
  
  console.log('\n✅ 基准价格已更新');
}

main().catch(console.error);
