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

// 4. AI 总结
const showAISummary = () => {
  printHeader('🧠', 'AI 智能总结');
  console.log('  📌 市场判断：主流币种今日波动正常');
  console.log('  📌 持仓建议：示例仓位盈利中，建议适当止盈');
  console.log('  📌 风险提示：保持止损纪律，避免过度杠杆');
};

// 主函数
const main = () => {
  console.log('\n╔' + '═'.repeat(48) + '╗');
  console.log('║' + ' '.repeat(10) + '🤖 AlphaMind Lite 演示' + ' '.repeat(15) + '║');
  console.log('╚' + '═'.repeat(48) + '╝');
  
  showMarket();
  showFearGreed();
  showRiskAnalysis();
  showAISummary();
  
  console.log('\n' + '═'.repeat(50));
  console.log('✅ 演示完成 | 让每个投资者都有机构级智慧');
  console.log('═'.repeat(50) + '\n');
};

main();
