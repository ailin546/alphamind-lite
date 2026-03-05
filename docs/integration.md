# AlphaMind Lite - 系统集成指南

本文档介绍如何将 AlphaMind Lite 与其他系统和服务进行集成。

---

## 📋 目录

1. [Telegram 通知集成](#telegram-通知集成)
2. [Binance API 交易集成](#binance-api-交易集成)
3. [数据源集成](#数据源集成)
4. [Webhooks 配置](#webhooks-配置)
5. [自定义数据源接入](#自定义数据源接入)
6. [第三方平台对接](#第三方平台对接)

---

## Telegram 通知集成

### 基础配置

在 `.env` 文件中配置 Telegram Bot：

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id
```

### 获取 Bot Token

1. 打开 Telegram，搜索 `@BotFather`
2. 发送 `/newbot` 创建新机器人
3. 按照提示设置名称和用户名
4. 复制 Bot Token

### 获取 Chat ID

1. 将机器人加入群组或直接与之对话
2. 访问 `https://api.telegram.org/bot<TOKEN>/getUpdates`
3. 找到 `chat` -> `id` 字段

### 代码示例

```javascript
const Telegram = require('telegram-bot-api');

const telegram = new Telegram({
  token: process.env.TELEGRAM_BOT_TOKEN
});

// 发送消息
await telegram.sendMessage({
  chat_id: process.env.TELEGRAM_CHAT_ID,
  text: '📊 市场提醒：BTC 突破 $70,000!'
});

// 发送带按钮的消息
await telegram.sendMessage({
  chat_id: process.env.TELEGRAM_CHAT_ID,
  text: '检测到大幅波动',
  reply_markup: {
    inline_keyboard: [
      [{ text: '查看详情', callback_data: 'view_details' }],
      [{ text: '设置提醒', callback_data: 'set_alert' }]
    ]
  }
});
```

---

## Binance API 交易集成

### API 密钥获取

1. 登录 [Binance](https://www.binance.com)
2. 进入 API 管理页面
3. 创建新 API Key
4. 设置 IP 限制（推荐）
5. 勾选读取权限（现货交易至少需要读取权限）

### 权限说明

| 权限 | 说明 |
|------|------|
| 读取 | 查询行情、余额、订单 |
| 交易 | 下单、撤单 |
| 提现 | 转账（高风险） |

### 代码示例

```javascript
const Binance = require('binance-api-node').default;

const client = Binance({
  apiKey: process.env.BINANCE_API_KEY,
  apiSecret: process.env.BINANCE_API_SECRET
});

// 查询余额
async function getBalances() {
  const account = await client.account();
  return account.balances.filter(b => parseFloat(b.free) > 0);
}

// 下单
async function placeOrder(symbol, side, quantity) {
  return await client.order({
    symbol: symbol,
    side: side,
    type: 'MARKET',
    quantity: quantity
  });
}

// 设置止损单
async function setStopLoss(symbol, stopPrice, quantity) {
  return await client.order({
    symbol: symbol,
    side: 'SELL',
    type: 'STOP_LOSS_LIMIT',
    stopPrice: stopPrice,
    quantity: quantity,
    timeInForce: 'GTC'
  });
}
```

### 完整交易机器人示例

```javascript
// 简单的网格交易机器人
class GridBot {
  constructor(symbol, gridLevels, baseQuantity) {
    this.symbol = symbol;
    this.gridLevels = gridLevels;
    this.baseQuantity = baseQuantity;
    this.orders = [];
  }

  async rebalance(currentPrice) {
    for (const level of this.gridLevels) {
      const diff = Math.abs(currentPrice - level) / level;
      
      if (diff < 0.001) { // 接近网格线
        const hasOrder = this.orders.find(o => Math.abs(o.price - level) / level < 0.002);
        if (!hasOrder) {
          const side = currentPrice > level ? 'SELL' : 'BUY';
          await placeOrder(this.symbol, side, this.baseQuantity);
        }
      }
    }
  }
}
```

---

## 数据源集成

### Fear & Greed Index

```javascript
// alternative.me Fear & Greed API
async function getFearGreedIndex() {
  const response = await fetch('https://api.alternative.me/fng/');
  const data = await response.json();
  
  return {
    value: data[0].value,
    classification: data[0].value_classification,
    timestamp: data[0].timestamp
  };
}
```

### CoinGecko 价格数据

```javascript
async function getCoinData(coinId) {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&community_data=false`
  );
  return await response.json();
}
```

### 链上数据 (Glassnode)

```javascript
async function getOnChainData(metric) {
  const response = await fetch(
    `https://api.glassnode.com/v1/metrics/${metric}`,
    {
      headers: { 'API-Key': process.env.GLASSNODE_KEY }
    }
  );
  return await response.json();
}
```

---

## Webhooks 配置

### 接收 Webhook

```javascript
const express = require('express');
const app = express();

app.use(express.json());

app.post('/webhook', (req, res) => {
  const { action, symbol, price } = req.body;
  
  console.log(`收到 Webhook: ${action} ${symbol} @ ${price}`);
  
  // 处理交易信号
  if (action === 'BUY') {
    placeOrder(symbol, 'BUY', 0.01);
  }
  
  res.status(200).send('OK');
});

app.listen(3000);
```

### 发送 Webhook

```javascript
async function sendWebhook(url, data) {
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

// 使用示例
sendWebhook('https://your-server.com/webhook', {
  symbol: 'BTC',
  action: 'BUY',
  price: 70000,
  reason: 'Fear index below 25'
});
```

---

## 自定义数据源接入

### 创建自定义 Provider

```javascript
class CustomDataProvider {
  constructor(config) {
    this.name = config.name;
    this.endpoint = config.endpoint;
    this.apiKey = config.apiKey;
  }

  async fetch() {
    const response = await fetch(this.endpoint, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` }
    });
    return this.transform(await response.json());
  }

  transform(rawData) {
    // 将外部数据格式转换为统一格式
    return {
      price: rawData.price,
      volume: rawData.volume24h,
      change24h: rawData.changePercent,
      timestamp: Date.now()
    };
  }
}

// 注册自定义 Provider
const providers = {
  binance: new BinanceProvider(),
  coinbase: new CoinbaseProvider(),
  custom: new CustomDataProvider({
    name: 'MyDataSource',
    endpoint: 'https://api.example.com/price',
    apiKey: process.env.CUSTOM_API_KEY
  })
};
```

### 统一数据接口

```javascript
async function getUnifiedPrice(symbols) {
  const results = await Promise.all(
    symbols.map(async (symbol) => {
      const prices = await Promise.all(
        Object.values(providers).map(p => p.fetch(symbol))
      );
      
      // 取平均值或加权平均
      const validPrices = prices.filter(p => p !== null);
      const avgPrice = validPrices.reduce((a, b) => a + b.price, 0) / validPrices.length;
      
      return { symbol, price: avgPrice, sources: validPrices.length };
    })
  );
  
  return results;
}
```

---

## 第三方平台对接

### TradingView 信号

```javascript
// TradingView Webhook 格式
app.post('/tradingview-webhook', (req, res) => {
  const { ticker, price, action, strategy } = req.body;
  
  console.log(`TradingView 信号: ${ticker} ${action}`);
  
  // 执行交易
  if (action === 'BUY') {
    executeTrade(ticker, 'BUY', calculateQuantity(price));
  } else if (action === 'SELL') {
    executeTrade(ticker, 'SELL', calculateQuantity(price));
  }
  
  res.status(200).send('Signal processed');
});
```

### Zapier / Make (Integromat)

```javascript
// 发送到 Zapier Webhook
async function sendToZapier(event, data) {
  await fetch(process.env.ZAPIER_WEBHOOK_URL, {
    method: 'POST',
    body: JSON.stringify({
      event,
      ...data,
      timestamp: new Date().toISOString()
    })
  });
}

// 使用场景
sendToZapier('price_alert', { symbol: 'BTC', price: 70000 });
sendToZapier('trade_executed', { symbol: 'ETH', side: 'BUY', qty: 0.1 });
```

### Notion 数据库同步

```javascript
const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_KEY });

async function logToNotion(trade) {
  await notion.pages.create({
    parent: { database_id: process.env.NOTION_DB_ID },
    properties: {
      '交易对': { title: [{ text: { content: trade.symbol } }] },
      '方向': { select: { name: trade.side } },
      '数量': { number: trade.quantity },
      '价格': { number: trade.price },
      '时间': { date: { start: new Date().toISOString() } }
    }
  });
}
```

### Google Sheets 记录

```javascript
const { GoogleSpreadsheet } = require('google-spreadsheet');

async function appendTradeLog(trade) {
  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID);
  await doc.useServiceAccountAuth(require('./service-account.json'));
  
  const sheet = doc.sheetsByIndex[0];
  await sheet.addRow({
    时间: new Date().toISOString(),
    交易对: trade.symbol,
    方向: trade.side,
    数量: trade.quantity,
    价格: trade.price,
    备注: trade.note || ''
  });
}
```

---

## 集成配置模板

创建 `.env` 文件：

```env
# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Binance
BINANCE_API_KEY=
BINANCE_API_SECRET=

# 数据源
GLASSNODE_KEY=
COINGECKO_KEY=

# Webhooks
ZAPIER_WEBHOOK_URL=

# Notion
NOTION_KEY=
NOTION_DB_ID=

# Google Sheets
GOOGLE_SHEET_ID=
```

---

## 最佳实践

1. **密钥安全**：所有 API 密钥存储在环境变量中，不要提交到代码仓库
2. **错误处理**：每个外部 API 调用都要有重试机制和超时设置
3. **限流控制**：遵守各平台的 API 限流规则，使用队列处理请求
4. **日志记录**：记录所有集成操作，便于问题排查
5. **监控告警**：设置关键指标监控，及时发现集成异常

---

## 故障排查

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| Telegram 消息发送失败 | Bot Token 失效 | 重新获取 Token |
| Binance API 报错 | 时间不同步 | 校准服务器时间 |
| Webhook 接收不到 | 防火墙/URL 错误 | 检查服务器可达性 |
| 数据源返回 null | API 限流/Key 过期 | 检查配额和 Key 状态 |

---

*如需更多帮助，请提交 Issue 或查看官方文档。*
