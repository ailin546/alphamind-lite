#!/usr/bin/env node
/**
 * AlphaMind Lite - Arbitrage Scanner
 * 跨交易所价格监控 - 套利机会发现
 */

const https = require('https');

// 简化版：仅监控 Binance 内部价格差异
// 真实套利需要多交易所API，这里仅做演示

const PAIRS = ['BTC', 'ETH', 'BNB', 'SOL', 'DOGE'];

function getBinancePrice(symbol) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.binance.com',
      path: `/api/v3/ticker/24hr?symbol=${symbol}USDT`,
      method: 'GET'
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({
            symbol: json.symbol,
            price: parseFloat(json.lastPrice),
            change: parseFloat(json.priceChangePercent),
            high: parseFloat(json.highPrice),
            low: parseFloat(json.lowPrice)
          });
        } catch { resolve(null); }
      });
    });
    req.end();
  });
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   🔍 AlphaMind - 套利机会扫描');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log('📡 获取市场数据...\n');
  
  const prices = await Promise.all(PAIRS.map(s => getBinancePrice(s)));
  
  console.log('币种       当前价格      24h涨跌      最高-最低\n');
  console.log('─'.repeat(55));
  
  let opportunities = [];
  
  for (const p of prices) {
    if (!p) continue;
    const emoji = p.change >= 0 ? '🟢' : '🔴';
    console.log(
      `${p.symbol.padEnd(10)} $${p.price.toLocaleString().padStart(12)} ${emoji} ${p.change.toFixed(2)}%`.padEnd(45) +
      `$${p.low.toLocaleString()} - $${p.high.toLocaleString()}`
    );
    
    // 简单的波动机会检测
    const range = ((p.high - p.low) / p.low * 100).toFixed(2);
    if (parseFloat(range) > 5) {
      opportunities.push({ symbol: p.symbol, range });
    }
  }
  
  console.log('\n📊 波动分析:\n');
  
  if (opportunities.length > 0) {
    console.log('⚡ 高波动币种 (可能存在日内交易机会):');
    opportunities.forEach(o => {
      console.log(`  • ${o.symbol}: 日内波动 ${o.range}%`);
    });
  } else {
    console.log('  当前市场波动较小，观望为主');
  }
  
  console.log('\n💡 套利提示:');
  console.log('  • 跨交易所套利需要真实API');
  console.log('  • 现货-合约价差套利需要专业工具');
  console.log('  • 本功能仅供信息参考，不构成投资建议');
  
  console.log('\n═══════════════════════════════════════════════════════════');
}

main();
