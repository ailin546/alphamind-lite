<p align="center">
  <h1 align="center">🦞 AlphaMind Lite</h1>
  <p align="center"><strong>AI 驱动的 BNB Chain 全生态加密货币智能投资助手</strong></p>
  <p align="center"><em>巨鲸监控 · 套利扫描 · 实时预警 · AI 分析 — 零依赖一键部署</em></p>
  <p align="center">
    <img src="https://img.shields.io/badge/Node.js-22-339933?logo=node.js" alt="Node.js">
    <img src="https://img.shields.io/badge/Dependencies-0-brightgreen" alt="Zero Dependencies">
    <img src="https://img.shields.io/badge/Tests-125%20passed-success" alt="Tests">
    <img src="https://img.shields.io/badge/License-MIT-blue" alt="MIT License">
    <img src="https://img.shields.io/badge/BNB_Chain-Full_Ecosystem-F0B90B?logo=binance" alt="BNB Chain">
    <img src="https://img.shields.io/badge/opBNB-L2-orange" alt="opBNB L2">
  </p>
  <p align="center">
    <a href="#快速开始">快速开始</a> · <a href="#-巨鲸监控---whale-monitoring">巨鲸监控</a> · <a href="#-套利扫描---arbitrage-scanner">套利扫描</a> · <a href="#功能全览">全部功能</a> · <a href="#english-version">English</a>
  </p>
</p>

<p align="center">
  <a href="https://railway.app/template/alphamind-lite"><img src="https://railway.app/button.svg" alt="Deploy on Railway" height="32"></a>
  &nbsp;
  <a href="https://render.com/deploy?repo=https://github.com/ailin546/alphamind-lite"><img src="https://render.com/images/deploy-to-render-button.svg" alt="Deploy to Render" height="32"></a>
</p>

---

## 为什么选择 AlphaMind Lite？

> **让每一个币安用户都拥有机构级别的巨鲸追踪和套利分析能力 — 零依赖、零门槛、全生态覆盖。**

普通投资者在加密市场交易时面临四大痛点：

| 痛点 | AlphaMind Lite 的解决方案 |
|------|--------------------------|
| **信息碎片化** — 行情、巨鲸动向、套利机会分散在不同平台 | 一站式 Dashboard：巨鲸追踪 + 套利扫描 + AI 分析 **一屏尽览** |
| **巨鲸信号滞后** — 看到大额交易时机已过 | SSE 实时推送巨鲸警报：>$500K 交易、爆仓浪潮、订单簿翻转 **秒级送达** |
| **套利计算复杂** — 基差、资金费率、手续费难以手工比较 | 自动扫描基差/资金费率机会，内置费后净收益计算 + 头寸建议 + 对冲方案 |
| **缺乏关联分析** — 巨鲸行为和套利机会各看各的 | 智能信号：巨鲸吸筹×负基差=看涨信号，爆仓潮×高资金费=级联风险 |

**核心特色：**

- **巨鲸全维度监控** — 大额交易(>$50K) + 链上转账 + 爆仓数据 + 订单簿深度 + 吸筹/派发指标 + 信心评分
- **专业套利扫描** — 30+ 币种基差/资金费率机会自动检测，费后净收益计算，A/B/C/D 评级，头寸建议
- **跨模块智能信号** — 巨鲸行为与套利数据自动关联，识别背离、轧空、级联风险等复合信号
- **真·零依赖** — 纯 Node.js 内置模块实现，`node server.js` 一键启动，无需 `npm install`
- **AI 深度融合** — AI 助手整合巨鲸/套利/行情/技术指标全维度数据进行分析
- **生产就绪** — Docker + Nginx + PM2 集群 + CI/CD + Prometheus 监控 + 安全加固

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

## 🐋 巨鲸监控 — Whale Monitoring

### 实时大额交易追踪

监控币安所有交易对的大额交易（>$50,000），自动分类为三个层级：

