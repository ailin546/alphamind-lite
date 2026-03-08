#!/usr/bin/env node
/**
 * AlphaMind Lite - Portfolio Manager
 * 真实持仓管理：添加/删除/查看持仓，实时盈亏计算
 *
 * Usage:
 *   node portfolio.js                    # 查看持仓概览
 *   node portfolio.js add BTC 0.5 68000  # 添加: 0.5 BTC 均价 $68000
 *   node portfolio.js add ETH 2 2100     # 添加: 2 ETH 均价 $2100
 *   node portfolio.js remove SOL         # 删除 SOL 持仓
 *   node portfolio.js update BTC 1.0     # 更新 BTC 数量为 1.0
 *   node portfolio.js interactive        # 交互模式
 */

const readline = require('readline');
const db = require('./db');
const { fetchMultiplePrices } = require('./api-client');

function fmt(n, decimals = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

async function showPortfolio() {
  const portfolio = db.getPortfolio();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   💼 AlphaMind Lite - 投资组合分析');
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (portfolio.length === 0) {
    console.log('  📭 持仓为空\n');
    console.log('  添加持仓: node portfolio.js add <币种> <数量> <均价>');
    console.log('  示例:     node portfolio.js add BTC 0.5 68000');
    console.log('  交互模式: node portfolio.js interactive\n');
    return;
  }

  const symbols = portfolio.map(p => p.symbol);
  console.log('  🔄 获取实时价格...\n');
  const prices = await fetchMultiplePrices(symbols);
  const priceMap = {};
  prices.forEach(p => { if (p.price) priceMap[p.symbol] = p.price; });

  let totalValue = 0;
  let totalCost = 0;
  const holdings = [];

  for (const p of portfolio) {
    const price = priceMap[p.symbol];
    if (!price) { console.log(`  ⚠️  ${p.symbol}: 无法获取价格`); continue; }

    const value = p.amount * price;
    const cost = p.amount * p.avgPrice;
    const pnl = value - cost;
    const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;
    totalValue += value;
    totalCost += cost;
    holdings.push({ ...p, price, value, cost, pnl, pnlPercent });
  }

  // Batch record prices (single save instead of N saves)
  for (const h of holdings) db.recordPrice(h.symbol, h.price, false);
  db.save();

  if (holdings.length === 0) { console.log('  ❌ 无法获取任何价格数据\n'); return; }
  holdings.sort((a, b) => b.value - a.value);

  console.log('  币种     数量         均价           现价           价值           盈亏');
  console.log('  ' + '─'.repeat(72));

  for (const h of holdings) {
    const emoji = h.pnl >= 0 ? '🟢' : '🔴';
    const sign = h.pnl >= 0 ? '+' : '';
    const weight = ((h.value / totalValue) * 100).toFixed(1);
    console.log(
      `  ${h.symbol.padEnd(6)}` +
      `  ${fmt(h.amount, 4).padStart(10)}` +
      `  $${fmt(h.avgPrice).padStart(11)}` +
      `  $${fmt(h.price).padStart(11)}` +
      `  $${fmt(h.value).padStart(11)}` +
      `  ${emoji} ${sign}$${fmt(h.pnl)} (${sign}${h.pnlPercent.toFixed(1)}%) [${weight}%]`
    );
  }

  const totalPnl = totalValue - totalCost;
  const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const totalEmoji = totalPnl >= 0 ? '🟢' : '🔴';
  const sign = totalPnl >= 0 ? '+' : '';

  console.log('  ' + '─'.repeat(72));
  console.log(`  总价值: $${fmt(totalValue)}   总成本: $${fmt(totalCost)}   ${totalEmoji} ${sign}$${fmt(totalPnl)} (${sign}${totalPnlPercent.toFixed(2)}%)\n`);

  // Risk analysis
  console.log('  📊 风险分析:');
  const maxWeight = Math.max(...holdings.map(h => (h.value / totalValue) * 100));
  const maxSym = holdings.find(h => (h.value / totalValue) * 100 === maxWeight)?.symbol;

  if (maxWeight > 70) console.log(`  ⚠️  ${maxSym} 占比 ${maxWeight.toFixed(1)}%，过于集中，建议 <50%`);
  else if (maxWeight > 50) console.log(`  ⚡ ${maxSym} 占比 ${maxWeight.toFixed(1)}%，略高`);
  else console.log(`  ✅ 持仓分散良好，最大占比 ${maxSym} ${maxWeight.toFixed(1)}%`);

  if (holdings.length < 3) console.log('  ⚠️  持仓不足 3 个币种，分散度偏低');

  const losers = holdings.filter(h => h.pnlPercent < -20);
  if (losers.length > 0) {
    console.log(`  🔴 深度亏损: ${losers.map(l => `${l.symbol}(${l.pnlPercent.toFixed(1)}%)`).join(', ')}，建议评估止损`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
}

async function interactiveMode() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise(resolve => rl.question(q, resolve));

  console.log('\n  💼 交互式持仓管理\n');

  while (true) {
    console.log('  1) 查看持仓   2) 添加持仓   3) 删除持仓   4) 退出');
    const choice = await ask('\n  请选择 [1-4]: ');

    if (choice === '1') {
      await showPortfolio();
    } else if (choice === '2') {
      const symbol = (await ask('  币种 (如 BTC): ')).toUpperCase().trim();
      if (!symbol) continue;
      const amount = parseFloat(await ask('  数量: '));
      if (isNaN(amount) || amount <= 0) { console.log('  ❌ 无效数量'); continue; }
      const avgPrice = parseFloat(await ask('  买入均价 ($): '));
      if (isNaN(avgPrice) || avgPrice <= 0) { console.log('  ❌ 无效价格'); continue; }
      db.addHolding(symbol, amount, avgPrice);
      console.log(`\n  ✅ 已添加: ${amount} ${symbol} @ $${fmt(avgPrice)}\n`);
    } else if (choice === '3') {
      const portfolio = db.getPortfolio();
      if (portfolio.length === 0) { console.log('  📭 持仓为空'); continue; }
      console.log('  当前持仓: ' + portfolio.map(p => p.symbol).join(', '));
      const symbol = (await ask('  要删除的币种: ')).toUpperCase().trim();
      db.removeHolding(symbol);
      console.log(`  ✅ 已删除 ${symbol}\n`);
    } else if (choice === '4' || choice === 'q') {
      break;
    }
  }
  rl.close();
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0]?.toLowerCase();

  if (cmd === 'add' && args.length >= 4) {
    const [, sym, amt, price] = args;
    const amount = parseFloat(amt), avgPrice = parseFloat(price);
    if (isNaN(amount) || isNaN(avgPrice) || amount <= 0 || avgPrice <= 0) {
      console.log('❌ 用法: node portfolio.js add BTC 0.5 68000');
      return;
    }
    db.addHolding(sym.toUpperCase(), amount, avgPrice);
    console.log(`✅ 已添加: ${amount} ${sym.toUpperCase()} @ $${fmt(avgPrice)}`);
  } else if (cmd === 'remove' && args[1]) {
    db.removeHolding(args[1].toUpperCase());
    console.log(`✅ 已删除 ${args[1].toUpperCase()}`);
  } else if (cmd === 'update' && args.length >= 3) {
    const amount = parseFloat(args[2]);
    const avgPrice = args[3] ? parseFloat(args[3]) : undefined;
    if (isNaN(amount) || amount <= 0) { console.log('❌ 无效数量'); return; }
    if (avgPrice !== undefined && (isNaN(avgPrice) || avgPrice <= 0)) { console.log('❌ 无效价格'); return; }
    const result = db.updateHolding(args[1].toUpperCase(), amount, avgPrice);
    if (!result) { console.log(`❌ 未找到 ${args[1].toUpperCase()} 持仓`); return; }
    console.log(`✅ 已更新 ${args[1].toUpperCase()}`);
  } else if (cmd === 'interactive' || cmd === 'i') {
    await interactiveMode();
  } else if (cmd === '--help' || cmd === '-h') {
    console.log(`
用法:
  node portfolio.js                      查看持仓
  node portfolio.js add <币种> <数量> <均价>  添加
  node portfolio.js remove <币种>           删除
  node portfolio.js update <币种> <数量>     更新
  node portfolio.js interactive           交互模式

示例:
  node portfolio.js add BTC 0.5 68000
  node portfolio.js add ETH 2 2100
  node portfolio.js remove DOGE`);
  } else {
    await showPortfolio();
  }
}

main().catch(console.error);
