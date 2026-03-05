#!/usr/bin/env node
/**
 * AlphaMind Lite - Market Correlation Analyzer
 * 计算多个币种与 BTC 的短期相关性，辅助判断是否需要分散风险
 *
 * 用法:
 *   node scripts/market-correlation.js
 *   node scripts/market-correlation.js BTC,ETH,SOL,BNB 120
 */

const https = require('https');

const DEFAULT_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];
const INTERVAL = '1h';

function fetchWithTimeout(url, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    });

    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.on('error', reject);
  });
}

async function getClosePrices(symbol, limit = 120) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${INTERVAL}&limit=${limit}`;
  const raw = await fetchWithTimeout(url);
  const arr = JSON.parse(raw);

  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error(`无效K线数据: ${symbol}`);
  }

  return arr.map((k) => Number(k[4])).filter((n) => Number.isFinite(n));
}

function returns(series) {
  const out = [];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1];
    const curr = series[i];
    if (prev > 0 && curr > 0) out.push((curr - prev) / prev);
  }
  return out;
}

function pearson(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 3) return NaN;

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i];
    const b = y[i];
    sumX += a;
    sumY += b;
    sumXY += a * b;
    sumX2 += a * a;
    sumY2 += b * b;
  }

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  if (!Number.isFinite(denominator) || denominator === 0) return NaN;

  return numerator / denominator;
}

function colorByCorr(v) {
  if (!Number.isFinite(v)) return '⚪';
  if (v >= 0.8) return '🔴';
  if (v >= 0.5) return '🟠';
  if (v >= 0.2) return '🟡';
  if (v > -0.2) return '🟢';
  return '🔵';
}

function suggestion(v) {
  if (!Number.isFinite(v)) return '数据不足';
  if (v >= 0.8) return '与BTC高度同步，分散效果弱';
  if (v >= 0.5) return '相关性偏高，注意系统性风险';
  if (v >= 0.2) return '中等相关，可小比例配置';
  if (v > -0.2) return '低相关，具备一定分散价值';
  return '负相关，可能有对冲价值';
}

async function main() {
  const argvSymbols = process.argv[2]
    ? process.argv[2].split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
    : DEFAULT_SYMBOLS;

  const limit = Number(process.argv[3]) || 120;
  const symbols = Array.from(new Set(argvSymbols.map((s) => (s.endsWith('USDT') ? s : `${s}USDT`))));

  if (!symbols.includes('BTCUSDT')) symbols.unshift('BTCUSDT');

  console.log('═══════════════════════════════════════════════════');
  console.log('   🔗 AlphaMind Lite - 市场相关性分析');
  console.log('═══════════════════════════════════════════════════');
  console.log(`周期: ${INTERVAL} | 样本: ${limit} 根K线\n`);

  const priceMap = {};
  for (const s of symbols) {
    try {
      priceMap[s] = await getClosePrices(s, limit);
    } catch (err) {
      console.log(`❌ ${s} 获取失败: ${err.message}`);
    }
  }

  if (!priceMap.BTCUSDT) {
    console.log('\n❌ BTCUSDT 数据不可用，无法计算相关性');
    process.exit(1);
  }

  const btcRet = returns(priceMap.BTCUSDT);
  const rows = [];

  for (const s of symbols) {
    if (s === 'BTCUSDT' || !priceMap[s]) continue;
    const r = pearson(btcRet, returns(priceMap[s]));
    rows.push({ symbol: s.replace('USDT', ''), corr: r });
  }

  if (rows.length === 0) {
    console.log('⚠️ 没有可对比的币种数据');
    return;
  }

  rows.sort((a, b) => (b.corr || -999) - (a.corr || -999));

  console.log('币种    与BTC相关系数   风险提示');
  console.log('----------------------------------------------');
  for (const row of rows) {
    const c = Number.isFinite(row.corr) ? row.corr.toFixed(3) : 'N/A';
    const emoji = colorByCorr(row.corr);
    console.log(`${row.symbol.padEnd(6)}  ${String(c).padStart(10)}     ${emoji} ${suggestion(row.corr)}`);
  }

  const lowCorr = rows.filter((r) => Number.isFinite(r.corr) && r.corr < 0.3).map((r) => r.symbol);
  console.log('\n💡 组合建议:');
  if (lowCorr.length > 0) {
    console.log(`  可关注低相关币种: ${lowCorr.join(', ')}`);
  } else {
    console.log('  当前样本内币种整体跟随BTC，建议控制总仓位杠杆');
  }

  console.log('\n相关性颜色说明: 🔴高相关 / 🟠偏高 / 🟡中等 / 🟢低相关 / 🔵负相关');
  console.log('═══════════════════════════════════════════════════');
}

main().catch((err) => {
  console.error(`\n❌ 执行失败: ${err.message}`);
  process.exit(1);
});
