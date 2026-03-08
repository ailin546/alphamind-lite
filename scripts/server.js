#!/usr/bin/env node
/**
 * AlphaMind Lite - Production HTTP Server
 * 提供 REST API、健康检查、静态页面服务
 * Zero dependencies - pure Node.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { getLogger, createLogger } = require('./logger');
const { fetchMarketData, fetchFearGreedIndex } = require('./api-client');

createLogger({ context: 'server' });
const log = getLogger('server');

let config;
try {
  config = require('../config/config');
} catch {
  config = { server: { port: 3000, host: '0.0.0.0' }, rateLimit: { windowMs: 60000, maxRequests: 100 } };
}

// ---- Rate Limiter ----
const rateLimiter = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const window = config.rateLimit.windowMs;
  const max = config.rateLimit.maxRequests;

  if (!rateLimiter.has(ip)) {
    rateLimiter.set(ip, { count: 1, start: now });
    return true;
  }

  const entry = rateLimiter.get(ip);
  if (now - entry.start > window) {
    entry.count = 1;
    entry.start = now;
    return true;
  }

  entry.count++;
  return entry.count <= max;
}

// Clean up rate limiter periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimiter) {
    if (now - entry.start > config.rateLimit.windowMs * 2) {
      rateLimiter.delete(ip);
    }
  }
}, 60000);

// ---- Metrics ----
const metrics = {
  startTime: Date.now(),
  requests: 0,
  errors: 0,
  lastHealthCheck: null,
};

// ---- Content Types ----
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// ---- Route Handlers ----
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
  });
  res.end(JSON.stringify(data));
}

async function handleHealth(req, res) {
  const uptime = Math.floor((Date.now() - metrics.startTime) / 1000);
  const memUsage = process.memoryUsage();

  const health = {
    status: 'ok',
    version: require('../package.json').version,
    uptime,
    timestamp: new Date().toISOString(),
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
    },
    metrics: {
      totalRequests: metrics.requests,
      totalErrors: metrics.errors,
    },
  };

  metrics.lastHealthCheck = new Date().toISOString();
  sendJSON(res, 200, health);
}

async function handleReadiness(req, res) {
  // Check if APIs are reachable
  try {
    await fetchMarketData('BTCUSDT');
    sendJSON(res, 200, { status: 'ready' });
  } catch {
    sendJSON(res, 503, { status: 'not ready', reason: 'API unreachable' });
  }
}

async function handleMarket(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const symbol = url.searchParams.get('symbol') || 'BTCUSDT';

    // Validate symbol (alphanumeric only)
    if (!/^[A-Z0-9]{2,20}$/i.test(symbol)) {
      sendJSON(res, 400, { error: 'Invalid symbol' });
      return;
    }

    const data = await fetchMarketData(symbol.toUpperCase());
    sendJSON(res, 200, { symbol: symbol.toUpperCase(), ...data });
  } catch (err) {
    log.error('Market data error', { error: err.message });
    metrics.errors++;
    sendJSON(res, 502, { error: 'Failed to fetch market data' });
  }
}

async function handleSentiment(req, res) {
  try {
    const data = await fetchFearGreedIndex();
    sendJSON(res, 200, data);
  } catch (err) {
    log.error('Sentiment data error', { error: err.message });
    metrics.errors++;
    sendJSON(res, 502, { error: 'Failed to fetch sentiment data' });
  }
}

async function handleMetrics(req, res) {
  const uptime = Math.floor((Date.now() - metrics.startTime) / 1000);
  const mem = process.memoryUsage();

  // Prometheus-compatible format
  const lines = [
    `# HELP alphamind_uptime_seconds Application uptime`,
    `# TYPE alphamind_uptime_seconds gauge`,
    `alphamind_uptime_seconds ${uptime}`,
    `# HELP alphamind_requests_total Total HTTP requests`,
    `# TYPE alphamind_requests_total counter`,
    `alphamind_requests_total ${metrics.requests}`,
    `# HELP alphamind_errors_total Total errors`,
    `# TYPE alphamind_errors_total counter`,
    `alphamind_errors_total ${metrics.errors}`,
    `# HELP alphamind_memory_rss_bytes RSS memory usage`,
    `# TYPE alphamind_memory_rss_bytes gauge`,
    `alphamind_memory_rss_bytes ${mem.rss}`,
    `# HELP alphamind_memory_heap_used_bytes Heap memory used`,
    `# TYPE alphamind_memory_heap_used_bytes gauge`,
    `alphamind_memory_heap_used_bytes ${mem.heapUsed}`,
  ];

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(lines.join('\n') + '\n');
}

function serveStatic(req, res) {
  const safePath = path.normalize(req.url).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(__dirname, '..', safePath === '/' ? 'index.html' : safePath);

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      sendJSON(res, 404, { error: 'Not found' });
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(content);
  });
}

// ---- Router ----
const routes = {
  'GET /health': handleHealth,
  'GET /ready': handleReadiness,
  'GET /api/market': handleMarket,
  'GET /api/sentiment': handleSentiment,
  'GET /metrics': handleMetrics,
};

// ---- Server ----
const server = http.createServer(async (req, res) => {
  metrics.requests++;

  const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;

  // Rate limiting
  if (!checkRateLimit(clientIP)) {
    log.warn('Rate limit exceeded', { ip: clientIP });
    sendJSON(res, 429, { error: 'Too many requests' });
    return;
  }

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
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

server.listen(PORT, HOST, () => {
  log.info(`AlphaMind Lite server running`, { host: HOST, port: PORT, env: config.env });

  // Validate config on startup
  const warnings = config.validate ? config.validate() : [];
  warnings.forEach(w => log.warn(`Config: ${w}`));
});
