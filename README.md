<p align="center">
  <h1 align="center">🦞 AlphaMind Lite</h1>
  <p align="center"><strong>AI 驱动的 BNB Chain 全生态加密货币智能投资助手</strong></p>
  <p align="center">
    <img src="https://img.shields.io/badge/Node.js-22-339933?logo=node.js" alt="Node.js">
    <img src="https://img.shields.io/badge/Dependencies-0-brightgreen" alt="Zero Dependencies">
    <img src="https://img.shields.io/badge/Tests-102%20passed-success" alt="Tests">
    <img src="https://img.shields.io/badge/License-MIT-blue" alt="MIT License">
    <img src="https://img.shields.io/badge/BNB_Chain-Full_Ecosystem-F0B90B?logo=binance" alt="BNB Chain">
    <img src="https://img.shields.io/badge/opBNB-L2-orange" alt="opBNB L2">
  </p>
  <p align="center">
    <a href="#快速开始">快速开始</a> · <a href="#功能全览">功能全览</a> · <a href="#bnb-chain-生态集成">BNB Chain</a> · <a href="#技术架构">技术架构</a> · <a href="#english-version">English</a>
  </p>
</p>

<p align="center">
  <a href="https://railway.app/template/alphamind-lite"><img src="https://railway.app/button.svg" alt="Deploy on Railway" height="32"></a>
  &nbsp;
  <a href="https://render.com/deploy?repo=https://github.com/ailin546/alphamind-lite"><img src="https://render.com/images/deploy-to-render-button.svg" alt="Deploy to Render" height="32"></a>
</p>

---

## 为什么选择 AlphaMind Lite？

> **让每一个币安用户都拥有机构级别的投资分析能力 — 零依赖、零门槛、全生态覆盖。**

普通投资者在 BNB Chain 生态交易时面临三大痛点：

| 痛点 | AlphaMind Lite 的解决方案 |
|------|--------------------------|
| **信息过载** — 行情、新闻、指标分散在不同平台 | 一站式 Dashboard：价格、恐慌贪婪指数、技术信号、K线图 **一屏尽览** |
| **风控缺失** — 杠杆交易不知何时爆仓 | 内置爆仓计算器 + 风险评级系统（安全/警告/危险三级） |
| **决策困难** — 不知道该买还是该卖 | AI 助手结合实时行情 + 技术指标给出分析建议，支持自然语言对话 |

**核心特色：**

- **真·零依赖** — 纯 Node.js 内置模块实现（http, https, fs, path, crypto），`node server.js` 一键启动，无需 `npm install`
- **BNB Chain 全生态** — BSC 主链 + opBNB L2 + BNB Greenfield 存储链，Gas 追踪、TVL、DeFi 协议
- **专业技术指标** — RSI(14)、MACD、布林带(20)、SMA/EMA(7,25) + 多时间框架（1H/4H/1D）融合分析
- **AI 智能分析** — 内置 AI 交易助手，整合实时行情 + 技术指标 + 情绪数据，自然语言对话
- **模拟交易** — $10,000 USDT 虚拟资金，Paper Trading 零风险练手
- **生产就绪** — Docker + Nginx + PM2 集群 + CI/CD + Prometheus 监控 + 安全加固
- **全天候监控** — 7×24 SSE 实时推送，价格提醒 + 巨鲸追踪 + 套利扫描

---

## 快速开始

```bash
# 克隆 & 启动（无需 npm install）
git clone https://github.com/ailin546/alphamind-lite.git
cd alphamind-lite
node server.js

# 浏览器打开 http://localhost:3000 即可使用
```

**系统要求：** Node.js >= 20.0.0（仅此一项，零外部依赖）

---

## 功能全览

### 1. Dashboard — 市场总览

一站式信息聚合面板，打开即可了解市场全貌：

- BTC / ETH 实时价格与 24h 涨跌幅（价格闪烁动画）
- Fear & Greed 恐慌贪婪指数（0-100，带颜色指示）
- 综合市场信号：**买入 / 持有 / 卖出**（基于多指标融合）
- 24 小时 BTC 价格走势图 + 30 天恐慌指数趋势
- 多币种行情总览表（12+ 主流币种）
- Live / Demo 数据源指示器

### 2. Market Data — K 线行情

专业级行情数据展示：

