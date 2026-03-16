#!/usr/bin/env node
/**
 * AlphaMind Lite - Whale Alert & Arbitrage Scanner Routes
 * API endpoints for whale tracking, arbitrage scanning, and funding rate analysis
 * Enhanced: liquidations, order book depth, open interest, triangular arb, fee-adjusted P&L
 */

const { httpGet, fetchMarketData, fetchFundingRates, fetchMultiplePrices } = require('./api-client');
const { sendJSON, getCached, setCache, CACHE_TTL } = require('./middleware');

var ARB_SYMBOLS = ['BTC', 'ETH', 'BNB', 'SOL', 'DOGE', 'XRP', 'ADA', 'AVAX', 'LINK', 'DOT', 'MATIC', 'ATOM', 'UNI', 'LTC', 'ETC'];
var FUNDING_SYMBOLS = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'MATIC', 'LINK', 'ATOM', 'UNI', 'LTC', 'ETC'];
var WHALE_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT'];

// Triangular arbitrage paths (symbol A -> B -> C -> A)
var TRI_ARB_PATHS = [
  { name: 'BTC-ETH-USDT', legs: ['ETHBTC', 'ETHUSDT', 'BTCUSDT'], directions: ['buy', 'sell', 'sell'] },
  { name: 'BTC-BNB-USDT', legs: ['BNBBTC', 'BNBUSDT', 'BTCUSDT'], directions: ['buy', 'sell', 'sell'] },
  { name: 'BTC-SOL-USDT', legs: ['SOLBTC', 'SOLUSDT', 'BTCUSDT'], directions: ['buy', 'sell', 'sell'] },
  { name: 'ETH-BNB-USDT', legs: ['BNBETH', 'BNBUSDT', 'ETHUSDT'], directions: ['buy', 'sell', 'sell'] },
  { name: 'BTC-XRP-USDT', legs: ['XRPBTC', 'XRPUSDT', 'BTCUSDT'], directions: ['buy', 'sell', 'sell'] },
  { name: 'BTC-DOGE-USDT', legs: ['DOGEBTC', 'DOGEUSDT', 'BTCUSDT'], directions: ['buy', 'sell', 'sell'] },
];

// ---- Whale Alert ----