| 层级 | 门槛 | 图标 |
|------|------|------|
| **Whale** 🐋 | ≥ 1,000 BTC | 蓝色标记 |
| **Shark** 🦈 | ≥ 500 BTC | 橙色标记 |
| **Dolphin** 🐬 | ≥ 100 BTC | 灰色标记 |

- 实时展示最近 30 笔大额交易（买入/卖出/金额/时间）
- 买卖比例统计 + 成交量对比
- $500K+/$100K+ 分层统计
- **市场情绪判定**：bullish / bearish / neutral（基于买卖量比）

### 爆仓数据监控

实时追踪多头/空头爆仓情况：

- 最近 20 笔爆仓详情（币种、方向、金额、时间）
- 多头/空头爆仓量对比 + 优势方判定
- 爆仓浪潮检测（短时间内 3+ 笔大额爆仓 = 级联风险信号）

### 订单簿深度分析

BTC 和 ETH 的 50 档深度订单簿分析：

- 买卖盘总量 + 不平衡比率（imbalance ratio）
- **买墙/卖墙检测** — 自动识别大额挂单支撑/阻力位
- 价差计算 + 流动性评估
- 不平衡信号：`strong_buy_support` / `heavy_sell_pressure` / `balanced`

### 链上数据

BTC/ETH 的实时链上活动指标：

- 活跃地址数 + 交易量 + 平均交易金额
- 交易所净流入/流出量（流入 = 抛压，流出 = 吸筹信号）

### 吸筹/派发指标

综合买卖量 + 订单簿不平衡自动判定当前市场阶段：

- **Accumulation** — 聪明钱正在买入（买量 > 卖量 × 1.2 且订单簿买盘占优）
- **Distribution** — 聪明钱正在卖出（反之）
- **Neutral** — 无明显方向

### 巨鲸信心评分

基于多因子计算的 0-100 综合评分：

| 因子 | 权重 | 说明 |
|------|------|------|
| 交易流向 | 25分 | 买卖比偏离度 |
| 爆仓方向 | 15分 | 多空爆仓不平衡 |
| 订单簿 | 10分 | 买卖盘深度比 |
| 链上流向 | 10分 | 交易所净流入/出 |

### SSE 实时巨鲸警报

通过 Server-Sent Events 实时推送三类巨鲸事件：

```
事件类型                    触发条件
mega_whale_trade           单笔交易 > $500,000
liquidation_cascade        短时间内 3+ 笔大额爆仓
orderbook_flip             订单簿不平衡方向反转
```

- 页面内 Toast 弹窗 + 浏览器原生通知
- 巨鲸页面实时 Feed（滑入动画展示最新事件）
- 60 秒检测周期，无需手动刷新

---

## 📊 套利扫描 — Arbitrage Scanner

### 基差套利扫描

自动扫描 30+ 币种的现货/合约价差（basis）：

- **正基差**（futures > spot）→ `cash_and_carry`：买现货 + 卖合约
- **负基差**（futures < spot）→ `reverse_cash_carry`：卖现货 + 买合约
- 自动计算年化收益率（APY）
- A/B/C/D 评级系统（基于风险回报比）

### 资金费率套利

永续合约资金费率机会检测：

- 实时资金费率 + 年化 APY 计算
- 历史资金费率趋势（最近 10 期迷你图 + 上升/下降趋势标识）
- 高资金费 + 低基差 = 纯资金费率套利机会
- 多空资金费率统计 + 市场情绪评估

### 费后净收益计算

内置真实手续费模型，告诉你套利到底赚不赚钱：

```
费用项              说明
现货 Taker 费       0.1%（币安默认）
合约 Taker 费       0.04%（币安合约）
滑点估算            0.05% × 2（开仓+平仓）
资金费收入          按当前费率计算
─────────────────────────
净利润 = 基差收益 + 资金费收入 - 总手续费
```

- 自定义仓位大小重新计算
- 盈亏平衡基差点位
- 绿色/红色直观标识盈利/亏损

### 头寸建议 & 对冲计算器

每个套利机会自动附带交易执行建议：

