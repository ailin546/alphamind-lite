#!/usr/bin/env node
/**
 * AlphaMind Lite - Shared Utilities
 * Zero dependencies - pure Node.js
 */

/**
 * Escape HTML entities to prevent XSS
 * @param {string} str - Input string
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format a price for display
 * @param {number} n - Price value
 * @returns {string} Formatted price string
 */
function fmtPrice(n) {
  return n >= 1
    ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${n.toFixed(6)}`;
}

/**
 * Format a percentage for display
 * @param {number} n - Percentage value
 * @returns {string} Formatted percentage string
 */
function fmtPct(n) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

/**
 * Validate a trading symbol
 * @param {string} symbol - Symbol to validate
 * @returns {boolean} Whether the symbol is valid
 */
function isValidSymbol(symbol) {
  return /^[A-Z0-9]{2,10}$/i.test(symbol);
}

/**
 * Validate a kline interval
 * @param {string} interval - Interval to validate
 * @param {string[]} [allowed] - Optional allowed intervals list
 * @returns {boolean} Whether the interval is valid
 */
function isValidInterval(interval, allowed) {
  const defaults = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];
  return (allowed || defaults).includes(interval);
}

module.exports = {
  escapeHtml,
  fmtPrice,
  fmtPct,
  isValidSymbol,
  isValidInterval,
};
