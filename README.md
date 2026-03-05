# AlphaMind Lite 🦞

> **7×24 小时币安智能交易伙伴**  
> 让每个普通投资者都能获得机构级的交易智慧

[![GitHub Stars](https://img.shields.io/github/stars/ailin546/alphamind-lite)](https://github.com/ailin546/alphamind-lite)
[![Version](https://img.shields.io/badge/version-v2.4-blue)](https://github.com/ailin546/alphamind-lite)
[![License](https://img.shields.io/github/license/ailin546/alphamind-lite)](LICENSE)

---

## ✨ 核心功能一览

| 功能 | 描述 | 命令 |
|------|------|------|
| 📊 实时行情 | Binance 主流币种实时数据 | `node scripts/comprehensive-demo.js` |
| 🎯 恐慌指数 | Fear & Greed Index + AI 建议 | `node scripts/fear-greed.js` |
| 💼 持仓分析 | 多币种盈亏 + 风险评估 | `node scripts/portfolio.js` |
| 📡 情报监控 | 公告 + 新闻 + KOL 信号 | `node scripts/tavily-news.js` |
| 🛡️ 风控预警 | 仓位健康 + 爆仓计算 | `node scripts/position-risk.js` |
| 🔔 价格监控 | 阈值报警 + 实时推送 | `node scripts/price-watcher.js` |
| 📈 市场情绪 | 综合分析 + 操作建议 | `node scripts/market-sentiment.js` |
| 💬 AI 对话 | OpenClaw Agent 自然语言 | `node scripts/ai-demo.js` |

---

## 🚀 快速开始

```bash
# 克隆项目
git clone https://github.com/ailin546/alphamind-lite.git
cd alphamind-lite

# 运行完整演示
node scripts/comprehensive-demo.js

# 或运行单个功能
node scripts/market-sentiment.js   # 市场情绪分析
node scripts/price-watcher.js      # 价格监控
```

---

## 📁 项目结构

```
alphamind-lite/
├── scripts/
│   ├── comprehensive-demo.js    # 完整演示
│   ├── market-sentiment.js     # 市场情绪分析 ⭐新增
│   ├── price-watcher.js        # 价格监控 ⭐新增
│   ├── portfolio.js            # 持仓分析
│   ├── fear-greed.js          # 恐慌指数
│   ├── position-risk.js       # 风控预警
│   ├── tavily-news.js         # 情报监控
│   └── ai-demo.js             # AI 对话
├── docs/
│   ├── product-spec.md         # 产品规格
│   ├── user-guide.md          # 用户指南
│   ├── business-plan.md       # 商业计划
│   ├── roadmap.md             # 路线图 ⭐新增
│   ├── changelog.md           # 更新日志 ⭐新增
│   └── demo-script.md         # 演示脚本
├── skills/                     # OpenClaw 技能
├── README.md
└── LICENSE
```

---

## 📊 演示效果

```
╔══════════════════════════════════════════════════════════════════╗
║          🤖 AlphaMind Lite - 市场情绪分析 (v2.4)              ║
╠══════════════════════════════════════════════════════════════════╣
║  🎯 恐慌指数: 22/100 (极度恐慌)                               ║
║  📈 BTC 趋势: 下跌 (24h均价 $72,774)                           ║
║                                                                  ║
║  🧠 综合分析:                                                  ║
║  ✓ 极度恐慌 + 下跌 = 可能是分批买入机会                        ║
║                                                                  ║
║  💡 操作建议:                                                   ║
║  • 可考虑分批建仓                                              ║
║  • 不要梭哈，留足应急资金                                      ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## 🛠️ 技术栈

- **Runtime**: OpenClaw Gateway
- **Data**: Binance API, alternative.me, Tavily
- **Language**: Node.js

---

## 📄 文档

- [产品规格](docs/product-spec.md)
- [用户指南](docs/user-guide.md)
- [商业计划](docs/business-plan.md)
- [产品路线图](docs/roadmap.md)
- [更新日志](docs/changelog.md)

---

## 👥 团队

| 角色 | 负责 |
|------|------|
| main | 首席开发 |
| thiel | 商业策划 |
| jobs | 产品体验 |
| nadella | 生态集成 |
| ren | 本地化 |

---

## 🤝 欢迎贡献

- ⭐ Star 我们
- 🐛 提交 Bug
- 💡 提出建议
- 📝 贡献代码

---

**让 AI 成为你的交易伙伴** 💪

📦 https://github.com/ailin546/alphamind-lite
