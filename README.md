# AlphaMind Lite 🦞

> **7×24 小时币安智能交易伙伴** — 让每个普通投资者都能获得机构级的交易智慧

[![Stars](https://img.shields.io/github/stars/ailin546/alphamind-lite)](https://github.com/ailin546/alphamind-lite)
[![License](https://img.shields.io/github/license/ailin546/alphamind-lite)](LICENSE)
[![Version](https://img.shields.io/badge/version-v4.1-blue)](https://github.com/ailin546/alphamind-lite)

---

## 📋 目录

- [项目简介](#项目简介)
- [核心功能](#核心功能)
- [快速开始](#快速开始)
- [功能列表](#功能列表)
- [配置说明](#配置说明)
- [技术架构](#技术架构)
- [常见问题](#常见问题)
- [贡献指南](#贡献指南)

---

## 项目简介

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

## 核心功能

### 📊 实时行情监控
毫秒级拉取 Binance 主流币种价格与涨跌幅，告别手动刷盘。

### 🎯 智能恐慌指数
整合 Fear & Greed Index 与 AI 分析，给出可执行的操作建议。

### 💼 持仓智能分析
自动追踪多币种盈亏状态，智能计算风险敞口。

### 📡 情报聚合雷达
7×24 小时监控币安公告、行业新闻、KOL 信号。

### 🛡️ 风控预警系统
实时仓位健康检测，提前预警爆仓风险。

### 🔔 智能价格提醒
自定义价格阈值，Telegram 实时推送。

---

## 快速开始

### 一行命令开始
```bash
git clone https://github.com/ailin546/alphamind-lite.git
cd alphamind-lite
node scripts/demo.js
```

### 运行单个功能
```bash
# 行情查询
node scripts/portfolio.js

# 恐慌指数
node scripts/fear-greed.js

# 市场情绪
node scripts/market-sentiment.js
```

---

## 功能列表

| 脚本 | 功能 | 说明 |
|------|------|------|
| `demo.js` | 完整演示 | 一键展示所有核心功能 |
| `portfolio.js` | 持仓分析 | 多币种盈亏计算 |
| `fear-greed.js` | 恐慌指数 | Fear & Greed Index |
| `market-sentiment.js` | 市场情绪 | 综合分析 |
| `price-watcher.js` | 价格监控 | 阈值报警 |
| `tavily-news.js` | 情报监控 | 公告新闻 |
| `arbitrage.js` | 套利扫描 | 波动机会 |
| `dca-calculator.js` | 定投计算 | 美元成本平均法 |
| `whale-alert.js` | 巨鲸监控 | 大户活动 |
| `user-ai-chat.js` | AI 对话 | 自定义 API |

---

## 配置说明

### 持仓配置
编辑 `scripts/portfolio.js` 中的 PORTFOLIO 数组：
```javascript
const PORTFOLIO = [
  { symbol: 'BTC', amount: 0.5, avgPrice: 70000 },
  { symbol: 'ETH', amount: 2.0, avgPrice: 2000 },
];
```

### AI 对话配置
编辑 `scripts/user-ai-chat.js`，填入你的 API Key：
```javascript
const CONFIG = {
  openai: { apiKey: 'sk-your-key', model: 'gpt-4o' }
};
```

### 价格提醒配置
编辑 `scripts/price-watcher.js` 中的 WATCH_LIST。

---

## 技术架构

### 技术栈
- **Runtime**: Node.js
- **Data**: Binance API, alternative.me, Tavily
- **Protocol**: HTTPS, JSON

### 模块设计
```
scripts/
├── data/          # 数据获取层
├── analysis/       # 分析层
├── ai/            # AI 对话层
└── notify/        # 通知层
```

详见 [docs/tech-architecture.md](docs/tech-architecture.md)

---

## 常见问题

### Q1: 需要 API Key 吗？
基础功能不需要。AI 对话功能需要自备 API Key。

### Q2: 安全吗？
所有数据仅保存在本地，不上传服务器。

### Q3: 支持哪些交易所？
目前支持 Binance。

### Q4: 收费吗？
基础功能完全免费。

详见 [docs/faq.md](docs/faq.md)

---

## 贡献指南

欢迎提交 Issue 和 Pull Request！

```bash
# 克隆项目
git clone https://github.com/ailin546/alphamind-lite.git

# 创建分支
git checkout -b feature/your-feature

# 提交更改
git commit -m "Add: your feature"

# 推送
git push origin main
```

---

## 相关链接

- 📖 [产品文档](docs/product-spec.md)
- 📊 [商业计划](docs/business-plan.md)
- 🗺️ [产品路线图](docs/roadmap.md)
- 👥 [团队](docs/mission.md)

---

**让 AI 成为你的交易伙伴** 💪

© 2026 AlphaMind Lite - Open Source Project
