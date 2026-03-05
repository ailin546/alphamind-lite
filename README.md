# AlphaMind Lite 🦞

> **简体中文** | [English](#english-version)

---

## 📖 项目简介

AlphaMind Lite 是一个开源的加密货币投资助手，基于 AI 技术帮助普通投资者做出更好的交易决策。

### 核心理念
- **让 AI 成为你的交易伙伴**
- **7×24 小时不间断监控**
- **中文本地化**，更懂中国投资者

### 适用人群
- 加密货币新手投资者
- 忙碌的上班族（没时间看盘）
- 想要智能工具的投资者
- 关注风险控制的用户

---

## ✨ 核心功能

| 功能 | 说明 |
|------|------|
| 📊 实时行情 | 毫秒级拉取 Binance 主流币种价格 |
| 🎯 恐慌指数 | Fear & Greed Index + AI 分析 |
| 💼 持仓分析 | 多币种盈亏智能计算 |
| 📡 情报雷达 | 7×24 小时监控公告新闻 |
| 🛡️ 风控预警 | 实时仓位健康检测 |
| 🔔 价格提醒 | 自定义阈值 Telegram 推送 |

---

## 🚀 快速开始

```bash
# 克隆项目
git clone https://github.com/ailin546/alphamind-lite.git
cd alphamind-lite

# 运行演示
node scripts/demo.js
```

---

## 📁 项目结构

```
alphamind-lite/
├── README.md              # 本文件
├── README-en.md          # English version
├── deploy.sh            # 一键部署
├── scripts/             # 功能脚本 (18个)
│   ├── demo.js         # 完整演示
│   ├── portfolio.js    # 持仓分析
│   ├── fear-greed.js  # 恐慌指数
│   └── ...
└── docs/               # 文档 (18个)
    ├── product-spec.md
    ├── business-plan.md
    └── ...
```

---

## ⚙️ 配置说明

### 持仓配置
编辑 `scripts/portfolio.js`:
```javascript
const PORTFOLIO = [
  { symbol: 'BTC', amount: 0.5, avgPrice: 70000 },
  { symbol: 'ETH', amount: 2.0, avgPrice: 2000 },
];
```

### AI 对话配置
编辑 `scripts/user-ai-chat.js`，填入你的 API Key。

---

## ❓ 常见问题

详见 [docs/faq.md](docs/faq.md)

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

```bash
git clone https://github.com/ailin546/alphamind-lite.git
git checkout -b feature/your-feature
git commit -m "Add: your feature"
git push origin main
```

---

## 📄 许可证

MIT License

---

## 🔗 相关链接

- 📖 [产品文档](docs/product-spec.md)
- 📊 [商业计划](docs/business-plan.md)
- 🗺️ [路线图](docs/roadmap.md)

---

**让 AI 成为你的交易伙伴** 💪

© 2026 AlphaMind Lite

---

<a name="english-version"></a>

# AlphaMind Lite 🦞

> **中文** | [English](#english-version)

---

## 📖 Overview

AlphaMind Lite is an open-source cryptocurrency investment assistant that helps ordinary investors make better trading decisions through AI technology.

### Core Philosophy
- **Let AI be your trading partner**
- **7×24 hours uninterrupted monitoring**
- **Chinese localization** - Better for Chinese investors

### Target Users
- New cryptocurrency investors
- Busy office workers (no time to watch markets)
- Investors seeking intelligent tools
- Users focused on risk management

---

## ✨ Core Features

| Feature | Description |
|---------|-------------|
| 📊 Real-time Market | Millisecond-level Binance price fetching |
| 🎯 Fear & Greed Index | Fear & Greed Index + AI analysis |
| 💼 Portfolio Analysis | Multi-coin P&L calculation |
| 📡 News Radar | 7×24h monitoring of announcements |
| 🛡️ Risk Alerts | Real-time position health detection |
| 🔔 Price Alerts | Custom threshold Telegram notifications |

---

## 🚀 Quick Start

```bash
# Clone project
git clone https://github.com/ailin546/alphamind-lite.git
cd alphamind-lite

# Run demo
node scripts/demo.js
```

---

## 📁 Project Structure

```
alphamind-lite/
├── README.md              # This file (Chinese)
├── README-en.md          # English version
├── deploy.sh            # One-click deploy
├── scripts/             # Function scripts (18)
│   ├── demo.js         # Full demo
│   ├── portfolio.js    # Portfolio analysis
│   ├── fear-greed.js  # Fear index
│   └── ...
└── docs/               # Documentation (18)
    ├── product-spec.md
    ├── business-plan.md
    └── ...
```

---

## ⚙️ Configuration

### Portfolio
Edit `scripts/portfolio.js`:
```javascript
const PORTFOLIO = [
  { symbol: 'BTC', amount: 0.5, avgPrice: 70000 },
  { symbol: 'ETH', amount: 2.0, avgPrice: 2000 },
];
```

### AI Chat
Edit `scripts/user-ai-chat.js`, add your API key.

---

## ❓ FAQ

See [docs/faq-en.md](docs/faq-en.md)

---

## 🤝 Contributing

Welcome to submit Issues and Pull Requests!

```bash
git clone https://github.com/ailin546/alphamind-lite.git
git checkout -b feature/your-feature
git commit -m "Add: your feature"
git push origin main
```

---

## 📄 License

MIT License

---

## 🔗 Links

- 📖 [Product Spec](docs/product-spec.md)
- 📊 [Business Plan](docs/business-plan.md)
- 🗺️ [Roadmap](docs/roadmap.md)

---

**Let AI be your trading partner** 💪

© 2026 AlphaMind Lite
