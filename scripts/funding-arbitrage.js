#!/usr/bin/env node
/**
 * AlphaMind Lite - Funding Rate Arbitrage Analyzer
 * 资金费率套利分析器
 * 
 * 功能:
 * - 监控多币种合约资金费率
 * - 计算资金费率套利年化收益
 * - 识别费率异常币种
 * - 智能提醒高收益机会
 * 
 * @author musk 🚀
 * @date 2026-03-05
 */

const https = require('https');

// ============ 配置 ============
const CONFIG = {
  // 监控的币种 (USDT 合约)
  symbols: [
    'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 
    'DOT', 'MATIC', 'LINK', 'ATOM', 'UNI', 'LTC', 'ETC'
  ],
  
  // 资金费率阈值 (超过此值视为高费率)
  fundingRateThreshold: 0.0001, // 0.01%
  
  // 套利年化计算参数
  fundingIntervalHours: 8,       // 资金费率结算周期
  makerFee: 0.0002,              // Maker 手续费 (0.02%)
  takerFee: 0.0004,              // Taker 手续费 (0.04%)
  
  // Telegram 推送 (预留)
  telegramEnabled: false,
};

// ============ 工具函数 ============

/**
 * 获取 Binance USDT 合约列表
 */
function getUsdtContracts() {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'fapi.binance.com',
      path: '/fapi/v1/exchangeInfo',
      method: 'GET',
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const usdtContracts = json.symbols
            .filter(s => s.quoteAsset === 'USDT' && s.contractType === 'PERPETUAL')
            .map(s => s.baseAsset);
          resolve(usdtContracts);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timeout')));
    req.end();
  });
}

/**
 * 获取单币种资金费率
 */
function getFundingRate(symbol) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'fapi.binance.com',
      path: `/fapi/v1/premiumIndex?symbol=${symbol}USDT`,
      method: 'GET',
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({
            symbol: json.symbol,
            fundingRate: parseFloat(json.lastFundingRate),
            fundingTime: json.nextFundingTime,
            markPrice: parseFloat(json.markPrice),
            indexPrice: parseFloat(json.indexPrice),
            estimated: parseFloat(json.estimatedSettlePrice)
          });
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => resolve(null));
    req.end();
  });
}

/**
 * 获取多个币种资金费率 (批量)
 */
async function getAllFundingRates(symbols) {
  console.log('📡 正在获取资金费率数据...\n');
  
  const results = await Promise.all(
    symbols.map(async (symbol) => {
      const data = await getFundingRate(symbol);
      return data;
    })
  );
  
  return results.filter(r => r !== null);
}

/**
 * 计算年化收益率
 */
function calculateAPY(fundingRate) {
  // 每天3次资金结算 (8小时一次)
  const dailyFunding = fundingRate * 3;
  const yearlyAPY = Math.pow(1 + dailyFunding, 365) - 1;
  return yearlyAPY * 100;
}

/**
 * 计算套利收益 (考虑手续费)
 */
function calculateArbitrageYield(fundingRate, positionSize = 10000) {
  // 单次资金收益
  const singleFunding = positionSize * fundingRate;
  
  // 年化
  const apy = calculateAPY(fundingRate);
  
  // 扣除手续费后的净收益 (假设做市商挂单)
  const feeCost = CONFIG.makerFee * 2; // 开仓 + 平仓
  const netAPY = apy - (feeCost * 100);
  
  return {
    grossAPY: apy.toFixed(2),
    netAPY: netAPY.toFixed(2),
    singleFunding: (singleFunding * 3).toFixed(2), // 每日
    monthly: (singleFunding * 3 * 30).toFixed(2)
  };
}

/**
 * 格式化时间
 */
