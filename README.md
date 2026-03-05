# AlphaMind Lite 🦞

> **7×24 小时币安智能交易伙伴**  
> 让每个普通投资者都能获得机构级的交易智慧

[![GitHub Stars](https://img.shields.io/github/stars/ailin546/alphamind-lite)](https://github.com/ailin546/alphamind-lite)
[![License](https://img.shields.io/github/license/ailin546/alphamind-lite)](LICENSE)
[![Version](https://img.shields.io/badge/version-v2.1-blue)](https://github.com/ailin546/alphamind-lite)

---

## 🎯 一句话介绍

AlphaMind Lite 是基于 OpenClaw Gateway 打造的 AI 交易助手，通过人工智能技术帮助普通投资者实时监控市场、规避风险、捕捉机会。

**核心理念**：让 AI 成为你的"24小时不眨眼的市场哨兵"。

---

## ✨ 为什么选择 AlphaMind？

| 痛点 | 我们的解决方案 |
|------|----------------|
| 睡觉时爆仓 | 7×24 自动监控，异常立即预警 |
| 看不懂英文公告 | 自动翻译推送 |
| 不知道什么时候买卖 | 恐慌指数 + AI 建议 |
| 持仓太分散/集中 | 组合分析 + 风险评估 |
| 消息太多看不过来 | AI 提炼关键信息 |

---

## 🛠️ 核心功能

### 1️⃣ 📊 实时行情监控
- 覆盖 BTC、ETH、BNB、SOL、DOGE 等主流币种
- 实时价格 + 24h 涨跌幅 + 成交量
- 多维度市场数据一目了然

### 2️⃣ 🎯 恐慌指数分析
- 引用权威的 Alternative.me Fear & Greed Index
- AI 驱动的买卖时机建议
- 历史数据参考，辅助判断市场周期

### 3️⃣ 💼 投资组合分析
- 支持多币种持仓管理
- 实时盈亏计算（按买入价 vs 当前价）
- 风险分散度评估
- 个性化仓位调整建议

### 4️⃣ 📡 情报监控系统
- 实时抓取 Binance 官方公告
- AI 翻译成中文
- 新币上线第一时间推送
- KOL 喊单信号监控

### 5️⃣ 🛡️ 风控预警系统
- 仓位健康度实时检测
- 爆仓风险提前预警（支持杠杆计算）
- 一键避险建议
- 个性化风控策略配置

### 6️⃣ 📢 价格提醒
- 自定义价格阈值
- 多币种同时监控
- 推送渠道可选（Telegram/QQ）

---

## 🚀 快速开始

### 方式一：运行完整演示
```bash
git clone https://github.com/ailin546/alphamind-lite.git
cd alphamind-lite
node scripts/comprehensive-demo.js
```

### 方式二：分功能体验
```bash
# 市场行情
curl -s "https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT" | jq

# 恐慌指数
node scripts/fear-greed.js

# 持仓分析
node scripts/portfolio.js

# 基础演示
node scripts/demo-runner.js
```

---

## 📁 项目结构

```
alphamind-lite/
├── scripts/
│   ├── comprehensive-demo.js   # 完整功能演示 (推荐)
│   ├── portfolio.js           # 投资组合分析
│   ├── fear-greed.js          # 恐慌指数
│   ├── position-risk.js       # 仓位风险计算
│   ├── alerts.js              # 价格提醒
│   ├── tavily-news.js         # 情报监控
│   └── demo-runner.js         # 基础演示
├── docs/
│   ├── user-guide.md         # 用户指南
│   ├── business-plan.md       # 商业计划书
│   └── demo-script.md         # 演示脚本
├── skills/                    # OpenClaw 技能定义
├── README.md
├── LICENSE
└── PLAN.md
```

---

## 👥 团队

| 角色 | GitHub | 负责领域 |
|------|--------|-----------|
| main | [@main](https://github.com/main) | 首席开发 |
| thiel | [@thiel](https://github.com/thiel) | 商业策划 |
| jobs | [@jobs](https://github.com/jobs) | 产品体验 |
| nadella | [@nadella](https://github.com/nadella) | 生态集成 |
| ren | [@ren](https://github.com/ren) | 本地化 |

---

## 📈 演示效果

```
╔═══════════════════════════════════════════════════════════════════╗
║     🤖 AlphaMind Lite - 完整功能演示 (v2.1)                   ║
╚═══════════════════════════════════════════════════════════════════╝

📊 市场概览:
  BTC: $72,768 (+2.87%)  🟢
  ETH: $2,130 (+4.21%)   🟢
  BNB: $656 (+1.32%)     🟢
  SOL: $91  (+2.80%)     🟢

🎯 恐慌指数: 22/100 😱 极度恐慌
   💡 建议: 可能是买入机会

💼 持仓分析:
   总价值: $44,849
   总盈亏: +$2,049 (+4.79%)
   风险: ⚠️ BTC 占比 81%

🧠 AI 综合建议:
   • 恐慌指数处于极值，可适当布局
   • 建议分散持仓，降低集中风险
   • 设置 10% 止损线保护本金
```

---

## 🤝 参与贡献

欢迎提交 Issue 和 Pull Request！

- 🐛 发现 Bug？[提交 Issue](https://github.com/ailin546/alphamind-lite/issues)
- 💡 有新功能建议？[提交 Feature Request](https://github.com/ailin546/alphamind-lite/issues)
- 📝 想贡献代码？[提交 PR](https://github.com/ailin546/alphamind-lite/pulls)

---

## 📄 许可证

本项目采用 [MIT](LICENSE) 许可证。

---

## 🔗 相关链接

- 🌐 项目主页: https://github.com/ailin546/alphamind-lite
- 📖 用户指南: [docs/user-guide.md](docs/user-guide.md)
- 📊 商业计划: [docs/business-plan.md](docs/business-plan.md)
- 🦞 OpenClaw: https://github.com/openclaw/openclaw
- 📊 Binance API: https://docs.binance.org

---

**让 AI 成为你的交易伙伴** 💪

_AlphaMind Lite - 让每个普通投资者都能获得机构级的交易智慧_