- 12+ 主流币种（BTC、ETH、BNB、SOL、XRP、ADA、DOGE、AVAX 等）
- Chart.js K 线图表支持 **1H / 4H / 1D** 三种时间周期
- 24h 成交量、最高价、最低价、OHLCV 完整数据
- 技术指标叠加：RSI(14)、MACD(12,26,9)、布林带(20)、SMA/EMA

### 3. Portfolio Manager — 持仓管理

像专业交易员一样管理你的投资组合：

- Web 表单直接添加 / 删除持仓
- 实时盈亏计算（金额 + 百分比）
- 资产分配饼图可视化
- AI 自动生成投资建议（分散化评分）
- **CSV 导出**（快捷键 `E`）
- 持久化存储，刷新不丢数据

### 4. Market Sentiment — 情绪分析

量化市场情绪，理性决策：

- Fear & Greed 仪表盘（带颜色分级指示器）
- BTC 价格趋势分析 + 成交量趋势（高/低/正常）
- 多币种与 BTC 相关性分析
- 30 天情绪走势图
- 情绪解读 + 操作建议

### 5. Risk Control — 风控中心

杠杆交易者的安全网：

- 输入币种、数量、入场价、杠杆倍数
- 自动计算：爆仓价格、保证金、清算距离
- **风险评级**：安全 / 警告 / 危险（三级可视化）
- 价格提醒系统（上穿/下穿阈值 SSE 实时触发）

### 6. Tools — 投资工具

- **DCA 定投计算器** — 输入月投金额和期数，用真实历史数据模拟收益
- **盈亏计算器** — 快速计算交易盈亏
- **Paper Trading 模拟交易** — $10,000 USDT 虚拟资金，支持买入/卖出/查看历史/一键重置

### 7. BSC Chain — BNB Chain 全生态

深度集成 BNB Chain 三链生态数据：

- **BSC 主链** — Gas 追踪（Low/Standard/Fast）、PoSA 共识、21 验证人、3s 出块
- **opBNB L2** — 二层扩展方案数据（~10,000 TPS、$0.001 Gas）
- **BNB Greenfield** — 去中心化存储链数据
- **BNB 代币** — 流通量(145M)、销毁量(54M+)、销毁率、质押 APY
- **DeFi 生态** — PancakeSwap、Venus、Alpaca Finance、BiSwap、Beefy 等协议
- **BSC 生态代币** — CAKE、XVS、BAKE、ALPACA、BSW 实时价格
- **TVL 估算** — BSC 全生态锁仓量
- **链参数** — Chain ID: 56 (BSC) / 204 (opBNB)、BEP-20/BEP-721/BEP-1155 标准

### 8. AI Chat — 智能对话

基于实时市场数据的 AI 投资顾问：

- 自然语言交互："现在该买BTC吗？" "帮我分析当前市场风险"
- AI 回复自动整合实时行情、恐慌指数、技术指标
- 意图识别：买入/卖出/风险评估/DCA/持仓分析/帮助
- 预设快捷问题，一键询问
- 中英双语支持

---

## 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `1` - `8` | 切换页面（Dashboard / Market / Portfolio / Sentiment / Risk / Tools / AI / BSC） |
| `R` | 刷新当前页面数据 |
| `E` | 导出持仓数据为 CSV |

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

## BNB Chain 生态集成

AlphaMind Lite 深度集成 BNB Chain 全生态，面向 BNB Chain 黑客松优化：

