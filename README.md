<p align="center">
  <h1 align="center">AlphaMind Lite</h1>
  <p align="center"><strong>AI 驱动的加密货币智能投资助手</strong></p>
  <p align="center">
    <img src="https://img.shields.io/badge/Node.js-22-339933?logo=node.js" alt="Node.js">
    <img src="https://img.shields.io/badge/Dependencies-0-brightgreen" alt="Zero Dependencies">
    <img src="https://img.shields.io/badge/Tests-46%20passed-success" alt="Tests">
    <img src="https://img.shields.io/badge/License-MIT-blue" alt="MIT License">
    <img src="https://img.shields.io/badge/Binance-API-F0B90B?logo=binance" alt="Binance API">
  </p>
  <p align="center">
    <a href="#快速开始">快速开始</a> · <a href="#功能全览">功能全览</a> · <a href="#技术架构">技术架构</a> · <a href="#english-version">English</a>
  </p>
</p>

<p align="center">
  <a href="https://railway.app/template/alphamind-lite"><img src="https://railway.app/button.svg" alt="Deploy on Railway" height="32"></a>
  &nbsp;
  <a href="https://render.com/deploy?repo=https://github.com/ailin546/alphamind-lite"><img src="https://render.com/images/deploy-to-render-button.svg" alt="Deploy to Render" height="32"></a>
</p>

---

## 为什么选择 AlphaMind Lite？

> **让每一个币安用户都拥有机构级别的投资分析能力。**

普通投资者在币安交易时面临三大痛点：

| 痛点 | AlphaMind Lite 的解决方案 |
|------|--------------------------|
| **信息过载** - 行情、新闻、指标分散在不同平台 | 一站式 Dashboard，BTC/ETH 价格、恐慌贪婪指数、买卖信号、K线图 **一屏尽览** |
| **风控缺失** - 杠杆交易不知何时爆仓 | 内置爆仓计算器 + 风险评级系统，输入仓位即出结果 |
| **决策困难** - 不知道该买还是该卖 | AI 助手结合实时行情给出分析建议，支持自然语言对话 |

**核心特色：**

- **零代码** - 纯 Web 界面，打开浏览器即可使用，无需任何技术背景
- **零依赖** - 纯 Node.js 实现，`node server.js` 一键启动，无需 `npm install`
- **实时数据** - 直接对接 Binance REST API，12+ 主流币种毫秒级行情
- **AI 智能分析** - 内置 AI 交易助手，用自然语言问"现在该买BTC吗？"
- **全天候监控** - 7×24 自动刷新，价格提醒 + 巨鲸追踪 + 套利扫描

---

## 快速开始

```bash
# 克隆 & 启动（无需 npm install）
git clone https://github.com/ailin546/alphamind-lite.git
cd alphamind-lite
node scripts/server.js

# 浏览器打开 http://localhost:3000 即可使用
```

**系统要求：** Node.js >= 20.0.0（仅此一项）

---

## 功能全览

### 1. Dashboard - 市场总览

一站式信息聚合面板，打开即可了解市场全貌：

- BTC / ETH 实时价格与 24h 涨跌幅
- Fear & Greed 恐慌贪婪指数（0-100）
- 综合市场信号：**买入 / 持有 / 卖出**
- 24 小时 BTC 价格走势图
- 30 天恐慌指数历史趋势
- 多币种行情总览表

### 2. Market Data - K线行情

专业级行情数据展示：

- 12+ 主流币种（BTC、ETH、BNB、SOL、XRP、ADA、DOGE、AVAX 等）
- K 线图表支持 **1H / 4H / 1D** 三种时间周期
- 24h 成交量、最高价、最低价
- 一键切换币种查看

### 3. Portfolio Manager - 持仓管理

像专业交易员一样管理你的投资组合：

- Web 表单直接添加 / 删除持仓
- 实时盈亏计算（金额 + 百分比）
- 资产分配饼图可视化
- AI 自动生成投资建议
- 持久化存储，刷新不丢数据

### 4. Market Sentiment - 情绪分析

量化市场情绪，理性决策：

- Fear & Greed 仪表盘（带颜色指示器）
- BTC 价格趋势分析
- 多币种与 BTC 相关性分析（Pearson 系数）
- 30 天情绪走势图
- 情绪解读 + 操作建议

### 5. Risk Control - 风控中心

杠杆交易者的安全网：

- 输入币种、数量、入场价、杠杆倍数
- 自动计算：爆仓价格、保证金、清算距离
- **风险评级**：安全 🟢 / 警告 🟡 / 危险 🔴
- 价格提醒系统

### 6. Tools - 投资工具

- **DCA 定投计算器** - 输入月投金额和期数，用真实历史数据模拟收益
- **盈亏计算器** - 快速计算交易盈亏

### 7. AI Chat - 智能对话

基于实时市场数据的 AI 投资顾问：

