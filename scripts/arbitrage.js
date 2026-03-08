#!/usr/bin/env node
/**
 * AlphaMind Lite - Arbitrage Scanner (Real Data)
 * 真实套利机会扫描：现货 vs 合约价差分析
 * 使用 Binance 现货 + 期货 API
 */

const { fetchMarketData, fetchFundingRates } = require('./api-client');

const SYMBOLS = ['BTC', 'ETH', 'BNB', 'SOL', 'DOGE', 'XRP', 'ADA', 'AVAX', 'LINK', 'DOT'];

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   🔍 AlphaMind - 套利机会扫描 (Real Data)');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('📡 扫描现货-合约价差...\n');

  // Fetch all symbols in parallel (2 calls per symbol instead of 3)
  const results = (await Promise.all(SYMBOLS.map(async (sym) => {
    try {
      const pair = `${sym}USDT`;
      const [market, futures] = await Promise.all([
        fetchMarketData(pair).catch(() => null),
        fetchFundingRates(pair).catch(() => null),
      ]);

      if (!market || !futures) return null;

      const spotPrice = parseFloat(market.lastPrice);
      const markPrice = parseFloat(futures.markPrice);
      const fundingRate = parseFloat(futures.lastFundingRate);
      const basis = ((markPrice - spotPrice) / spotPrice) * 100;
      const fundingAPY = fundingRate * 3 * 365 * 100;
      const high = parseFloat(market.highPrice);
      const low = parseFloat(market.lowPrice);
      const dayRange = low > 0 ? ((high - low) / low * 100) : 0;

      return {
        symbol: sym,
        spotPrice,
        futuresPrice: markPrice,
        basis,
        fundingRate: fundingRate * 100,
        fundingAPY,
        dayRange,
        volume: parseFloat(market.quoteVolume) || 0,
        change: parseFloat(market.priceChangePercent) || 0,
      };
    } catch {
      return null;
    }
  }))).filter(Boolean);

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
