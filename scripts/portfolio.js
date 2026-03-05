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

// HTTP request with timeout
function fetchWithTimeout(url, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.on('error', reject);
  });
}

async function getPrice(symbol) {
  try {
    const data = await fetchWithTimeout(
      `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}USDT`
    );
    const json = JSON.parse(data);
    // Validate API response
    if (!json || !json.price || isNaN(parseFloat(json.price))) {
      throw new Error('Invalid API response');
    }
    return json.price;
  } catch (e) {
    return null;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('   💼 AlphaMind Lite - 投资组合分析');
  console.log('═══════════════════════════════════════════════════\n');
  
  // Empty portfolio check
  if (!PORTFOLIO || PORTFOLIO.length === 0) {
    console.log('❌ 持仓为空，请先配置');
    return;
  }
  
  let totalValue = 0;
  let totalCost = 0;
  const holdings = [];
  
  for (const p of PORTFOLIO) {
    const price = await getPrice(p.symbol);
    if (!price) continue;
    
    const value = p.amount * parseFloat(price);
    const cost = p.amount * p.avgPrice;
    const pnl = value - cost;
    const pnlPercent = ((value - cost) / cost * 100);
    
    holdings.push({ ...p, price, value, cost, pnl, pnlPercent });
    totalValue += value;
    totalCost += cost;
  }
  
  // Empty result check
  if (holdings.length === 0) {
    console.log('❌ 无法获取价格数据');
    return;
  }
  
  holdings.sort((a, b) => b.value - a.value);
  
  console.log('📊 持仓明细:\n');
  console.log('  币种    数量      均价      当前价    价值       盈亏       盈亏%');
  console.log('  '.repeat(60));
  
  for (const h of holdings) {
    const emoji = h.pnl >= 0 ? '🟢' : '🔴';
    console.log(
      `  ${h.symbol.padEnd(6)} ${h.amount.toFixed(2).padStart(8)} $${h.avgPrice}`.padEnd(30) +
      `$${parseFloat(h.price).toFixed(2).padStart(10)} $${h.value.toFixed(0).padStart(10)} `.padEnd(45) +
      `${emoji} $${h.pnl.toFixed(0).padStart(8)} (${h.pnlPercent.toFixed(2)}%)`
    );
  }
  
  // Total cost check
  if (totalCost === 0) {
    console.log('\n❌ 总成本为0');
    return;
  }
  
  const totalPnl = totalValue - totalCost;
  const totalPnlPercent = ((totalValue - totalCost) / totalCost * 100);
  const totalEmoji = totalPnl >= 0 ? '🟢' : '🔴';
  
  console.log('\n' + '─'.repeat(65));
  console.log(`  总价值: $${totalValue.toLocaleString()}`);
  console.log(`  总成本: $${totalCost.toLocaleString()}`);
  console.log(`  ${totalEmoji} 总盈亏: $${totalPnl.toLocaleString()} (${totalPnlPercent.toFixed(2)}%)`);
  
  const btcRatio = holdings.find(h => h.symbol === 'BTC')?.value / totalValue * 100 || 0;
  console.log('\n📈 风险分析:');
  console.log(`  • BTC 占比: ${btcRatio.toFixed(1)}%`);
  console.log(`  • 持仓分散度: ${btcRatio > 50 ? '⚠️ 集中' : '✅ 分散'}`);
  
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
