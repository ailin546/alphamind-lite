# AlphaMind Lite

> **AI-Powered Cryptocurrency Investment Assistant**
>
> **简体中文** | [English](#english-version)

---

## 项目简介

AlphaMind Lite 是一个**零依赖**的开源加密货币智能投资助手。通过一个直观的 Web Dashboard，普通用户无需任何代码知识，即可获得机构级别的市场分析、持仓管理和风险控制能力。

**核心特点：**
- **零代码操作** - 纯 Web 界面，打开浏览器即可使用
- **零依赖部署** - 纯 Node.js，无需安装任何 npm 包
- **实时数据** - 直接对接 Binance API，毫秒级行情更新
- **AI 智能分析** - 内置 AI 交易助手，自然语言交互
- **7x24 监控** - 自动刷新，永不错过市场变化

---

## 快速开始

```bash
# 1. 克隆项目
git clone https://github.com/ailin546/alphamind-lite.git
cd alphamind-lite

# 2. 启动服务（无需 npm install）
node server.js

# 3. 打开浏览器访问
# http://localhost:3000
```

就这么简单！无需配置，无需安装依赖。

---

## 功能展示

### Dashboard - 一站式市场概览
- BTC/ETH 实时价格与涨跌
- Fear & Greed 恐慌贪婪指数
- 综合市场信号（买入/持有/卖出）
- 24小时价格走势图
- 恐慌指数30天历史

### Market Data - 多币种行情
- 12+ 主流币种实时价格
- K线图表（1H/4H/1D 时间周期）
- 24h 成交量、最高/最低价
- 一键切换币种

### Portfolio Manager - 持仓管理
- 可视化添加/删除持仓
- 实时盈亏计算（金额 + 百分比）
- 资产分配饼图
- AI 投资建议
- 本地存储，数据不丢失

### Market Sentiment - 情绪分析
- Fear & Greed 指数仪表盘
- BTC 趋势分析
- 综合买卖信号
- 多币种与 BTC 相关性分析
- 30天情绪趋势图

### Risk Control - 风控中心
- 杠杆仓位风险计算器
- 爆仓价格预警
- 风险评级（安全/警告/危险）
- 价格提醒配置

### Tools - 投资工具
- 定投(DCA)收益计算器
- 盈亏计算器

### AI Chat - 智能对话
- 自然语言问答
- 基于实时数据的市场分析
- 买卖建议
- 风险评估
- 预设快捷问题

---

## 技术架构

```
                    +-------------------+
                    |   Web Dashboard   |  (dashboard.html)
                    |   Pure HTML/CSS/JS |
                    +--------+----------+
                             |
                    +--------v----------+
                    |   Node.js Server  |  (server.js)
                    |   REST API Layer  |
                    +--------+----------+
                             |
            +----------------+----------------+
            |                |                |
    +-------v------+  +-----v-------+  +-----v-------+
    | Binance API  |  | Fear/Greed  |  | AI Engine   |
    | Market Data  |  | Sentiment   |  | Analysis    |
    +--------------+  +-------------+  +-------------+
```

**零依赖设计** - 仅使用 Node.js 内置模块（http, https, fs, path, url），无需任何第三方包。

### API 端点

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/market` | 实时行情（支持多币种） |
| GET | `/api/fear-greed` | 恐慌贪婪指数 + 30天历史 |
| GET | `/api/sentiment` | 综合市场情绪分析 |
| GET | `/api/correlation` | 币种相关性分析 |
| GET | `/api/klines` | K线图表数据 |
| POST | `/api/portfolio` | 持仓分析 |
| POST | `/api/risk` | 仓位风险计算 |
| POST | `/api/dca` | 定投收益计算 |
| POST | `/api/ai-chat` | AI 智能对话 |

---

## 项目结构

```
alphamind-lite/
├── server.js          # Web 服务器 + REST API (核心)
├── dashboard.html     # 交互式 Web Dashboard (前端)
├── package.json       # 项目配置
├── index.html         # 项目展示页
├── deploy.sh          # 一键部署脚本
├── scripts/           # CLI 工具脚本 (19个)
│   ├── demo.js               # 快速演示
│   ├── demo-interactive.js   # 交互式菜单
│   ├── portfolio.js          # 持仓分析
│   ├── fear-greed.js         # 恐慌指数
│   ├── market-sentiment.js   # 情绪分析
│   ├── position-risk.js      # 风险计算
│   ├── price-watcher.js      # 价格监控
│   ├── alerts.js             # 价格提醒
│   ├── market-correlation.js # 相关性分析
│   ├── arbitrage.js          # 套利扫描
│   ├── dca-calculator.js     # 定投计算
│   ├── whale-alert.js        # 巨鲸监控
│   ├── ai-chat.js            # AI 对话
│   └── ...
└── docs/              # 完整文档 (18个)
    ├── product-spec.md       # 产品规格
    ├── tech-architecture.md  # 技术架构
    ├── business-plan.md      # 商业计划
    ├── roadmap.md            # 产品路线图
    └── ...
```

---

## 商业模式

1. **免费基础版** - 开源社区版，所有核心功能免费
2. **高级订阅** - 高级AI分析、多交易所支持、实时推送
3. **API 服务** - 为其他应用提供数据分析接口
4. **策略市场** - 用户分享交易策略的平台

---

## 路线图

- [x] Phase 1: MVP - 核心功能 + CLI 工具
- [x] Phase 2: Web Dashboard - 零代码交互界面
- [x] Phase 3: AI 智能分析 - 自然语言交互
- [ ] Phase 4: 多交易所支持
- [ ] Phase 5: 社交功能 + 策略市场

---

## 贡献

欢迎 Issue 和 Pull Request！

```bash
git clone https://github.com/ailin546/alphamind-lite.git
git checkout -b feature/your-feature
git commit -m "Add: your feature"
git push origin feature/your-feature
```

---

## License

MIT License

---

<a name="english-version"></a>

# AlphaMind Lite (English)

> **AI-Powered Cryptocurrency Investment Assistant**

## Overview

AlphaMind Lite is a **zero-dependency** open-source AI cryptocurrency investment assistant. Through an intuitive Web Dashboard, ordinary users can access institutional-grade market analysis, portfolio management, and risk control without any coding knowledge.

**Key Features:**
- **Zero Code** - Pure web interface, just open your browser
- **Zero Dependencies** - Pure Node.js, no npm packages needed
- **Real-time Data** - Direct Binance API integration
- **AI Analysis** - Built-in AI trading assistant with natural language
- **24/7 Monitoring** - Auto-refresh, never miss market changes

## Quick Start

```bash
git clone https://github.com/ailin546/alphamind-lite.git
cd alphamind-lite
node server.js
# Open http://localhost:3000
```

## Features

| Feature | Description |
|---------|-------------|
| Dashboard | One-stop market overview with live charts |
| Market Data | 12+ coins with K-line charts (1H/4H/1D) |
| Portfolio | Visual portfolio management with P&L tracking |
| Sentiment | Fear & Greed Index + correlation analysis |
| Risk Control | Leverage risk calculator + price alerts |
| Tools | DCA calculator + P&L calculator |
| AI Chat | Natural language trading assistant |

## Architecture

- **Frontend**: Pure HTML/CSS/JS (no framework, no build step)
- **Backend**: Native Node.js HTTP server (zero npm dependencies)
- **Data**: Binance REST API + Fear & Greed API
- **AI**: Context-aware analysis engine with market data integration

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/market` | Real-time market data |
| GET | `/api/fear-greed` | Fear & Greed Index |
| GET | `/api/sentiment` | Comprehensive sentiment |
| GET | `/api/correlation` | Correlation analysis |
| GET | `/api/klines` | K-line chart data |
| POST | `/api/portfolio` | Portfolio analysis |
| POST | `/api/risk` | Position risk calculation |
| POST | `/api/dca` | DCA calculation |
| POST | `/api/ai-chat` | AI chat |

## License

MIT License

**Let AI be your trading partner**

(c) 2026 AlphaMind Lite
