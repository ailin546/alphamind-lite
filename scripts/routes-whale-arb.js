#!/usr/bin/env node
/**
 * AlphaMind Lite - Whale Alert & Arbitrage Scanner Routes
 * API endpoints for whale tracking, arbitrage scanning, and funding rate analysis
 */

const { httpGet, fetchMarketData, fetchFundingRates, fetchMultiplePrices } = require('./api-client');
const { sendJSON, getCached, setCache, CACHE_TTL } = require('./middleware');

var ARB_SYMBOLS = ['BTC', 'ETH', 'BNB', 'SOL', 'DOGE', 'XRP', 'ADA', 'AVAX', 'LINK', 'DOT', 'MATIC', 'ATOM', 'UNI', 'LTC', 'ETC'];
var FUNDING_SYMBOLS = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'MATIC', 'LINK', 'ATOM', 'UNI', 'LTC', 'ETC'];
var WHALE_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT'];

// ---- Whale Alert ----

async function fetchBTCLargeTransactions() {
  try {
    var latestBlock = await httpGet('https://blockchain.info/latestblock', { timeout: 10000, retries: 2 });
    var block = await httpGet('https://blockchain.info/rawblock/' + latestBlock.hash + '?limit=30', { timeout: 15000, retries: 2 });

    var largeTxs = [];
    var BTC_TO_SAT = 100000000;
    var MIN_BTC = 50; // Lowered from 100 to catch more large transactions

    var txCount = Math.min((block.tx || []).length, 80);
    for (var i = 0; i < txCount; i++) {
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
          size: btcAmount >= 1000 ? 'whale' : btcAmount >= 500 ? 'shark' : btcAmount >= 100 ? 'dolphin' : 'fish',
        });
      }
    }

    largeTxs.sort(function(a, b) { return b.btc - a.btc; });
    return { blockHeight: block.height, blockHash: latestBlock.hash.slice(0, 16) + '...', transactions: largeTxs.slice(0, 15) };
  } catch (err) {
    return { blockHeight: 0, blockHash: 'N/A', transactions: [], error: err.message };
  }
}

/**
 * Fetch and aggregate Binance trades - aggregates trades within 100ms windows
 * to reconstruct large orders that were split into multiple fills
 */
async function fetchBinanceLargeTrades(symbol, minUSD) {
  symbol = symbol || 'BTCUSDT';
  minUSD = minUSD || 100000; // Lowered to $100K to catch more whale activity
  try {
    // Fetch 1000 trades (max allowed) instead of 100
    var trades = await httpGet(
      'https://api.binance.com/api/v3/aggTrades?symbol=' + symbol + '&limit=1000',
      { timeout: 10000, retries: 2 }
    );

    // Aggregate trades within 100ms windows (same order fills)
    var aggregated = [];
    var current = null;

    for (var i = 0; i < trades.length; i++) {
      var t = trades[i];
      var price = parseFloat(t.p);
      var qty = parseFloat(t.q);
      var side = t.m ? 'sell' : 'buy';
      var ts = t.T;

      if (current && current.side === side && Math.abs(ts - current.ts) <= 100) {
        // Same order — aggregate
        current.qty += qty;
        current.usd += price * qty;
        current.fills++;
        current.avgPrice = current.usd / current.qty;
      } else {
        if (current && current.usd >= minUSD) {
          aggregated.push({
            price: current.avgPrice,
            qty: current.qty,
            usd: current.usd,
            side: current.side,
            time: new Date(current.ts).toISOString(),
            fills: current.fills,
            symbol: symbol.replace('USDT', ''),
          });
        }
        current = { avgPrice: price, qty: qty, usd: price * qty, side: side, ts: ts, fills: 1 };
      }
    }
    // Don't forget the last one
    if (current && current.usd >= minUSD) {
      aggregated.push({
        price: current.avgPrice,
        qty: current.qty,
        usd: current.usd,
        side: current.side,
        time: new Date(current.ts).toISOString(),
        fills: current.fills,
        symbol: symbol.replace('USDT', ''),
      });
    }

    return aggregated;
  } catch (err) {
    return [];
  }
}