| 项目 | 说明 |
|------|------|
| **建议仓位** | 基于评级（A=15%, B=10%, C=6%, D=3%）的账户分配 |
| **对冲方案** | 现货买/卖 + 合约做空/做多的具体数量和成本 |
| **推荐杠杆** | 根据日波幅自动计算（高波动=低杠杆） |
| **初始保证金** | 合约侧所需保证金金额 |
| **强平价格** | 在推荐杠杆下的预估强制平仓价格 |
| **月收益率** | 预期月化收益百分比 |
| **风险等级** | HIGH / MEDIUM / LOW |

### 快速对比工具

在币种扫描表中点击 `+` 将任意币种加入对比列表：

- 并排对比基差 / 资金费率 / 评级 / 手续费 / 净 ROI / 月收益
- 最多 8 个币种同时对比
- 数据持久化在 localStorage，页面刷新不丢
- 一键清空对比列表

### 套利历史追踪

内存环形缓冲区记录每次扫描结果，Chart.js 趋势图展示：

- 基差趋势线（随时间变化）
- 资金费率趋势线
- 盈利机会数量变化
- 支持多次刷新累积数据观测

### 持仓量（Open Interest）

每个币种展示合约持仓量数据，帮助判断市场参与度：

- 大持仓量 + 高基差 = 更可靠的套利机会
- 小持仓量 = 流动性风险，不适合大仓位

---

## 🧠 智能信号 — Cross-Module Signals

巨鲸监控和套利扫描不是孤立的，AlphaMind Lite 会自动进行跨模块关联分析：

| 信号类型 | 条件 | 含义 |
|---------|------|------|
| **whale_basis_divergence** | 巨鲸吸筹 + 合约负基差 | 聪明钱买入而合约折价 → 潜在反转看涨 |
| **whale_basis_convergence** | 巨鲸派发 + 合约正溢价 | 聪明钱卖出而合约高溢价 → 潜在见顶看跌 |
| **liquidation_cascade_risk** | 多头爆仓量 > 3× 空头 + 正资金费率 | 多头持续被清算，下行趋势可能加速 |
| **short_squeeze** | 空头爆仓量 > 3× 多头 + 负资金费率 | 空头被轧，上行动能可能延续 |
| **buy_support_with_arb** | 订单簿买盘支撑 + 盈利套利机会 | 买盘有支撑且有套利空间 → 低风险机会 |

智能信号在巨鲸页面以颜色标记卡片展示，每个信号附带置信度（高/中）和操作建议。

---

## 🤖 AI 助手 — 全维度数据融合

AI Chat 不仅使用行情和技术指标，还自动融合巨鲸和套利数据：

```
用户: "现在BTC值得买入吗？"

AI 回复会综合考虑:
├── 📈 实时价格 + 24h 涨跌
├── 📊 技术指标（RSI/MACD/布林带/多时间框架）
├── 😨 恐慌贪婪指数
├── 🐋 巨鲸行为（买卖比/吸筹派发/信心评分）
├── 💥 爆仓数据（多空爆仓量/优势方）
├── 📖 订单簿（买卖不平衡/支撑位/阻力位）
├── 💰 套利机会（基差/资金费率/评级/盈利性）
└── 🔗 链上数据（活跃地址/交易所流入流出）
```

支持意图识别：买入分析 / 卖出建议 / 风险评估 / DCA 定投 / 巨鲸追踪 / 套利机会 / 爆仓查询 / 资金费率

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

- Web 表单直接添加 / 删除持仓
- 实时盈亏计算（金额 + 百分比）
- 资产分配饼图可视化 + AI 自动生成投资建议
- **CSV 导出**（快捷键 `E`）+ 持久化存储

### 4. Market Sentiment — 情绪分析

- Fear & Greed 仪表盘（带颜色分级指示器）
- BTC 价格趋势 + 成交量趋势 + 多币种相关性
- 30 天情绪走势图 + 情绪解读

### 5. Risk Control — 风控中心

