# AlphaMind Lite 产品规格说明书

## 1. 产品愿景

**愿景**：让每个普通投资者都能获得机构级的交易智慧

**使命**：通过 AI 技术消除信息不对称，让投资决策更智能

## 2. 用户故事

### 用户故事 1：新手投资者
> "我是加密货币新手，看到 BTC 涨涨跌跌不敢下手。AlphaMind 告诉我什么时候可以买、什么时候要跑。"

### 用户故事 2：忙碌的上班族
> "我白天上班没时间看盘，晚上睡觉担心爆仓。AlphaMind 7×24 帮我盯着，有风险立刻通知我。"

### 用户故事 3：信息焦虑者
> "币圈消息太多，我看不过来。AlphaMind 帮我筛选重要信息，翻译成中文，推送到我手机上。"

### 用户故事 4：风险厌恶者
> "我之前爆仓过一次，现在很小心。AlphaMind 的风控功能让我知道什么时候该跑。"

### 用户故事 5：长期hodler
> "我持有多个币种，想知道整体持仓状况。AlphaMind 给我一个全面的组合分析。"

## 3. 功能列表

### F1: 实时行情监控
- 数据源：Binance Public API
- 更新频率：实时
- 支持币种：BTC, ETH, BNB, SOL, DOGE, etc.
- 显示信息：价格、24h涨跌、成交量

### F2: 恐慌指数
- 数据源：alternative.me API
- 更新频率：每日
- 显示：0-100 数值 + 情绪标签

### F3: 持仓分析
- 功能：多币种持仓管理
- 计算：成本、现价、盈亏、占比
- 风险评估：集中度、波动性

### F4: 情报监控
- 数据源：Binance API + Tavily 搜索
- 内容：公告、新闻、KOL 喊单
- 推送：中文摘要

### F5: 风控预警
- 仓位健康检测
- 爆仓计算（支持杠杆）
- 预警推送

### F6: AI 对话（进阶）
- 引擎：OpenClaw Agent
- 功能：自然语言交互
- 场景：问答、建议、分析

## 4. 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                    AlphaMind Lite                        │
├─────────────────────────────────────────────────────────┤
│  用户层 (Telegram / QQ / Discord / Web)               │
├─────────────────────────────────────────────────────────┤
│  应用层 (Node.js Scripts)                              │
│  ├── market-data.service    - 行情数据                 │
│  ├── portfolio.service      - 持仓分析                  │
│  ├── fear-greed.service   - 恐慌指数                  │
│  ├── news.service         - 情报监控                  │
│  └── ai-agent.service    - AI 对话                    │
├─────────────────────────────────────────────────────────┤
│  基础设施层                                           │
│  ├── Binance API         - 交易数据                    │
│  ├── alternative.me      - 恐慌指数                    │
│  ├── Tavily             - 搜索情报                    │
│  └── OpenClaw Gateway  - AI Agent                   │
└─────────────────────────────────────────────────────────┘
```

## 5. 部署方式

### 方式一：本地运行（推荐开发）
```bash
git clone https://github.com/ailin546/alphamind-lite.git
cd alphamind-lite
node scripts/comprehensive-demo.js
```

### 方式二：Docker 部署
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY . .
CMD ["node", "scripts/comprehensive-demo.js"]
```

### 方式三：OpenClaw Agent
```bash
# 集成到 OpenClaw 作为技能
cp -r skills /root/.openclaw/workspace/skills/
# 重启 OpenClaw
openclaw gateway restart
```

## 6. 依赖说明

### 运行时依赖
- Node.js >= 18
- npm

### API 依赖（免费）
- Binance Public API（行情）
- alternative.me（恐慌指数）
- Tavily（搜索，需要免费 API Key）

### 可选依赖
- OpenClaw Gateway（AI 对话功能）
- Telegram/QQ/Discord Bot（消息推送）

## 7. 配置说明

### 环境变量
```
# 可选：Tavily 搜索
TAVILY_API_KEY=your_key_here

# 可选：OpenClaw Gateway
GATEWAY_URL=http://127.0.0.1:18789
AUTH_TOKEN=your_token
```

### 持仓配置
编辑 `scripts/portfolio.js` 中的 PORTFOLIO 数组：
```javascript
const PORTFOLIO = [
  { symbol: 'BTC', amount: 0.5, avgPrice: 70000 },
  { symbol: 'ETH', amount: 2.0, avgPrice: 2000 },
];
```

## 8. 版本历史

| 版本 | 日期 | 内容 |
|------|------|------|
| v1.0 | 2026-03-05 | 基础功能 |
| v2.0 | 2026-03-05 | 完整功能 |
| v2.1 | 2026-03-05 | AI 对话集成 |
