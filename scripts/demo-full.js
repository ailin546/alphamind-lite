#!/usr/bin/env node
/**
 * AlphaMind Lite - Full Demo with Fear & Greed Index
 */

const { execSync } = require('child_process');

console.log('═══════════════════════════════════════════════════════');
console.log('   🤖 AlphaMind Lite - 完整功能演示   ');
console.log('═══════════════════════════════════════════════════════');
console.log('');

// Demo 1: Price
console.log('📊 主流币种行情');
console.log('─────────────────────────────────────');
const coins = ['BTC', 'ETH', 'BNB', 'SOL'];
coins.forEach(coin => {
  try {
    const result = execSync(`curl -s "https://api.binance.com/api/v3/ticker/24hr?symbol=${coin}USDT"`, {encoding:'utf8'});
    const data = JSON.parse(result);
    const emoji = parseFloat(data.priceChangePercent) >= 0 ? '🟢' : '🔴';
    console.log(`  ${coin}: $${parseFloat(data.lastPrice).toLocaleString()} (${emoji} ${parseFloat(data.priceChangePercent).toFixed(2)}%)`);
  } catch (e) {}
});
console.log('');

// Demo 2: Fear & Greed
console.log('🎯 市场情绪 - 恐慌指数');
console.log('─────────────────────────────────────');
try {
  const fg = execSync('node /root/.openclaw/workspace/binance-contest/scripts/fear-greed.js', {encoding:'utf8', maxBuffer: 1024*1024});
  console.log(fg);
} catch (e) {
  console.log('  获取失败');
}
console.log('');

// Demo 3: Risk
console.log('💰 仓位风险分析 (示例)');
console.log('─────────────────────────────────────');
console.log('  持仓: 0.5 BTC @ $70,000');
console.log('  当前: $73,285');
console.log('  盈亏: +$1,642 (+4.69%)');
console.log('  风险: 🟢 安全');
console.log('');

console.log('═══════════════════════════════════════════════════════');
console.log('   ✅ AlphaMind Lite - 演示完成');
console.log('═══════════════════════════════════════════════════════');
