#!/usr/bin/env node
/**
 * AlphaMind Lite - Whale Alert & Arbitrage Scanner Routes
 * API endpoints for whale tracking, arbitrage scanning, and funding rate analysis
 */

const { httpGet, fetchMarketData, fetchFundingRates, fetchMultiplePrices } = require('./api-client');
const { sendJSON, getCached, setCache, CACHE_TTL } = require('./middleware');

const ARB_SYMBOLS = ['BTC', 'ETH', 'BNB', 'SOL', 'DOGE', 'XRP', 'ADA', 'AVAX', 'LINK', 'DOT'];
const FUNDING_SYMBOLS = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'MATIC', 'LINK', 'ATOM', 'UNI', 'LTC', 'ETC'];

// ---- Whale Alert ----

async function fetchBTCLargeTransactions() {
  try {
    const latestBlock = await httpGet('https://blockchain.info/latestblock', { timeout: 10000, retries: 2 });
    const block = await httpGet('https://blockchain.info/rawblock/' + latestBlock.hash + '?limit=20', { timeout: 15000, retries: 2 });

    var largeTxs = [];
    var BTC_TO_SAT = 100000000;
    var MIN_BTC = 100;

    for (var i = 0; i < Math.min((block.tx || []).length, 50); i++) {
      var tx = block.tx[i];
      var totalOutput = 0;
      for (var j = 0; j < (tx.out || []).length; j++) {
        totalOutput += tx.out[j].value || 0;
      }
      var btcAmount = totalOutput / BTC_TO_SAT;
      if (btcAmount >= MIN_BTC) {
        largeTxs.push({
          hash: tx.hash.slice(0, 16) + '...',
          btc: btcAmount,
          usd: 0,
          outputs: (tx.out || []).length,
          time: tx.time ? new Date(tx.time * 1000).toISOString() : null,
          size: btcAmount >= 1000 ? 'whale' : btcAmount >= 500 ? 'shark' : 'dolphin',
        });
      }
    }

    return { blockHeight: block.height, blockHash: latestBlock.hash.slice(0, 16) + '...', transactions: largeTxs.slice(0, 10) };
  } catch (err) {
    return { blockHeight: 0, blockHash: 'N/A', transactions: [], error: err.message };
  }
}

async function fetchBinanceLargeTrades(symbol, minUSD) {
  symbol = symbol || 'BTCUSDT';
  minUSD = minUSD || 500000;
  try {
    var trades = await httpGet(
      'https://api.binance.com/api/v3/aggTrades?symbol=' + symbol + '&limit=100',
      { timeout: 10000, retries: 2 }
    );

    var largeTrades = [];
    for (var i = 0; i < trades.length; i++) {
      var t = trades[i];
      var price = parseFloat(t.p);
      var qty = parseFloat(t.q);
      var usdValue = price * qty;
      if (usdValue >= minUSD) {
        largeTrades.push({
          price: price,
          qty: qty,
          usd: usdValue,
          side: t.m ? 'sell' : 'buy',
          time: new Date(t.T).toISOString(),
        });
      }
    }

    return largeTrades;
  } catch (err) {
    return [];
  }
}

async function handleWhaleAlert(req, res) {
  var cached = getCached('whale');
  if (cached) { sendJSON(res, 200, cached); return; }

  try {
    var results = await Promise.all([
      fetchMarketData('BTCUSDT').catch(function() { return null; }),
      fetchBinanceLargeTrades('BTCUSDT', 500000),
      fetchBTCLargeTransactions(),
    ]);
    var market = results[0];
    var largeTrades = results[1];
    var onchain = results[2];

    // Calculate buy/sell volumes
    var buyVol = 0, sellVol = 0;
    for (var i = 0; i < largeTrades.length; i++) {
      if (largeTrades[i].side === 'buy') buyVol += largeTrades[i].usd;
      else sellVol += largeTrades[i].usd;
    }
    var total = buyVol + sellVol;
    var buyRatio = total > 0 ? (buyVol / total) * 100 : 50;

    // Add USD values to onchain transactions
    var btcPrice = market ? parseFloat(market.lastPrice) : 0;
    for (var j = 0; j < onchain.transactions.length; j++) {
      onchain.transactions[j].usd = onchain.transactions[j].btc * btcPrice;
    }

    // Determine sentiment
    var sentiment = 'neutral';
    if (buyVol > sellVol * 1.5) sentiment = 'bullish';
    else if (sellVol > buyVol * 1.5) sentiment = 'bearish';

    var data = {
      btcPrice: btcPrice,
      btcChange: market ? parseFloat(market.priceChangePercent) : 0,
      volume24h: market ? parseFloat(market.quoteVolume) : 0,
      largeTrades: largeTrades.slice(0, 15),
      onchain: onchain,
      summary: {
        buyVolume: buyVol,
        sellVolume: sellVol,
        buyRatio: buyRatio,
        sellRatio: 100 - buyRatio,
        tradeCount: largeTrades.length,
        sentiment: sentiment,
      },
    };

    setCache('whale', data, 15000);
    sendJSON(res, 200, data);
  } catch (err) {
    sendJSON(res, 500, { error: 'Failed to fetch whale data: ' + err.message });
  }
}

// ---- Arbitrage Scanner ----