- 自然语言交互："现在该买BTC吗？" "帮我分析当前市场风险"
- AI 回复自动整合实时行情、恐慌指数、技术指标
- 预设快捷问题，一键询问
- 个性化持仓风险评估

---

## CLI 工具集（19 个独立脚本）

除了 Web Dashboard，还提供丰富的命令行工具：

| 工具 | 命令 | 功能 |
|------|------|------|
| 快速演示 | `node scripts/demo.js` | 一键展示市场概览 |
| 交互菜单 | `node scripts/demo-interactive.js` | 交互式功能选择 |
| 持仓分析 | `node scripts/portfolio.js` | 命令行持仓管理 |
| 恐慌指数 | `node scripts/fear-greed.js` | Fear & Greed 查询 |
| 情绪分析 | `node scripts/market-sentiment.js` | 综合情绪分析 |
| 风险计算 | `node scripts/position-risk.js` | 杠杆风险评估 |
| 价格监控 | `node scripts/price-watcher.js` | 实时价格追踪 |
| 价格提醒 | `node scripts/alerts.js` | 自定义价格报警 |
| 相关性分析 | `node scripts/market-correlation.js` | 币种相关性矩阵 |
| 套利扫描 | `node scripts/arbitrage.js` | 现货/合约价差检测 |
| 资金费率 | `node scripts/funding-arbitrage.js` | 永续合约套利分析 |
| 定投计算 | `node scripts/dca-calculator.js` | DCA 收益模拟 |
| 巨鲸追踪 | `node scripts/whale-alert.js` | 链上大额转账监控 |
| AI 对话 | `node scripts/ai-chat.js` | 命令行 AI 助手 |
| 新闻监控 | `node scripts/news-monitor.js` | 币安公告追踪 |

所有脚本均支持 `--help` 参数查看使用说明。

---

## 技术架构

```
用户浏览器                        AlphaMind Lite Server
┌─────────────┐                  ┌──────────────────────┐
│  Dashboard  │  ◄── HTTP ──►    │  Node.js HTTP Server │
│  HTML/CSS/JS│                  │  REST API Layer      │
└─────────────┘                  └──────────┬───────────┘
                                            │
                    ┌───────────────────────┬┴──────────────────┐
                    │                       │                    │
           ┌────────▼───────┐    ┌─────────▼────────┐  ┌───────▼──────┐
           │  Binance API   │    │  Fear & Greed API │  │  AI Engine   │
           │  行情/K线/合约  │    │  市场情绪指数      │  │  智能分析     │
           └────────────────┘    └──────────────────┘  └──────────────┘
```

### 核心设计原则

| 原则 | 实现 |
|------|------|
| **零依赖** | 仅使用 Node.js 内置模块（http, https, fs, path, url, crypto） |
| **前端零框架** | 原生 HTML/CSS/JS，无需构建步骤 |
| **数据真实** | 所有数据来自 Binance API 和 Blockchain.com，无模拟数据 |
| **持久化存储** | JSON 文件数据库（db.js），零数据库依赖 |
| **生产就绪** | Docker + Nginx + PM2 + 健康检查 + 速率限制 |

### API 端点

| Method | Endpoint | 功能 |
|--------|----------|------|
| GET | `/api/market?symbols=BTC,ETH,BNB` | 实时行情（多币种） |
| GET | `/api/fear-greed` | 恐慌贪婪指数 + 30天历史 |
| GET | `/api/sentiment` | 综合市场情绪分析 |
| GET | `/api/correlation` | 币种相关性矩阵 |
| GET | `/api/klines?symbol=BTC&interval=1h` | K线图表数据 |
| POST | `/api/portfolio` | 持仓分析与建议 |
| POST | `/api/portfolio/holdings` | 添加/删除持仓 |
| POST | `/api/risk` | 仓位风险计算 |
| POST | `/api/dca` | 定投收益模拟 |
| POST | `/api/ai-chat` | AI 智能对话 |
| GET | `/health` | 服务健康检查 |

---

## 生产部署

### 方式一：直接运行

```bash
node scripts/server.js
# 或
npm start
```

### 方式二：Docker

```bash
docker compose up -d
# 自带 Nginx 反向代理 + 健康检查
```

### 方式三：PM2 集群

```bash
npm run pm2:start
# 自动多核集群 + 崩溃自动重启 + 内存限制
```

### 方式四：一键部署脚本

```bash
bash deploy.sh
# 自动检测环境 + 安装依赖 + 启动服务
```

---

## 项目结构