async function fetchBTCLargeTransactions() {
  try {
    var latestBlock = await httpGet('https://blockchain.info/latestblock', { timeout: 10000, retries: 2 });
    var block = await httpGet('https://blockchain.info/rawblock/' + latestBlock.hash + '?limit=30', { timeout: 15000, retries: 2 });

    var largeTxs = [];
    var BTC_TO_SAT = 100000000;
    var MIN_BTC = 50;

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
  minUSD = minUSD || 100000;
  try {
    var trades = await httpGet(
      'https://api.binance.com/api/v3/aggTrades?symbol=' + symbol + '&limit=1000',
      { timeout: 10000, retries: 2 }
    );

    var aggregated = [];
    var current = null;

    for (var i = 0; i < trades.length; i++) {
      var t = trades[i];
      var price = parseFloat(t.p);
      var qty = parseFloat(t.q);
      var side = t.m ? 'sell' : 'buy';
      var ts = t.T;

      if (current && current.side === side && Math.abs(ts - current.ts) <= 100) {
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

/**
 * Fetch recent forced liquidations from Binance Futures
 * These represent large margin calls - critical whale event data
 */
async function fetchLiquidations(symbol) {
  symbol = symbol || 'BTCUSDT';
  try {
    var data = await httpGet(
      'https://fapi.binance.com/fapi/v1/allForceOrders?symbol=' + symbol + '&limit=50',
      { timeout: 10000, retries: 2 }
    );

    return (data || []).map(function(liq) {
      var price = parseFloat(liq.price);
      var qty = parseFloat(liq.origQty);
      var usd = price * qty;
      return {
        symbol: symbol.replace('USDT', ''),
        side: liq.side === 'BUY' ? 'short_liq' : 'long_liq',
        price: price,
        qty: qty,
        usd: usd,
        time: new Date(liq.time).toISOString(),
        tier: usd >= 1000000 ? 'mega' : usd >= 500000 ? 'large' : usd >= 100000 ? 'medium' : 'small',
      };
    }).filter(function(l) { return l.usd >= 50000; });
  } catch (err) {
    return [];
  }
}

/**
 * Fetch order book depth for a symbol - identifies bid/ask walls
 */
async function fetchOrderBookDepth(symbol) {
  symbol = symbol || 'BTCUSDT';
  try {
    var book = await httpGet(
      'https://api.binance.com/api/v3/depth?symbol=' + symbol + '&limit=20',
      { timeout: 8000, retries: 2 }
    );

    var bids = (book.bids || []).map(function(b) { return { price: parseFloat(b[0]), qty: parseFloat(b[1]) }; });
    var asks = (book.asks || []).map(function(a) { return { price: parseFloat(a[0]), qty: parseFloat(a[1]) }; });

    // Calculate total bid/ask volume (top 20 levels)
    var bidVolume = bids.reduce(function(sum, b) { return sum + b.price * b.qty; }, 0);
    var askVolume = asks.reduce(function(sum, a) { return sum + a.price * a.qty; }, 0);
    var totalDepth = bidVolume + askVolume;

    // Find walls (levels with >3x average size)
    var avgBidSize = bidVolume / (bids.length || 1);
    var avgAskSize = askVolume / (asks.length || 1);

    var bidWalls = bids.filter(function(b) { return b.price * b.qty > avgBidSize * 3; }).map(function(b) {
      return { price: b.price, usd: b.price * b.qty };
    });
    var askWalls = asks.filter(function(a) { return a.price * a.qty > avgAskSize * 3; }).map(function(a) {
      return { price: a.price, usd: a.price * a.qty };
    });

    // Bid/ask imbalance ratio: >1 = more buy support, <1 = more sell pressure
    var imbalance = askVolume > 0 ? bidVolume / askVolume : 1;

    return {
      symbol: symbol.replace('USDT', ''),
      bidVolume: bidVolume,
      askVolume: askVolume,
      imbalance: parseFloat(imbalance.toFixed(3)),
      imbalanceSignal: imbalance > 1.5 ? 'strong_buy' : imbalance > 1.1 ? 'buy' : imbalance < 0.67 ? 'strong_sell' : imbalance < 0.9 ? 'sell' : 'neutral',
      spread: asks.length > 0 && bids.length > 0 ? parseFloat(((asks[0].price - bids[0].price) / bids[0].price * 100).toFixed(4)) : 0,
      bestBid: bids.length > 0 ? bids[0].price : 0,
      bestAsk: asks.length > 0 ? asks[0].price : 0,
      bidWalls: bidWalls.slice(0, 3),
      askWalls: askWalls.slice(0, 3),
      depth: {
        bid10: bids.slice(0, 10).reduce(function(s, b) { return s + b.price * b.qty; }, 0),
        ask10: asks.slice(0, 10).reduce(function(s, a) { return s + a.price * a.qty; }, 0),
      },
    };
  } catch (err) {
    return { symbol: symbol.replace('USDT', ''), bidVolume: 0, askVolume: 0, imbalance: 1, imbalanceSignal: 'neutral', spread: 0, bestBid: 0, bestAsk: 0, bidWalls: [], askWalls: [], depth: { bid10: 0, ask10: 0 } };
  }
}

async function handleWhaleAlert(req, res) {
  var cached = getCached('whale');
  if (cached) { sendJSON(res, 200, cached); return; }

  try {
    // Fetch trades, liquidations, and order book depth in parallel
    var fetchPromises = [
      fetchMarketData('BTCUSDT').catch(function() { return null; }),
      fetchBTCLargeTransactions(),
    ];
    // Multi-symbol whale trades
    for (var si = 0; si < WHALE_SYMBOLS.length; si++) {
      fetchPromises.push(fetchBinanceLargeTrades(WHALE_SYMBOLS[si], WHALE_SYMBOLS[si] === 'BTCUSDT' ? 100000 : 50000));
    }
    // Liquidation data for BTC and ETH
    fetchPromises.push(fetchLiquidations('BTCUSDT'));
    fetchPromises.push(fetchLiquidations('ETHUSDT'));
    // Order book depth for key symbols
    fetchPromises.push(fetchOrderBookDepth('BTCUSDT'));
    fetchPromises.push(fetchOrderBookDepth('ETHUSDT'));

    var results = await Promise.all(fetchPromises);
    var market = results[0];
    var onchain = results[1];

    // Merge all exchange large trades (indices 2 to 2+WHALE_SYMBOLS.length-1)
    var largeTrades = [];
    var whaleEnd = 2 + WHALE_SYMBOLS.length;
    for (var ri = 2; ri < whaleEnd; ri++) {
      largeTrades = largeTrades.concat(results[ri] || []);
    }
    largeTrades.sort(function(a, b) { return b.usd - a.usd; });

    // Liquidation data
    var btcLiqs = results[whaleEnd] || [];
    var ethLiqs = results[whaleEnd + 1] || [];
    var allLiqs = btcLiqs.concat(ethLiqs);
    allLiqs.sort(function(a, b) { return b.usd - a.usd; });

    var longLiqVol = 0, shortLiqVol = 0;
    for (var li = 0; li < allLiqs.length; li++) {
      if (allLiqs[li].side === 'long_liq') longLiqVol += allLiqs[li].usd;
      else shortLiqVol += allLiqs[li].usd;
    }

    // Order book depth
    var btcDepth = results[whaleEnd + 2] || {};
    var ethDepth = results[whaleEnd + 3] || {};

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

    // Determine sentiment (enhanced with liquidation + depth data)
    var sentiment = 'neutral';
    var sentimentScore = 0;
    if (buyVol > sellVol * 1.3) sentimentScore += 2;
    else if (sellVol > buyVol * 1.3) sentimentScore -= 2;
    if (longLiqVol > shortLiqVol * 2) sentimentScore -= 1; // lots of longs liquidated = bearish
    else if (shortLiqVol > longLiqVol * 2) sentimentScore += 1; // lots of shorts liquidated = bullish
    if (btcDepth.imbalance > 1.3) sentimentScore += 1;
    else if (btcDepth.imbalance < 0.77) sentimentScore -= 1;

    if (sentimentScore >= 2) sentiment = 'bullish';
    else if (sentimentScore <= -2) sentiment = 'bearish';

    // Compute volume tiers for summary
    var tier500k = largeTrades.filter(function(t) { return t.usd >= 500000; }).length;
    var tier100k = largeTrades.filter(function(t) { return t.usd >= 100000; }).length;

    // Accumulation/Distribution indicator
    var accDist = 'neutral';
    if (buyVol > sellVol * 1.2 && btcDepth.imbalance > 1.1) accDist = 'accumulation';
    else if (sellVol > buyVol * 1.2 && btcDepth.imbalance < 0.9) accDist = 'distribution';

    // Cross-module correlation signals (whale x arb)
    var signals = [];
    var arbCache = getCached('arbitrage');
    if (arbCache && arbCache.coins) {
      var btcArb = arbCache.coins.find(function(c) { return c.symbol === 'BTC'; });
      if (btcArb) {
        // Signal: whales accumulating while basis is negative = potential reversal
        if (accDist === 'accumulation' && btcArb.basis < -0.03) {
          signals.push({ type: 'whale_basis_divergence', confidence: 'high', direction: 'bullish',
            detail: 'Whales accumulating while futures trade at discount — potential reversal setup' });
        }
        // Signal: whales distributing while basis is positive = potential top
        if (accDist === 'distribution' && btcArb.basis > 0.05) {
          signals.push({ type: 'whale_basis_convergence', confidence: 'high', direction: 'bearish',
            detail: 'Whales distributing while futures trade at premium — potential top signal' });
        }
        // Signal: massive long liquidations + high positive funding = cascade risk
        if (longLiqVol > shortLiqVol * 3 && btcArb.fundingRate > 0.005) {
          signals.push({ type: 'liquidation_cascade_risk', confidence: 'medium', direction: 'bearish',
            detail: 'Heavy long liquidations with elevated funding — further downside possible' });
        }
        // Signal: short squeeze + negative funding = bullish
        if (shortLiqVol > longLiqVol * 3 && btcArb.fundingRate < -0.005) {
          signals.push({ type: 'short_squeeze', confidence: 'medium', direction: 'bullish',
            detail: 'Shorts being squeezed with negative funding — momentum may continue up' });
        }
        // Signal: order book flip with arb opportunity
        if (btcDepth.imbalanceSignal && btcDepth.imbalanceSignal.indexOf('buy') >= 0 && btcArb.feeAnalysis && btcArb.feeAnalysis.profitable) {
          signals.push({ type: 'buy_support_with_arb', confidence: 'medium', direction: 'opportunity',
            detail: 'Strong buy-side support + profitable arb opportunity on BTC' });
        }
      }
    }

    var data = {
      btcPrice: btcPrice,
      btcChange: market ? parseFloat(market.priceChangePercent) : 0,
      volume24h: market ? parseFloat(market.quoteVolume) : 0,
      largeTrades: largeTrades.slice(0, 30),
      smartSignals: signals,
      onchain: onchain,
      liquidations: {
        recent: allLiqs.slice(0, 20),
        summary: {
          totalCount: allLiqs.length,
          longLiqVolume: longLiqVol,
          shortLiqVolume: shortLiqVol,
          longLiqCount: allLiqs.filter(function(l) { return l.side === 'long_liq'; }).length,
          shortLiqCount: allLiqs.filter(function(l) { return l.side === 'short_liq'; }).length,
          dominantSide: longLiqVol > shortLiqVol ? 'long_liq' : 'short_liq',
        },
      },
      orderBook: {
        btc: btcDepth,
        eth: ethDepth,
      },
      summary: {
        buyVolume: buyVol,
        sellVolume: sellVol,
        buyRatio: buyRatio,
        sellRatio: 100 - buyRatio,
        tradeCount: largeTrades.length,
        tier500k: tier500k,
        tier100k: tier100k,
        sentiment: sentiment,
        sentimentScore: sentimentScore,
        accumulationDistribution: accDist,
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
  var risk = 1;
  if (dayRange > 8) risk += 2;
  else if (dayRange > 5) risk += 1;
  if (Math.abs(fundingRate) > 0.05) risk += 1;
  if (Math.abs(basis) > 0.5) risk += 1;

  var basisReward = Math.abs(basis) * 365;
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

/**
 * Calculate fee-adjusted net P&L for an arbitrage position
 * Takes into account: spot taker fee, futures taker fee, funding payments
 */
function calculateFeeAdjustedPnL(basis, fundingRate, positionSize) {
  positionSize = positionSize || 10000; // default $10K position
  var SPOT_TAKER_FEE = 0.001; // 0.1% Binance default
  var FUTURES_TAKER_FEE = 0.0004; // 0.04% Binance futures
  var SLIPPAGE = 0.0005; // 0.05% estimated slippage

  var grossProfit = Math.abs(basis / 100) * positionSize;
  var spotFee = positionSize * SPOT_TAKER_FEE;
  var futuresFee = positionSize * FUTURES_TAKER_FEE;
  var slippageCost = positionSize * SLIPPAGE * 2; // entry + exit
  var totalFees = spotFee + futuresFee + slippageCost;

  // Funding income (per 8h cycle if held)
  var fundingIncome = Math.abs(fundingRate / 100) * positionSize;

  var netProfit = grossProfit + fundingIncome - totalFees;
  var netROI = (netProfit / positionSize) * 100;

  return {
    positionSize: positionSize,
    grossProfit: parseFloat(grossProfit.toFixed(2)),
    fees: {
      spot: parseFloat(spotFee.toFixed(2)),
      futures: parseFloat(futuresFee.toFixed(2)),
      slippage: parseFloat(slippageCost.toFixed(2)),
      total: parseFloat(totalFees.toFixed(2)),
    },
    fundingIncome: parseFloat(fundingIncome.toFixed(2)),
    netProfit: parseFloat(netProfit.toFixed(2)),
    netROI: parseFloat(netROI.toFixed(4)),
    profitable: netProfit > 0,
    breakEvenBasis: parseFloat(((totalFees / positionSize) * 100).toFixed(4)),
  };
}

/**
 * Calculate position sizing advice and hedging details
 * Uses a conservative fixed-fractional approach with grade-based scaling
 */
function calculatePositionAdvice(coin, accountSize) {
  accountSize = accountSize || 100000;
  var grade = coin.riskReward ? coin.riskReward.grade : 'C';
  var basis = Math.abs(coin.basis || 0);
  var fundingRate = Math.abs(coin.fundingRate || 0);

  // Grade-based position fraction (conservative)
  var fractionMap = { A: 0.15, B: 0.10, C: 0.06, D: 0.03 };
  var fraction = fractionMap[grade] || 0.05;

  var positionSize = Math.round(accountSize * fraction);
  var spotSize = positionSize;
  var futuresSize = positionSize;

  // Hedging details
  var spotQty = coin.spotPrice > 0 ? parseFloat((spotSize / coin.spotPrice).toFixed(6)) : 0;
  var futuresQty = coin.futuresPrice > 0 ? parseFloat((futuresSize / coin.futuresPrice).toFixed(6)) : 0;

  // Expected returns
  var dailyBasisReturn = basis / 100;
  var dailyFundingReturn = fundingRate / 100 * 3; // 3 funding cycles per day
  var dailyReturn = (dailyBasisReturn + dailyFundingReturn) * positionSize;
  var monthlyReturn = dailyReturn * 30;

  // Risk: max drawdown if basis widens by 2x
  var maxDrawdown = parseFloat((basis * 2 * positionSize / 100).toFixed(2));

  // Leverage needed for futures side
  var recLeverage = coin.dayRange > 8 ? 2 : coin.dayRange > 5 ? 3 : 5;

  // Initial margin for futures at recommended leverage
  var initialMargin = parseFloat((futuresSize / recLeverage).toFixed(2));

  // Liquidation price estimate (for short futures)
  var liqDistance = coin.futuresPrice > 0 ? (1 / recLeverage) : 0;
  var liqPrice = coin.basis > 0
    ? parseFloat((coin.futuresPrice * (1 + liqDistance)).toFixed(2))
    : parseFloat((coin.futuresPrice * (1 - liqDistance)).toFixed(2));

  var riskLevel = coin.dayRange > 8 ? 'HIGH' : coin.dayRange > 5 ? 'MEDIUM' : 'LOW';

  return {
    accountSize: accountSize,
    recommendedPosition: positionSize,
    percentOfAccount: parseFloat((fraction * 100).toFixed(1)),
    hedge: {
      spotAction: coin.basis > 0 ? 'BUY' : 'SELL',
      spotQty: spotQty,
      spotCost: spotSize,
      futuresAction: coin.basis > 0 ? 'SHORT' : 'LONG',
      futuresQty: futuresQty,
      futuresCost: futuresSize,
      initialMargin: initialMargin,
      leverage: recLeverage,
      liquidationPrice: liqPrice,
    },
    expectedDaily: parseFloat(dailyReturn.toFixed(2)),
    expectedMonthly: parseFloat(monthlyReturn.toFixed(2)),
    expectedMonthlyROI: parseFloat(((monthlyReturn / positionSize) * 100).toFixed(2)),
    maxDrawdown: maxDrawdown,
    riskLevel: riskLevel,
  };
}

/**
 * Fetch open interest for a futures symbol
 */
async function fetchOpenInterest(symbol) {
  try {
    var data = await httpGet(
      'https://fapi.binance.com/fapi/v1/openInterest?symbol=' + symbol,
      { timeout: 8000, retries: 2 }
    );
    return {
      symbol: symbol.replace('USDT', ''),
      openInterest: parseFloat(data.openInterest),
      time: data.time,
    };
  } catch (err) {
    return { symbol: symbol.replace('USDT', ''), openInterest: 0 };
  }
}

/**
 * Fetch historical funding rates to detect trend
 */
async function fetchFundingHistory(symbol) {
  try {
    var data = await httpGet(
      'https://fapi.binance.com/fapi/v1/fundingRate?symbol=' + symbol + '&limit=10',
      { timeout: 8000, retries: 2 }
    );
    return (data || []).map(function(d) {
      return {
        rate: parseFloat(d.fundingRate) * 100,
        time: d.fundingTime,
      };
    });
  } catch (err) {
    return [];
  }
}

/**
 * Detect triangular arbitrage opportunities
 * Checks if trading A->B->C->A yields profit after fees
 */
async function detectTriangularArbitrage() {
  try {
    // Fetch all needed ticker prices in one batch
    var allSymbols = [];
    for (var pi = 0; pi < TRI_ARB_PATHS.length; pi++) {
      for (var li = 0; li < TRI_ARB_PATHS[pi].legs.length; li++) {
        if (allSymbols.indexOf(TRI_ARB_PATHS[pi].legs[li]) === -1) {
          allSymbols.push(TRI_ARB_PATHS[pi].legs[li]);
        }
      }
    }

    var pricePromises = allSymbols.map(function(sym) {
      return httpGet('https://api.binance.com/api/v3/ticker/bookTicker?symbol=' + sym, { timeout: 8000, retries: 1 })
        .then(function(d) {
          return {
            symbol: d.symbol,
            bidPrice: parseFloat(d.bidPrice),
            askPrice: parseFloat(d.askPrice),
          };
        })
        .catch(function() { return null; });
    });

    var prices = await Promise.all(pricePromises);
    var priceMap = {};
    for (var pm = 0; pm < prices.length; pm++) {
      if (prices[pm]) priceMap[prices[pm].symbol] = prices[pm];
    }

    var FEE_RATE = 0.001; // 0.1% per leg
    var opportunities = [];

    for (var ai = 0; ai < TRI_ARB_PATHS.length; ai++) {
      var path = TRI_ARB_PATHS[ai];
      var p0 = priceMap[path.legs[0]];
      var p1 = priceMap[path.legs[1]];
      var p2 = priceMap[path.legs[2]];
      if (!p0 || !p1 || !p2) continue;

      // Forward path: start with 1 USDT
      // Leg 1: Buy leg[0] pair (e.g., ETHBTC - buy ETH with BTC)
      // We need the ask price to buy
      var rate0 = path.directions[0] === 'buy' ? p0.askPrice : p0.bidPrice;
      var rate1 = path.directions[1] === 'sell' ? p1.bidPrice : p1.askPrice;
      var rate2 = path.directions[2] === 'sell' ? p2.bidPrice : p2.askPrice;

      if (rate0 <= 0 || rate1 <= 0 || rate2 <= 0) continue;

      // Calculate: start with 1 unit
      // Step 1: Buy USDT worth of BTC at rate2 ask
      // Actually, let's compute the effective rate more simply
      // For BTC-ETH-USDT: Start 1 USDT -> buy BTC -> buy ETH with BTC -> sell ETH for USDT
      var startAmount = 1;
      // Buy leg2 base (BTC) with USDT at ask
      var step1 = startAmount / p2.askPrice; // BTC amount
      step1 *= (1 - FEE_RATE);
      // Buy leg0 base (ETH) with BTC at ask
      var step2 = step1 / p0.askPrice; // ETH amount
      step2 *= (1 - FEE_RATE);
      // Sell ETH for USDT at bid
      var step3 = step2 * p1.bidPrice;
      step3 *= (1 - FEE_RATE);

      var profitPct = (step3 - startAmount) * 100;

      // Also check reverse direction
      var revStep1 = startAmount / p1.askPrice; // ETH
      revStep1 *= (1 - FEE_RATE);
      var revStep2 = revStep1 * p0.bidPrice; // BTC
      revStep2 *= (1 - FEE_RATE);
      var revStep3 = revStep2 * p2.bidPrice; // USDT
      revStep3 *= (1 - FEE_RATE);
      var revProfitPct = (revStep3 - startAmount) * 100;

      var bestProfit = Math.max(profitPct, revProfitPct);
      var bestDirection = profitPct >= revProfitPct ? 'forward' : 'reverse';

      opportunities.push({
        path: path.name,
        legs: path.legs,
        profitPct: parseFloat(bestProfit.toFixed(4)),
        direction: bestDirection,
        profitable: bestProfit > 0,
        perTenK: parseFloat((bestProfit / 100 * 10000).toFixed(2)),
        prices: {
          leg0: { bid: p0.bidPrice, ask: p0.askPrice },
          leg1: { bid: p1.bidPrice, ask: p1.askPrice },
          leg2: { bid: p2.bidPrice, ask: p2.askPrice },
        },
      });
    }

    opportunities.sort(function(a, b) { return b.profitPct - a.profitPct; });
    return opportunities;
  } catch (err) {
    return [];
  }
}

async function handleArbitrage(req, res) {
  var cached = getCached('arbitrage');
  if (cached) { sendJSON(res, 200, cached); return; }

  try {
    // Fetch spot+futures data, open interest, and funding history in parallel
    var coinPromises = ARB_SYMBOLS.map(function(sym) {
      var pair = sym + 'USDT';
      return Promise.all([
        fetchMarketData(pair).catch(function() { return null; }),
        fetchFundingRates(pair).catch(function() { return null; }),
        fetchOpenInterest(pair).catch(function() { return { symbol: sym, openInterest: 0 }; }),
        fetchFundingHistory(pair).catch(function() { return []; }),
      ]).then(function(r) {
        var market = r[0], futures = r[1], oi = r[2], fundingHist = r[3];
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

        // Funding rate trend analysis
        var fundingTrend = 'stable';
        if (fundingHist.length >= 3) {
          var recent = fundingHist.slice(-3);
          var avgRecent = recent.reduce(function(s, f) { return s + f.rate; }, 0) / recent.length;
          var older = fundingHist.slice(0, Math.min(3, fundingHist.length - 3));
          if (older.length > 0) {
            var avgOlder = older.reduce(function(s, f) { return s + f.rate; }, 0) / older.length;
            if (avgRecent > avgOlder * 1.5) fundingTrend = 'rising';
            else if (avgRecent < avgOlder * 0.5) fundingTrend = 'falling';
          }
        }

        // Open interest in USD
        var oiUSD = oi.openInterest * markPrice;

        var coin = {
          symbol: sym,
          spotPrice: spotPrice,
          futuresPrice: markPrice,
          indexPrice: indexPrice,
          basis: basis,
          fundingRate: fundingRate * 100,
          fundingAPY: fundingAPY,
          fundingTrend: fundingTrend,
          fundingHistory: fundingHist.slice(-5),
          dayRange: dayRange,
          volume: volume,
          change24h: change24h,
          high24h: high,
          low24h: low,
          openInterest: oi.openInterest,
          openInterestUSD: oiUSD,
        };

        coin.riskReward = calculateRiskReward(coin.basis, coin.fundingRate, coin.dayRange);
        coin.strategies = generateStrategy(coin);
        coin.feeAnalysis = calculateFeeAdjustedPnL(coin.basis, coin.fundingRate);
        coin.positionAdvice = calculatePositionAdvice(coin);

        return coin;
      });
    });

    // Fetch triangular arbitrage in parallel
    var triArbPromise = detectTriangularArbitrage().catch(function() { return []; });

    var allResults = await Promise.all([Promise.all(coinPromises), triArbPromise]);
    var results = allResults[0];
    var triArb = allResults[1];

    var data = results.filter(Boolean);
    data.sort(function(a, b) { return Math.abs(b.basis) - Math.abs(a.basis); });

    // Classify opportunities
    var basisOpps = data.filter(function(r) { return Math.abs(r.basis) > 0.05; })
      .sort(function(a, b) { return Math.abs(b.basis) - Math.abs(a.basis); });
    var fundingOpps = data.filter(function(r) { return Math.abs(r.fundingAPY) > 15; })
      .sort(function(a, b) { return Math.abs(b.fundingAPY) - Math.abs(a.fundingAPY); });
    var highVolatility = data.filter(function(r) { return r.dayRange > 3; })
      .sort(function(a, b) { return b.dayRange - a.dayRange; });

    // Only include profitable fee-adjusted opportunities
    var profitableAfterFees = data.filter(function(r) { return r.feeAnalysis && r.feeAnalysis.profitable; })
      .sort(function(a, b) { return b.feeAnalysis.netROI - a.feeAnalysis.netROI; });

    // Market summary
    var avgBasis = data.reduce(function(s, d) { return s + d.basis; }, 0) / (data.length || 1);
    var avgFunding = data.reduce(function(s, d) { return s + d.fundingRate; }, 0) / (data.length || 1);
    var totalVolume = data.reduce(function(s, d) { return s + d.volume; }, 0);
    var totalOI = data.reduce(function(s, d) { return s + (d.openInterestUSD || 0); }, 0);

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
            feeAnalysis: r.feeAnalysis,
            positionAdvice: r.positionAdvice,
            openInterestUSD: r.openInterestUSD,
          };
        }),
        funding: fundingOpps.map(function(r) {
          return {
            symbol: r.symbol,
            fundingRate: r.fundingRate,
            fundingAPY: r.fundingAPY,
            fundingTrend: r.fundingTrend,
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
        triangular: triArb,
        profitableAfterFees: profitableAfterFees.slice(0, 5).map(function(r) {
          return {
            symbol: r.symbol,
            basis: r.basis,
            netROI: r.feeAnalysis.netROI,
            netProfit: r.feeAnalysis.netProfit,
            breakEvenBasis: r.feeAnalysis.breakEvenBasis,
          };
        }),
      },
      marketSummary: {
        avgBasis: parseFloat(avgBasis.toFixed(4)),
        avgFundingRate: parseFloat(avgFunding.toFixed(4)),
        totalVolume: totalVolume,
        totalOpenInterest: totalOI,
        coinsScanned: data.length,
        basisOppsCount: basisOpps.length,
        fundingOppsCount: fundingOpps.length,
        volatileCount: highVolatility.length,
        triArbCount: triArb.filter(function(t) { return t.profitable; }).length,
        profitableAfterFeesCount: profitableAfterFees.length,
        bestOpportunity: bestOpp ? { symbol: bestOpp.symbol, grade: bestOpp.riskReward.grade, ratio: bestOpp.riskReward.ratio } : null,
      },
      timestamp: new Date().toISOString(),
    };

    setCache('arbitrage', response, 15000);
    recordArbSnapshot(response);
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
      return Promise.all([
        httpGet('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=' + sym + 'USDT', { timeout: 10000, retries: 2 }),
        fetchFundingHistory(sym + 'USDT').catch(function() { return []; }),
      ]).then(function(r) {
          var json = r[0];
          var history = r[1];
          var rate = parseFloat(json.lastFundingRate);
          var grossAPY = (Math.pow(1 + rate * 3, 365) - 1) * 100;
          var netAPY = grossAPY - 0.04;
          var riskLevel = 'normal';
          if (Math.abs(rate) > 0.003) riskLevel = 'extreme';
          else if (Math.abs(rate) > 0.001) riskLevel = 'high';

          // Trend from history
          var trend = 'stable';
          if (history.length >= 3) {
            var recentRates = history.slice(-3);
            var allPositive = recentRates.every(function(h) { return h.rate > 0; });
            var allNegative = recentRates.every(function(h) { return h.rate < 0; });
            var increasing = recentRates.length >= 2 && recentRates[recentRates.length - 1].rate > recentRates[0].rate;
            if (allPositive && increasing) trend = 'rising';
            else if (allNegative && !increasing) trend = 'falling';
            else if (allPositive) trend = 'positive_stable';
            else if (allNegative) trend = 'negative_stable';
          }

          return {
            symbol: sym,
            fundingRate: rate * 100,
            markPrice: parseFloat(json.markPrice),
            indexPrice: parseFloat(json.indexPrice),
            nextFundingTime: parseInt(json.nextFundingTime),
            grossAPY: grossAPY,
            netAPY: netAPY,
            singlePayment: rate * 10000,
            monthlyYield: rate * 3 * 30 * 10000,
            riskLevel: riskLevel,
            trend: trend,
            history: history.slice(-5),
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

// ---- Arbitrage History Tracker ----
// In-memory ring buffer of arb snapshots (kept across requests, cleared on restart)
var _arbHistory = [];
var MAX_ARB_HISTORY = 48; // ~12h at 15min intervals

function recordArbSnapshot(data) {
  if (!data || !data.coins) return;
  var snapshot = {
    time: new Date().toISOString(),
    avgBasis: data.marketSummary.avgBasis,
    avgFunding: data.marketSummary.avgFundingRate,
    basisOpps: data.marketSummary.basisOppsCount,
    fundingOpps: data.marketSummary.fundingOppsCount,
    profitableCount: data.marketSummary.profitableAfterFeesCount,
    totalOI: data.marketSummary.totalOpenInterest,
    topCoins: data.coins.slice(0, 5).map(function(c) {
      return { symbol: c.symbol, basis: c.basis, fundingRate: c.fundingRate, fundingTrend: c.fundingTrend };
    }),
  };
  _arbHistory.push(snapshot);
  if (_arbHistory.length > MAX_ARB_HISTORY) _arbHistory.shift();
}

function handleArbHistory(req, res) {
  sendJSON(res, 200, {
    snapshots: _arbHistory,
    count: _arbHistory.length,
    maxHistory: MAX_ARB_HISTORY,
  });
}

module.exports = {
  handleWhaleAlert,
  handleArbitrage,
  handleFundingRate,
  handleArbHistory,
  recordArbSnapshot,
  // Exported for testing
  calculateRiskReward,
  generateStrategy,
  calculateFeeAdjustedPnL,
  calculatePositionAdvice,
  fetchOrderBookDepth,
  fetchLiquidations,
  detectTriangularArbitrage,
  fetchOpenInterest,
  fetchFundingHistory,
};
