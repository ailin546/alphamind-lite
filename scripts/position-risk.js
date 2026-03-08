#!/usr/bin/env node
/**
 * AlphaMind Lite - 仓位风险计算器
 * 计算持仓风险指标：当前价值、盈亏、爆仓距离、风险评级
 */

/**
 * 计算仓位风险
 * @param {Object} position - 仓位信息
 * @param {string} position.symbol - 交易对/币种
 * @param {number} position.quantity - 持仓数量
 * @param {number} position.entryPrice - 开仓价格（买入价）
 * @param {number} position.currentPrice - 当前市场价格
 * @param {number} position.leverage - 杠杆倍数
 * @returns {Object} 风险计算结果
 */
function calculatePositionRisk(position) {
  const { symbol, quantity, entryPrice, currentPrice, leverage } = position;
  
  // 1. 计算当前价值
  const currentValue = quantity * currentPrice;
  const entryValue = quantity * entryPrice;
  
  // 2. 计算盈亏金额
  const pnlAmount = currentValue - entryValue;
  
  // 3. 计算盈亏百分比 (基于保证金)
  const initialMargin = entryValue / leverage;
  const pnlPercentage = (pnlAmount / initialMargin) * 100;
  
  // 4. 计算爆仓价格（多单情况下）
  // 爆仓条件：保证金 + 未实现盈亏 <= 0
  // initialMargin + (liquidationPrice - entryPrice) * quantity = 0
  // liquidationPrice = entryPrice - (initialMargin / quantity)
  const liquidationPrice = entryPrice - (initialMargin / quantity);
  
  // 5. 计算距离爆仓百分比
  let liquidationDistancePercent;
  if (currentPrice > liquidationPrice) {
    liquidationDistancePercent = ((currentPrice - liquidationPrice) / currentPrice) * 100;
  } else {
    liquidationDistancePercent = -Infinity; // 已经爆仓
  }
  
  // 6. 风险评级
  let riskRating;
  if (liquidationDistancePercent <= 0) {
    riskRating = '已爆仓';
  } else if (liquidationDistancePercent < 5) {
    riskRating = '危险 🔴';
  } else if (liquidationDistancePercent < 15) {
    riskRating = '警告 🟡';
  } else {
    riskRating = '安全 🟢';
  }
  
  return {
    symbol,
    quantity,
    entryPrice: entryPrice.toFixed(2),
    currentPrice: currentPrice.toFixed(2),
    leverage: `${leverage}x`,
    currentValue: currentValue.toFixed(2),
    entryValue: entryValue.toFixed(2),
    pnlAmount: pnlAmount.toFixed(2),
    pnlPercentage: pnlPercentage.toFixed(2),
    initialMargin: initialMargin.toFixed(2),
    liquidationPrice: liquidationPrice.toFixed(2),
    liquidationDistancePercent: liquidationDistancePercent === -Infinity 
      ? '已爆仓' 
      : liquidationDistancePercent.toFixed(2),
    riskRating
  };
}

/**
 * 格式化输出风险报告
 * @param {Object} result - 风险计算结果
 */
function printRiskReport(result) {
  console.log('\n═══════════════════════════════════════════');
  console.log('           📊 仓位风险分析报告');
  console.log('═══════════════════════════════════════════\n');
  
  console.log(`  币种: ${result.symbol}`);
  console.log(`  持仓数量: ${result.quantity}`);
  console.log(`  开仓价格: $${result.entryPrice}`);
  console.log(`  当前价格: $${result.currentPrice}`);
  console.log(`  杠杆倍数: ${result.leverage}`);
  console.log('───────────────────────────────────────────');
  console.log(`  💰 当前价值: $${result.currentValue}`);
  console.log(`  💵 开仓价值: $${result.entryValue}`);
  console.log('───────────────────────────────────────────');
  
  const pnlEmoji = parseFloat(result.pnlAmount) >= 0 ? '📈' : '📉';
  const pnlColor = parseFloat(result.pnlAmount) >= 0 ? '+' : '';
  console.log(`  ${pnlEmoji} 未实现盈亏: $${pnlColor}${result.pnlAmount}`);
  console.log(`  📊 盈亏百分比(基于保证金): ${pnlColor}${result.pnlPercentage}%`);
  console.log(`  💼 初始保证金: $${result.initialMargin}`);
  console.log('───────────────────────────────────────────');
  console.log(`  ⚠️  爆仓价格: $${result.liquidationPrice}`);
  console.log(`  📏 距离爆仓: ${result.liquidationDistancePercent}%`);
  console.log('───────────────────────────────────────────');
  console.log(`  🎯 风险评级: ${result.riskRating}`);
  console.log('═══════════════════════════════════════════\n');
}

// 示例测试
function runExample() {
  console.log('🧪 运行示例仓位测试...\n');
  
  const examplePosition = {
    symbol: 'BTC',
    quantity: 0.5,
    entryPrice: 70000,
    currentPrice: 73300,
    leverage: 10
  };
  
  console.log('测试参数:');
  console.log(JSON.stringify(examplePosition, null, 2));
  
  const result = calculatePositionRisk(examplePosition);
  printRiskReport(result);
  
  return result;
}

// CLI 支持
function runCLI() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--example' || args[0] === '-e') {
    return runExample();
  }
  
  if (args[0] === '--help' || args[0] === '-h') {
    console.log(`
使用方法:
  node position-risk.js [选项]

选项:
  --example, -e     运行示例测试 (默认)
  --help, -h        显示帮助信息
  
或者直接传入参数:
  node position-risk.js <币种> <数量> <开仓价> <当前价> <杠杆>

示例:
  node position-risk.js BTC 0.5 70000 73300 10
`);
    return;
  }
  
  if (args.length >= 5) {
    const position = {
      symbol: args[0].toUpperCase(),
      quantity: parseFloat(args[1]),
      entryPrice: parseFloat(args[2]),
      currentPrice: parseFloat(args[3]),
      leverage: parseInt(args[4])
    };

    if (isNaN(position.quantity) || position.quantity <= 0) { console.log('❌ 数量必须为正数'); return; }
    if (isNaN(position.entryPrice) || position.entryPrice <= 0) { console.log('❌ 开仓价必须为正数'); return; }
    if (isNaN(position.currentPrice) || position.currentPrice <= 0) { console.log('❌ 当前价必须为正数'); return; }
    if (isNaN(position.leverage) || position.leverage < 1 || position.leverage > 125) { console.log('❌ 杠杆倍数范围: 1-125'); return; }

    const result = calculatePositionRisk(position);
    printRiskReport(result);
    return result;
  }

  console.log('⚠️  参数不足，运行示例测试...\n');
  console.log('💡 使用 --help 查看完整用法\n');
  return runExample();
}

// 导出模块（支持 require/import）
module.exports = { calculatePositionRisk, printRiskReport };

// 如果是直接运行
if (require.main === module) {
  runCLI();
}