async function handleWhaleAlert(req, res) {
  var cached = getCached('whale');
  if (cached) { sendJSON(res, 200, cached); return; }

  try {
    // Fetch trades from multiple symbols in parallel
    var fetchPromises = [
      fetchMarketData('BTCUSDT').catch(function() { return null; }),
      fetchBTCLargeTransactions(),
    ];
    // Add multi-symbol whale trades
    for (var si = 0; si < WHALE_SYMBOLS.length; si++) {
      fetchPromises.push(fetchBinanceLargeTrades(WHALE_SYMBOLS[si], WHALE_SYMBOLS[si] === 'BTCUSDT' ? 100000 : 50000));
    }

    var results = await Promise.all(fetchPromises);
    var market = results[0];
    var onchain = results[1];

    // Merge all exchange large trades
    var largeTrades = [];
    for (var ri = 2; ri < results.length; ri++) {
      largeTrades = largeTrades.concat(results[ri] || []);
    }

    // Sort by USD value descending
    largeTrades.sort(function(a, b) { return b.usd - a.usd; });

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
    if (buyVol > sellVol * 1.3) sentiment = 'bullish';
    else if (sellVol > buyVol * 1.3) sentiment = 'bearish';

    // Compute volume tiers for summary
    var tier500k = largeTrades.filter(function(t) { return t.usd >= 500000; }).length;
    var tier100k = largeTrades.filter(function(t) { return t.usd >= 100000; }).length;

    var data = {
      btcPrice: btcPrice,
      btcChange: market ? parseFloat(market.priceChangePercent) : 0,
      volume24h: market ? parseFloat(market.quoteVolume) : 0,
      largeTrades: largeTrades.slice(0, 30),
      onchain: onchain,
      summary: {
        buyVolume: buyVol,
        sellVolume: sellVol,
        buyRatio: buyRatio,
        sellRatio: 100 - buyRatio,
        tradeCount: largeTrades.length,
        tier500k: tier500k,
        tier100k: tier100k,
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

function calculateRiskReward(basis, fundingRate, dayRange) {
  // Risk score: 1 (low) to 5 (high)
  var risk = 1;
  if (dayRange > 8) risk += 2;
  else if (dayRange > 5) risk += 1;
  if (Math.abs(fundingRate) > 0.05) risk += 1;
  if (Math.abs(basis) > 0.5) risk += 1;

  // Reward score: estimated annualized return
  var basisReward = Math.abs(basis) * 365; // simplified
  var fundingReward = Math.abs(fundingRate) * 3 * 365;
  var totalReward = basisReward + fundingReward;

  return {
    risk: Math.min(risk, 5),
    reward: parseFloat(totalReward.toFixed(1)),
    ratio: risk > 0 ? parseFloat((totalReward / risk).toFixed(1)) : 0,
    grade: totalReward / risk > 10 ? 'A' : totalReward / risk > 5 ? 'B' : totalReward / risk > 2 ? 'C' : 'D',
  };
}

function generateStrategy(coin) {
  var strategies = [];

  // Basis strategy
  if (Math.abs(coin.basis) > 0.05) {
    if (coin.basis > 0) {
      strategies.push({
        type: 'basis',
        name: 'Cash & Carry',
        action: 'Long spot + Short futures',
        expectedReturn: '+' + Math.abs(coin.basis).toFixed(3) + '% per cycle',
        risk: 'Low (delta neutral)',
      });
    } else {
      strategies.push({
        type: 'basis',
        name: 'Reverse Cash & Carry',
        action: 'Short spot + Long futures',
        expectedReturn: '+' + Math.abs(coin.basis).toFixed(3) + '% per cycle',
        risk: 'Medium (borrow cost)',
      });
    }
  }

  // Funding rate strategy
  if (Math.abs(coin.fundingRate) > 0.005) {
    if (coin.fundingRate > 0) {
      strategies.push({
        type: 'funding',
        name: 'Funding Rate Harvest',
        action: 'Short futures (collect funding)',
        expectedReturn: (coin.fundingRate * 3).toFixed(3) + '% daily / ' + coin.fundingAPY.toFixed(1) + '% APY',
        risk: coin.fundingAPY > 50 ? 'High (rate may reverse)' : 'Medium',
      });
    } else {
      strategies.push({
        type: 'funding',
        name: 'Negative Funding Play',
        action: 'Long futures (collect funding)',
        expectedReturn: (Math.abs(coin.fundingRate) * 3).toFixed(3) + '% daily / ' + Math.abs(coin.fundingAPY).toFixed(1) + '% APY',
        risk: 'Medium (price risk)',
      });
    }
  }

  // Volatility strategy
  if (coin.dayRange > 4) {
    strategies.push({
      type: 'volatility',
      name: 'Range Trading',
      action: 'Buy support / Sell resistance',
      expectedReturn: 'Range: ' + coin.dayRange.toFixed(1) + '% daily',
      risk: coin.dayRange > 8 ? 'High (breakout risk)' : 'Medium',
    });
  }

  return strategies;
}

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
        var indexPrice = parseFloat(futures.indexPrice) || spotPrice;
        var fundingRate = parseFloat(futures.lastFundingRate);
        var basis = ((markPrice - spotPrice) / spotPrice) * 100;
        var fundingAPY = fundingRate * 3 * 365 * 100;
        var high = parseFloat(market.highPrice);
        var low = parseFloat(market.lowPrice);
        var dayRange = low > 0 ? ((high - low) / low * 100) : 0;
        var volume = parseFloat(market.quoteVolume) || 0;
        var change24h = parseFloat(market.priceChangePercent) || 0;

        var coin = {
          symbol: sym,
          spotPrice: spotPrice,
          futuresPrice: markPrice,
          indexPrice: indexPrice,
          basis: basis,
          fundingRate: fundingRate * 100,
          fundingAPY: fundingAPY,
          dayRange: dayRange,
          volume: volume,
          change24h: change24h,
          high24h: high,
          low24h: low,
        };

        coin.riskReward = calculateRiskReward(coin.basis, coin.fundingRate, coin.dayRange);
        coin.strategies = generateStrategy(coin);

        return coin;
      });
    }));

    var data = results.filter(Boolean);
    data.sort(function(a, b) { return Math.abs(b.basis) - Math.abs(a.basis); });

    // Classify opportunities with more detail
    var basisOpps = data.filter(function(r) { return Math.abs(r.basis) > 0.05; })
      .sort(function(a, b) { return Math.abs(b.basis) - Math.abs(a.basis); });
    var fundingOpps = data.filter(function(r) { return Math.abs(r.fundingAPY) > 15; })
      .sort(function(a, b) { return Math.abs(b.fundingAPY) - Math.abs(a.fundingAPY); });
    var highVolatility = data.filter(function(r) { return r.dayRange > 3; })
      .sort(function(a, b) { return b.dayRange - a.dayRange; });

    // Market summary
    var avgBasis = data.reduce(function(s, d) { return s + d.basis; }, 0) / (data.length || 1);
    var avgFunding = data.reduce(function(s, d) { return s + d.fundingRate; }, 0) / (data.length || 1);
    var totalVolume = data.reduce(function(s, d) { return s + d.volume; }, 0);

    // Best opportunity
    var bestOpp = null;
    for (var bi = 0; bi < data.length; bi++) {
      if (data[bi].riskReward && (!bestOpp || data[bi].riskReward.ratio > bestOpp.riskReward.ratio)) {
        bestOpp = data[bi];
      }
    }

    var response = {
      coins: data,
      opportunities: {
        basis: basisOpps.map(function(r) {
          return {
            symbol: r.symbol,
            basis: r.basis,
            spotPrice: r.spotPrice,
            futuresPrice: r.futuresPrice,
            direction: r.basis > 0 ? 'premium' : 'discount',
            strategy: r.basis > 0 ? 'short_futures_long_spot' : 'long_futures_short_spot',
            annualizedReturn: (Math.abs(r.basis) * 365).toFixed(1),
            grade: r.riskReward.grade,
          };
        }),
        funding: fundingOpps.map(function(r) {
          return {
            symbol: r.symbol,
            fundingRate: r.fundingRate,
            fundingAPY: r.fundingAPY,
            strategy: r.fundingRate > 0 ? 'short_futures' : 'long_futures',
            dailyYield: (Math.abs(r.fundingRate) * 3).toFixed(3),
            monthlyYield: (Math.abs(r.fundingRate) * 3 * 30).toFixed(2),
            grade: r.riskReward.grade,
          };
        }),
        highVolatility: highVolatility.slice(0, 8).map(function(r) {
          return {
            symbol: r.symbol,
            dayRange: r.dayRange,
            change24h: r.change24h,
            high24h: r.high24h,
            low24h: r.low24h,
            volume: r.volume,
          };
        }),
      },
      marketSummary: {
        avgBasis: parseFloat(avgBasis.toFixed(4)),
        avgFundingRate: parseFloat(avgFunding.toFixed(4)),
        totalVolume: totalVolume,
        coinsScanned: data.length,
        basisOppsCount: basisOpps.length,
        fundingOppsCount: fundingOpps.length,
        volatileCount: highVolatility.length,
        bestOpportunity: bestOpp ? { symbol: bestOpp.symbol, grade: bestOpp.riskReward.grade, ratio: bestOpp.riskReward.ratio } : null,
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
