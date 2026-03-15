#!/usr/bin/env node
/**
 * AlphaMind Lite - Production HTTP Server
 * Modular router with graceful shutdown
 * Zero dependencies - pure Node.js
 */

const http = require('http');
const crypto = require('crypto');
const { getLogger, createLogger } = require('./logger');
const { config, checkRateLimit, sendJSON, metrics, cacheCleanupTimer, rateLimitCleanupTimer } = require('./middleware');

// Route modules
const { handleHealth, handleReadiness, handleMetrics, serveStatic } = require('./routes-health');
const { handleMarket, handleSentiment, handleSentimentAnalysis, handleCorrelation, handleKlines, handleIndicators, handleMultiTimeframe } = require('./routes-market');
const { handlePortfolio, handlePortfolioAdd, handlePortfolioRemove, handleAlerts, handleAlertAdd, handleAlertRemove, handleFunding } = require('./routes-portfolio');
const { handleRisk, handleDCA, handlePaperTrade, handlePaperTradeHistory, handlePaperTradeReset, handleLatestPrices, setLastPrices } = require('./routes-trading');
const { handleAIChat } = require('./routes-ai-chat');
const { handleBSCData } = require('./routes-bsc');
const { handleWhaleAlert, handleArbitrage, handleFundingRate } = require('./routes-whale-arb');
const { handleSSE, heartbeatTimer, broadcastTimer, drainClients, onPricesUpdate } = require('./sse');

createLogger({ context: 'server' });
const log = getLogger('server');

// Wire SSE price updates to trading module's price cache
onPricesUpdate(setLastPrices);

// ---- Route Table ----
const routes = {
  'GET /health': handleHealth,
  'GET /ready': handleReadiness,
  'GET /api/market': handleMarket,
  'GET /api/sentiment': handleSentimentAnalysis,
  'GET /api/fear-greed': handleSentiment,
  'GET /api/correlation': handleCorrelation,
  'GET /api/klines': handleKlines,
  'GET /api/portfolio': handlePortfolio,
  'POST /api/portfolio': handlePortfolio,
  'GET /api/alerts': handleAlerts,
  'POST /api/portfolio/add': handlePortfolioAdd,
  'POST /api/portfolio/remove': handlePortfolioRemove,
  'POST /api/alerts/add': handleAlertAdd,
  'POST /api/alerts/remove': handleAlertRemove,
  'GET /api/funding': handleFunding,
  'POST /api/risk': handleRisk,
  'POST /api/dca': handleDCA,
  'POST /api/ai-chat': handleAIChat,
  'POST /api/paper-trade': handlePaperTrade,
  'GET /api/paper-trade': handlePaperTradeHistory,
  'POST /api/paper-trade/reset': handlePaperTradeReset,
  'GET /api/bsc': handleBSCData,
  'GET /api/whale': handleWhaleAlert,
  'GET /api/arbitrage': handleArbitrage,
  'GET /api/funding-rate': handleFundingRate,
  'GET /api/indicators': handleIndicators,
  'GET /api/multi-timeframe': handleMultiTimeframe,
  'GET /api/prices': handleLatestPrices,
  'GET /api/stream': handleSSE,
  'GET /metrics': handleMetrics,
};

// ---- Server ----
const server = http.createServer(async (req, res) => {
  metrics.requests++;
  const requestId = crypto.randomUUID();
  res.setHeader('X-Request-ID', requestId);

  // Only trust X-Forwarded-For when behind a trusted proxy
  const trustProxy = config.server.trustProxy || false;
  const clientIP = trustProxy
    ? (req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress)
    : req.socket.remoteAddress;

  // Rate limiting
  if (!checkRateLimit(clientIP)) {
    log.warn('Rate limit exceeded', { ip: clientIP });
    sendJSON(res, 429, { error: 'Too many requests' });
    return;
  }

  // CORS headers
  const corsOrigin = process.env.CORS_ORIGIN;
  const origin = req.headers.origin;
  const host = req.headers.host;
  const allowedOrigin = corsOrigin || (origin && host && (origin === 'http://' + host || origin === 'https://' + host) ? origin : 'null');
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const routeKey = `${req.method} ${req.url.split('?')[0]}`;
  const handler = routes[routeKey];

  if (handler) {
    try {
      await handler(req, res);
    } catch (err) {
      log.error('Unhandled route error', { route: routeKey, error: err.message });
      metrics.errors++;
      sendJSON(res, 500, { error: 'Internal server error' });
    }
  } else if (req.method === 'GET') {
    serveStatic(req, res);
  } else {
    sendJSON(res, 405, { error: 'Method not allowed' });
  }

  log.debug('Request', { method: req.method, url: req.url, status: res.statusCode, ip: clientIP });
});

// ---- Graceful Shutdown ----
let isShuttingDown = false;

function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log.info(`Received ${signal}, starting graceful shutdown...`);

  // Clear all intervals
  clearInterval(cacheCleanupTimer);
  clearInterval(rateLimitCleanupTimer);
  clearInterval(heartbeatTimer);
  clearInterval(broadcastTimer);

  // Drain SSE clients
  drainClients();

  // Stop accepting new connections
  server.close(() => {
    log.info('Server closed, exiting');
    process.exit(0);
  });

  // Force exit after timeout
  setTimeout(() => {
    log.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// PM2 graceful shutdown
process.on('message', msg => {
  if (msg === 'shutdown') shutdown('PM2');
});

// Unhandled errors
process.on('uncaughtException', (err) => {
  log.error('Uncaught exception', { error: err.message, stack: err.stack });
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled rejection', { reason: String(reason) });
});

// ---- Start ----
const PORT = config.server.port;
const HOST = config.server.host;

server.timeout = 30000;
server.requestTimeout = 10000;

server.listen(PORT, HOST, () => {
  log.info(`AlphaMind Lite server running`, { host: HOST, port: PORT, env: config.env });

  const warnings = config.validate ? config.validate() : [];
  warnings.forEach(w => log.warn(`Config: ${w}`));
});
