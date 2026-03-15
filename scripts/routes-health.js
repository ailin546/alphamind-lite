#!/usr/bin/env node
/**
 * AlphaMind Lite - Health & System Routes
 * Health check, readiness probe, metrics, static file serving
 * Zero dependencies - pure Node.js
 */

const fs = require('fs');
const path = require('path');
const { fetchMarketData } = require('./api-client');
const { sendJSON, metrics, MIME_TYPES, SENSITIVE_PATHS, SECURITY_HEADERS } = require('./middleware');

const PKG_VERSION = require('../package.json').version;
const STATIC_ROOT = path.resolve(__dirname, '..');

// Cached readiness result (TTL 30s to avoid hitting Binance on every k8s probe)
let _readyCache = { ready: false, checkedAt: 0 };
const READY_TTL = 30000;

async function handleHealth(req, res) {
  metrics.lastHealthCheck = new Date().toISOString();
  sendJSON(res, 200, {
    status: 'ok',
    version: PKG_VERSION,
    uptime: Math.floor((Date.now() - metrics.startTime) / 1000),
    timestamp: new Date().toISOString(),
  });
}

async function handleReadiness(req, res) {
  const now = Date.now();
  if (now - _readyCache.checkedAt < READY_TTL) {
    sendJSON(res, _readyCache.ready ? 200 : 503, { status: _readyCache.ready ? 'ready' : 'not ready' });
    return;
  }
  try {
    await fetchMarketData('BTCUSDT');
    _readyCache = { ready: true, checkedAt: now };
    sendJSON(res, 200, { status: 'ready' });
  } catch {
    _readyCache = { ready: false, checkedAt: now };
    sendJSON(res, 503, { status: 'not ready', reason: 'API unreachable' });
  }
}

async function handleMetrics(req, res) {
  const uptime = Math.floor((Date.now() - metrics.startTime) / 1000);
  const mem = process.memoryUsage();

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
  const urlPath = req.url.split('?')[0];
  const filePath = urlPath === '/'
    ? path.join(STATIC_ROOT, 'dashboard.html')
    : path.resolve(STATIC_ROOT, '.' + path.normalize(urlPath));

  // Prevent path traversal
  if (!filePath.startsWith(STATIC_ROOT + path.sep) && filePath !== path.join(STATIC_ROOT, 'dashboard.html')) {
    sendJSON(res, 403, { error: 'Forbidden' });
    return;
  }

  // Block access to sensitive paths
  const normalizedUrl = urlPath.toLowerCase();
  if (SENSITIVE_PATHS.some(p => normalizedUrl.startsWith(p))) {
    sendJSON(res, 404, { error: 'Not found' });
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  if (!MIME_TYPES[ext]) {
    sendJSON(res, 404, { error: 'Not found' });
    return;
  }
  const contentType = MIME_TYPES[ext];

  fs.readFile(filePath, (err, content) => {
    if (err) {
      sendJSON(res, 404, { error: 'Not found' });
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
      ...SECURITY_HEADERS,
    });
    res.end(content);
  });
}

module.exports = { handleHealth, handleReadiness, handleMetrics, serveStatic };
