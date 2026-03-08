# AlphaMind Lite - Production Deployment Guide

## Quick Start

### Option 1: Docker (Recommended)

```bash
# 1. Clone and configure
git clone https://github.com/ailin546/alphamind-lite.git
cd alphamind-lite
cp .env.example .env
# Edit .env with your settings

# 2. Build and start
docker compose up -d

# 3. Verify
curl http://localhost/health
```

### Option 2: PM2 (Direct Node.js)

```bash
# 1. Install PM2 globally
npm install -g pm2

# 2. Clone and configure
git clone https://github.com/ailin546/alphamind-lite.git
cd alphamind-lite
cp .env.example .env

# 3. Start with PM2
pm2 start ecosystem.config.js --env production

# 4. Save process list and enable startup
pm2 save
pm2 startup
```

### Option 3: Direct Node.js

```bash
NODE_ENV=production node scripts/server.js
```

---

## Architecture

```
                    ┌──────────┐
                    │  Client  │
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │  Nginx   │  Port 80/443
                    │  Proxy   │  Rate Limiting, Gzip, SSL
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │  Node.js │  Port 3000
                    │  Server  │  API, Health Check, Static
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
         ┌────▼───┐ ┌───▼────┐ ┌──▼───┐
         │Binance │ │Fear &  │ │Tavily│
         │  API   │ │Greed   │ │ News │
         └────────┘ └────────┘ └──────┘
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check (uptime, memory, metrics) |
| `GET /ready` | Readiness probe (API connectivity) |
| `GET /metrics` | Prometheus-compatible metrics |
| `GET /api/market?symbol=BTCUSDT` | Market data for a symbol |
| `GET /api/sentiment` | Fear & Greed Index |
| `GET /` | Web dashboard |

## Configuration

All configuration via environment variables (`.env` file):

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | development | Environment mode |
| `PORT` | 3000 | Server port |
| `LOG_LEVEL` | info (prod) / debug (dev) | Log level |
| `LOG_FORMAT` | json (prod) / pretty (dev) | Log format |
| `API_TIMEOUT` | 10000 | API request timeout (ms) |
| `API_RETRIES` | 3 | API retry count |
| `RATE_LIMIT_MAX` | 100 | Max requests per window |
| `TELEGRAM_BOT_TOKEN` | - | Telegram bot token |
| `TELEGRAM_CHAT_ID` | - | Telegram chat ID |
| `TAVILY_API_KEY` | - | Tavily news API key |

## Monitoring

### Health Check
```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "version": "9.0.0",
  "uptime": 3600,
  "memory": { "rss": "45MB", "heapUsed": "20MB" },
  "metrics": { "totalRequests": 1234, "totalErrors": 2 }
}
```

### Prometheus Metrics
```bash
curl http://localhost:3000/metrics
```

### PM2 Monitoring
```bash
pm2 monit          # Real-time dashboard
pm2 status         # Process list
pm2 logs           # Log stream
```

### Docker Logs
```bash
docker compose logs -f app    # Application logs
docker compose logs -f nginx  # Nginx access/error logs
```

## Security Checklist

- [x] Non-root Docker user
- [x] Rate limiting (Nginx + Application)
- [x] Security headers (X-Frame-Options, CSP, etc.)
- [x] Input validation on API parameters
- [x] No hardcoded secrets
- [x] .env excluded from git
- [x] Sensitive paths blocked in Nginx
- [x] Connection limits configured
- [x] Request timeouts configured
- [x] Graceful shutdown handling

## Scaling

### Horizontal Scaling (PM2 Cluster)
```bash
# Uses all CPU cores
pm2 start ecosystem.config.js --env production
# PM2 automatically starts one instance per CPU core
```

### Docker Scaling
```bash
docker compose up -d --scale app=4
```

## Troubleshooting

### Server won't start
```bash
# Check syntax
npm run validate

# Check logs
cat logs/app-$(date +%Y-%m-%d).log | tail -20
```

### API returns 502
- Check if Binance API is accessible: `curl https://api.binance.com/api/v3/ping`
- Check server logs for timeout errors
- Increase `API_TIMEOUT` in `.env`

### High memory usage
- Check PM2: `pm2 monit`
- Adjust `max_memory_restart` in `ecosystem.config.js`
- Check for memory leaks in logs
