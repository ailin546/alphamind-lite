#!/usr/bin/env node
/**
 * AlphaMind Lite - Arbitrage Scanner (Real Data)
 * 真实套利机会扫描：现货 vs 合约价差分析
 * 使用 Binance 现货 + 期货 API
 */

const { httpGet } = require('./api-client');

const SYMBOLS = ['BTC', 'ETH', 'BNB', 'SOL', 'DOGE', 'XRP', 'ADA', 'AVAX', 'LINK', 'DOT'];

/**
 * 获取现货价格
 */
async function fetchSpotPrice(symbol) {
  const data = await httpGet(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}USDT`, { timeout: 5000 });
  return parseFloat(data.price);
}

/**
 * 获取合约标记价格和资金费率
 */
async function fetchFuturesData(symbol) {
  const data = await httpGet(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}USDT`, { timeout: 5000 });
  return {
    markPrice: parseFloat(data.markPrice),
    indexPrice: parseFloat(data.indexPrice),
    fundingRate: parseFloat(data.lastFundingRate),
    nextFunding: data.nextFundingTime,
  };
}

/**
 * 获取24h行情数据
 */
async function fetchSpot24h(symbol) {
  const data = await httpGet(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}USDT`, { timeout: 5000 });
  return {
    price: parseFloat(data.lastPrice),
    high: parseFloat(data.highPrice),
    low: parseFloat(data.lowPrice),
    volume: parseFloat(data.quoteVolume),
    change: parseFloat(data.priceChangePercent),
  };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   🔍 AlphaMind - 套利机会扫描 (Real Data)');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('📡 扫描现货-合约价差...\n');

  const results = [];

  for (const sym of SYMBOLS) {
    try {
      const [spot, futures, market] = await Promise.all([
        fetchSpotPrice(sym).catch(() => null),
        fetchFuturesData(sym).catch(() => null),
        fetchSpot24h(sym).catch(() => null),
      ]);

      if (!spot || !futures) continue;

      // Basis = (Futures - Spot) / Spot * 100
      const basis = ((futures.markPrice - spot) / spot) * 100;
      const fundingAPY = futures.fundingRate * 3 * 365 * 100; // 3 times/day * 365 days
      const dayRange = market ? ((market.high - market.low) / market.low * 100) : 0;

      results.push({
        symbol: sym,
        spotPrice: spot,
        futuresPrice: futures.markPrice,
        basis,
        fundingRate: futures.fundingRate * 100,
        fundingAPY,
        dayRange,
        volume: market?.volume || 0,
        change: market?.change || 0,
      });
    } catch {
      // Skip failed symbols
    }
  }

  if (results.length === 0) {
    console.log('  ❌ 无法获取数据\n');
    return;
  }

  // Sort by absolute basis
  results.sort((a, b) => Math.abs(b.basis) - Math.abs(a.basis));

  // Table
  console.log('  币种     现货价格         合约价格         基差%     费率%    费率APY%');
  console.log('  ' + '─'.repeat(68));

  for (const r of results) {
    const basisEmoji = r.basis > 0.1 ? '🔺' : r.basis < -0.1 ? '🔻' : '⚖️';
    console.log(
      `  ${r.symbol.padEnd(6)}` +
      `  $${r.spotPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}).padStart(14)}` +
      `  $${r.futuresPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}).padStart(14)}` +
      `  ${basisEmoji} ${r.basis >= 0 ? '+' : ''}${r.basis.toFixed(4)}%` +
      `  ${r.fundingRate >= 0 ? '+' : ''}${r.fundingRate.toFixed(4)}%` +
      `  ${r.fundingAPY >= 0 ? '+' : ''}${r.fundingAPY.toFixed(1)}%`
    );
  }

  // Opportunities
  console.log('\n📊 套利机会分析:\n');

  // 1. High basis spread
  const highBasis = results.filter(r => Math.abs(r.basis) > 0.1);
  if (highBasis.length > 0) {
    console.log('  🎯 基差套利机会 (|基差| > 0.1%):');
    for (const r of highBasis) {
      if (r.basis > 0.1) {
        console.log(`    ${r.symbol}: 合约溢价 ${r.basis.toFixed(3)}% → 做空合约 + 做多现货`);
      } else {
        console.log(`    ${r.symbol}: 合约折价 ${r.basis.toFixed(3)}% → 做多合约 + 做空现货`);
      }
    }
  } else {
    console.log('  ⚖️ 当前基差较小，无明显基差套利机会');
  }

  // 2. Funding rate opportunities
  console.log('');
  const highFunding = results.filter(r => Math.abs(r.fundingAPY) > 20);
  if (highFunding.length > 0) {
    console.log('  💰 费率套利机会 (|APY| > 20%):');
    for (const r of highFunding) {
      if (r.fundingRate > 0) {
        console.log(`    ${r.symbol}: 费率 ${r.fundingRate.toFixed(4)}% (APY ${r.fundingAPY.toFixed(1)}%) → 做空合约收取费率`);
      } else {
        console.log(`    ${r.symbol}: 费率 ${r.fundingRate.toFixed(4)}% (APY ${r.fundingAPY.toFixed(1)}%) → 做多合约收取费率`);
      }
    }
  } else {
    console.log('  ⚖️ 费率正常，无高收益费率套利机会');
  }

  // 3. High volatility
  console.log('');
  const highVol = results.filter(r => r.dayRange > 5).sort((a, b) => b.dayRange - a.dayRange);
  if (highVol.length > 0) {
    console.log('  ⚡ 高波动币种 (日内振幅 > 5%):');
    for (const r of highVol) {
      console.log(`    ${r.symbol}: 振幅 ${r.dayRange.toFixed(2)}%  24h涨跌 ${r.change >= 0 ? '+' : ''}${r.change.toFixed(2)}%`);
    }
  } else {
    console.log('  📉 市场波动较低，日内交易机会有限');
  }

  console.log('\n  ⚠️ 风险提示:');
  console.log('  • 套利需要同时操作现货和合约，存在执行风险');
  console.log('  • 手续费（Maker 0.02% + Taker 0.04%）会侵蚀利润');
  console.log('  • 合约有强制平仓风险，需预留充足保证金');
  console.log('  • 数据为实时快照，价差可能瞬间变化');

  console.log('\n═══════════════════════════════════════════════════════════');
}

main().catch(console.error);
