#!/usr/bin/env node
/**
 * AlphaMind Lite - Market Data Routes
 * Market, sentiment, correlation, klines, indicators, multi-timeframe
 * Zero dependencies - pure Node.js
 */

const { getLogger } = require('./logger');
const { fetchMarketData, fetchFearGreedIndex, fetchKlines, calculateIndicators } = require('./api-client');
const { sendJSON, getCached, setCache, CACHE_TTL, metrics } = require('./middleware');
const { isValidSymbol, isValidInterval } = require('./utils');
const DEMO_DATA = require('./demo-data');

const log = getLogger('market');

async function handleMarket(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const symbolsParam = url.searchParams.get('symbols');
    const symbol = url.searchParams.get('symbol') || 'BTCUSDT';

    if (symbolsParam) {
      const symbols = symbolsParam.split(',').filter(s => isValidSymbol(s)).slice(0, 20);
      const cacheKey = `market:${symbols.join(',')}`;
      const cached = getCached(cacheKey);
      if (cached) return sendJSON(res, 200, cached);

      const results = await Promise.all(
        symbols.map(s => fetchMarketData(`${s.toUpperCase()}USDT`).then(d => ({
          symbol: s.toUpperCase(),
          price: parseFloat(d.lastPrice),
          change24h: parseFloat(d.priceChangePercent),
          high24h: parseFloat(d.highPrice),
          low24h: parseFloat(d.lowPrice),
          volume24h: parseFloat(d.quoteVolume),
        })).catch(() => ({ symbol: s.toUpperCase(), error: true })))
      );
      const response = { ok: true, data: results };
      setCache(cacheKey, response, CACHE_TTL.market);
      return sendJSON(res, 200, response);
    }

    if (!/^[A-Z0-9]{2,20}$/i.test(symbol)) {
      return sendJSON(res, 400, { error: 'Invalid symbol' });
    }

    const cacheKey = `market:${symbol.toUpperCase()}`;
    const cached = getCached(cacheKey);
    if (cached) return sendJSON(res, 200, cached);

    const data = await fetchMarketData(symbol.toUpperCase());
    const response = { ok: true, symbol: symbol.toUpperCase(), ...data };
    setCache(cacheKey, response, CACHE_TTL.market);
    sendJSON(res, 200, response);
  } catch (err) {
    log.error('Market data error', { error: err.message });
    metrics.errors++;
    sendJSON(res, 200, { ok: true, degraded: true, source: 'demo', data: DEMO_DATA.market });
  }
}

async function handleSentiment(req, res) {
  try {
    const cacheKey = 'sentiment';
    const cached = getCached(cacheKey);
    if (cached) return sendJSON(res, 200, cached);

    const data = await fetchFearGreedIndex();
    const fgData = data.data ? data.data[0] : null;
    const history = data.data || [];
    const value = fgData ? parseInt(fgData.value) : null;

    let advice = '';
    if (value !== null) {
      if (value <= 25) advice = 'Extreme fear — historically a good buying opportunity. Consider DCA.';
      else if (value <= 45) advice = 'Fear in the market — potential accumulation zone.';
      else if (value <= 55) advice = 'Neutral sentiment — market is undecided.';
      else if (value <= 75) advice = 'Greed detected — consider taking partial profits.';
      else advice = 'Extreme greed — high risk zone. Be cautious with new positions.';
    }

    const response = {
      ok: true, value, sentiment: fgData ? fgData.value_classification : 'Unknown', advice,
      history: history.slice(0, 30).map(h => ({ value: parseInt(h.value), timestamp: parseInt(h.timestamp) })),
    };
    setCache(cacheKey, response, CACHE_TTL.sentiment);
    sendJSON(res, 200, response);
  } catch (err) {
    log.error('Sentiment data error', { error: err.message });
    metrics.errors++;
    sendJSON(res, 200, { ok: true, degraded: true, source: 'demo', ...DEMO_DATA.fearGreed, history: [] });
  }
}

