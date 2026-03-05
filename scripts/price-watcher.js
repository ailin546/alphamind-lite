#!/usr/bin/env node
/**
 * AlphaMind Lite - Price Watcher
 * 价格监控脚本 - 超过阈值自动报警
 */

const https = require('https');

const WATCH_LIST = [
  { symbol: 'BTC', high: 80000, low: 60000 },
  { symbol: 'ETH', high: 3000, low: 1800 },
  { symbol: 'BNB', high: 800, low: 500 },
  { symbol: 'SOL', high: 150, low: 80 },
];

function getPrice(symbol) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.binance.com',
      path: `/api/v3/ticker/price?symbol=${symbol}USDT`,
      method: 'GET'
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data).price); } 
        catch { resolve(null); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function checkPrices() {
  console.log('📡 价格监控...\n');
  
  for (const coin of WATCH_LIST) {
    const price = await getPrice(coin.symbol);
    if (!price) continue;
    
    const p = parseFloat(price);
    const alert = [];
    
    if (p >= coin.high) alert.push('⚠️ 突破高点');
    if (p <= coin.low) alert.push('📉 跌破低点');
    
    const status = alert.length > 0 ? alert.join(' ') : '✅ 正常';
    console.log(`  ${coin.symbol}: $${p.toLocaleString()} ${status}`);
  }
}

console.log('═══════════════════════════════════════════════════');
console.log('   🔔 AlphaMind - 价格监控');
console.log('═══════════════════════════════════════════════════\n');
checkPrices();