async function handleArbitrage(req, res) {
  var cached = getCached('arbitrage');
  if (cached) { sendJSON(res, 200, cached); return; }

  try {
    var results = await Promise.all(ARB_SYMBOLS.map(function(sym) {
      var pair = sym + 'USDT';
      return Promise.all([
        fetchMarketData(pair).catch(function() { return null; }),
        fetchFundingRates(pair).catch(function() { return null; }),
      ]).then(function(r) {
        var market = r[0], futures = r[1];
        if (!market || !futures) return null;

        var spotPrice = parseFloat(market.lastPrice);
        var markPrice = parseFloat(futures.markPrice);
        var fundingRate = parseFloat(futures.lastFundingRate);
        var basis = ((markPrice - spotPrice) / spotPrice) * 100;
        var fundingAPY = fundingRate * 3 * 365 * 100;
        var high = parseFloat(market.highPrice);
        var low = parseFloat(market.lowPrice);
        var dayRange = low > 0 ? ((high - low) / low * 100) : 0;

        return {
          symbol: sym,
          spotPrice: spotPrice,
          futuresPrice: markPrice,
          basis: basis,
          fundingRate: fundingRate * 100,
          fundingAPY: fundingAPY,
          dayRange: dayRange,
          volume: parseFloat(market.quoteVolume) || 0,
          change24h: parseFloat(market.priceChangePercent) || 0,
        };
      });
    }));

    var data = results.filter(Boolean);
    data.sort(function(a, b) { return Math.abs(b.basis) - Math.abs(a.basis); });

    // Classify opportunities
    var basisOpps = data.filter(function(r) { return Math.abs(r.basis) > 0.1; });
    var fundingOpps = data.filter(function(r) { return Math.abs(r.fundingAPY) > 20; });
    var highVolatility = data.filter(function(r) { return r.dayRange > 5; })
      .sort(function(a, b) { return b.dayRange - a.dayRange; });

    var response = {
      coins: data,
      opportunities: {
        basis: basisOpps.map(function(r) {
          return {
            symbol: r.symbol,
            basis: r.basis,
            direction: r.basis > 0 ? 'premium' : 'discount',
            strategy: r.basis > 0 ? 'short_futures_long_spot' : 'long_futures_short_spot',
          };
        }),
        funding: fundingOpps.map(function(r) {
          return {
            symbol: r.symbol,
            fundingRate: r.fundingRate,
            fundingAPY: r.fundingAPY,
            strategy: r.fundingRate > 0 ? 'short_futures' : 'long_futures',
          };
        }),
        highVolatility: highVolatility.slice(0, 5).map(function(r) {
          return { symbol: r.symbol, dayRange: r.dayRange, change24h: r.change24h };
        }),
      },
      timestamp: new Date().toISOString(),
    };

    setCache('arbitrage', response, 15000);
    sendJSON(res, 200, response);
  } catch (err) {
    sendJSON(res, 500, { error: 'Failed to scan arbitrage: ' + err.message });
  }
}

// ---- Funding Rate Analysis ----

async function handleFundingRate(req, res) {
  var cached = getCached('funding-rate');
  if (cached) { sendJSON(res, 200, cached); return; }

  try {
    var results = await Promise.all(FUNDING_SYMBOLS.map(function(sym) {
      return httpGet('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=' + sym + 'USDT', { timeout: 10000, retries: 2 })
        .then(function(json) {
          var rate = parseFloat(json.lastFundingRate);
          var grossAPY = (Math.pow(1 + rate * 3, 365) - 1) * 100;
          var netAPY = grossAPY - 0.04; // minus fees
          var riskLevel = 'normal';
          if (Math.abs(rate) > 0.003) riskLevel = 'extreme';
          else if (Math.abs(rate) > 0.001) riskLevel = 'high';

          return {
            symbol: sym,
            fundingRate: rate * 100,
            markPrice: parseFloat(json.markPrice),
            indexPrice: parseFloat(json.indexPrice),
            nextFundingTime: parseInt(json.nextFundingTime),
            grossAPY: grossAPY,
            netAPY: netAPY,
            singlePayment: rate * 10000, // per $10K position
            monthlyYield: rate * 3 * 30 * 10000,
            riskLevel: riskLevel,
          };
        })
        .catch(function() { return null; });
    }));

    var data = results.filter(Boolean);
    data.sort(function(a, b) { return Math.abs(b.fundingRate) - Math.abs(a.fundingRate); });

    var positiveCount = data.filter(function(d) { return d.fundingRate > 0; }).length;
    var negativeCount = data.filter(function(d) { return d.fundingRate < 0; }).length;
    var avgRate = data.reduce(function(sum, d) { return sum + d.fundingRate; }, 0) / (data.length || 1);

    var sentiment = 'neutral';
    if (positiveCount > negativeCount * 1.5) sentiment = 'bullish';
    else if (negativeCount > positiveCount * 1.5) sentiment = 'bearish';

    var opportunities = data.filter(function(d) { return d.fundingRate > 0.01; });

    var response = {
      rates: data,
      opportunities: opportunities,
      marketSentiment: {
        sentiment: sentiment,
        positiveCount: positiveCount,
        negativeCount: negativeCount,
        averageRate: avgRate,
      },
      timestamp: new Date().toISOString(),
    };

    setCache('funding-rate', response, 15000);
    sendJSON(res, 200, response);
  } catch (err) {
    sendJSON(res, 500, { error: 'Failed to fetch funding rates: ' + err.message });
  }
}

module.exports = { handleWhaleAlert, handleArbitrage, handleFundingRate };
