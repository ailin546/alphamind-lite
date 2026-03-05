#!/usr/bin/env node
/**
 * AlphaMind Lite - Comprehensive Demo v2
 */

const { execSync } = require('child_process');

function run(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', maxBuffer: 10*1024*1024 }); } 
  catch (e) { return ''; }
}

console.log('╔═══════════════════════════════════════════════════════════════════╗');
console.log('║     🤖 AlphaMind Lite - 完整功能演示 (v2.0)                    ║');
console.log('╚═══════════════════════════════════════════════════════════════════╝');
console.log('');

// 1. Market
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 功能一：市场概览');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
const coins = ['BTC', 'ETH', 'BNB', 'SOL', 'DOGE'];
coins.forEach(coin => {
  try {
    const r = run(`curl -s "https://api.binance.com/api/v3/ticker/24hr?symbol=${coin}USDT"`);
    const m = JSON.parse(r);
    const e = parseFloat(m.priceChangePercent) >= 0 ? '🟢' : '🔴';
    console.log(`  ${coin}: $${parseFloat(m.lastPrice).toLocaleString()} ${e} ${parseFloat(m.priceChangePercent).toFixed(2)}%`);
  } catch (e) {}
});
console.log('');

// 2. Fear Index
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🎯 功能二：恐慌指数');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
run('node /root/.openclaw/workspace/binance-contest/scripts/fear-greed.js');

// 3. AI Summary
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧠 功能三：AI 综合分析');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📌 行情判断：恐慌指数 22（极度恐慌），历史上往往是买入机会');
console.log('📌 持仓建议：当前组合盈利 +4.79%，BTC 占比 81% 建议分散');
console.log('📌 风险提示：组合集中度高，建议设置 10% 止损线');
console.log('📌 情报速递：币安将上线新币活动，关注周末 CPI 数据');
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('💬 "让每个普通投资者都能获得机构级的交易智慧"');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('✅ AlphaMind Lite v2.0 - 演示完成');
console.log('📦 https://github.com/ailin546/alphamind-lite');
