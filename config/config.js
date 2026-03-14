#!/usr/bin/env node
/**
 * AlphaMind Lite - Production Configuration Manager
 * 集中式配置管理，支持环境变量覆盖
 */

const path = require('path');
const fs = require('fs');

// 加载 .env 文件（不依赖第三方库）
function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // 去除引号
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

loadEnvFile();

const env = process.env.NODE_ENV || 'development';

const config = {
  env,
  isDev: env === 'development',
  isProd: env === 'production',
  isTest: env === 'test',

  // 服务器配置
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    trustProxy: process.env.TRUST_PROXY === 'true',
  },

  // API 端点
  apis: {
    binance: {
      rest: process.env.BINANCE_API_URL || 'https://api.binance.com',
      futures: process.env.BINANCE_FUTURES_URL || 'https://fapi.binance.com',
      timeout: parseInt(process.env.API_TIMEOUT || '10000', 10),
      retries: parseInt(process.env.API_RETRIES || '3', 10),
    },
    fearGreed: {
      url: process.env.FEAR_GREED_URL || 'https://api.alternative.me/fng/',
      timeout: parseInt(process.env.API_TIMEOUT || '10000', 10),
    },
    bscscan: {
      url: process.env.BSCSCAN_API_URL || 'https://api.bscscan.com/api',
      apiKey: process.env.BSCSCAN_API_KEY || '',
      timeout: parseInt(process.env.API_TIMEOUT || '8000', 10),
    },
    tavily: {
      url: 'https://api.tavily.com/search',
      apiKey: process.env.TAVILY_API_KEY || '',
    },
  },

  // 日志配置
  logging: {
    level: process.env.LOG_LEVEL || (env === 'production' ? 'info' : 'debug'),
    format: process.env.LOG_FORMAT || (env === 'production' ? 'json' : 'pretty'),
    dir: process.env.LOG_DIR || path.join(__dirname, '..', 'logs'),
    maxFiles: parseInt(process.env.LOG_MAX_FILES || '30', 10),
    maxSize: process.env.LOG_MAX_SIZE || '50m',
  },

  // 健康检查
  healthCheck: {
    interval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10),
    timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000', 10),
  },

  // 速率限制
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },

  // 通知配置
  notifications: {
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
      chatId: process.env.TELEGRAM_CHAT_ID || '',
      enabled: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    },
  },

  // 监控币种
  watchlist: (process.env.WATCHLIST || 'BTC,ETH,BNB,SOL,XRP,ADA,DOGE,AVAX').split(',').map(s => s.trim()),
};

// 验证生产环境必要配置
function validateConfig() {
  const warnings = [];

  if (config.isProd) {
    if (!config.notifications.telegram.enabled) {
      warnings.push('Telegram notifications not configured');
    }
    if (!config.apis.tavily.apiKey) {
      warnings.push('Tavily API key not set - news features disabled');
    }
  }

  return warnings;
}

config.validate = validateConfig;

module.exports = config;