```
BNB Chain Ecosystem
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  BSC Mainnet (Chain ID: 56)                             │
│  ├── Gas Tracker: Low / Standard / Fast                 │
│  ├── PoSA Consensus: 21 Validators, 3s Block Time      │
│  ├── DeFi Protocols: PancakeSwap, Venus, Alpaca...      │
│  ├── Ecosystem Tokens: CAKE, XVS, BAKE, ALPACA, BSW    │
│  └── TVL: ~$5.2B                                       │
│                                                         │
│  opBNB Layer 2 (Chain ID: 204)                          │
│  ├── Throughput: ~10,000 TPS                            │
│  ├── Gas Cost: ~$0.001                                  │
│  └── OP Stack Architecture                              │
│                                                         │
│  BNB Greenfield                                         │
│  └── Decentralized Storage Network                      │
│                                                         │
│  BNB Token                                              │
│  ├── Circulating Supply: 145M                           │
│  ├── Total Burned: 54M+ (~27%)                          │
│  └── Staking APY: ~2.5-3%                               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 技术架构

```
用户浏览器                          AlphaMind Lite Server
┌──────────────┐                  ┌───────────────────────────┐
│  Dashboard   │  ◄── HTTP ──►   │  Pure Node.js HTTP Server  │
│  HTML/CSS/JS │  ◄── SSE ───    │  (Zero Dependencies)       │
│  Chart.js    │                  │  REST API + SSE Streaming  │
└──────────────┘                  └──────────┬────────────────┘
                                             │
                  ┌──────────────────────────┬┴────────────────────┐
                  │                          │                      │
         ┌────────▼────────┐      ┌─────────▼─────────┐  ┌────────▼───────┐
         │  Binance API    │      │  Alternative.me    │  │  AI Engine     │
         │  行情/K线/合约   │      │  Fear & Greed Index│  │  NLP + 技术分析 │
         └─────────────────┘      └───────────────────┘  └────────────────┘
