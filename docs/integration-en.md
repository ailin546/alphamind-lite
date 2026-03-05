# AlphaMind Lite - System Integration Guide

This document describes how to integrate AlphaMind Lite with other systems and services.

---

## Table of Contents

1. [Telegram Notification Integration](#telegram-notification-integration)
2. [Binance API Trading Integration](#binance-api-trading-integration)
3. [Data Source Integration](#data-source-integration)
4. [Webhook Configuration](#webhook-configuration)
5. [Custom Data Source Integration](#custom-data-source-integration)
6. [Third-Party Platform Integration](#third-party-platform-integration)

---

## Telegram Notification Integration

### Basic Configuration

Configure your Telegram Bot in the `.env` file:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id
```

### Obtaining Bot Token

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` to create a new bot
3. Follow the prompts to set a name and username
4. Copy the Bot Token

### Obtaining Chat ID

1. Add the bot to a group or start a conversation with it
2. Visit `https://api.telegram.org/bot<TOKEN>/getUpdates`
3. Find the `chat` -> `id` field

### Code Example

```javascript
const Telegram = require('telegram-bot-api');

const telegram = new Telegram({
  token: process.env.TELEGRAM_BOT_TOKEN
});

// Send message
await telegram.sendMessage({
  chat_id: process.env.TELEGRAM_CHAT_ID,
  text: '📊 Market Alert: BTC Broke $70,000!'
});

// Send message with buttons
await telegram.sendMessage({
  chat_id: process.env.TELEGRAM_CHAT_ID,
  text: 'Significant volatility detected',
  reply_markup: {
    inline_keyboard: [
      [{ text: 'View Details', callback_data: 'view_details' }],
      [{ text: 'Set Alert', callback_data: 'set_alert' }]
    ]
  }
});
```

---

## Binance API Trading Integration

### Obtaining API Keys

1. Log in to [Binance](https://www.binance.com)
2. Go to API Management page
3. Create a new API Key
4. Set IP restrictions (recommended)
5. Enable read permissions (at least read permission required for spot trading)

### Permission Overview

| Permission | Description |
|------------|-------------|
| Read | Query prices, balances, orders |
| Trade | Place orders, cancel orders |
| Withdraw | Transfer funds (high risk) |

### Code Example

```javascript
const Binance = require('binance-api-node').default;

const client = Binance({
  apiKey: process.env.BINANCE_API_KEY,
  apiSecret: process.env.BINANCE_API_SECRET
});

// Query balances
async function getBalances() {
  const account = await client.account();
  return account.balances.filter(b => parseFloat(b.free) > 0);
}

// Place order
async function placeOrder(symbol, side, quantity) {
  return await client.order({
    symbol: symbol,
    side: side,
    type: 'MARKET',
    quantity: quantity
  });
}

// Set stop-loss order
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

### Complete Trading Bot Example

```javascript
// Simple grid trading bot
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
      
      if (diff < 0.001) { // Near grid line
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

## Data Source Integration

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

### CoinGecko Price Data

```javascript
async function getCoinData(coinId) {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&community_data=false`
  );
  return await response.json();
}
```

### On-Chain Data (Glassnode)

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

## Webhook Configuration

### Receiving Webhooks

```javascript
const express = require('express');
const app = express();

app.use(express.json());

app.post('/webhook', (req, res) => {
  const { action, symbol, price } = req.body;
  
  console.log(`Received Webhook: ${action} ${symbol} @ ${price}`);
  
  // Process trading signal
  if (action === 'BUY') {
    placeOrder(symbol, 'BUY', 0.01);
  }
  
  res.status(200).send('OK');
});

app.listen(3000);
```

### Sending Webhooks

```javascript
async function sendWebhook(url, data) {
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

// Usage example
sendWebhook('https://your-server.com/webhook', {
  symbol: 'BTC',
  action: 'BUY',
  price: 70000,
  reason: 'Fear index below 25'
});
```

---

## Custom Data Source Integration

### Creating a Custom Provider

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
    // Convert external data format to unified format
    return {
      price: rawData.price,
      volume: rawData.volume24h,
      change24h: rawData.changePercent,
      timestamp: Date.now()
    };
  }
}

// Register custom providers
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

### Unified Data Interface

```javascript
async function getUnifiedPrice(symbols) {
  const results = await Promise.all(
    symbols.map(async (symbol) => {
      const prices = await Promise.all(
        Object.values(providers).map(p => p.fetch(symbol))
      );
      
      // Take average or weighted average
      const validPrices = prices.filter(p => p !== null);
      const avgPrice = validPrices.reduce((a, b) => a + b.price, 0) / validPrices.length;
      
      return { symbol, price: avgPrice, sources: validPrices.length };
    })
  );
  
  return results;
}
```

---

## Third-Party Platform Integration

### TradingView Signals

```javascript
// TradingView Webhook format
app.post('/tradingview-webhook', (req, res) => {
  const { ticker, price, action, strategy } = req.body;
  
  console.log(`TradingView Signal: ${ticker} ${action}`);
  
  // Execute trade
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
// Send to Zapier Webhook
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

// Use cases
sendToZapier('price_alert', { symbol: 'BTC', price: 70000 });
sendToZapier('trade_executed', { symbol: 'ETH', side: 'BUY', qty: 0.1 });
```

### Notion Database Sync

```javascript
const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_KEY });

async function logToNotion(trade) {
  await notion.pages.create({
    parent: { database_id: process.env.NOTION_DB_ID },
    properties: {
      'Trading Pair': { title: [{ text: { content: trade.symbol } }] },
      'Direction': { select: { name: trade.side } },
      'Quantity': { number: trade.quantity },
      'Price': { number: trade.price },
      'Time': { date: { start: new Date().toISOString() } }
    }
  });
}
```

### Google Sheets Logging

```javascript
const { GoogleSpreadsheet } = require('google-spreadsheet');

async function appendTradeLog(trade) {
  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID);
  await doc.useServiceAccountAuth(require('./service-account.json'));
  
  const sheet = doc.sheetsByIndex[0];
  await sheet.addRow({
    Time: new Date().toISOString(),
    Trading Pair: trade.symbol,
    Direction: trade.side,
    Quantity: trade.quantity,
    Price: trade.price,
    Notes: trade.note || ''
  });
}
```

---

## Integration Configuration Template

Create a `.env` file:

```env
# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Binance
BINANCE_API_KEY=
BINANCE_API_SECRET=

# Data Sources
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

## Best Practices

1. **Key Security**: Store all API keys in environment variables, never commit to code repositories
2. **Error Handling**: Implement retry mechanisms and timeout settings for every external API call
3. **Rate Limiting**: Respect each platform's API rate limits, use queues to process requests
4. **Logging**: Log all integration operations for troubleshooting
5. **Monitoring & Alerts**: Set up key metric monitoring to detect integration anomalies promptly

---

## Troubleshooting

| Issue | Possible Cause | Solution |
|-------|----------------|----------|
| Telegram message sending failed | Bot Token expired | Regenerate Token |
| Binance API error | Time not synchronized | Calibrate server time |
| Webhook not received | Firewall/URL error | Check server accessibility |
| Data source returns null | API rate limit/Key expired | Check quota and Key status |

---

*For more help, please submit an Issue or check the official documentation.*
