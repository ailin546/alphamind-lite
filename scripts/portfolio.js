#!/usr/bin/env node
/**
 * AlphaMind Lite - Portfolio Analyzer
 * 投资组合分析工具
 */

const https = require('https');

const PORTFOLIO = [
  { symbol: 'BTC', amount: 0.5, avgPrice: 70000 },
  { symbol: 'ETH', amount: 2.0, avgPrice: 2000 },
  { symbol: 'BNB', amount: 5.0, avgPrice: 600 },
  { symbol: 'SOL', amount: 10.0, avgPrice: 80 },
];

async function getPrice(symbol) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.binance.com',
      path: `/api/v3/ticker/price?symbol=${symbol}USDT`,
      method: 'GET'
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data).price);
        } catch (e) { resolve(null); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('   💼 AlphaMind Lite - 投资组合分析');
  console.log('═══════════════════════════════════════════════════\n');
  
  let totalValue = 0;
  let totalCost = 0;
  const holdings = [];
  
  for (const p of PORTFOLIO) {
    const price = await getPrice(p.symbol);
    if (!price) continue;
    
    const value = p.amount * parseFloat(price);
    const cost = p.amount * p.avgPrice;
    const pnl = value - cost;
    const pnlPercent = ((value - cost) / cost * 100).toFixed(2);
    
    holdings.push({ ...p, price, value, cost, pnl, pnlPercent });
    totalValue += value;
    totalCost += cost;
  }
  
  // Sort by value
  holdings.sort((a, b) => b.value - a.value);
  
  console.log('📊 持仓明细:\n');
  console.log('  币种    数量      均价      当前价    价值       盈亏       盈亏%');
  console.log('  '.repeat(60));
  
  for (const h of holdings) {
    const emoji = h.pnl >= 0 ? '🟢' : '🔴';
    console.log(
      `  ${h.symbol.padEnd(6)} ${h.amount.toFixed(2).padStart(8)} $${h.avgPrice}`.padEnd(30) +
      `$${parseFloat(h.price).toFixed(2).padStart(10)} $${h.value.toFixed(0).padStart(10)} `.padEnd(45) +
      `${emoji} $${h.pnl.toFixed(0).padStart(8)} (${h.pnlPercent}%)`
    );
  }
  
  const totalPnl = totalValue - totalCost;
  const totalPnlPercent = ((totalValue - totalCost) / totalCost * 100).toFixed(2);
  const totalEmoji = totalPnl >= 0 ? '🟢' : '🔴';
  
  console.log('\n' + '─'.repeat(65));
  console.log(`  总价值: $${totalValue.toLocaleString()}`);
  console.log(`  总成本: $${totalCost.toLocaleString()}`);
  console.log(`  ${totalEmoji} 总盈亏: $${totalPnl.toLocaleString()} (${totalPnlPercent}%)`);
  
  // Risk analysis
  const btcRatio = holdings.find(h => h.symbol === 'BTC')?.value / totalValue * 100 || 0;
  console.log('\n📈 风险分析:');
  console.log(`  • BTC 占比: ${btcRatio.toFixed(1)}%`);
  console.log(`  • 持仓分散度: ${btcRatio > 50 ? '⚠️ 集中' : '✅ 分散'}`);
  
  // AI建议
  console.log('\n💡 AI 建议:');
  if (btcRatio > 70) {
    console.log('  建议适当分散持仓，降低 BTC 集中风险');
  } else if (totalPnlPercent < -10) {
    console.log('  当前亏损较大，建议设置止损线');
  } else {
    console.log('  组合健康，继续持有观望');
  }
  
  console.log('\n═══════════════════════════════════════════════════');
}

main();
