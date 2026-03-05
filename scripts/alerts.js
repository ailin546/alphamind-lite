#!/usr/bin/env node
/**
 * AlphaMind Lite - 价格提醒
 * 设置价格阈值，监控多个币种
 */

const https = require('https');

// 提醒配置
const alertsConfig = {
  // 币种: { 提醒价格, 方向: 'above'|'below', 已触发 }
  BTC: { price: 75000, direction: 'above', triggered: false },
  ETH: { price: 3000, direction: 'below', triggered: false },
  SOL: { price: 200, direction: 'above', triggered: false },
  BNB: { price: 500, direction: 'below', triggered: false }
};

// 获取价格
function fetchPrice(symbol) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.binance.com',
      path: `/api/v3/ticker/price?symbol=${symbol}USDT`,
      method: 'GET'
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
    req.end();
  });
}

// 获取多个价格
async function fetchAllPrices(symbols) {
  const prices = {};
  for (const symbol of symbols) {
    try {
      prices[symbol] = await fetchPrice(symbol);
    } catch (e) {
      // Demo 价格
      const demoPrices = { BTC: 73500, ETH: 3350, SOL: 145, BNB: 620 };
      prices[symbol] = demoPrices[symbol] || 100;
    }
  }
  return prices;
}

// 检查提醒
function checkAlerts(prices, config) {
  const results = [];
  const active = [];
  const triggered = [];

  for (const [symbol, alert] of Object.entries(config)) {
    const currentPrice = prices[symbol];
    if (currentPrice === undefined) continue;

    let isTriggered = false;
    let message = '';

    if (alert.direction === 'above' && currentPrice >= alert.price) {
      isTriggered = true;
      message = `🚀 ${symbol} 突破 $${alert.price}，当前 $${currentPrice.toLocaleString()}`;
    } else if (alert.direction === 'below' && currentPrice <= alert.price) {
      isTriggered = true;
      message = `📉 ${symbol} 跌破 $${alert.price}，当前 $${currentPrice.toLocaleString()}`;
    }

    const status = {
      symbol,
      alertPrice: alert.price,
      direction: alert.direction,
      currentPrice,
      isTriggered,
      message
    };

    if (isTriggered && !alert.triggered) {
      triggered.push(status);
    } else if (!isTriggered) {
      active.push(status);
    }
  }

  return { active, triggered };
}

// 打印提醒配置
function printAlertConfig(config, prices) {
  console.log('═══════════════════════════════════════════════════════');
  console.log('           🔔 价格提醒配置');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log('📋 监控币种:');
  console.log('─────────────────────────────────────────────────────');
  console.log('  币种    提醒价格    方向      当前价格    状态');
  console.log('─────────────────────────────────────────────────────');

  for (const [symbol, alert] of Object.entries(config)) {
    const currentPrice = prices[symbol] || 'N/A';
    const dirEmoji = alert.direction === 'above' ? '⬆️ 突破' : '⬇️ 跌破';
    const priceStr = typeof currentPrice === 'number' 
      ? currentPrice.toLocaleString() 
      : currentPrice;
    
    let status = '⏳ 待触发';
    if (typeof currentPrice === 'number') {
      if (alert.direction === 'above' && currentPrice >= alert.price) {
        status = '✅ 已触发';
      } else if (alert.direction === 'below' && currentPrice <= alert.price) {
        status = '✅ 已触发';
      }
    }

    console.log(
      `  ${symbol.padEnd(6)} $${alert.price.toLocaleString().padEnd(10)} ${dirEmoji.padEnd(8)} $${priceStr.padEnd(11)} ${status}`
    );
  }

  console.log('─────────────────────────────────────────────────────\n');
}

// 打印提醒结果
function printAlertResults(active, triggered) {
  if (triggered.length > 0) {
    console.log('🎉 触发的提醒:');
    console.log('─────────────────────────────────────────────────────');
    triggered.forEach(t => {
      console.log(`  ${t.message}`);
    });
    console.log('');
  }

  if (active.length > 0) {
    console.log('⏳ 等待触发的提醒:');
    console.log('─────────────────────────────────────────────────────');
    active.forEach(a => {
      const target = a.direction === 'above' ? '上涨至' : '下跌至';
      console.log(`  ${a.symbol}: 等待价格${target} $${a.alertPrice.toLocaleString()} (当前 $${a.currentPrice.toLocaleString()})`);
    });
    console.log('');
  }
}

// 添加新提醒
function addAlert(config, symbol, price, direction) {
  config[symbol] = { price, direction, triggered: false };
  return config;
}

// 删除提醒
function removeAlert(config, symbol) {
  delete config[symbol];
  return config;
}

// CLI 支持
function runCLI() {
  const args = process.argv.slice(2);
  
  if (args[0] === '--add' && args.length >= 4) {
    const symbol = args[1].toUpperCase();
    const price = parseFloat(args[2]);
    const direction = args[3].toLowerCase();
    
    if (direction !== 'above' && direction !== 'below') {
      console.log('❌ 方向必须是 above 或 below');
      return;
    }
    
    addAlert(alertsConfig, symbol, price, direction);
    console.log(`✅ 已添加提醒: ${symbol} ${direction} $${price}`);
  }
  
  if (args[0] === '--remove' && args.length >= 2) {
    const symbol = args[1].toUpperCase();
    removeAlert(alertsConfig, symbol);
    console.log(`✅ 已删除提醒: ${symbol}`);
  }
  
  if (args[0] === '--list') {
    console.log('📋 当前提醒列表:');
    for (const [symbol, alert] of Object.entries(alertsConfig)) {
      console.log(`  ${symbol}: ${alert.direction} $${alert.price}`);
    }
  }
  
  if (args[0] === '--help') {
    console.log(`
使用方法:
  node alerts.js [选项]

选项:
  --add <币种> <价格> <above|below>  添加提醒
  --remove <币种>                      删除提醒
  --list                               查看提醒列表
  --check                              检查提醒状态 (默认)
  --help                               显示帮助

示例:
  node alerts.js --add BTC 80000 above
  node alerts.js --remove ETH
  node alerts.js --list
`);
  }
}

async function main() {
  // CLI 处理
  if (process.argv.length > 2) {
    runCLI();
    return;
  }

  console.log('🔄 正在检查价格提醒...\n');

  const symbols = Object.keys(alertsConfig);
  const prices = await fetchAllPrices(symbols);
  
  printAlertConfig(alertsConfig, prices);
  
  const { active, triggered } = checkAlerts(prices, alertsConfig);
  printAlertResults(active, triggered);

  // 更新触发状态
  for (const t of triggered) {
    alertsConfig[t.symbol].triggered = true;
  }

  console.log('💡 小贴士:');
  console.log('  • above = 价格上涨至触发');
  console.log('  • below = 价格下跌至触发');
  console.log('  • 使用 --add 添加新提醒');
  console.log('  • 使用 --list 查看所有提醒\n');
}

main().catch(console.error);
