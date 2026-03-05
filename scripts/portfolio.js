#!/usr/bin/env node
/**
 * AlphaMind Lite - 投资组合分析
 * 支持多币种持仓，计算总价值、分布、风险
 */

const https = require('https');

// 获取币种价格
function fetchPrice(symbol) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.binance.com',
      path: `/api/v3/ticker/24hr?symbol=${symbol}USDT`,
      method: 'GET'
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// 投资组合配置
const portfolio = {
  // 币种配置: 数量, 平均成本价
  BTC: { quantity: 0.5, avgCost: 68000 },
  ETH: { quantity: 5, avgCost: 3200 },
  BNB: { quantity: 20, avgCost: 580 },
  SOL: { quantity: 50, avgCost: 120 },
  XRP: { quantity: 5000, avgCost: 0.52 },
  ADA: { quantity: 10000, avgCost: 0.45 }
};

// 计算单个币种持仓
async function calculateHolding(symbol, holding) {
  try {
    const priceData = await fetchPrice(symbol);
    const currentPrice = parseFloat(priceData.lastPrice);
    const costBasis = holding.quantity * holding.avgCost;
    const currentValue = holding.quantity * currentPrice;
    const pnl = currentValue - costBasis;
    const pnlPercent = (pnl / costBasis) * 100;
    const change24h = parseFloat(priceData.priceChangePercent);

    return {
      symbol,
      quantity: holding.quantity,
      avgCost: holding.avgCost,
      currentPrice,
      costBasis,
      currentValue,
      pnl,
      pnlPercent,
      change24h
    };
  } catch (e) {
    // Demo 数据
    const demoPrices = { BTC: 73500, ETH: 3350, BNB: 620, SOL: 145, XRP: 0.58, ADA: 0.48 };
    const currentPrice = demoPrices[symbol] || 1;
    const costBasis = holding.quantity * holding.avgCost;
    const currentValue = holding.quantity * currentPrice;
    const pnl = currentValue - costBasis;
    const pnlPercent = (pnl / costBasis) * 100;

    return {
      symbol,
      quantity: holding.quantity,
      avgCost: holding.avgCost,
      currentPrice,
      costBasis,
      currentValue,
      pnl,
      pnlPercent,
      change24h: 0,
      demo: true
    };
  }
}

// 计算组合统计
function calculatePortfolioStats(holdings) {
  const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const totalCost = holdings.reduce((sum, h) => sum + h.costBasis, 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPercent = (totalPnl / totalCost) * 100;

  // 计算分布
  const distribution = holdings.map(h => ({
    symbol: h.symbol,
    percent: (h.currentValue / totalValue) * 100,
    value: h.currentValue
  })).sort((a, b) => b.percent - a.percent);

  // 风险指标
  const avgChange24h = holdings.reduce((sum, h) => sum + Math.abs(h.change24h), 0) / holdings.length;
  const volatility = avgChange24h > 5 ? '高 🔴' : avgChange24h > 2 ? '中 🟡' : '低 🟢';

  return { totalValue, totalCost, totalPnl, totalPnlPercent, distribution, volatility, avgChange24h };
}

// 打印报告
function printPortfolioReport(holdings, stats) {
  console.log('═══════════════════════════════════════════════════════');
  console.log('           📊 投资组合分析报告');
  console.log('═══════════════════════════════════════════════════════\n');

  // 持仓明细
  console.log('📋 持仓明细:');
  console.log('─────────────────────────────────────────────────────');
  console.log('  币种    数量        均价       现价      价值        24h涨跌   盈亏');
  console.log('─────────────────────────────────────────────────────');
  
  holdings.forEach(h => {
    const emoji = h.pnl >= 0 ? '📈' : '📉';
    const pnlStr = `${emoji} ${h.pnl >= 0 ? '+' : ''}${h.pnlPercent.toFixed(2)}%`;
    const changeEmoji = h.change24h >= 0 ? '🟢' : '🔴';
    const demoStr = h.demo ? ' [demo]' : '';
    console.log(
      `  ${h.symbol.padEnd(6)} ${h.quantity.toString().padEnd(10)} $${h.avgCost.toFixed(2).padEnd(9)} $${h.currentPrice.toFixed(2).padEnd(9)} $${h.currentValue.toFixed(0).padEnd(9)} ${changeEmoji}${h.change24h >= 0 ? '+' : ''}${h.change24h.toFixed(2)}% ${pnlStr}${demoStr}`
    );
  });

  console.log('─────────────────────────────────────────────────────\n');

  // 组合统计
  console.log('📈 组合统计:');
  console.log('─────────────────────────────────────────────────────');
  console.log(`  💰 总价值: $${stats.totalValue.toFixed(2)}`);
  console.log(`  💵 总成本: $${stats.totalCost.toFixed(2)}`);
  const pnlEmoji = stats.totalPnl >= 0 ? '📈' : '📉';
  console.log(`  ${pnlEmoji} 总盈亏: $${stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toFixed(2)} (${stats.totalPnlPercent >= 0 ? '+' : ''}${stats.totalPnlPercent.toFixed(2)}%)`);
  console.log('');

  // 分布
  console.log('📊 资产分布:');
  stats.distribution.forEach(d => {
    const bar = '█'.repeat(Math.ceil(d.percent / 5));
    console.log(`  ${d.symbol.padEnd(6)} ${bar.padEnd(20)} ${d.percent.toFixed(1)}%`);
  });
  console.log('');

  // 风险
  console.log('⚠️  风险指标:');
  console.log('─────────────────────────────────────────────────────');
  console.log(`  波动率: ${stats.volatility}`);
  console.log(`  24h平均涨跌幅: ${stats.avgChange24h.toFixed(2)}%`);
  console.log(`  持仓币种数: ${holdings.length}`);
  console.log('');

  // 建议
  console.log('💡 投资建议:');
  console.log('─────────────────────────────────────────────────────');
  if (stats.totalPnlPercent > 20) {
    console.log('  ✅ 组合表现优秀，可考虑部分止盈');
  } else if (stats.totalPnlPercent > 0) {
    console.log('  ✅ 组合盈利中，继续持有');
  } else if (stats.totalPnlPercent > -15) {
    console.log('  ⚠️ 组合小幅亏损，可考虑分批加仓');
  } else {
    console.log('  🔴 组合亏损较大，注意风险，可考虑定投摊低成本');
  }
  console.log('═══════════════════════════════════════════════════════\n');
}

async function main() {
  console.log('🔄 正在获取投资组合数据...\n');

  const symbols = Object.keys(portfolio);
  const holdings = await Promise.all(
    symbols.map(symbol => calculateHolding(symbol, portfolio[symbol]))
  );

  const stats = calculatePortfolioStats(holdings);
  printPortfolioReport(holdings, stats);
}

main().catch(console.error);
