#!/usr/bin/env node
/**
 * AlphaMind Lite - Market Sentiment Analysis
 * 市场情绪综合分析
 */

const https = require('https');

async function getFearGreed() {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.alternative.me',
      path: '/fng/',
      method: 'GET'
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data).data?.[0]); }
        catch { resolve(null); }
      });
    });
    req.end();
  });
}

async function getBTCTrend() {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.binance.com',
      path: '/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=24',
      method: 'GET'
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const klines = JSON.parse(data);
          const closes = klines.map(k => parseFloat(k[4]));
          const avg = closes.reduce((a,b) => a+b,0) / closes.length;
          const trend = closes[closes.length-1] > avg ? '上涨' : '下跌';
          resolve({ trend, avg: avg.toFixed(2) });
        } catch { resolve(null); }
      });
    });
    req.end();
  });
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('   📊 AlphaMind - 市场情绪综合分析');
  console.log('═══════════════════════════════════════════════════\n');
  
  // Fear & Greed
  const fg = await getFearGreed();
  const fgValue = fg ? parseInt(fg.value) : 50;
  let fgSentiment = '中性';
  if (fgValue < 25) fgSentiment = '极度恐慌';
  else if (fgValue < 45) fgSentiment = '恐慌';
  else if (fgValue > 75) fgSentiment = '极度贪婪';
  else if (fgValue > 55) fgSentiment = '贪婪';
  
  console.log(`🎯 恐慌指数: ${fgValue}/100 (${fgSentiment})`);
  
  // BTC Trend
  const btc = await getBTCTrend();
  if (btc) {
    console.log(`📈 BTC 趋势: ${btc.trend} (24h均价 $${btc.avg})`);
  }
  
  // 综合判断
  console.log('\n🧠 综合分析:');
  
  if (fgValue < 30 && btc?.trend === '下跌') {
    console.log('  ✓ 极度恐慌 + 下跌 = 可能是分批买入机会');
  } else if (fgValue > 70 && btc?.trend === '上涨') {
    console.log('  ⚠️ 极度贪婪 + 上涨 = 注意风险，可考虑部分止盈');
  } else if (fgValue >= 40 && fgValue <= 60) {
    console.log('  ○ 市场中性，观望为主');
  } else {
    console.log('  → 当前市场方向不明朗，建议轻仓观望');
  }
  
  console.log('\n💡 操作建议:');
  if (fgValue < 30) {
    console.log('  • 可考虑分批建仓');
    console.log('  • 不要梭哈，留足应急资金');
  } else if (fgValue > 70) {
    console.log('  • 可以考虑分批止盈');
    console.log('  • 减少新开仓位');
  } else {
    console.log('  • 保持现有仓位');
    console.log('  • 设置移动止损保护利润');
  }
  
  console.log('\n═══════════════════════════════════════════════════');
}

main();
