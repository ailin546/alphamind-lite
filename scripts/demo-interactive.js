#!/usr/bin/env node
/**
 * AlphaMind Lite - Interactive Demo Menu
 * 交互式演示菜单
 */

const { execSync } = require('child_process');
const readline = require('readline');

const MENU = `
╔═══════════════════════════════════════════════════════════════════╗
║           🤖 AlphaMind Lite - 功能演示菜单                  ║
╚═══════════════════════════════════════════════════════════════════╝

  1️⃣  📊 市场概览      - 主流币种实时行情
  2️⃣  🎯 恐慌指数     - Fear & Greed Index
  3️⃣  💼 持仓分析     - 多币种盈亏计算
  4️⃣  📡 情报监控     - 最新公告新闻
  5️⃣  🛡️ 风控预警     - 仓位风险检测
  6️⃣  🔔 价格监控     - 阈值报警设置
  7️⃣  📈 市场情绪     - 综合情绪分析
  8️⃣  🔍 套利扫描     - 波动机会发现
  
  9️⃣  🚀 完整演示     - 所有功能一次展示
  
  0️⃣  📖 帮助        - 使用说明
  
  ❌ 退出

───────────────────────────────────────────────────────────
请输入选项 [0-9]:
`;

const COMMANDS = {
  '1': { cmd: 'curl -s "https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT"', desc: '📊 BTC 行情' },
  '2': { script: 'fear-greed.js', desc: '🎯 恐慌指数' },
  '3': { script: 'portfolio.js', desc: '💼 持仓分析' },
  '4': { script: 'tavily-news.js', desc: '📡 情报监控' },
  '5': { script: 'position-risk.js', desc: '🛡️ 风控预警' },
  '6': { script: 'price-watcher.js', desc: '🔔 价格监控' },
  '7': { script: 'market-sentiment.js', desc: '📈 市场情绪' },
  '8': { script: 'arbitrage.js', desc: '🔍 套利扫描' },
  '9': { script: 'comprehensive-demo.js', desc: '🚀 完整演示' },
};

const HELP = `
╔═══════════════════════════════════════════════════════════════════╗
║                    📖 AlphaMind Lite 使用帮助                  ║
╚═══════════════════════════════════════════════════════════════════╝

【快速开始】
  git clone https://github.com/ailin546/alphamind-lite
  cd alphamind-lite
  node scripts/demo-interactive.js

【单独运行功能】
  node scripts/comprehensive-demo.js   # 完整演示
  node scripts/portfolio.js          # 持仓分析
  node scripts/fear-greed.js         # 恐慌指数
  node scripts/market-sentiment.js   # 市场情绪

【配置】
  编辑 scripts/user-ai-chat.js 填入你的 API Key

【更多】
  查看 docs/ 目录下的详细文档

───────────────────────────────────────────────────────────
`;

function run(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', maxBuffer: 10*1024*1024 }); }
  catch (e) { return e.message; }
}

async function main() {
  console.log(MENU);
  
  // Auto-run option 9 for demo
  console.log('\n🎬 正在启动完整演示...\n');
  
  const result = run('node /root/.openclaw/workspace/binance-contest/scripts/comprehensive-demo.js');
  console.log(result);
  
  console.log('\n✅ 演示完成！');
  console.log('运行 node scripts/demo-interactive.js 选择其他功能');
}

main();
