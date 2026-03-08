#!/usr/bin/env node
/**
 * AlphaMind Lite - Whale Alert (Real On-Chain Data)
 * 链上巨鲸活动监控 - 使用 Blockchain.com 公开 API 和 Binance 大单监控
 */

const { httpGet, fetchMarketData } = require('./api-client');

/**
 * 获取 BTC 最新区块中的大额交易
 * 使用 Blockchain.com 公开 API（无需 API key）
 */
async function fetchBTCLargeTransactions() {
  try {
    // 获取最新区块 hash
    const latestBlock = await httpGet('https://blockchain.info/latestblock', { timeout: 10000, retries: 2 });
    const blockHash = latestBlock.hash;

    // 获取区块详情（只取前几笔大交易）
    const block = await httpGet(`https://blockchain.info/rawblock/${blockHash}?limit=20`, { timeout: 15000, retries: 2 });

    const largeTxs = [];
    const BTC_TO_SAT = 100000000;
    const MIN_BTC = 100; // 只显示 >= 100 BTC 的交易

    for (const tx of (block.tx || []).slice(0, 50)) {
      let totalOutput = 0;
      for (const out of tx.out || []) {
        totalOutput += out.value || 0;
      }
      const btcAmount = totalOutput / BTC_TO_SAT;
      if (btcAmount >= MIN_BTC) {
        largeTxs.push({
          hash: tx.hash.slice(0, 16) + '...',
          btc: btcAmount,
          outputs: tx.out?.length || 0,
          time: tx.time ? new Date(tx.time * 1000).toLocaleString() : 'Unknown',
        });
      }
    }

    return { blockHeight: block.height, blockHash: blockHash.slice(0, 16) + '...', transactions: largeTxs.slice(0, 10) };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * 获取 Binance 最近大额成交（使用 aggTrades 接口）
 */
async function fetchBinanceLargeTrades(symbol = 'BTCUSDT', minUSD = 500000) {
  try {
    const trades = await httpGet(
      `https://api.binance.com/api/v3/aggTrades?symbol=${symbol}&limit=100`,
      { timeout: 10000, retries: 2 }
    );

    const largeTrades = [];
    for (const t of trades) {
      const price = parseFloat(t.p);
      const qty = parseFloat(t.q);
      const usdValue = price * qty;
      if (usdValue >= minUSD) {
        largeTrades.push({
          price,
          qty,
          usd: usdValue,
          side: t.m ? 'SELL' : 'BUY', // m=true means buyer is maker (seller initiated)
          time: new Date(t.T).toLocaleTimeString(),
        });
      }
    }

    return largeTrades;
  } catch (err) {
    return [];
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   🐋 AlphaMind - 巨鲸活动监控 (Real Data)');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. Market overview
  console.log('📊 当前市场:');
  try {
    const market = await fetchMarketData('BTCUSDT');
    const emoji = parseFloat(market.priceChangePercent) >= 0 ? '🟢' : '🔴';
    console.log(`  BTC: $${parseFloat(market.lastPrice).toLocaleString()} ${emoji} ${parseFloat(market.priceChangePercent).toFixed(2)}%`);
    console.log(`  24h 成交量: $${(parseFloat(market.quoteVolume) / 1e9).toFixed(2)}B`);
  } catch {
    console.log('  ⚠️ 无法获取市场数据');
  }

  // 2. Binance large trades
  console.log('\n🔥 Binance 近期大额成交 (>$500K):');
  console.log('  ' + '─'.repeat(55));

  const largeTrades = await fetchBinanceLargeTrades('BTCUSDT', 500000);
  if (largeTrades.length > 0) {
    let buyVol = 0, sellVol = 0;
    for (const t of largeTrades.slice(0, 10)) {
      const emoji = t.side === 'BUY' ? '🟢' : '🔴';
      console.log(`  ${emoji} ${t.side.padEnd(4)} ${t.qty.toFixed(4)} BTC @ $${t.price.toLocaleString()} = $${(t.usd / 1000).toFixed(0)}K  [${t.time}]`);
      if (t.side === 'BUY') buyVol += t.usd; else sellVol += t.usd;
    }
    console.log('  ' + '─'.repeat(55));
    const total = buyVol + sellVol;
    const buyRatio = total > 0 ? ((buyVol / total) * 100).toFixed(1) : '0';
    const sellRatio = total > 0 ? ((sellVol / total) * 100).toFixed(1) : '0';
    console.log(`  大单买入: $${(buyVol / 1e6).toFixed(2)}M (${buyRatio}%)  |  大单卖出: $${(sellVol / 1e6).toFixed(2)}M (${sellRatio}%)`);

    if (buyVol > sellVol * 1.5) console.log('  📈 大单买入压力明显，多头占优');
    else if (sellVol > buyVol * 1.5) console.log('  📉 大单卖出压力明显，空头占优');
    else console.log('  ⚖️ 多空力量均衡');
  } else {
    console.log('  暂无大额成交记录');
  }

  // 3. BTC on-chain large transactions
  console.log('\n⛓️  BTC 链上大额转账 (最新区块, ≥100 BTC):');
  console.log('  ' + '─'.repeat(55));

  const onchain = await fetchBTCLargeTransactions();
  if (onchain.error) {
    console.log(`  ⚠️ 链上数据获取失败: ${onchain.error}`);
    console.log('  (Blockchain.com API 可能受区域限制)');
  } else {
    console.log(`  区块高度: #${onchain.blockHeight}  Hash: ${onchain.blockHash}`);
    if (onchain.transactions.length > 0) {
      for (const tx of onchain.transactions) {
        const emoji = tx.btc >= 1000 ? '🐋' : tx.btc >= 500 ? '🦈' : '🐟';
        console.log(`  ${emoji} ${tx.btc.toFixed(2)} BTC  |  Tx: ${tx.hash}  |  ${tx.time}`);
      }
    } else {
      console.log('  该区块内暂无 ≥100 BTC 的大额交易');
    }
  }

  console.log('\n💡 解读:');
  console.log('  • 🐋 ≥1000 BTC: 超级巨鲸   🦈 ≥500 BTC: 大户   🐟 ≥100 BTC: 中型玩家');
  console.log('  • 大量链上转入交易所 → 可能抛售信号');
  console.log('  • 大量从交易所转出   → 可能囤积信号');
  console.log('  • Binance 大单买卖比可反映即时市场情绪');

  console.log('\n═══════════════════════════════════════════════════════════');
}

main().catch(console.error);
