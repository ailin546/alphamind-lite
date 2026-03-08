#!/usr/bin/env node
/**
 * AlphaMind Lite - Production Logger
 * 结构化日志模块，支持文件输出和日志轮转
 * Zero dependencies - pure Node.js
 */

const fs = require('fs');
const path = require('path');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const COLORS = {
  error: '\x1b[31m', // red
  warn: '\x1b[33m',  // yellow
  info: '\x1b[36m',  // cyan
  debug: '\x1b[90m', // gray
  reset: '\x1b[0m',
};

class Logger {
  constructor(options = {}) {
    this.level = LEVELS[options.level || 'info'] ?? LEVELS.info;
    this.format = options.format || 'pretty';
    this.logDir = options.dir || path.join(__dirname, '..', 'logs');
    this.maxSize = this._parseSize(options.maxSize || '50m');
    this.maxFiles = options.maxFiles || 30;
    this.context = options.context || 'app';

    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    this._stream = null;
    this._currentFile = null;
  }

  _parseSize(size) {
    const units = { k: 1024, m: 1024 * 1024, g: 1024 * 1024 * 1024 };
    const match = String(size).match(/^(\d+)([kmg]?)$/i);
    if (!match) return 50 * 1024 * 1024;
    return parseInt(match[1], 10) * (units[match[2].toLowerCase()] || 1);
  }

  _getLogFile() {
    const date = new Date().toISOString().slice(0, 10);
    return path.join(this.logDir, `${this.context}-${date}.log`);
  }

  _getStream() {
    const file = this._getLogFile();
    if (this._currentFile !== file) {
      if (this._stream) this._stream.end();
      this._stream = fs.createWriteStream(file, { flags: 'a' });
      this._currentFile = file;
      this._cleanup();
    }

    // Rotate if file is too large
    try {
      const stat = fs.statSync(file);
      if (stat.size > this.maxSize) {
        this._stream.end();
        const rotated = file.replace('.log', `-${Date.now()}.log`);
        fs.renameSync(file, rotated);
        this._stream = fs.createWriteStream(file, { flags: 'a' });
      }
    } catch {
      // File might not exist yet
    }

    return this._stream;
  }

  _cleanup() {
    try {
      const files = fs.readdirSync(this.logDir)
        .filter(f => f.endsWith('.log'))
        .map(f => ({ name: f, time: fs.statSync(path.join(this.logDir, f)).mtime.getTime() }))
        .sort((a, b) => b.time - a.time);

      files.slice(this.maxFiles).forEach(f => {
        fs.unlinkSync(path.join(this.logDir, f.name));
      });
    } catch {
      // Cleanup is best-effort
    }
  }

  _log(level, message, meta = {}) {
    if (LEVELS[level] > this.level) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      context: this.context,
      message,
      ...meta,
    };

    // Console output
    if (this.format === 'pretty') {
      const color = COLORS[level] || '';
      const prefix = `${color}[${entry.timestamp}] [${level.toUpperCase().padEnd(5)}]${COLORS.reset}`;
      const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
      process.stdout.write(`${prefix} ${message}${metaStr}\n`);
    } else {
      process.stdout.write(JSON.stringify(entry) + '\n');
    }

    // File output (always JSON)
    try {
      const stream = this._getStream();
      stream.write(JSON.stringify(entry) + '\n');
    } catch {
      // Don't crash app if logging fails
    }
  }

  error(message, meta) { this._log('error', message, meta); }
  warn(message, meta) { this._log('warn', message, meta); }
  info(message, meta) { this._log('info', message, meta); }
  debug(message, meta) { this._log('debug', message, meta); }

  child(context) {
    return new Logger({
      level: Object.keys(LEVELS).find(k => LEVELS[k] === this.level),
      format: this.format,
      dir: this.logDir,
      maxSize: this.maxSize,
      maxFiles: this.maxFiles,
      context: `${this.context}:${context}`,
    });
  }

  close() {
    if (this._stream) {
      this._stream.end();
      this._stream = null;
    }
  }
}

// Singleton logger with config support
let _instance = null;

function createLogger(options) {
  try {
    const config = require('../config/config');
    _instance = new Logger({
      level: config.logging.level,
      format: config.logging.format,
      dir: config.logging.dir,
      maxSize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles,
      ...options,
    });
  } catch {
    _instance = new Logger(options);
  }
  return _instance;
}

function getLogger(context) {
  if (!_instance) createLogger();
  return context ? _instance.child(context) : _instance;
}

module.exports = { Logger, createLogger, getLogger };