function formatFundingTime(timestamp) {
  const date = new Date(parseInt(timestamp));
  return date.toLocaleString('zh-CN', { 
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ============ 主逻辑 ============

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   💰 AlphaMind - 资金费率套利分析器');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log('📊 监控币种:', CONFIG.symbols.length, '个主流币种\n');
  
  // 过滤有效的币种
  const validSymbols = CONFIG.symbols.filter(s => 
    s && s.length > 0 && s !== 'USDT'
  );
  
  // 获取资金费率数据
  const fundingData = await getAllFundingRates(validSymbols);
  
  if (fundingData.length === 0) {
    console.log('❌ 无法获取资金费率数据，请检查网络连接\n');
    return;
  }
  
  // 按资金费率排序
  fundingData.sort((a, b) => Math.abs(b.fundingRate) - Math.abs(a.fundingRate));
  
  // 打印表格
  console.log('┌────────────┬────────────┬────────────┬────────────┬────────────┐');
  console.log('│   币种     │  资金费率  │   标记价格  │  预估年化   │  风险评估  │');
  console.log('├────────────┼────────────┼────────────┼────────────┼────────────┤');
  
  let opportunities = [];
  
  for (const data of fundingData) {
    const rate = data.fundingRate;
    const ratePercent = (rate * 100).toFixed(4);
    const yieldCalc = calculateArbitrageYield(rate);
    const apy = parseFloat(yieldCalc.grossAPY);
    
    // 费率显示
    const rateDisplay = rate >= 0 
      ? `+${ratePercent}%` 
      : `${ratePercent}%`;
    
    // 风险评估
    let riskLevel = '🟢 正常';
    if (Math.abs(rate) > 0.001) riskLevel = '🟡 偏高';
    if (Math.abs(rate) > 0.003) riskLevel = '🔴 极高';
    
    // 年化收益显示
    const apyDisplay = rate > 0 
      ? `${yieldCalc.netAPY}%` 
      : '-';
    
    console.log(
      `│ ${data.symbol.padEnd(10)} │ ${rateDisplay.padEnd(10)} │ ` +
      `$${parseFloat(data.markPrice).toLocaleString().padEnd(10)} │ ` +
      `${apyDisplay.padEnd(10)} │ ${riskLevel} │`
    );
    
    // 记录高收益机会
    if (rate > CONFIG.fundingRateThreshold) {
      opportunities.push({
        symbol: data.symbol,
        rate: ratePercent,
        apy: apyDisplay,
        markPrice: data.markPrice,
        fundingTime: data.fundingTime
      });
    }
  }
  
  console.log('└────────────┴────────────┴────────────┴────────────┴────────────┘\n');
  
  // 高收益机会分析
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   ⚡ 高收益机会分析 (资金费率 > 0.01%)');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  if (opportunities.length > 0) {
    console.log('🔥 发现', opportunities.length, '个潜在套利机会:\n');
    
    opportunities.forEach((opp, i) => {
      console.log(`  ${i + 1}. ${opp.symbol}/USDT`);
      console.log(`     📈 资金费率: ${opp.rate}%`);
      console.log(`     💵 预估年化: ${opp.apy}%`);
      console.log(`     💰 标记价格: $${opp.markPrice.toLocaleString()}`);
      console.log(`     ⏰ 下次结算: ${formatFundingTime(opp.fundingTime)}`);
      console.log();
    });
    
    // 套利建议
    console.log('💡 套利策略建议:');
    console.log('  1. 买入现货 + 做空合约 对冲');
    console.log('  2. 持有到期赚取资金费率');
    console.log('  3. 关注手续费成本对净收益的影响');
    console.log('  4. 注意极端行情时的流动性风险');
  } else {
    console.log('  📊 当前无高资金费率机会');
    console.log('  💡 建议关注资金费率即将转正的币种');
  }
  
  // 资金费率方向统计
  const positiveCount = fundingData.filter(d => d.fundingRate > 0).length;
  const negativeCount = fundingData.filter(d => d.fundingRate < 0).length;
  const avgRate = fundingData.reduce((sum, d) => sum + d.fundingRate, 0) / fundingData.length;
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('   📈 市场情绪分析');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log(`  多头支付: ${positiveCount} 个币种 (${(positiveCount/fundingData.length*100).toFixed(0)}%)`);
  console.log(`  空头支付: ${negativeCount} 个币种 (${(negativeCount/fundingData.length*100).toFixed(0)}%)`);
  console.log(`  平均费率: ${(avgRate*100).toFixed(4)}%`);
  
  // 情绪判断
  if (positiveCount > negativeCount * 1.5) {
    console.log('\n  🔍 市场情绪: 多头占优');
    console.log('  📝 解读: 多数合约多方需要支付资金，市场偏向看多');
  } else if (negativeCount > positiveCount * 1.5) {
    console.log('\n  🔍 市场情绪: 空头占优');
    console.log('  📝 解读: 多数合约空方需要支付资金，市场偏向看空');
  } else {
    console.log('\n  🔍 市场情绪: 中性');
    console.log('  📝 解读: 多空力量相对均衡');
  }
  
  // 风险提示
  console.log('\n⚠️ 风险提示:');
  console.log('  • 资金费率套利并非无风险');
  console.log('  • 需要承担现货/合约价格波动风险');
  console.log('  • 极端行情可能导致大幅亏损');
  console.log('  • 本分析仅供参考，不构成投资建议');
  
  console.log('\n═══════════════════════════════════════════════════════════');
  
  // 返回数据供其他模块使用
  return {
    allData: fundingData,
    opportunities: opportunities,
    marketSentiment: {
      positive: positiveCount,
      negative: negativeCount,
      average: avgRate
    }
  };
}

// 导出模块
module.exports = {
  CONFIG,
  getFundingRate,
  calculateAPY,
  calculateArbitrageYield,
  main
};

// 独立运行时执行
if (require.main === module) {
  main().catch(console.error);
}