- 输入币种、数量、入场价、杠杆倍数
- 自动计算：爆仓价格、保证金、清算距离
- **风险评级**：安全 / 警告 / 危险（三级可视化）
- 价格提醒系统（上穿/下穿阈值 SSE 实时触发）

### 6. Tools — 投资工具

- **DCA 定投计算器** — 真实历史数据模拟收益
- **盈亏计算器** — 快速计算交易盈亏
- **Paper Trading** — $10,000 USDT 虚拟资金模拟交易

### 7. BSC Chain — BNB Chain 全生态

- **BSC 主链** — Gas 追踪、PoSA 共识、21 验证人
- **opBNB L2** — ~10,000 TPS、$0.001 Gas
- **BNB Greenfield** — 去中心化存储链
- **DeFi 生态** — PancakeSwap、Venus、Alpaca Finance 等协议
- **BNB 代币** — 流通量、销毁率、质押 APY

### 8. AI Chat — 智能对话

- 自然语言交互 + 中英双语
- 融合巨鲸/套利/行情/技术指标/情绪全维度数据
- 意图识别（买入/卖出/风险/巨鲸/套利/爆仓/资金费率）

### 9. Whale Monitoring — 巨鲸监控

→ [查看详细功能说明](#-巨鲸监控---whale-monitoring)

### 10. Arbitrage Scanner — 套利扫描

→ [查看详细功能说明](#-套利扫描---arbitrage-scanner)

---

## 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `1` - `0` | 切换页面（Dashboard / Market / Portfolio / Sentiment / Risk / Tools / AI / BSC / Whale / Arb） |
| `R` | 刷新当前页面数据 |
| `E` | 导出当前数据为 CSV |

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
┌──────────────┐                  ┌──────────────────────────────────┐
│  Dashboard   │  ◄── HTTP ──►   │  Pure Node.js HTTP Server         │
│  HTML/CSS/JS │  ◄── SSE ───    │  (Zero Dependencies)              │
│  Chart.js    │                  │                                    │
│              │  whale_alert ──► │  routes-whale-arb.js              │
│              │  arb_update ───► │   ├── handleWhaleAlert()          │
│              │  liq_cascade ──► │   ├── handleArbitrage()           │
│              │                  │   ├── calculatePositionAdvice()    │
│              │                  │   └── smartSignals correlator      │
└──────────────┘                  └──────────┬───────────────────┬────┘
                                             │                   │
                  ┌──────────────────────────┬┴───────┐   ┌──────▼──────┐
                  │                          │         │   │  SSE Engine  │
         ┌────────▼────────┐      ┌─────────▼──────┐  │   │  sse.js      │
         │  Binance API    │      │  Alternative.me│  │   │  60s whale   │
         │  行情/K线/合约   │      │  Fear & Greed  │  │   │  alerts      │
         │  订单簿/爆仓/OI  │      └────────────────┘  │   └──────────────┘
         └─────────────────┘                           │
                                              ┌────────▼───────┐
                                              │  AI Engine      │
                                              │  巨鲸+套利+行情  │
                                              │  全维度上下文     │
                                              └────────────────┘
```

### 核心设计原则

| 原则 | 实现 |
|------|------|
| **零依赖** | 仅使用 Node.js 内置模块（http, https, fs, path, url, crypto） |
| **前端零框架** | 原生 HTML/CSS/JS + Chart.js（CDN），无需构建步骤 |
| **数据真实** | 所有数据来自 Binance API、Alternative.me、BSCScan，自动降级至 Demo 数据 |
| **实时推送** | SSE 双通道：30s 价格推送 + 60s 巨鲸事件推送 |
| **跨模块关联** | 巨鲸×套利自动关联分析，不做信息孤岛 |
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
| GET | `/api/whale` | **巨鲸数据（大额交易+爆仓+订单簿+链上+智能信号）** |
| GET | `/api/arbitrage` | **套利扫描（基差+资金费率+费后净收益+头寸建议）** |
| GET | `/api/arb-history` | **套利历史趋势数据** |
| GET | `/api/funding` | 永续合约资金费率 |
| GET | `/api/bsc` | BSC + opBNB + Greenfield 全生态数据 |
| GET | `/api/alerts` | 价格提醒列表 |
| POST | `/api/portfolio` | 持仓分析与建议 |
| POST | `/api/portfolio/add` | 添加持仓 |
| POST | `/api/portfolio/remove` | 删除持仓 |
| POST | `/api/alerts/add` | 添加价格提醒 |
| POST | `/api/risk` | 仓位风险计算（爆仓价格） |
| POST | `/api/dca` | 定投收益模拟 |
| POST | `/api/ai-chat` | **AI 智能对话（融合巨鲸+套利数据）** |
| POST | `/api/paper-trade` | 模拟交易下单 |
| GET | `/api/paper-trade` | 模拟交易历史 |
| POST | `/api/paper-trade/reset` | 重置模拟账户 |
| GET | `/api/stream` | **SSE 实时推送（价格+巨鲸警报）** |
| GET | `/health` | 服务健康检查 |
| GET | `/ready` | 就绪检查（Binance 连通性） |
| GET | `/metrics` | Prometheus 监控指标 |

---

## 用户体验亮点

- **暗色主题** — Material Design 风格，专业交易界面配色
- **骨架屏加载** — Shimmer 动画，流畅加载体验
- **价格闪烁** — 价格变化时绿涨红跌视觉反馈
- **巨鲸 Feed** — 实时巨鲸事件滑入动画
- **Toast 通知** — 成功/错误/警告/巨鲸警报弹窗
- **中英双语** — 导航栏一键切换 EN / 中文
- **响应式设计** — 移动端自适应
- **无障碍** — ARIA 标签、键盘导航、Skip-to-content
- **CSV 导出** — 巨鲸数据/套利数据/持仓数据一键导出

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
├── dashboard.js           # 前端逻辑（巨鲸/套利/AI/市场/持仓/风控）
├── package.json           # 项目配置
├── index.html             # 项目展示着陆页
├── deploy.sh              # 一键部署脚本
├── Dockerfile             # Docker 多阶段构建
├── docker-compose.yml     # Docker Compose（App + Nginx）
├── ecosystem.config.js    # PM2 集群配置
├── config/
│   └── config.js          # 集中配置管理（环境变量覆盖）
├── scripts/
│   ├── server.js          # HTTP 服务器 + 路由 + 优雅关闭
│   ├── middleware.js       # 缓存、限流、安全头、响应助手
│   ├── utils.js           # 共享工具（escapeHtml, 格式化, 验证）
│   ├── routes-whale-arb.js # 🐋 巨鲸监控 + 📊 套利扫描 + 🧠 智能信号
│   ├── routes-ai-chat.js  # 🤖 AI 智能分析（融合全维度数据）
│   ├── routes-market.js   # 行情、情绪、相关性、K线、指标
│   ├── routes-portfolio.js# 持仓 CRUD、提醒、资金费率
│   ├── routes-trading.js  # 风险计算、DCA模拟、模拟交易
│   ├── routes-health.js   # 健康检查、就绪探针、Prometheus 指标
│   ├── routes-bsc.js      # BSC 生态数据
│   ├── sse.js             # SSE 实时推送 + 巨鲸警报 + 提醒触发
│   ├── api-client.js      # 统一 API 客户端（超时/重试/指数退避）
│   ├── db.js              # JSON 文件数据库（原子写入）
│   ├── demo-data.js       # 降级/演示数据
│   ├── logger.js          # 结构化日志系统（文件 + 轮转）
│   ├── notify.js          # 通知系统（Telegram）
│   ├── test.js            # 测试主入口（125 测试）
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
#   Results: 125 passed, 0 failed
# ════════════════════════════════════════
```

125 个测试用例覆盖：配置管理、日志系统、API 客户端、技术指标、持仓管理、数据库、路由模块、中间件、工具函数、SSE、安全头、速率限制、**巨鲸模块**、**套利评级/费用计算/头寸建议**、**AI 意图识别**、**套利历史追踪**。

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
- [x] **Phase 6** — 巨鲸监控：大额交易 + 爆仓 + 订单簿 + 链上 + 吸筹/派发 + 实时警报
- [x] **Phase 7** — 套利扫描：基差/资金费率/费后净收益/头寸建议/对比工具/历史追踪
- [x] **Phase 8** — 跨模块智能信号 + AI 全维度数据融合
- [ ] **Phase 9** — 策略回测引擎 + 多交易所支持 + 社交策略分享

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

> **AI-Powered BNB Chain Ecosystem Crypto Investment Assistant — Whale Monitoring, Arbitrage Scanning, Real-Time Alerts, Zero Dependencies**

## Overview

AlphaMind Lite is a **truly zero-dependency** open-source AI crypto investment assistant built entirely with Node.js built-in modules. Through an intuitive Web Dashboard, anyone can access institutional-grade **whale tracking**, **arbitrage scanning**, market analysis, portfolio management, risk control, and BNB Chain ecosystem data — no coding or `npm install` required.

### Problems We Solve

| Problem | Solution |
|---------|----------|
| **Whale signals delayed** — large trades spotted too late | SSE real-time push: >$500K trades, liquidation cascades, orderbook flips in **seconds** |
| **Arb math is hard** — basis, funding, fees scattered across tools | Auto-scan 30+ coins for basis/funding opps with fee-adjusted P&L + position sizing advice |
| **Data silos** — whale activity and arb opportunities analyzed separately | Smart Signals: whale accumulation × negative basis = bullish divergence, auto-detected |
| **Decision paralysis** — don't know when to buy or sell | AI assistant combines whale + arb + market + indicators for holistic analysis |

### Key Features

- **Full-Spectrum Whale Monitoring** — Large trades (>$50K), liquidations, order book depth, on-chain flows, accumulation/distribution indicator, confidence score
- **Professional Arbitrage Scanner** — 30+ coins basis/funding rate scanning, fee-adjusted P&L, A/B/C/D grading, position sizing + hedge calculator
- **Cross-Module Smart Signals** — Whale × arb correlation: divergence, squeeze, cascade risk detection
- **True Zero Dependencies** — Pure Node.js built-in modules only. No `npm install` needed
- **AI Deep Integration** — AI chat fuses whale + arb + market + indicators for full-context analysis
- **Production Ready** — Docker + Nginx + PM2 + CI/CD + Prometheus + security hardening
- **24/7 Real-Time Alerts** — SSE dual-channel: 30s price push + 60s whale event push

## Quick Start

```bash
git clone https://github.com/ailin546/alphamind-lite.git
cd alphamind-lite
node server.js
# Open http://localhost:3000
```

**Requirements:** Node.js >= 20.0.0 (that's literally it — zero external dependencies)

## Whale Monitoring

Real-time tracking of large trades, liquidations, order book depth, and on-chain activity:

| Feature | Description |
|---------|-------------|
| **Large Trades** | All trades >$50K on Binance, classified as Whale/Shark/Dolphin |
| **Liquidations** | Long/short liquidation tracking with cascade detection |
| **Order Book Depth** | 50-level depth for BTC/ETH with buy/sell wall detection |
| **On-Chain Data** | Active addresses, tx volume, exchange net inflow/outflow |
| **Accumulation/Distribution** | Smart money buying vs selling indicator |
| **Confidence Score** | Multi-factor 0-100 score (trade flow + liquidations + orderbook + on-chain) |
| **SSE Alerts** | Real-time push for mega trades (>$500K), liquidation cascades, orderbook flips |
| **Smart Signals** | Cross-module correlation with arbitrage data (see below) |

## Arbitrage Scanner

Automated scanning of 30+ coins for spot-futures basis and funding rate opportunities:

| Feature | Description |
|---------|-------------|
| **Basis Scanning** | Spot vs futures price divergence with APY calculation |
| **Funding Rate** | Perpetual contract funding rate with historical trend + APY |
| **Fee-Adjusted P&L** | Real fee model (spot 0.1%, futures 0.04%, slippage 0.05%) |
| **Risk/Reward Grade** | A/B/C/D grading based on risk-reward ratio |
| **Position Advice** | Recommended size, hedge details, leverage, margin, liquidation price |
| **Quick Compare** | Side-by-side comparison of up to 8 coins (persisted in localStorage) |
| **History Tracking** | Ring buffer + Chart.js trend visualization of basis/funding over time |
| **Open Interest** | Futures OI data for market participation assessment |

## Smart Signals (Cross-Module)

| Signal | Condition | Meaning |
|--------|-----------|---------|
| **whale_basis_divergence** | Whales accumulating + negative basis | Smart money buying while futures at discount → bullish reversal |
| **whale_basis_convergence** | Whales distributing + positive premium | Smart money selling while futures at premium → potential top |
| **liquidation_cascade_risk** | Long liqs > 3x short liqs + positive funding | Longs being cascaded, downside may accelerate |
| **short_squeeze** | Short liqs > 3x long liqs + negative funding | Shorts squeezed, upward momentum may continue |
| **buy_support_with_arb** | Orderbook buy support + profitable arb | Buy wall + arb opportunity → low risk trade |

## All Features

| Module | Description |
|--------|-------------|
| **Dashboard** | BTC/ETH live prices, Fear & Greed Index, market signals, 24h charts |
| **Market Data** | 12+ coins with K-line charts (1H/4H/1D), technical indicator overlays |
| **Portfolio** | Holdings management, real-time P&L, allocation chart, AI advice, CSV export |
| **Sentiment** | Fear & Greed gauge, BTC trend, multi-coin correlation, 30-day history |
| **Risk Control** | Leverage liquidation calculator, 3-level risk ratings, price alerts |
| **Tools** | DCA calculator, P&L calculator, Paper Trading ($10K virtual) |
| **BSC Chain** | BSC mainnet + opBNB L2 + Greenfield + BNB burns + DeFi ecosystem |
| **AI Chat** | NLP Q&A with whale + arb + market + indicator context, bilingual (EN/中文) |
| **Whale Monitoring** | Large trades, liquidations, orderbook depth, on-chain, confidence score, SSE alerts |
| **Arb Scanner** | Basis/funding scanning, fee P&L, grading, position advice, comparison, history |
| **Smart Signals** | Cross-module whale × arb correlation signals |
| **19 CLI Tools** | Portfolio, alerts, whale tracking, arbitrage, funding rates, news monitor |

## BNB Chain Ecosystem

- **BSC Mainnet** — Gas tracking, PoSA consensus, 21 validators, 3s blocks, ~100 TPS
- **opBNB L2** — Layer 2 scaling (~10,000 TPS, ~$0.001 gas, OP Stack)
- **BNB Greenfield** — Decentralized storage network
- **BNB Token** — Supply (145M), burns (54M+, ~27%), staking APY (~2.5-3%)
- **DeFi Protocols** — PancakeSwap, Venus, Alpaca Finance, BiSwap, Beefy

## Technical Architecture

- **Frontend**: Pure HTML/CSS/JS + Chart.js (CDN) — no framework, no build step
- **Backend**: Native Node.js HTTP server — zero npm dependencies
- **Data Sources**: Binance REST API + Alternative.me + BSCScan
- **Real-Time**: SSE dual-channel (30s prices + 60s whale alerts)
- **AI**: Context-aware NLP with whale + arb + market + indicator fusion
- **Storage**: JSON file database with atomic writes and auto-backup
- **Deployment**: Docker (multi-stage, non-root) + Nginx + PM2 (cluster)

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

## Tests

```bash
npm test  # 125 tests, all passing
```

Covers: config, logger, API client, technical indicators, portfolio, database, routes, middleware, security, SSE, **whale module**, **arb grading/fees/position advice**, **AI intent detection**, **arb history tracking**.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` - `0` | Switch pages |
| `R` | Refresh current page |
| `E` | Export data as CSV |

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

## License

MIT License