async function handleSentimentAnalysis(req, res) {
  try {
    const cacheKey = 'sentiment-analysis';
    const cached = getCached(cacheKey);
    if (cached) return sendJSON(res, 200, cached);

    const [btcData, fgData] = await Promise.all([
      fetchMarketData('BTCUSDT'),
      fetchFearGreedIndex().catch(() => null),
    ]);

    const btcPrice = parseFloat(btcData.lastPrice);
    const btcChange = parseFloat(btcData.priceChangePercent);
    const btcAvg = parseFloat(btcData.weightedAvgPrice);
    const fgValue = fgData?.data?.[0] ? parseInt(fgData.data[0].value) : 50;
    const btcTrend = btcPrice > btcAvg ? 'up' : 'down';

    let signal = 'hold';
    let analysis = '';
    if (fgValue <= 25 && btcTrend === 'down') { signal = 'buy'; analysis = 'Extreme fear + oversold conditions suggest accumulation opportunity.'; }
    else if (fgValue <= 40 && btcChange < -3) { signal = 'buy'; analysis = 'Market fear with significant dip — consider buying on weakness.'; }
    else if (fgValue >= 75 && btcTrend === 'up') { signal = 'sell'; analysis = 'Extreme greed + overbought — consider taking profits.'; }
    else if (fgValue >= 60 && btcChange > 5) { signal = 'sell'; analysis = 'Market euphoria with strong rally — risk of correction.'; }
    else { analysis = 'Market conditions are mixed — hold current positions and monitor.'; }

    const response = { ok: true, signal, analysis, fearGreed: fgValue, btcTrend, btcPrice, btcAvg };
    setCache(cacheKey, response, CACHE_TTL.sentiment);
    sendJSON(res, 200, response);
  } catch (err) {
    log.error('Sentiment analysis error', { error: err.message });
    metrics.errors++;
    sendJSON(res, 200, { ok: true, degraded: true, source: 'demo', signal: 'hold', analysis: 'Demo mode — connect to internet for live analysis.', fearGreed: 45, btcTrend: 'up', btcPrice: DEMO_DATA.prices.BTC, btcAvg: DEMO_DATA.prices.BTC * 0.98 });
  }
}

async function handleCorrelation(req, res) {
  try {
    const cacheKey = 'correlation';
    const cached = getCached(cacheKey);
    if (cached) return sendJSON(res, 200, cached);

    const symbols = ['ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA'];
    const results = await Promise.all(
      symbols.map(s => fetchMarketData(`${s}USDT`).then(d => ({
        symbol: s,
        change: parseFloat(d.priceChangePercent),
      })).catch(() => null))
    );

    const btcData = await fetchMarketData('BTCUSDT');
    const btcChange = parseFloat(btcData.priceChangePercent);

    const correlations = results.filter(Boolean).map(r => {
      const diff = Math.abs(r.change - btcChange);
      const correlation = Math.max(0, 1 - diff / 20);
      const level = correlation > 0.8 ? 'very_high' : correlation > 0.6 ? 'high' : correlation > 0.4 ? 'moderate' : correlation > 0.2 ? 'low' : 'very_low';
      return { symbol: r.symbol, correlation: parseFloat(correlation.toFixed(3)), level, change24h: r.change };
    });

    const response = { ok: true, correlations, btcChange };
    setCache(cacheKey, response, CACHE_TTL.sentiment);
    sendJSON(res, 200, response);
  } catch (err) {
    log.error('Correlation error', { error: err.message });
    metrics.errors++;
    const demoCorr = ['ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA'].map(s => ({ symbol: s, correlation: 0.5 + Math.random() * 0.4, level: 'moderate', change24h: (Math.random() - 0.3) * 5 }));
    sendJSON(res, 200, { ok: true, degraded: true, source: 'demo', correlations: demoCorr, btcChange: 2.34 });
  }
}

async function handleKlines(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const symbol = (url.searchParams.get('symbol') || 'BTC').toUpperCase();
    const interval = url.searchParams.get('interval') || '1h';
    const limit = Math.min(parseInt(url.searchParams.get('limit')) || 24, 500);

    if (!isValidSymbol(symbol)) return sendJSON(res, 400, { error: 'Invalid symbol' });
    if (!isValidInterval(interval)) return sendJSON(res, 400, { error: 'Invalid interval' });

    const cacheKey = `klines:${symbol}:${interval}:${limit}`;
    const cached = getCached(cacheKey);
    if (cached) return sendJSON(res, 200, cached);

    const klines = await fetchKlines(`${symbol}USDT`, interval, limit);
    const data = klines.map(k => ({
      time: k[0], open: parseFloat(k[1]), high: parseFloat(k[2]),
      low: parseFloat(k[3]), close: parseFloat(k[4]), volume: parseFloat(k[5]),
    }));

    const response = { ok: true, data };
    setCache(cacheKey, response, CACHE_TTL.klines);
    sendJSON(res, 200, response);
  } catch (err) {
    log.error('Klines error', { error: err.message });
    metrics.errors++;
    sendJSON(res, 200, { ok: true, degraded: true, source: 'demo', data: DEMO_DATA.klines });
  }
}

