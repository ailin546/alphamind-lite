#!/usr/bin/env node
/**
 * AlphaMind Lite - DCA Calculator (Real Historical Data)
 * 定投计算器 - 使用真实历史 K 线数据模拟
 *
 * Usage:
 *   node dca-calculator.js                  # 默认: BTC $100/月 × 12个月
 *   node dca-calculator.js ETH 200 6        # ETH $200/月 × 6个月
 *   node dca-calculator.js BTC 500 24       # BTC $500/月 × 24个月
 */

const { fetchKlines, fetchPrice } = require('./api-client');

async function calculateDCA(symbol = 'BTC', monthlyAmount = 100, months = 12) {
  const pair = `${symbol.toUpperCase()}USDT`;

  console.log('═══════════════════════════════════════════════════════════');
  console.log('   💰 AlphaMind - 定投计算器 (历史数据模拟)');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Fetch historical monthly klines
  console.log(`  🔄 获取 ${symbol} 过去 ${months} 个月历史数据...\n`);

  let klines;
  try {
    klines = await fetchKlines(pair, '1M', Math.min(months, 36)); // max 36 months
  } catch (err) {
    console.log(`  ❌ 获取历史数据失败: ${err.message}`);
    console.log('  请检查币种名称是否正确（如 BTC, ETH, SOL）\n');
    return;
  }

  if (!klines || klines.length === 0) {
    console.log('  ❌ 无历史数据\n');
    return;
  }

  // Get current price
  let currentPrice;
  try {
    const priceData = await fetchPrice(pair);
    currentPrice = parseFloat(priceData.price);
  } catch {
    // Use last kline close price
    currentPrice = parseFloat(klines[klines.length - 1][4]);
  }

  // Simulate DCA with real monthly open prices
  const usableMonths = Math.min(months, klines.length);
  let totalInvested = 0;
  let totalCoins = 0;
  const entries = [];

  for (let i = 0; i < usableMonths; i++) {
    const kline = klines[klines.length - usableMonths + i]; // most recent N months
    const openPrice = parseFloat(kline[1]);  // Open price
    const highPrice = parseFloat(kline[2]);
    const lowPrice = parseFloat(kline[3]);
    const closePrice = parseFloat(kline[4]);
    const date = new Date(kline[0]);

    const coinsBought = monthlyAmount / openPrice;
    totalInvested += monthlyAmount;
    totalCoins += coinsBought;

    const avgCost = totalInvested / totalCoins;

    entries.push({
      month: date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short' }),
      price: openPrice,
      coins: coinsBought,
      totalCoins,
      avgCost,
      high: highPrice,
      low: lowPrice,
    });
  }

  const currentValue = totalCoins * currentPrice;
  const pnl = currentValue - totalInvested;
  const pnlPercent = (pnl / totalInvested) * 100;
  const avgCost = totalInvested / totalCoins;

  // Print monthly breakdown
  console.log(`  📅 定投记录 (${symbol} | $${monthlyAmount}/月 × ${usableMonths}月):\n`);
  console.log('  月份          买入价        买入量          累计持有       均价');
  console.log('  ' + '─'.repeat(65));

  for (const e of entries) {
    console.log(
      `  ${e.month.padEnd(12)}` +
      `  $${e.price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}).padStart(12)}` +
      `  ${e.coins.toFixed(6).padStart(12)}` +
      `  ${e.totalCoins.toFixed(6).padStart(14)}` +
      `  $${e.avgCost.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}).padStart(12)}`
    );
  }

  // Summary
  const emoji = pnl >= 0 ? '🟢' : '🔴';
  const sign = pnl >= 0 ? '+' : '';

  console.log('\n  ' + '═'.repeat(65));
  console.log(`  📊 定投总结:\n`);
  console.log(`    总投入:     $${totalInvested.toLocaleString()}`);
  console.log(`    累计持有:   ${totalCoins.toFixed(6)} ${symbol}`);
  console.log(`    持仓均价:   $${avgCost.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
  console.log(`    当前价格:   $${currentPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
  console.log(`    当前价值:   $${currentValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
  console.log(`    ${emoji} 收益:      ${sign}$${pnl.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} (${sign}${pnlPercent.toFixed(2)}%)`);

  // Compare with lump sum
  const firstPrice = entries[0].price;
  const lumpSumCoins = totalInvested / firstPrice;
  const lumpSumValue = lumpSumCoins * currentPrice;
  const lumpSumPnl = lumpSumValue - totalInvested;
  const lumpSumPercent = (lumpSumPnl / totalInvested) * 100;

  console.log(`\n  📐 对比一次性买入:`);
  console.log(`    一次性 $${totalInvested.toLocaleString()} @ $${firstPrice.toLocaleString()} → $${lumpSumValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} (${lumpSumPnl >= 0 ? '+' : ''}${lumpSumPercent.toFixed(2)}%)`);
  console.log(`    定投优势: ${pnlPercent > lumpSumPercent ? '❌ 本轮定投跑输一次性买入' : '✅ 定投表现更好（波动中摊低成本）'}`);

  console.log('\n  💡 定投策略:');
  console.log('    • 定投核心优势是在下跌中积累更多筹码');
  console.log('    • 牛市中一次性买入通常跑赢定投');
  console.log('    • 关键是纪律性：坚持执行，不受情绪影响');
  console.log('    • 数据基于真实历史月度开盘价\n');

  console.log('═══════════════════════════════════════════════════════════');
}

// CLI
const args = process.argv.slice(2);

if (args[0] === '--help' || args[0] === '-h') {
  console.log(`
使用方法:
  node dca-calculator.js [币种] [每月金额] [月数]

参数:
  币种       默认: BTC (支持 Binance 上的任何币种)
  每月金额   默认: $100
  月数       默认: 12 (最大 36)

示例:
  node dca-calculator.js                  # BTC $100/月 × 12个月
  node dca-calculator.js ETH 200 6        # ETH $200/月 × 6个月
  node dca-calculator.js BTC 500 24       # BTC $500/月 × 24个月
`);
  process.exit(0);
}

const symbol = (args[0] || 'BTC').toUpperCase();
const amount = parseFloat(args[1]) || 100;
const months = parseInt(args[2]) || 12;

if (amount <= 0) { console.log('❌ 每月金额必须为正数'); process.exit(1); }
if (months <= 0 || months > 36) { console.log('❌ 月数范围: 1-36'); process.exit(1); }
if (!/^[A-Z0-9]{1,10}$/.test(symbol)) { console.log('❌ 无效币种名称'); process.exit(1); }

calculateDCA(symbol, amount, months).catch(console.error);
