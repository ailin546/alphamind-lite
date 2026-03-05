# AlphaMind Lite 🦞

> **7×24 Hours Binance Smart Trading Partner** — Bring institutional-grade trading wisdom to every investor

---

## Overview

AlphaMind Lite is an open-source crypto investment assistant that helps ordinary investors make better trading decisions through AI technology.

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

## Quick Start

```bash
git clone https://github.com/ailin546/alphamind-lite.git
cd alphamind-lite
node scripts/demo.js
```

---

## Core Features

| Feature | Description |
|---------|-------------|
| 📊 Real-time Market | Live Binance prices |
| 🎯 Fear & Greed Index | AI-powered analysis |
| 💼 Portfolio Analysis | Multi-coin P&L |
| 📡 News Radar | 24/7 monitoring |
| 🛡️ Risk Alerts | Liquidation warnings |
| 🔔 Price Alerts | Custom thresholds |

---

## Configuration

### Portfolio
Edit `scripts/portfolio.js`:
```javascript
const PORTFOLIO = [
  { symbol: 'BTC', amount: 0.5, avgPrice: 70000 },
];
```

### AI Chat
Edit `scripts/user-ai-chat.js`:
```javascript
const CONFIG = {
  openai: { apiKey: 'sk-your-key' }
};
```

---

## Documentation

- [Product Spec](docs/product-spec.md)
- [Business Plan](docs/business-plan.md)
- [Tech Architecture](docs/tech-architecture.md)
- [User Guide](docs/user-guide.md)
- [FAQ](docs/faq.md)

---

## License

MIT

© 2026 AlphaMind Lite
