#!/usr/bin/env node
/**
 * AlphaMind Lite - Middleware Module
 * Cache, rate limiting, security headers, response helpers
 * Zero dependencies - pure Node.js
 */

let config;
try {
  config = require('../config/config');
} catch {
  config = { server: { port: 3000, host: '0.0.0.0' }, rateLimit: { windowMs: 60000, maxRequests: 100 } };
}

// ---- API Response Cache (short-lived TTL) ----
const apiCache = new Map();
const CACHE_TTL = { market: 5000, sentiment: 30000, funding: 15000, klines: 10000 };

function getCached(key) {
  const entry = apiCache.get(key);
  if (entry && Date.now() - entry.time < entry.ttl) return entry.data;
  return null;
}

function setCache(key, data, ttl) {
  apiCache.set(key, { data, time: Date.now(), ttl });
}

// Clean stale cache entries every 60s
const cacheCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of apiCache) {
    if (now - entry.time > entry.ttl * 3) apiCache.delete(key);
  }
}, 60000);

// ---- Rate Limiter ----
const rateLimiter = new Map();
const RATE_LIMITER_MAX_SIZE = 100000;

function checkRateLimit(ip) {
  const now = Date.now();
  const window = config.rateLimit.windowMs;
  const max = config.rateLimit.maxRequests;

  if (rateLimiter.size > RATE_LIMITER_MAX_SIZE) {
    cleanRateLimiter();
    if (rateLimiter.size > RATE_LIMITER_MAX_SIZE) return false;
  }

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

function cleanRateLimiter() {
  const now = Date.now();
  for (const [ip, entry] of rateLimiter) {
    if (now - entry.start > config.rateLimit.windowMs * 2) {
      rateLimiter.delete(ip);
    }
  }
}

const rateLimitCleanupTimer = setInterval(cleanRateLimiter, 60000);

// ---- Security Headers ----
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-DNS-Prefetch-Control': 'off',
  'X-Permitted-Cross-Domain-Policies': 'none',
};

// ---- Response Helpers ----
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    ...SECURITY_HEADERS,
  });
  res.end(JSON.stringify(data));
}

// ---- Body Parser ----
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e5) { req.destroy(); reject(new Error('Body too large')); }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

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

// ---- Sensitive Paths ----
const SENSITIVE_PATHS = ['/config/', '/data/', '/logs/', '/.env', '/.git', '/scripts/', '/.claude',
  '/package.json', '/package-lock.json', '/docker-compose.yml', '/dockerfile',
  '/ecosystem.config.js', '/deploy.sh', '/.dockerignore', '/claude.md'];

module.exports = {
  config,
  apiCache,
  CACHE_TTL,
  getCached,
  setCache,
  cacheCleanupTimer,
  checkRateLimit,
  cleanRateLimiter,
  rateLimitCleanupTimer,
  SECURITY_HEADERS,
  sendJSON,
  readBody,
  metrics,
  MIME_TYPES,
  SENSITIVE_PATHS,
};
