#!/usr/bin/env node
/**
 * AlphaMind Lite - Interactive Menu
 * 真正可交互的功能选择菜单
 */

const { execSync, spawn } = require('child_process');
const readline = require('readline');
const path = require('path');

const SCRIPTS_DIR = path.join(__dirname);

const MENU_ITEMS = [
  { key: '1', label: '📊 市场概览', desc: '主流币种实时行情', script: 'demo.js' },
  { key: '2', label: '🎯 恐慌指数', desc: 'Fear & Greed Index 分析', script: 'fear-greed.js' },
  { key: '3', label: '💼 持仓分析', desc: '投资组合盈亏分析', script: 'portfolio.js' },
  { key: '4', label: '📈 市场情绪', desc: '综合市场情绪分析', script: 'market-sentiment.js' },
  { key: '5', label: '🔔 价格提醒', desc: '设置价格阈值提醒', script: 'alerts.js' },
  { key: '6', label: '👀 价格监控', desc: '多币种实时监控', script: 'price-watcher.js' },
  { key: '7', label: '🛡️ 仓位风控', desc: '杠杆仓位风险计算', script: 'position-risk.js' },
  { key: '8', label: '🔍 套利扫描', desc: '现货-合约价差分析', script: 'arbitrage.js' },
  { key: '9', label: '💹 资金费率', desc: '永续合约费率套利', script: 'funding-arbitrage.js' },
  { key: 'a', label: '💰 定投计算', desc: '历史模拟 DCA 收益', script: 'dca-calculator.js' },
  { key: 'b', label: '🐋 大户监控', desc: '链上巨鲸活动追踪', script: 'whale-alert.js' },
  { key: 'c', label: '💼 管理持仓', desc: '添加/删除/修改持仓', script: 'portfolio.js', args: ['interactive'] },
];

function printMenu() {
  console.clear();
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║             🤖 AlphaMind Lite - 交互式菜单                ║
╚════════════════════════════════════════════════════════════════╝
`);
  for (const item of MENU_ITEMS) {
    console.log(`   ${item.key})  ${item.label.padEnd(14)} ${item.desc}`);
  }
  console.log(`
   q)  ❌ 退出
`);
  console.log('─'.repeat(62));
}

function runScript(scriptName, args = []) {
  const scriptPath = path.join(SCRIPTS_DIR, scriptName);
  try {
    const result = execSync(
      `node "${scriptPath}" ${args.join(' ')}`,
      { encoding: 'utf8', stdio: 'inherit', maxBuffer: 10 * 1024 * 1024 }
    );
  } catch (e) {
    // execSync with stdio:inherit already printed output
  }
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise(resolve => rl.question(q, resolve));

  while (true) {
    printMenu();
    const choice = (await ask('  请选择 [1-9, a-c, q]: ')).trim().toLowerCase();

    if (choice === 'q' || choice === 'exit') {
      console.log('\n  👋 再见！祝交易顺利！\n');
      break;
    }

    const item = MENU_ITEMS.find(m => m.key === choice);
    if (!item) {
      console.log('\n  ❌ 无效选项，请重新选择');
      await ask('  按回车继续...');
      continue;
    }

    console.log(`\n  🚀 启动: ${item.label}\n`);
    runScript(item.script, item.args || []);

    await ask('\n  按回车返回菜单...');
  }

  rl.close();
}

main().catch(console.error);
