#!/usr/bin/env node
/**
 * AlphaMind Lite - DCA Calculator
 * 定投计算器 - 美元成本平均法
 */

const https = require('https');

function getPrice(symbol) {
  return new Promise((resolve) => {
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
    req.end();
  });
}

async function calculate(symbol, monthlyAmount, months) {
  const price = await getPrice(symbol);
  if (!price) return null;
  
  const currentPrice = parseFloat(price);
  let totalInvested = monthlyAmount * months;
  let totalCoins = 0;
  
  // 模拟：假设每月价格波动 ±10%
  for (let i = 0; i < months; i++) {
    // 简化：按当前价格计算
    totalCoins += monthlyAmount / currentPrice;
  }
  
  return { currentPrice, totalInvested, totalCoins, currentValue: totalCoins * currentPrice };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   💰 AlphaMind - 定投计算器');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const symbol = 'BTC';
  const monthlyAmount = 100; // 每月100 USDT
  const months = 12; // 12个月
  
  const result = await calculate(symbol, monthlyAmount, months);
  
  if (!result) {
    console.log('❌ 获取价格失败');
    return;
  }
  
  console.log(`📊 假设定投 ${symbol}：`);
  console.log(`  每月投入: $${monthlyAmount}`);
  console.log(`  定投周期: ${months} 个月`);
  console.log(`  总投入: $${result.totalInvested}`);
  console.log(`  当前价格: $${result.currentPrice.toLocaleString()}`);
  console.log(`  累计币数: ${result.totalCoins.toFixed(6)} ${symbol}`);
  console.log(`  当前价值: $${result.currentValue.toFixed(2)}`);
  console.log(`  收益: $${(result.currentValue - result.totalInvested).toFixed(2)} (${((result.currentValue/result.totalInvested-1)*100).toFixed(2)}%)`);
  
  console.log('\n💡 定投优势:');
  console.log('  • 无需择时，降低买入风险');
  console.log('  • 分散成本，波动中积累');
  console.log('  • 养成储蓄习惯');
  
  console.log('\n⚠️ 风险提示:');
  console.log('  • 历史收益不代表未来');
  console.log('  • 加密货币波动大');
  console.log('  • 仅供参考，不构成投资建议');
  
  console.log('\n═══════════════════════════════════════════════════════════');
}

main();
