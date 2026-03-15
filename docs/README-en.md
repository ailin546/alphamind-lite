# AlphaMind Lite

> **AI-Powered BNB Chain Ecosystem Crypto Investment Assistant**
>
> Zero dependencies. Production ready. Full BNB Chain ecosystem integration.

---

## Overview

AlphaMind Lite is a **truly zero-dependency** open-source AI crypto investment assistant. Built entirely with Node.js built-in modules, it provides institutional-grade market analysis, portfolio management, risk control, and deep BNB Chain ecosystem data through an intuitive Web Dashboard — no coding or `npm install` required.

### Target Users
- Cryptocurrency investors seeking professional analysis tools
- BNB Chain ecosystem participants (DeFi, staking, trading)
- Busy traders who need 24/7 automated monitoring
- Risk-conscious investors managing leveraged positions
- Beginners who want AI-guided trading decisions

---

## Quick Start

```bash
git clone https://github.com/ailin546/alphamind-lite.git
cd alphamind-lite
node server.js
# Open http://localhost:3000
```

**Requirements:** Node.js >= 20.0.0 (that's literally it)

---

## Core Features

### 8-Page Web Dashboard

| Page | Features |
|------|----------|
| **Dashboard** | BTC/ETH live prices, Fear & Greed Index, market signals (Buy/Hold/Sell), 24h price chart, 30-day sentiment trend, skeleton loading animations |
| **Market Data** | 12+ coins, K-line charts (1H/4H/1D), OHLCV data, volume analysis |
| **Portfolio** | Add/remove holdings, real-time P&L, allocation pie chart, AI investment advice, CSV export |
| **Sentiment** | Fear & Greed gauge, BTC trend analysis, multi-coin correlation matrix, 30-day history |
| **Risk Control** | Leverage liquidation calculator, margin calculation, 3-level risk ratings (safe/warning/danger) |
| **Tools** | DCA calculator, P&L calculator, Paper Trading simulator ($10,000 USDT virtual balance) |
| **BSC Chain** | BSC mainnet + opBNB L2 + BNB Greenfield, gas tracking, DeFi protocols, TVL, BNB burns |
| **AI Chat** | Natural language Q&A, intent detection (buy/sell/risk/DCA/portfolio), bilingual (EN/Chinese) |

### Technical Indicators Engine

| Indicator | Parameters | Purpose |
|-----------|------------|---------|
| RSI | Period: 14 | Overbought (>70) / Oversold (<30) |
| MACD | Fast: 12, Slow: 26, Signal: 9 | Trend direction + momentum |
| Bollinger Bands | Period: 20, Width: 2 standard deviations | Volatility + support/resistance |
| SMA / EMA | Period: 7, 25 | Short/medium-term trend |
| Multi-timeframe | 1H / 4H / 1D | Cross-timeframe signal confluence (bullish/bearish/mixed) |

### 19 CLI Tools

| Tool | Command | Function |
|------|---------|----------|
| Quick Demo | `node scripts/demo.js` | Market overview |
| Interactive | `node scripts/demo-interactive.js` | Feature selection menu |
| Portfolio | `node scripts/portfolio.js` | CLI portfolio manager |
| Fear & Greed | `node scripts/fear-greed.js` | Sentiment index query |
| Sentiment | `node scripts/market-sentiment.js` | Comprehensive analysis |
| Risk Calc | `node scripts/position-risk.js` | Leverage risk assessment |
| Price Watch | `node scripts/price-watcher.js` | Real-time tracker |
| Alerts | `node scripts/alerts.js` | Custom price alerts |
| Correlation | `node scripts/market-correlation.js` | Cross-coin correlation matrix |
| Arbitrage | `node scripts/arbitrage.js` | Spot/futures spread detection |
| Funding | `node scripts/funding-arbitrage.js` | Perpetual contract arbitrage |
| DCA | `node scripts/dca-calculator.js` | Dollar-cost averaging simulation |
| Whale Alert | `node scripts/whale-alert.js` | On-chain large transfer monitoring |
| AI Chat | `node scripts/ai-chat.js` | CLI AI assistant |
| News | `node scripts/news-monitor.js` | Binance announcement tracker |

---

## BNB Chain Ecosystem Integration

Deep integration with the full BNB Chain tri-chain ecosystem:

```
BNB Chain Ecosystem
+----------------------------------------------------------+
|                                                          |
|  BSC Mainnet (Chain ID: 56)                              |
|  - Gas Tracker: Low / Standard / Fast                    |
|  - PoSA Consensus: 21 Validators, 3s Block Time         |
|  - DeFi Protocols: PancakeSwap, Venus, Alpaca, BiSwap   |
|  - Ecosystem Tokens: CAKE, XVS, BAKE, ALPACA, BSW       |
|  - TVL: ~$5.2B                                           |
|                                                          |
|  opBNB Layer 2 (Chain ID: 204)                           |
|  - Throughput: ~10,000 TPS                               |
|  - Gas Cost: ~$0.001                                     |
|  - Architecture: OP Stack                                |
|                                                          |
|  BNB Greenfield                                          |
|  - Decentralized Storage Network                         |
|                                                          |
|  BNB Token                                               |
|  - Circulating Supply: 145M                              |
|  - Total Burned: 54M+ (~27%)                             |
|  - Staking APY: ~2.5-3%                                  |
|                                                          |
+----------------------------------------------------------+
```

---

## Architecture

```
Browser                              AlphaMind Lite Server
+--------------+                    +---------------------------+
|  Dashboard   |  <-- HTTP -->      | Pure Node.js HTTP Server  |
|  HTML/CSS/JS |  <-- SSE ---      | (Zero Dependencies)       |
|  Chart.js    |                    | REST API + SSE Streaming  |
+--------------+                    +------------+--------------+
                                                 |
                  +-----------------------------+|+--------------------+
                  |                              |                     |
         +--------v--------+         +----------v--------+   +-------v--------+
         |  Binance API    |         |  Alternative.me   |   |  AI Engine     |
         |  Prices/Klines  |         |  Fear & Greed     |   |  NLP + Signals |
         +-----------------+         +-------------------+   +----------------+
```

### Design Principles

| Principle | Implementation |
|-----------|---------------|
| Zero Dependencies | Node.js built-in modules only (http, https, fs, path, url, crypto) |
| Zero Framework Frontend | Vanilla HTML/CSS/JS + Chart.js (CDN), no build step |
| Real Data | Binance API + Alternative.me + BSCScan with auto-fallback to demo data |
| Persistent Storage | JSON file database with atomic writes (tmp rename), corruption auto-backup |
| Production Ready | Docker + Nginx + PM2 + health checks + rate limiting + Prometheus |
| Security Hardened | CSP, X-Frame-Options, CORS, rate limiting, input validation, XSS defense |

---

## API Reference

| Method | Endpoint | Function |
|--------|----------|----------|
| GET | `/api/market?symbols=BTC,ETH,BNB` | Real-time prices (multi-coin) |
| GET | `/api/fear-greed` | Fear & Greed Index + 30-day history |
| GET | `/api/sentiment` | Comprehensive market sentiment |
| GET | `/api/correlation` | Cross-coin correlation matrix |
| GET | `/api/klines?symbol=BTC&interval=1h` | K-line chart data |
| GET | `/api/indicators?symbol=BTC` | Technical indicators (RSI/MACD/BB/SMA) |
| GET | `/api/multi-timeframe?symbol=BTC` | Multi-timeframe confluence (1H/4H/1D) |
| GET | `/api/bsc` | BSC + opBNB + Greenfield ecosystem data |
| GET | `/api/funding` | Perpetual contract funding rates |
| GET | `/api/alerts` | Price alert list |
| POST | `/api/portfolio` | Portfolio analysis with AI advice |
| POST | `/api/portfolio/add` | Add holding |
| POST | `/api/portfolio/remove` | Remove holding |
| POST | `/api/alerts/add` | Add price alert |
| POST | `/api/risk` | Position risk calculation |
| POST | `/api/dca` | DCA return simulation |
| POST | `/api/ai-chat` | AI chat with market context |
| POST | `/api/paper-trade` | Execute paper trade |
| GET | `/api/paper-trade` | Paper trade history |
| POST | `/api/paper-trade/reset` | Reset paper trading account |
| GET | `/api/stream` | SSE real-time price push (30s heartbeat) |
| GET | `/health` | Liveness check |
| GET | `/ready` | Readiness check (Binance connectivity) |
| GET | `/metrics` | Prometheus monitoring metrics |

---

## Security

| Feature | Implementation |
|---------|---------------|
| Security Headers | CSP, X-Frame-Options (DENY), X-Content-Type-Options (nosniff), Referrer-Policy |
| Rate Limiting | 100 req/60s per IP, memory-safe cleanup (100K IP cap) |
| CORS | Strict same-origin policy |
| Input Validation | Parameter validation + XSS defense + path traversal protection |
| Graceful Degradation | API failures auto-fallback to demo data |
| Health Probes | /health (liveness) + /ready (readiness) + Docker health checks |
| Monitoring | Prometheus metrics (requests, errors, memory, uptime) |
| Logging | JSON structured logs with rotation and configurable levels |
| Docker Security | Non-root user (alphamind:1001), tini signal handling, multi-stage build |

---

## Deployment

| Method | Command | Features |
|--------|---------|----------|
| Direct | `node server.js` | Simplest, single-process |
| Docker | `docker compose up -d` | Nginx reverse proxy + health checks + gzip |
| PM2 | `npm run pm2:start` | Multi-core cluster + auto-restart + memory limit |
| Script | `bash deploy.sh` | Auto-detection + dependency setup |
| Railway | One-click deploy button | Cloud hosted |
| Render | One-click deploy button | Cloud hosted |

---

## UX Highlights

- **Dark theme** with Material Design color palette
- **Skeleton loading** with shimmer animation
- **Price flash** — green/red visual feedback on price changes
- **Page transitions** — 0.3s fade-in animation
- **Toast notifications** — success/error/warning with slide-in
- **Bilingual** — EN/Chinese toggle in navbar
- **Responsive** — mobile breakpoints at 768px/1024px, collapsible sidebar
- **Accessible** — ARIA labels, keyboard navigation (Tab/Enter/Space), skip-to-content
- **Keyboard shortcuts** — number keys for page switching, R for refresh, E for CSV export

---

## Tests

```bash
npm test
# ========================================
#   Results: 62 passed, 0 failed
# ========================================
```

Covers: config, logger, API client, technical indicators, portfolio, database, routes, security headers, rate limiting.

---

## Documentation

- [Product Specification](product-spec.md)
- [Technical Architecture](tech-architecture.md)
- [Business Plan](business-plan.md)
- [Competitor Analysis](competitor-analysis.md)
- [User Guide](user-guide.md)
- [FAQ](faq.md)

---

## License

MIT

(c) 2026 AlphaMind Lite