```
alphamind-lite/
├── server.js              # Web 服务器 + REST API（核心入口）
├── dashboard.html         # 交互式 Web Dashboard（前端）
├── package.json           # 项目配置
├── index.html             # 项目展示页
├── deploy.sh              # 一键部署脚本
├── Dockerfile             # Docker 多阶段构建
├── docker-compose.yml     # Docker Compose 编排（App + Nginx）
├── ecosystem.config.js    # PM2 集群配置
├── config/
│   └── config.js          # 集中配置管理（支持环境变量覆盖）
├── scripts/               # CLI 工具集（19 个脚本）
│   ├── server.js          # 生产级 HTTP 服务器
│   ├── api-client.js      # 统一 API 客户端（超时/重试/错误处理）
│   ├── db.js              # JSON 文件数据库
│   ├── logger.js          # 结构化日志（带轮转）
│   ├── notify.js          # 通知系统（Telegram 推送）
│   ├── demo.js            # 快速演示
│   ├── portfolio.js       # 持仓管理
│   ├── fear-greed.js      # 恐慌指数
│   ├── arbitrage.js       # 套利扫描
│   ├── whale-alert.js     # 巨鲸追踪
│   ├── ai-chat.js         # AI 对话
│   └── ...                # 更多工具
├── nginx/                 # Nginx 反向代理配置
│   ├── nginx.conf         # 主配置（Gzip + 安全头 + 速率限制）
│   └── conf.d/default.conf
├── docs/                  # 完整文档（18 篇）
│   ├── product-spec.md    # 产品规格
│   ├── tech-architecture.md # 技术架构
│   ├── business-plan.md   # 商业计划
│   ├── competitor-analysis.md # 竞品分析
│   └── ...
└── data/                  # 持久化数据存储
```

---

## 测试

```bash
npm test
# ════════════════════════════════════════
#   Results: 46 passed, 0 failed
# ════════════════════════════════════════
```

零依赖测试框架，36 个测试用例全部通过。

---

## 路线图

- [x] **Phase 1** - MVP：核心市场分析 + CLI 工具集
- [x] **Phase 2** - Web Dashboard：零代码交互界面
- [x] **Phase 3** - AI 智能分析：自然语言投资顾问
- [x] **Phase 4** - 生产部署：Docker + Nginx + PM2 + CI/CD
- [ ] **Phase 5** - 多交易所支持 + 社交策略分享

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

> **AI-Powered Cryptocurrency Investment Assistant for Binance Users**

## Overview

AlphaMind Lite is a **zero-dependency** open-source AI crypto investment assistant. Through an intuitive Web Dashboard, anyone can access institutional-grade market analysis, portfolio management, and risk control — no coding required.

### Problems We Solve

| Problem | Solution |
|---------|----------|
| **Information overload** — prices, news, indicators scattered across platforms | One-stop Dashboard: prices, Fear & Greed, signals, K-lines **all in one screen** |
| **Risk blindness** — no idea when leveraged positions get liquidated | Built-in liquidation calculator + risk rating system |
| **Decision paralysis** — don't know when to buy or sell | AI assistant analyzes real-time data and provides actionable advice |

### Key Features

- **Zero Code** — Pure web interface, just open your browser
- **Zero Dependencies** — Pure Node.js, run with `node server.js`, no `npm install` needed
- **Real-time Data** — Direct Binance REST API integration, 12+ coins
- **AI Analysis** — Ask "Should I buy BTC now?" in natural language
- **24/7 Monitoring** — Auto-refresh, price alerts, whale tracking, arbitrage scanning

## Quick Start

```bash
git clone https://github.com/ailin546/alphamind-lite.git
cd alphamind-lite
node scripts/server.js
# Open http://localhost:3000
```

**Requirements:** Node.js >= 20.0.0 (that's it)

## Features

| Module | Description |
|--------|-------------|
| **Dashboard** | BTC/ETH prices, Fear & Greed Index, market signals, 24h charts |
| **Market Data** | 12+ coins with K-line charts (1H/4H/1D), volume, high/low |
| **Portfolio** | Add/remove holdings, real-time P&L, allocation pie chart, AI advice |
| **Sentiment** | Fear & Greed gauge, BTC trend, multi-coin correlation analysis |
| **Risk Control** | Leverage liquidation calculator, risk ratings (safe/warning/danger) |
| **Tools** | DCA calculator with real historical data, P&L calculator |
| **AI Chat** | Natural language Q&A powered by real-time market context |
| **19 CLI Tools** | Portfolio, alerts, whale tracking, arbitrage, funding rates, and more |

## Architecture

- **Frontend**: Pure HTML/CSS/JS (no framework, no build step)
- **Backend**: Native Node.js HTTP server (zero npm dependencies)
- **Data**: Binance REST API + Fear & Greed API + Blockchain.com
- **AI**: Context-aware analysis engine with live market data integration
- **Storage**: JSON file database (zero database dependencies)
- **Deployment**: Docker + Nginx + PM2 + health checks + rate limiting

## Tests

```bash
npm test  # 46 tests, all passing
```

## License

MIT License

**Let AI be your trading partner.**

(c) 2026 AlphaMind Lite