async function handleIndicators(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const symbol = (url.searchParams.get('symbol') || 'BTC').toUpperCase();
    const interval = url.searchParams.get('interval') || '4h';

    if (!isValidSymbol(symbol)) return sendJSON(res, 400, { error: 'Invalid symbol' });
    if (!isValidInterval(interval, ['1h', '4h', '1d'])) return sendJSON(res, 400, { error: 'Invalid interval' });

    const cacheKey = `indicators:${symbol}:${interval}`;
    const cached = getCached(cacheKey);
    if (cached) return sendJSON(res, 200, cached);

    const klines = await fetchKlines(`${symbol}USDT`, interval, 100);
    const indicators = calculateIndicators(klines);

    if (!indicators) {
      return sendJSON(res, 200, { ok: true, degraded: true, message: 'Insufficient data for indicators' });
    }

    const response = { ok: true, symbol, interval, ...indicators };
    setCache(cacheKey, response, CACHE_TTL.klines);
    sendJSON(res, 200, response);
  } catch (err) {
    log.error('Indicators error', { error: err.message });
    metrics.errors++;
    sendJSON(res, 200, { ok: true, degraded: true, source: 'demo', symbol: 'BTC', rsi: 52.3, signal: 'hold', strength: 0 });
  }
}

async function handleMultiTimeframe(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const symbol = (url.searchParams.get('symbol') || 'BTC').toUpperCase();
    if (!isValidSymbol(symbol)) return sendJSON(res, 400, { error: 'Invalid symbol' });

    const cacheKey = `mtf:${symbol}`;
    const cached = getCached(cacheKey);
    if (cached) return sendJSON(res, 200, cached);

    const [k1h, k4h, k1d] = await Promise.all([
      fetchKlines(`${symbol}USDT`, '1h', 50),
      fetchKlines(`${symbol}USDT`, '4h', 50),
      fetchKlines(`${symbol}USDT`, '1d', 50),
    ]);

    const tf1h = calculateIndicators(k1h);
    const tf4h = calculateIndicators(k4h);
    const tf1d = calculateIndicators(k1d);

    const signals = [tf1h?.signal, tf4h?.signal, tf1d?.signal].filter(Boolean);
    const buyCount = signals.filter(s => s === 'buy').length;
    const sellCount = signals.filter(s => s === 'sell').length;

    let confluence = 'mixed';
    if (buyCount >= 2) confluence = 'bullish';
    else if (sellCount >= 2) confluence = 'bearish';

    const response = {
      ok: true, symbol,
      timeframes: {
        '1h': tf1h ? { signal: tf1h.signal, rsi: tf1h.rsi, strength: tf1h.strength } : null,
        '4h': tf4h ? { signal: tf4h.signal, rsi: tf4h.rsi, strength: tf4h.strength } : null,
        '1d': tf1d ? { signal: tf1d.signal, rsi: tf1d.rsi, strength: tf1d.strength } : null,
      },
      confluence,
      summary: `${symbol} multi-timeframe: 1H=${tf1h?.signal || 'N/A'}, 4H=${tf4h?.signal || 'N/A'}, 1D=${tf1d?.signal || 'N/A'} → ${confluence.toUpperCase()}`,
    };
    setCache(cacheKey, response, 30000);
    sendJSON(res, 200, response);
  } catch (err) {
    log.error('Multi-timeframe error', { error: err.message });
    sendJSON(res, 200, { ok: true, degraded: true, source: 'demo', confluence: 'mixed' });
  }
}

module.exports = {
  handleMarket,
  handleSentiment,
  handleSentimentAnalysis,
  handleCorrelation,
  handleKlines,
  handleIndicators,
  handleMultiTimeframe,
};
