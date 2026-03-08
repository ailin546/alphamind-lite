#!/usr/bin/env node
/**
 * AlphaMind Lite - Demo
 * 统一演示脚本：市场概览 + 恐慌指数 + 风险分析
 */

const { execSync } = require('child_process');
const path = require('path');

// 工具函数
const run = (cmd) => {
  try { return execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }).trim(); }
  catch (e) { return null; }
};

const formatPrice = (n) => `$${parseFloat(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const formatPercent = (n) => `${parseFloat(n) >= 0 ? '+' : ''}${parseFloat(n).toFixed(2)}%`;
const emojiTrend = (n) => parseFloat(n) >= 0 ? '🟢' : '🔴';

// 打印标题
const printHeader = (icon, title) => {
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`${icon} ${title}`);
  console.log(`${'─'.repeat(50)}`);
};

// 1. 市场概览
const showMarket = () => {
  printHeader('📊', '市场概览');
  const coins = [
    { symbol: 'BTC', name: 'Bitcoin' },
    { symbol: 'ETH', name: 'Ethereum' },
    { symbol: 'BNB', name: 'BNB' },
    { symbol: 'SOL', name: 'Solana' }
  ];

  coins.forEach(({ symbol, name }) => {
    const data = run(`curl -s "https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}USDT"`);
    if (!data) {
      console.log(`  ${symbol}: 获取失败`);
      return;
    }
    try {
      const json = JSON.parse(data);
      const price = formatPrice(json.lastPrice);
      const change = formatPercent(json.priceChangePercent);
      const emoji = emojiTrend(json.priceChangePercent);
      console.log(`  ${symbol.padEnd(5)} ${price.padStart(12)}  ${emoji} ${change.padStart(8)}  ${name}`);
    } catch (e) {
      console.log(`  ${symbol}: 解析失败`);
    }
  });
};

// 2. 恐慌指数
const showFearGreed = () => {
  printHeader('🎯', '市场情绪 (Fear & Greed)');
  const scriptPath = path.join(__dirname, 'fear-greed.js');
  const output = run(`node "${scriptPath}"`);
  if (output) {
    console.log(output.split('\n').map(l => '  ' + l).join('\n'));
  } else {
    console.log('  获取失败，请检查网络连接');
  }
};

// 3. 仓位风险分析 (示例)
const showRiskAnalysis = () => {
  printHeader('💰', '仓位风险分析 (示例)');
  
  const data = run('curl -s "https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT"');
  if (!data) {
    console.log('  无法获取当前价格');
    return;
  }
  
  try {
    const json = JSON.parse(data);
    const currentPrice = parseFloat(json.lastPrice);
    const qty = 0.5;
    const buyPrice = 70000;
    const value = qty * currentPrice;
    const pnl = (currentPrice - buyPrice) * qty;
    const pnlPercent = ((currentPrice - buyPrice) / buyPrice) * 100;
    
    const riskLevel = pnlPercent > -10 ? '🟢 安全' : pnlPercent > -20 ? '🟡 注意' : '🔴 危险';
    
    console.log(`  持仓: ${qty} BTC @ ${formatPrice(buyPrice)}`);
    console.log(`  当前: ${formatPrice(currentPrice)}`);
    console.log(`  价值: ${formatPrice(value)}`);
    console.log(`  盈亏: ${formatPrice(pnl)} (${formatPercent(pnlPercent)})`);
    console.log(`  风险: ${riskLevel}`);
  } catch (e) {
    console.log('  计算失败');
  }
};

// 4. 市场总结 (基于真实数据)
const showSummary = () => {
  printHeader('🧠', '市场总结');
  const coins = ['BTC', 'ETH', 'BNB', 'SOL'];
  const changes = [];
  for (const sym of coins) {
    const data = run(`curl -s "https://api.binance.com/api/v3/ticker/24hr?symbol=${sym}USDT"`);
    if (!data) continue;
    try { const j = JSON.parse(data); changes.push({ sym, pct: parseFloat(j.priceChangePercent) }); } catch {}
  }
  if (changes.length === 0) { console.log('  无法生成总结（数据不可用）'); return; }
  const avg = changes.reduce((s, c) => s + c.pct, 0) / changes.length;
  const best = changes.reduce((a, b) => a.pct > b.pct ? a : b);
  const worst = changes.reduce((a, b) => a.pct < b.pct ? a : b);
  const sentiment = avg > 3 ? '偏多头' : avg < -3 ? '偏空头' : '震荡中';
  console.log(`  📌 市场情绪：${sentiment}（主流币均涨幅 ${avg >= 0 ? '+' : ''}${avg.toFixed(2)}%）`);
  console.log(`  📌 最强表现：${best.sym} ${best.pct >= 0 ? '+' : ''}${best.pct.toFixed(2)}%`);
  console.log(`  📌 最弱表现：${worst.sym} ${worst.pct >= 0 ? '+' : ''}${worst.pct.toFixed(2)}%`);
  if (Math.abs(avg) > 5) console.log('  ⚠️  波动较大，注意风险管理');
  else console.log('  💡 波动正常，适合观望或定投');
};

// 主函数
const main = () => {
  console.log('\n╔' + '═'.repeat(48) + '╗');
  console.log('║' + ' '.repeat(10) + '🤖 AlphaMind Lite 演示' + ' '.repeat(15) + '║');
  console.log('╚' + '═'.repeat(48) + '╝');
  
  showMarket();
  showFearGreed();
  showRiskAnalysis();
  showSummary();
  
  console.log('\n' + '═'.repeat(50));
  console.log('✅ 演示完成 | 让每个投资者都有机构级智慧');
  console.log('═'.repeat(50) + '\n');
};

main();