```

### 核心设计原则

| 原则 | 实现 |
|------|------|
| **零依赖** | 仅使用 Node.js 内置模块（http, https, fs, path, url, crypto） |
| **前端零框架** | 原生 HTML/CSS/JS + Chart.js（CDN），无需构建步骤 |
| **数据真实** | 所有数据来自 Binance API、Alternative.me、BSCScan，自动降级至 Demo 数据 |
| **持久化存储** | JSON 文件数据库（db.js），原子写入（tmp 重命名），损坏自动备份恢复 |
| **生产就绪** | Docker + Nginx + PM2 + 健康检查 + 速率限制 + Prometheus 监控 |
| **安全加固** | CSP / X-Frame-Options / CORS / Rate Limiting / Input Validation / XSS 防护 |

### 技术指标引擎

| 指标 | 参数 | 用途 |
|------|------|------|
| RSI | 周期: 14 | 超买(>70)/超卖(<30)判定 |
| MACD | 快线:12, 慢线:26, 信号:9 | 趋势方向 + 动量变化 |
| 布林带 | 周期: 20, 宽度: 2σ | 波动率 + 支撑/阻力位 |
| SMA | 周期: 7, 25 | 短期/中期均线趋势 |
| EMA | 周期: 7, 25 | 加权均线，对近期价格更敏感 |
| 多时间框架 | 1H / 4H / 1D | 跨周期信号融合（看涨/看跌/混合） |

### API 端点

| Method | Endpoint | 功能 |
|--------|----------|------|
| GET | `/api/market?symbols=BTC,ETH,BNB` | 实时行情（多币种） |
| GET | `/api/fear-greed` | 恐慌贪婪指数 + 30天历史 |
| GET | `/api/sentiment` | 综合市场情绪分析 |
| GET | `/api/correlation` | 币种相关性矩阵 |
| GET | `/api/klines?symbol=BTC&interval=1h` | K线图表数据 |
| GET | `/api/indicators?symbol=BTC` | 技术指标（RSI/MACD/布林带/SMA） |
| GET | `/api/multi-timeframe?symbol=BTC` | 多时间框架融合分析（1H/4H/1D） |
| GET | `/api/bsc` | BSC + opBNB + Greenfield 全生态数据 |
| GET | `/api/funding` | 永续合约资金费率 |
| GET | `/api/alerts` | 价格提醒列表 |
| POST | `/api/portfolio` | 持仓分析与建议 |
| POST | `/api/portfolio/add` | 添加持仓 |
| POST | `/api/portfolio/remove` | 删除持仓 |
| POST | `/api/alerts/add` | 添加价格提醒 |
| POST | `/api/risk` | 仓位风险计算（爆仓价格） |
| POST | `/api/dca` | 定投收益模拟 |
| POST | `/api/ai-chat` | AI 智能对话 |
| POST | `/api/paper-trade` | 模拟交易下单 |
| GET | `/api/paper-trade` | 模拟交易历史 |
| POST | `/api/paper-trade/reset` | 重置模拟账户 |
| GET | `/api/stream` | SSE 实时价格推送（30s 心跳） |
| GET | `/health` | 服务健康检查 |
| GET | `/ready` | 就绪检查（Binance 连通性） |
| GET | `/metrics` | Prometheus 监控指标 |

---

## 用户体验亮点

- **暗色主题** — Material Design 风格，专业交易界面配色
- **骨架屏加载** — Shimmer 动画，流畅加载体验
- **价格闪烁** — 价格变化时绿涨红跌视觉反馈
- **页面过渡** — 0.3s 淡入动画
- **Toast 通知** — 成功/错误/警告弹窗，滑入动画
- **中英双语** — 导航栏一键切换 EN / 中文
- **响应式设计** — 移动端自适应（768px/1024px 断点），侧边栏折叠
- **无障碍** — ARIA 标签、键盘导航（Tab/Enter/Space）、Skip-to-content
- **键盘快捷键** — 数字键切换页面、R 刷新、E 导出 CSV

---

## 生产部署

### 方式一：直接运行

```bash
node server.js
# 或
npm start
```

### 方式二：Docker

```bash
docker compose up -d
# 自带 Nginx 反向代理 + 健康检查 + Gzip 压缩
```

Docker 安全特性：非 root 用户(alphamind:1001)、tini 信号处理、多阶段构建

### 方式三：PM2 集群

```bash
npm run pm2:start
# 自动多核集群 + 崩溃自动重启 + 内存限制(512M)
```

### 方式四：一键部署脚本

```bash
bash deploy.sh
# 自动检测环境 + 安装依赖 + 启动服务
```

### 安全特性

| 特性 | 实现 |
|------|------|
| 安全头 | CSP, X-Frame-Options(DENY), X-Content-Type-Options, Referrer-Policy |
| 速率限制 | 100 req/60s per IP，内存安全清理（10万IP上限） |
| CORS | 严格同源策略 |
| 输入验证 | 参数校验 + XSS 防护 + 路径遍历防护 |
| 优雅降级 | API 失败自动降级至 Demo 数据 |
| 优雅关闭 | 10s kill timeout + 信号处理 |
| 健康探针 | /health（存活）+ /ready（就绪）+ Docker 健康检查 |
| 监控 | Prometheus 指标（请求数、错误数、内存、启动时间） |
| 日志 | JSON 结构化日志 + 轮转 + 可配置级别 |

---

## 项目结构

```
alphamind-lite/
├── server.js              # 服务器入口（重定向至 scripts/server.js）
├── dashboard.html         # 交互式 Web Dashboard（前端 SPA）
├── package.json           # 项目配置
├── index.html             # 项目展示着陆页
├── deploy.sh              # 一键部署脚本
├── Dockerfile             # Docker 多阶段构建
├── docker-compose.yml     # Docker Compose（App + Nginx）
├── ecosystem.config.js    # PM2 集群配置
├── config/
│   └── config.js          # 集中配置管理（环境变量覆盖）
├── scripts/
│   ├── server.js          # HTTP 服务器入口 + 路由 + 优雅关闭（172行）
│   ├── middleware.js       # 缓存、限流、安全头、响应助手
│   ├── utils.js           # 共享工具（escapeHtml, 格式化, 验证）
│   ├── demo-data.js       # 降级/演示数据
│   ├── routes-health.js   # 健康检查、就绪探针、Prometheus 指标
│   ├── routes-market.js   # 行情、情绪、相关性、K线、指标
│   ├── routes-portfolio.js# 持仓 CRUD、提醒、资金费率
│   ├── routes-trading.js  # 风险计算、DCA模拟、模拟交易
│   ├── routes-ai-chat.js  # AI 智能分析引擎
│   ├── routes-bsc.js      # BSC 生态数据
│   ├── sse.js             # SSE 实时推送 + 提醒触发
│   ├── api-client.js      # 统一 API 客户端（超时/重试/指数退避）
│   ├── db.js              # JSON 文件数据库（原子写入）
│   ├── logger.js          # 结构化日志系统（文件 + 轮转）
│   ├── notify.js          # 通知系统（Telegram）
│   ├── test.js            # 测试主入口（102 测试）
│   ├── test-modules.js    # 模块化架构测试
│   ├── test-runner.js     # 测试运行器
│   └── ...                # CLI 工具（demo, portfolio, arbitrage 等）
├── nginx/                 # Nginx 反向代理
│   ├── nginx.conf         # 主配置（Gzip + 安全头 + 速率限制）
│   └── conf.d/default.conf
├── docs/                  # 完整文档（18 篇）
│   ├── product-spec.md    # 产品规格
│   ├── tech-architecture.md # 技术架构
│   ├── business-plan.md   # 商业计划
│   └── ...
├── .github/
│   └── workflows/         # CI/CD（lint → test → docker → deploy）
└── data/                  # 持久化数据存储
```

---

## 测试

```bash
npm test
# ════════════════════════════════════════
#   Results: 62 passed, 0 failed
# ════════════════════════════════════════
```

102 个测试用例覆盖：配置管理、日志系统、API 客户端、技术指标、持仓管理、数据库、路由模块、中间件、工具函数、SSE、安全头、速率限制。

---

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 3000 | 服务端口 |
| `NODE_ENV` | development | 环境（production 启用安全加固） |
| `WATCHLIST` | BTC,ETH,BNB,SOL | 监控币种列表 |
| `BSCSCAN_API_KEY` | — | BSCScan API Key（增强 BSC 数据） |
| `TELEGRAM_BOT_TOKEN` | — | Telegram 通知 Bot Token |
| `TELEGRAM_CHAT_ID` | — | Telegram 通知 Chat ID |

---

## 路线图

- [x] **Phase 1** — MVP：核心市场分析 + 19 个 CLI 工具
- [x] **Phase 2** — Web Dashboard：8 页 SPA 交互界面
- [x] **Phase 3** — AI 智能分析：NLP 意图识别 + 实时数据融合
- [x] **Phase 4** — BNB Chain 全生态：BSC + opBNB + Greenfield 三链集成
- [x] **Phase 5** — 生产部署：Docker + Nginx + PM2 + CI/CD + Prometheus
- [ ] **Phase 6** — 策略回测引擎 + 多交易所支持 + 社交策略分享

---

## 贡献

欢迎 Issue 和 Pull Request！

```bash
git clone https://github.com/ailin546/alphamind-lite.git
git checkout -b feature/your-feature
npm test                             # 确保测试通过
git commit -m "feat: your feature"
git push origin feature/your-feature
```

---

## License

MIT License

---

<a name="english-version"></a>

# AlphaMind Lite (English)

> **AI-Powered BNB Chain Ecosystem Crypto Investment Assistant — Zero Dependencies, Production Ready**

## Overview

AlphaMind Lite is a **truly zero-dependency** open-source AI crypto investment assistant built entirely with Node.js built-in modules. Through an intuitive Web Dashboard, anyone can access institutional-grade market analysis, portfolio management, risk control, and BNB Chain ecosystem data — no coding or `npm install` required.

### Problems We Solve

| Problem | Solution |
|---------|----------|
| **Information overload** — prices, indicators, news scattered across platforms | One-stop Dashboard: prices, Fear & Greed, technical signals, K-lines **all in one screen** |
| **Risk blindness** — no idea when leveraged positions get liquidated | Built-in liquidation calculator + 3-level risk rating system |
| **Decision paralysis** — don't know when to buy or sell | AI assistant combines real-time data + technical indicators for actionable analysis |

### Key Features

- **True Zero Dependencies** — Pure Node.js built-in modules only (http, https, fs, path, crypto). No `npm install` needed
- **BNB Chain Full Ecosystem** — BSC Mainnet + opBNB L2 + BNB Greenfield storage chain
- **Professional Indicators** — RSI(14), MACD, Bollinger Bands(20), SMA/EMA(7,25), multi-timeframe confluence (1H/4H/1D)
- **AI Analysis** — NLP-powered assistant with real-time market context integration
- **Paper Trading** — $10,000 USDT virtual balance for risk-free practice
- **Production Ready** — Docker + Nginx + PM2 + CI/CD + Prometheus + security hardening
- **24/7 Monitoring** — SSE real-time streaming, price alerts, whale tracking, arbitrage scanning

## Quick Start

```bash
git clone https://github.com/ailin546/alphamind-lite.git
cd alphamind-lite
node server.js
# Open http://localhost:3000
```

**Requirements:** Node.js >= 20.0.0 (that's literally it — zero external dependencies)

## Features

| Module | Description |
|--------|-------------|
| **Dashboard** | BTC/ETH live prices, Fear & Greed Index, market signals, 24h charts, skeleton loading |
| **Market Data** | 12+ coins with K-line charts (1H/4H/1D), OHLCV data, technical indicator overlays |
| **Portfolio** | Add/remove holdings, real-time P&L, allocation pie chart, AI advice, **CSV export** |
| **Sentiment** | Fear & Greed gauge, BTC trend analysis, multi-coin correlation, 30-day history |
| **Risk Control** | Leverage liquidation calculator, 3-level risk ratings (safe/warning/danger) |
| **Tools** | DCA calculator with historical data simulation, P&L calculator, Paper Trading ($10K) |
| **BSC Chain** | BSC mainnet gas + opBNB L2 + Greenfield + BNB burns + DeFi ecosystem + TVL |
| **AI Chat** | Natural language Q&A with real-time market context, intent detection, bilingual (EN/中文) |
| **19 CLI Tools** | Portfolio, alerts, whale tracking, arbitrage, funding rates, news monitor, and more |

## BNB Chain Ecosystem Integration

Deep integration with the full BNB Chain ecosystem:

- **BSC Mainnet** — Gas tracking (Low/Standard/Fast), PoSA consensus, 21 validators, 3s blocks, ~100 TPS
- **opBNB L2** — Layer 2 scaling (~10,000 TPS, ~$0.001 gas, OP Stack)
- **BNB Greenfield** — Decentralized storage network
- **BNB Token** — Supply (145M circulating), burns (54M+, ~27%), staking APY (~2.5-3%)
- **DeFi Protocols** — PancakeSwap, Venus, Alpaca Finance, BiSwap, Beefy
- **Ecosystem Tokens** — CAKE, XVS, BAKE, ALPACA, BSW with live prices

## Technical Architecture

- **Frontend**: Pure HTML/CSS/JS + Chart.js (CDN) — no framework, no build step
- **Backend**: Native Node.js HTTP server — zero npm dependencies
- **Data**: Binance REST API + Alternative.me Fear & Greed + BSCScan
- **AI**: Context-aware NLP engine with live market data + technical indicators
- **Storage**: JSON file database with atomic writes (tmp rename), corruption auto-backup
- **Streaming**: SSE real-time push with 30s heartbeat
- **Deployment**: Docker (multi-stage, non-root) + Nginx (gzip, rate-limit) + PM2 (cluster mode)

### Technical Indicators

| Indicator | Parameters | Purpose |
|-----------|------------|---------|
| RSI | Period: 14 | Overbought (>70) / Oversold (<30) detection |
| MACD | Fast: 12, Slow: 26, Signal: 9 | Trend direction + momentum |
| Bollinger Bands | Period: 20, Width: 2σ | Volatility + support/resistance |
| SMA/EMA | Period: 7, 25 | Short/medium-term trend |
| Multi-timeframe | 1H / 4H / 1D | Cross-timeframe signal confluence (bullish/bearish/mixed) |

## Security

| Feature | Implementation |
|---------|---------------|
| Headers | CSP, X-Frame-Options (DENY), X-Content-Type-Options (nosniff), Referrer-Policy |
| Rate Limiting | 100 req/60s per IP, memory-safe cleanup (100K IP cap) |
| CORS | Strict same-origin policy |
| Input Validation | Parameter validation + XSS defense + path traversal protection |
| Graceful Degradation | API failures auto-fallback to demo data |
| Health Probes | /health (liveness) + /ready (readiness) + Docker health checks |
| Monitoring | Prometheus metrics (requests, errors, memory, uptime) |
| Logging | JSON structured logs with rotation and configurable levels |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` - `8` | Switch pages (Dashboard / Market / Portfolio / Sentiment / Risk / Tools / AI / BSC) |
| `R` | Refresh current page data |
| `E` | Export portfolio as CSV |

## Accessibility

- ARIA labels on all interactive elements
- Keyboard navigation support (Tab, Enter, Space)
- Skip-to-content link
- Toast notifications with `aria-live="polite"`
- Semantic HTML structure with proper roles

## Deployment

```bash
# Direct
node server.js

# Docker
docker compose up -d

# PM2 Cluster
npm run pm2:start

# One-click script
bash deploy.sh
```

## Tests

```bash
npm test  # 102 tests, all passing
```

Covers: config, logger, API client, technical indicators, portfolio, database, routes, security headers, rate limiting.

## License

MIT License

**Let AI be your trading partner on BNB Chain.**

(c) 2026 AlphaMind Lite
