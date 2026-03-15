#!/usr/bin/env node
/**
 * AlphaMind Lite - Demo/Fallback Data
 * Used when external APIs are unreachable
 * Zero dependencies - pure Node.js
 */

const DEMO_DATA = {
  prices: {
    BTC: 67542.30, ETH: 3456.78, BNB: 612.45, SOL: 178.92,
    XRP: 0.62, DOGE: 0.185, ADA: 0.48, AVAX: 38.75,
  },
  market: [
    { symbol: 'BTC', price: 67542.30, change24h: 2.34, high24h: 68100, low24h: 65800, volume24h: 28500000000 },
    { symbol: 'ETH', price: 3456.78, change24h: 1.56, high24h: 3520, low24h: 3380, volume24h: 15200000000 },
    { symbol: 'BNB', price: 612.45, change24h: -0.82, high24h: 625, low24h: 605, volume24h: 1800000000 },
    { symbol: 'SOL', price: 178.92, change24h: 5.21, high24h: 182, low24h: 168, volume24h: 3200000000 },
    { symbol: 'XRP', price: 0.62, change24h: -1.23, high24h: 0.64, low24h: 0.60, volume24h: 2100000000 },
    { symbol: 'DOGE', price: 0.185, change24h: 3.45, high24h: 0.19, low24h: 0.178, volume24h: 1500000000 },
    { symbol: 'ADA', price: 0.48, change24h: -0.56, high24h: 0.49, low24h: 0.47, volume24h: 650000000 },
    { symbol: 'AVAX', price: 38.75, change24h: 1.89, high24h: 39.50, low24h: 37.20, volume24h: 520000000 },
  ],
  fearGreed: {
    value: 45,
    sentiment: 'Fear',
    advice: 'Market shows fear — historically a potential accumulation zone. Consider DCA.',
  },
  klines: Array.from({ length: 24 }, (_, i) => {
    const base = 66000 + Math.sin(i * 0.3) * 1500;
    const open = base + Math.random() * 500;
    const close = base + Math.random() * 500;
    const high = Math.max(open, close) + Math.random() * 800;
    const low = Math.min(open, close) - Math.random() * 800;
    return {
      time: Date.now() - (23 - i) * 3600000,
      open, high, low, close,
      volume: 1000000000 + Math.random() * 500000000,
    };
  }),
};

module.exports = DEMO_DATA;
