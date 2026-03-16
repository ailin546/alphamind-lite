/**
 * AlphaMind Lite - Dashboard Application
 * CSP-compliant: no inline scripts, all event binding via addEventListener
 * Zero framework dependencies
 */

// ─── State ───────────────────────────────────────────────────────────────
let portfolio = JSON.parse(localStorage.getItem('am_portfolio') || '[]');
let alerts = JSON.parse(localStorage.getItem('am_alerts') || '[]');
let chartInstances = {};
let currentInterval = '1h';

// ─── API Helper ──────────────────────────────────────────────────────────
async function api(endpoint, opts = {}) {
  const fetchOpts = { headers: { 'Content-Type': 'application/json' } };
  if (opts.body) {
    fetchOpts.method = 'POST';
    fetchOpts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(endpoint, fetchOpts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'HTTP ' + res.status }));
    throw new Error(err.error || 'Request failed: ' + res.status);
  }
  return res.json();
}

// ─── Format Helpers ──────────────────────────────────────────────────────
const fmt = (n, d) => n != null ? Number(n).toLocaleString('en-US', { maximumFractionDigits: d != null ? d : 2 }) : '--';
const fmtPct = (n) => n != null ? (n >= 0 ? '+' : '') + Number(n).toFixed(2) + '%' : '--';
const fmtUSD = (n) => n != null ? '$' + fmt(n) : '--';

// ─── XSS-safe HTML escape ───────────────────────────────────────────────
function escapeHtml(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/\n/g, '<br>');
}

// ─── Navigation ──────────────────────────────────────────────────────────
function showPage(name) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
  document.getElementById('page-' + name).classList.add('active');
  document.querySelector('.nav-item[data-page="' + name + '"]').classList.add('active');
  document.querySelector('.sidebar').classList.remove('open');

  if (name === 'dashboard') loadDashboard();
  else if (name === 'market') { loadMarketTable(); loadMarketChart(); }
  else if (name === 'sentiment') loadSentiment();
  else if (name === 'portfolio') renderHoldings();
  else if (name === 'risk') renderAlerts();
  else if (name === 'tools') loadPaperTrades();
  else if (name === 'bsc') loadBSCData();
  else if (name === 'whale') loadWhaleData();
  else if (name === 'arb') loadArbitrageData();
}

// ─── Dashboard ───────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    var market, fg, sentiment;
    var results = await Promise.all([
      api('/api/market?symbols=BTC,ETH,BNB,SOL,XRP,DOGE,ADA,AVAX'),
      api('/api/fear-greed'),
      api('/api/sentiment'),
    ]);
    market = results[0]; fg = results[1]; sentiment = results[2];

    // Check demo mode
    checkDemoMode(market);
    checkDemoMode(fg);

    // Stats
    var btc = market.data.find(function(c) { return c.symbol === 'BTC'; });
    var eth = market.data.find(function(c) { return c.symbol === 'ETH'; });
    if (btc) {
      document.getElementById('dash-btc-price').textContent = fmtUSD(btc.price);
      var el = document.getElementById('dash-btc-change');
      el.textContent = fmtPct(btc.change24h);
      el.className = 'stat-change ' + (btc.change24h >= 0 ? 'up' : 'down');
    }
    if (eth) {
      document.getElementById('dash-eth-price').textContent = fmtUSD(eth.price);
      var el2 = document.getElementById('dash-eth-change');
      el2.textContent = fmtPct(eth.change24h);
      el2.className = 'stat-change ' + (eth.change24h >= 0 ? 'up' : 'down');
    }
    if (fg.value != null) {
      var fgEl = document.getElementById('dash-fg-value');
      fgEl.textContent = fg.value;
      fgEl.className = 'stat-value ' + (fg.value > 50 ? 'up' : fg.value < 40 ? 'down' : '');
      document.getElementById('dash-fg-text').textContent = fg.sentiment;
    }
    if (sentiment.signal) {
      var sMap = { buy: ['BUY', 'up'], sell: ['SELL', 'down'], hold: ['HOLD', ''] };
      var s = sMap[sentiment.signal] || sMap.hold;
      document.getElementById('dash-signal').textContent = s[0];
      document.getElementById('dash-signal').className = 'stat-value ' + s[1];
      document.getElementById('dash-signal-text').textContent = sentiment.analysis;
    }

    // Load technical indicators (non-blocking)
    api('/api/indicators?symbol=BTC&interval=4h').then(function(ti) {
      if (ti && ti.rsi != null) {
        document.getElementById('dash-ti-rsi').textContent = ti.rsi;
        document.getElementById('dash-ti-rsi').style.color = ti.rsi < 30 ? 'var(--up)' : ti.rsi > 70 ? 'var(--down)' : 'var(--text)';
      }
      if (ti && ti.macd) {
        document.getElementById('dash-ti-macd').textContent = ti.macd.histogram > 0 ? 'Bull' : 'Bear';
        document.getElementById('dash-ti-macd').style.color = ti.macd.histogram > 0 ? 'var(--up)' : 'var(--down)';
      }
      if (ti && ti.signal) {
        var sigEl = document.getElementById('dash-ti-signal');
        sigEl.textContent = ti.signal;
        sigEl.style.color = ti.signal === 'buy' ? 'var(--up)' : ti.signal === 'sell' ? 'var(--down)' : 'var(--warning)';
        var labels = { buy: 'Bullish setup — consider entries', sell: 'Bearish setup — exercise caution', hold: 'Neutral — wait for clearer signal' };
        document.getElementById('dash-ti-summary').textContent = labels[ti.signal] || 'Calculating...';
      }
    }).catch(function() {});

    // Market table
    var html = '';
    for (var ci = 0; ci < market.data.length; ci++) {
      var c = market.data[ci];
      if (c.error) continue;
      var cls = c.change24h >= 0 ? 'up' : 'down';
      html += '<tr>' +
        '<td><div class="coin-name"><div class="coin-icon">' + escapeHtml(c.symbol.slice(0,2)) + '</div>' + escapeHtml(c.symbol) + '</div></td>' +
        '<td>' + fmtUSD(c.price) + '</td>' +
        '<td class="' + cls + '">' + fmtPct(c.change24h) + '</td>' +
        '<td>' + fmtUSD(c.high24h) + '</td>' +
        '<td>' + fmtUSD(c.low24h) + '</td>' +
        '<td>$' + fmt(c.volume24h, 0) + '</td>' +
      '</tr>';
    }
    document.getElementById('dash-market-body').innerHTML = html;

    // BTC chart
    var klines = await api('/api/klines?symbol=BTC&interval=1h&limit=24');
    renderChart('chart-btc', {
      type: 'line',
      data: {
        labels: klines.data.map(function(k) { return new Date(k.time).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }); }),
        datasets: [{
          data: klines.data.map(function(k) { return k.close; }),
          borderColor: '#00e676',
          backgroundColor: 'rgba(0,230,118,0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 2,
        }],
      },
    });

    // Fear greed chart
    if (fg.history) {
      renderChart('chart-fg', {
        type: 'bar',
        data: {
          labels: fg.history.map(function(h) {
            var d = new Date(h.timestamp * 1000);
            return (d.getMonth()+1) + '/' + d.getDate();
          }).reverse(),
          datasets: [{
            data: fg.history.map(function(h) { return h.value; }).reverse(),
            backgroundColor: fg.history.map(function(h) {
              if (h.value <= 25) return 'rgba(255,82,82,0.7)';
              if (h.value <= 45) return 'rgba(255,171,0,0.7)';
              if (h.value <= 55) return 'rgba(255,255,255,0.3)';
              if (h.value <= 75) return 'rgba(0,176,255,0.7)';
              return 'rgba(0,230,118,0.7)';
            }).reverse(),
            borderRadius: 4,
          }],
        },
      });
    }

    document.getElementById('dash-update').textContent = 'Updated: ' + new Date().toLocaleTimeString();
  } catch (e) {
    console.error('Dashboard error:', e);
  }
}

function renderChart(canvasId, config) {
  if (chartInstances[canvasId]) chartInstances[canvasId].destroy();
  var ctx = document.getElementById(canvasId);
  if (!ctx) return;
  chartInstances[canvasId] = new Chart(ctx, {
    type: config.type,
    data: config.data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8a8f98', maxTicksLimit: 10, font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8a8f98', font: { size: 10 } } },
      },
      ...(config.options || {}),
    },
  });
}

// ─── Market Page ─────────────────────────────────────────────────────────
async function loadMarketTable() {
  try {
    var data = await api('/api/market?symbols=BTC,ETH,BNB,SOL,XRP,DOGE,ADA,AVAX,DOT,MATIC,LINK,UNI');
    checkDemoMode(data);
    var html = '';
    for (var ci = 0; ci < data.data.length; ci++) {
      var c = data.data[ci];
      if (c.error) continue;
      var cls = c.change24h >= 0 ? 'up' : 'down';
      html += '<tr>' +
        '<td><div class="coin-name"><div class="coin-icon">' + escapeHtml(c.symbol.slice(0,2)) + '</div>' + escapeHtml(c.symbol) + '</div></td>' +
        '<td>' + fmtUSD(c.price) + '</td>' +
        '<td class="' + cls + '">' + fmtPct(c.change24h) + '</td>' +
        '<td>$' + fmt(c.volume24h, 0) + '</td>' +
      '</tr>';
    }
    document.getElementById('market-table-body').innerHTML = html;
  } catch (err) {
    showToast('Failed to load market data', 'error');
    console.error('Market table error:', err);
  }
}

async function loadMarketChart() {
  try {
    var sym = document.getElementById('chart-symbol').value;
    var results = await Promise.all([
      api('/api/klines?symbol=' + sym + '&interval=' + currentInterval + '&limit=100'),
      api('/api/indicators?symbol=' + sym + '&interval=' + currentInterval).catch(function() { return null; }),
    ]);
    var klines = results[0];
    var indicators = results[1];
    checkDemoMode(klines);

    var labels = klines.data.map(function(k) {
      var d = new Date(k.time);
      return currentInterval === '1d' ? (d.getMonth()+1) + '/' + d.getDate() : d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
    });

    var candleColors = klines.data.map(function(k) { return k.close >= k.open ? 'rgba(0,230,118,0.7)' : 'rgba(255,82,82,0.7)'; });

    var closes = klines.data.map(function(k) { return k.close; });
    var sma7Data = closes.map(function(_, i) {
      if (i < 6) return null;
      var sum = closes.slice(i - 6, i + 1).reduce(function(a, b) { return a + b; }, 0);
      return sum / 7;
    });

    var datasets = [
      {
        label: sym + ' Close',
        data: closes,
        borderColor: '#00e676',
        backgroundColor: 'rgba(0,230,118,0.08)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      },
      {
        label: 'SMA(7)',
        data: sma7Data,
        borderColor: '#ffab00',
        borderWidth: 1.5,
        borderDash: [5, 3],
        pointRadius: 0,
        fill: false,
        tension: 0.3,
      },
      {
        label: 'High-Low Range',
        data: klines.data.map(function(k) { return [k.low, k.high]; }),
        borderColor: candleColors,
        backgroundColor: candleColors.map(function(c) { return c.replace('0.7', '0.15'); }),
        borderWidth: 1,
        type: 'bar',
        yAxisID: 'y',
        order: 2,
      },
      {
        label: sym + ' Volume',
        data: klines.data.map(function(k) { return k.volume; }),
        borderColor: 'rgba(0,176,255,0.3)',
        backgroundColor: 'rgba(0,176,255,0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 1,
        yAxisID: 'y1',
      },
    ];

    // Add Bollinger Bands if available
    if (indicators && indicators.bollinger) {
      var bb = indicators.bollinger;
      var bbUpper = closes.map(function() { return bb.upper; });
      var bbLower = closes.map(function() { return bb.lower; });
      datasets.push({
        label: 'BB Upper',
        data: bbUpper,
        borderColor: 'rgba(255,64,129,0.3)',
        borderWidth: 1,
        borderDash: [3, 3],
        pointRadius: 0,
        fill: false,
      });
      datasets.push({
        label: 'BB Lower',
        data: bbLower,
        borderColor: 'rgba(255,64,129,0.3)',
        borderWidth: 1,
        borderDash: [3, 3],
        pointRadius: 0,
        fill: '-1',
        backgroundColor: 'rgba(255,64,129,0.03)',
      });
    }

    renderChart('chart-market', {
      type: 'line',
      data: { labels: labels, datasets: datasets },
      options: {
        scales: {
          y1: { position: 'right', grid: { display: false }, ticks: { color: '#8a8f98', font: { size: 10 } } },
        },
      },
    });

    // Show indicators summary under chart
    if (indicators && indicators.rsi != null) {
      var infoHtml = '<div style="display:flex;gap:16px;margin-top:8px;font-size:0.85em;color:var(--text-dim)">';
      infoHtml += '<span>RSI: <strong style="color:' + (indicators.rsi < 30 ? 'var(--up)' : indicators.rsi > 70 ? 'var(--down)' : 'var(--text)') + '">' + indicators.rsi + '</strong></span>';
      if (indicators.macd) infoHtml += '<span>MACD: <strong style="color:' + (indicators.macd.histogram > 0 ? 'var(--up)' : 'var(--down)') + '">' + (indicators.macd.histogram > 0 ? 'Bullish' : 'Bearish') + '</strong></span>';
      if (indicators.signal) infoHtml += '<span>Signal: <strong style="color:' + (indicators.signal === 'buy' ? 'var(--up)' : indicators.signal === 'sell' ? 'var(--down)' : 'var(--warning)') + '">' + indicators.signal.toUpperCase() + '</strong></span>';
      if (indicators.bollinger) infoHtml += '<span>BB: ' + fmtUSD(indicators.bollinger.lower) + ' — ' + fmtUSD(indicators.bollinger.upper) + '</span>';
      infoHtml += '</div>';
      var chartCard = document.getElementById('chart-market').closest('.card');
      var infoEl = chartCard.querySelector('.chart-indicators');
      if (!infoEl) { infoEl = document.createElement('div'); infoEl.className = 'chart-indicators'; chartCard.appendChild(infoEl); }
      infoEl.innerHTML = infoHtml;
    }

  } catch (err) {
    showToast('Failed to load chart data', 'error');
    console.error('Market chart error:', err);
  }
}

function setChartInterval(btn, interval) {
  document.querySelectorAll('#page-market .tab').forEach(function(t) { t.classList.remove('active'); });
  btn.classList.add('active');
  currentInterval = interval;
  loadMarketChart();
}

// ─── Portfolio ───────────────────────────────────────────────────────────
function addHolding() {
  var symbol = document.getElementById('pf-symbol').value;
  var amount = parseFloat(document.getElementById('pf-amount').value);
  var avgPrice = parseFloat(document.getElementById('pf-price').value);
  if (!amount || !avgPrice) { showToast('Please fill in all fields', 'error'); return; }

  var existing = portfolio.find(function(h) { return h.symbol === symbol; });
  if (existing) {
    var totalQty = existing.amount + amount;
    existing.avgPrice = (existing.amount * existing.avgPrice + amount * avgPrice) / totalQty;
    existing.amount = totalQty;
  } else {
    portfolio.push({ symbol: symbol, amount: amount, avgPrice: avgPrice });
  }
  savePortfolio();
  renderHoldings();
  document.getElementById('pf-amount').value = '';
  document.getElementById('pf-price').value = '';
}

function removeHolding(idx) {
  portfolio.splice(idx, 1);
  savePortfolio();
  renderHoldings();
}

function savePortfolio() {
  localStorage.setItem('am_portfolio', JSON.stringify(portfolio));
}

function renderHoldings() {
  var el = document.getElementById('pf-holdings');
  if (portfolio.length === 0) {
    el.innerHTML = '<div class="loading">No holdings yet. Add coins above.</div>';
    return;
  }
  var html = '';
  portfolio.forEach(function(h, i) {
    html += '<div class="holding-row">' +
      '<div class="coin-icon">' + h.symbol.slice(0,2) + '</div>' +
      '<div style="flex:1"><strong>' + h.symbol + '</strong></div>' +
      '<div style="flex:1">Amount: ' + h.amount + '</div>' +
      '<div style="flex:1">Avg: $' + fmt(h.avgPrice) + '</div>' +
      '<div style="flex:1">Cost: $' + fmt(h.amount * h.avgPrice) + '</div>' +
      '<div class="holding-actions">' +
        '<button class="btn-sm" data-remove-holding="' + i + '">Remove</button>' +
      '</div>' +
    '</div>';
  });
  el.innerHTML = html;
}

async function analyzePortfolio() {
  if (portfolio.length === 0) { showToast('Add holdings first', 'error'); return; }
  try {
  var result = await api('/api/portfolio', { body: { holdings: portfolio } });

  document.getElementById('pf-summary').style.display = 'grid';
  document.getElementById('pf-total-value').textContent = fmtUSD(result.totalValue);
  document.getElementById('pf-total-cost').textContent = fmtUSD(result.totalCost);

  var pnlEl = document.getElementById('pf-total-pnl');
  pnlEl.textContent = fmtUSD(result.totalPnl);
  pnlEl.className = 'pf-card-value ' + (result.totalPnl >= 0 ? 'up' : 'down');

  var pctEl = document.getElementById('pf-total-pct');
  pctEl.textContent = fmtPct(result.totalPnlPercent);
  pctEl.className = 'pf-card-value ' + (result.totalPnlPercent >= 0 ? 'up' : 'down');

  // Holdings with live data
  var html = '';
  for (var hi = 0; hi < result.holdings.length; hi++) {
    var h = result.holdings[hi];
    if (h.error) continue;
    var cls = h.pnl >= 0 ? 'up' : 'down';
    html += '<div class="holding-row">' +
      '<div class="coin-icon">' + h.symbol.slice(0,2) + '</div>' +
      '<div style="flex:1"><strong>' + h.symbol + '</strong><br><small style="color:var(--text-dim)">$' + fmt(h.price) + '</small></div>' +
      '<div style="flex:1">Amount<br><strong>' + h.amount + '</strong></div>' +
      '<div style="flex:1">Value<br><strong>' + fmtUSD(h.value) + '</strong></div>' +
      '<div style="flex:1" class="' + cls + '">P&amp;L<br><strong>' + fmtUSD(h.pnl) + ' (' + fmtPct(h.pnlPercent) + ')</strong></div>' +
    '</div>';
  }
  document.getElementById('pf-holdings').innerHTML = html;

  // Advice
  var advEl = document.getElementById('pf-advice');
  advEl.style.display = 'block';
  advEl.innerHTML = '<strong>AI Advice:</strong> ' + escapeHtml(result.advice) + '<br><small>BTC allocation: ' + fmt(result.btcRatio, 1) + '% | Diversification: ' + escapeHtml(result.diversification) + '</small>';

  // Pie chart
  document.getElementById('pf-chart-card').style.display = 'block';
  renderChart('chart-portfolio', {
    type: 'doughnut',
    data: {
      labels: result.holdings.filter(function(h) { return !h.error; }).map(function(h) { return h.symbol; }),
      datasets: [{
        data: result.holdings.filter(function(h) { return !h.error; }).map(function(h) { return h.value; }),
        backgroundColor: ['#00e676', '#00b0ff', '#ff4081', '#ffab00', '#7c4dff', '#ff6e40', '#69f0ae', '#40c4ff'],
        borderWidth: 0,
      }],
    },
    options: {
      plugins: { legend: { display: true, position: 'right', labels: { color: '#e8eaed' } } },
    },
  });
  } catch (err) { showToast('Portfolio analysis failed: ' + err.message, 'error'); }
}

// ─── Sentiment ───────────────────────────────────────────────────────────
async function loadSentiment() {
  var fg = {}, sentiment = {}, corr = {};
  try {
    var results = await Promise.all([
      api('/api/fear-greed').catch(function() { return {}; }),
      api('/api/sentiment').catch(function() { return {}; }),
      api('/api/correlation').catch(function() { return {}; }),
    ]);
    fg = results[0]; sentiment = results[1]; corr = results[2];
  } catch (e) { console.error('Sentiment error:', e); return; }

  // Fear gauge
  if (fg.value != null) {
    var v = fg.value;
    document.getElementById('fg-value').textContent = v;
    document.getElementById('fg-value').className = 'gauge-value ' + (v > 55 ? 'up' : v < 45 ? 'down' : '');
    document.getElementById('fg-text').textContent = fg.sentiment;
    document.getElementById('fg-pointer').style.left = v + '%';
    document.getElementById('fg-advice').textContent = fg.advice;

    // Chart
    if (fg.history) {
      renderChart('chart-fg-detail', {
        type: 'line',
        data: {
          labels: fg.history.map(function(h) {
            var d = new Date(h.timestamp * 1000);
            return (d.getMonth()+1) + '/' + d.getDate();
          }).reverse(),
          datasets: [{
            data: fg.history.map(function(h) { return h.value; }).reverse(),
            borderColor: '#ffab00',
            backgroundColor: 'rgba(255,171,0,0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 2,
            borderWidth: 2,
          }],
        },
      });
    }
  }

  // Sentiment details
  if (sentiment) {
    var signalCls = { buy: 'signal-buy', sell: 'signal-sell', hold: 'signal-hold' };
    var signalText = { buy: 'BUY', sell: 'SELL', hold: 'HOLD' };
    document.getElementById('sentiment-details').innerHTML =
      '<div style="margin-bottom:16px">' +
        '<div style="font-size:0.85em;color:var(--text-dim);margin-bottom:4px">Market Signal</div>' +
        '<span class="signal ' + (signalCls[sentiment.signal] || 'signal-hold') + '">' + (signalText[sentiment.signal] || 'HOLD') + '</span>' +
      '</div>' +
      '<div style="margin-bottom:12px">' +
        '<div style="font-size:0.85em;color:var(--text-dim);margin-bottom:4px">Fear &amp; Greed</div>' +
        '<strong>' + sentiment.fearGreed + '/100</strong>' +
      '</div>' +
      '<div style="margin-bottom:12px">' +
        '<div style="font-size:0.85em;color:var(--text-dim);margin-bottom:4px">BTC Trend (24h)</div>' +
        '<strong class="' + (sentiment.btcTrend === 'up' ? 'up' : 'down') + '">' + (sentiment.btcTrend === 'up' ? 'Uptrend' : 'Downtrend') + '</strong>' +
        (sentiment.btcPrice ? '<br><small>Price: $' + fmt(sentiment.btcPrice) + ' | Avg: $' + fmt(sentiment.btcAvg) + '</small>' : '') +
      '</div>' +
      '<div class="advice-box">' + escapeHtml(sentiment.analysis || '') + '</div>';
  }

  // Correlation
  if (corr.correlations) {
    var html = '';
    for (var ci = 0; ci < corr.correlations.length; ci++) {
      var c = corr.correlations[ci];
      var pct = c.correlation != null ? Math.abs(c.correlation) * 100 : 0;
      var color = c.level === 'very_high' ? '#ff5252' : c.level === 'high' ? '#ff9800' : c.level === 'moderate' ? '#ffeb3b' : c.level === 'low' ? '#00e676' : '#00b0ff';
      html += '<div class="corr-item">' +
        '<div><strong>' + escapeHtml(c.symbol) + '</strong><br><small style="color:var(--text-dim)">' + (c.correlation != null ? c.correlation.toFixed(3) : 'N/A') + '</small></div>' +
        '<div class="corr-bar"><div class="corr-fill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
      '</div>';
    }
    document.getElementById('corr-grid').innerHTML = html;
  }
}

// ─── Risk ────────────────────────────────────────────────────────────────
async function calculateRisk() {
  var symbol = document.getElementById('risk-symbol').value;
  var quantity = parseFloat(document.getElementById('risk-qty').value);
  var entryPrice = parseFloat(document.getElementById('risk-entry').value);
  var leverage = parseInt(document.getElementById('risk-leverage').value);

  var r;
  try { r = await api('/api/risk', { body: { symbol: symbol, quantity: quantity, entryPrice: entryPrice, leverage: leverage } }); }
  catch (err) { document.getElementById('risk-result').innerHTML = '<div class="loading" style="color:var(--down)">' + escapeHtml(err.message) + '</div>'; return; }
  if (r.error) { document.getElementById('risk-result').innerHTML = '<div class="loading">' + escapeHtml(r.error) + '</div>'; return; }

  var riskColors = { safe: 'risk-safe', warning: 'risk-warning', danger: 'risk-danger', liquidated: 'risk-danger' };
  var pnlCls = r.pnlAmount >= 0 ? 'up' : 'down';

  document.getElementById('risk-result').innerHTML =
    '<div class="card-title">' + t('risk.result') + '</div>' +
    '<div class="risk-meter" style="margin-bottom:16px;font-size:1.2em">' +
      '<div class="risk-dot ' + riskColors[r.riskRating] + '"></div>' +
      t('risk.' + r.riskRating) +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
      '<div><small style="color:var(--text-dim)">' + t('risk.currentPrice') + '</small><br><strong>' + fmtUSD(r.currentPrice) + '</strong></div>' +
      '<div><small style="color:var(--text-dim)">' + t('risk.positionValue') + '</small><br><strong>' + fmtUSD(r.currentValue) + '</strong></div>' +
      '<div><small style="color:var(--text-dim)">' + t('risk.initialMargin') + '</small><br><strong>' + fmtUSD(r.initialMargin) + '</strong></div>' +
      '<div class="' + pnlCls + '"><small style="color:var(--text-dim)">' + t('risk.unrealizedPnl') + '</small><br><strong>' + fmtUSD(r.pnlAmount) + ' (' + fmtPct(r.pnlPercentage) + ')</strong></div>' +
      '<div><small style="color:var(--text-dim)">' + t('risk.liquidationPrice') + '</small><br><strong style="color:var(--accent)">' + fmtUSD(r.liquidationPrice) + '</strong></div>' +
      '<div><small style="color:var(--text-dim)">' + t('risk.distanceToLiq') + '</small><br><strong>' + fmt(r.liquidationDistance) + '%</strong></div>' +
    '</div>' +
    '<div class="advice-box" style="margin-top:16px">' +
      (r.riskRating === 'safe' ? t('risk.adviceSafe') :
        r.riskRating === 'warning' ? t('risk.adviceWarning') :
        t('risk.adviceDanger')) +
    '</div>';
}

function resetRisk() {
  document.getElementById('risk-symbol').selectedIndex = 0;
  document.getElementById('risk-qty').value = '0.5';
  document.getElementById('risk-entry').value = '70000';
  document.getElementById('risk-leverage').value = '10';
  document.getElementById('risk-result').innerHTML =
    '<div class="card-title">' + t('risk.result') + '</div>' +
    '<div class="loading">' + t('risk.inputHint') + '</div>';
}

// Price alerts
function addAlert() {
  var symbol = document.getElementById('alert-symbol').value;
  var price = parseFloat(document.getElementById('alert-price').value);
  var direction = document.getElementById('alert-dir').value;
  if (!price) { showToast('Enter target price', 'error'); return; }
  alerts.push({ symbol: symbol, price: price, direction: direction, created: Date.now(), triggered: false });
  localStorage.setItem('am_alerts', JSON.stringify(alerts));
  renderAlerts();
  document.getElementById('alert-price').value = '';
}

function removeAlert(idx) {
  alerts.splice(idx, 1);
  localStorage.setItem('am_alerts', JSON.stringify(alerts));
  renderAlerts();
}

function renderAlerts() {
  var el = document.getElementById('alerts-list');
  if (alerts.length === 0) { el.innerHTML = '<div style="padding:12px;color:var(--text-dim)">No alerts configured</div>'; return; }
  var html = '';
  alerts.forEach(function(a, i) {
    html += '<div class="holding-row">' +
      '<div class="coin-icon">' + a.symbol.slice(0,2) + '</div>' +
      '<div style="flex:1"><strong>' + a.symbol + '</strong></div>' +
      '<div style="flex:1">' + (a.direction === 'above' ? 'Above' : 'Below') + ' $' + fmt(a.price) + '</div>' +
      '<div style="flex:1"><small>' + new Date(a.created).toLocaleDateString() + '</small></div>' +
      '<button class="btn-sm" data-remove-alert="' + i + '">Remove</button>' +
    '</div>';
  });
  el.innerHTML = html;
}

// ─── DCA Calculator ─────────────────────────────────────────────────────
async function calcDCA() {
  var symbol = document.getElementById('dca-symbol').value;
  var monthlyAmount = parseFloat(document.getElementById('dca-amount').value);
  var months = parseInt(document.getElementById('dca-months').value);

  var r;
  try { r = await api('/api/dca', { body: { symbol: symbol, monthlyAmount: monthlyAmount, months: months } }); }
  catch (err) { document.getElementById('dca-result').innerHTML = '<p style="color:var(--down)">' + escapeHtml(err.message) + '</p>'; return; }
  if (r.error) { document.getElementById('dca-result').innerHTML = '<p>' + escapeHtml(r.error) + '</p>'; return; }

  var profitCls = r.profit >= 0 ? 'up' : 'down';
  document.getElementById('dca-result').innerHTML =
    '<div class="dca-result">' +
      '<div class="dca-item"><div class="dca-item-label">' + t('tools.totalInvested') + '</div><div class="dca-item-value">' + fmtUSD(r.totalInvested) + '</div></div>' +
      '<div class="dca-item"><div class="dca-item-label">' + t('tools.coinsAccumulated') + '</div><div class="dca-item-value">' + r.totalCoins.toFixed(6) + '</div></div>' +
      '<div class="dca-item"><div class="dca-item-label">' + t('tools.currentValue') + '</div><div class="dca-item-value">' + fmtUSD(r.currentValue) + '</div></div>' +
      '<div class="dca-item"><div class="dca-item-label">' + t('tools.currentPrice') + '</div><div class="dca-item-value">' + fmtUSD(r.currentPrice) + '</div></div>' +
      '<div class="dca-item"><div class="dca-item-label">' + t('tools.profit') + '</div><div class="dca-item-value ' + profitCls + '">' + fmtUSD(r.profit) + '</div></div>' +
      '<div class="dca-item"><div class="dca-item-label">' + t('tools.roi') + '</div><div class="dca-item-value ' + profitCls + '">' + fmtPct(r.profitPercent) + '</div></div>' +
    '</div>' +
    '<div class="advice-box" style="margin-top:12px">' +
      (currentLang === 'zh'
        ? '定投策略: 每月投入 $' + monthlyAmount + '，持续 ' + months + ' 个月，按当前 ' + symbol + ' 价格计算。定期投资可以降低择时风险，平滑市场波动。'
        : 'DCA Strategy: Investing $' + monthlyAmount + '/month for ' + months + ' months at current ' + symbol + ' price. Regular investment reduces timing risk and smooths out volatility.') +
    '</div>';
}

// ─── PnL Calculator ─────────────────────────────────────────────────────
function calcPnL() {
  var buy = parseFloat(document.getElementById('calc-buy').value);
  var sell = parseFloat(document.getElementById('calc-sell').value);
  var qty = parseFloat(document.getElementById('calc-qty').value);
  if (!buy || !sell || !qty) { showToast('Fill all fields', 'error'); return; }

  var profit = (sell - buy) * qty;
  var pct = ((sell - buy) / buy) * 100;
  var cls = profit >= 0 ? 'up' : 'down';
  document.getElementById('calc-result').innerHTML =
    '<div class="dca-result" style="grid-template-columns:repeat(3,1fr)">' +
      '<div class="dca-item"><div class="dca-item-label">' + t('tools.cost') + '</div><div class="dca-item-value">' + fmtUSD(buy * qty) + '</div></div>' +
      '<div class="dca-item"><div class="dca-item-label">' + t('tools.revenue') + '</div><div class="dca-item-value">' + fmtUSD(sell * qty) + '</div></div>' +
      '<div class="dca-item"><div class="dca-item-label">' + t('tools.profitLoss') + '</div><div class="dca-item-value ' + cls + '">' + fmtUSD(profit) + ' (' + fmtPct(pct) + ')</div></div>' +
    '</div>';
}

// ─── Paper Trading ────────────────────────────────────────────────────────
async function paperTrade(side) {
  var symbol = document.getElementById('paper-symbol').value;
  var qty = parseFloat(document.getElementById('paper-qty').value);
  if (!qty || qty <= 0) { showToast('Enter a valid quantity', 'error'); return; }

  try {
    var r = await api('/api/paper-trade', { body: { symbol: symbol, side: side, quantity: qty } });
    document.getElementById('paper-balance').textContent = fmtUSD(r.balance);
    document.getElementById('paper-result').innerHTML = '<div style="padding:8px;border-radius:8px;background:' + (side === 'buy' ? 'rgba(0,230,118,0.1)' : 'rgba(255,82,82,0.1)') + '">' + side.toUpperCase() + ' ' + qty + ' ' + symbol + ' @ ' + fmtUSD(r.trade.price) + ' = ' + fmtUSD(r.trade.cost) + '</div>';
    showToast('Paper ' + side + ': ' + qty + ' ' + symbol, side === 'buy' ? 'success' : 'warning');
    loadPaperTrades();
  } catch (err) {
    showToast('Trade failed: ' + err.message, 'error');
  }
}

async function loadPaperTrades() {
  try {
    var r = await api('/api/paper-trade');
    document.getElementById('paper-balance').textContent = fmtUSD(r.balance);
    if (r.trades.length === 0) {
      document.getElementById('paper-trades').innerHTML = 'No trades yet — start trading!';
      return;
    }
    document.getElementById('paper-trades').innerHTML = r.trades.slice(-10).reverse().map(function(t) {
      return '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border)">' +
        '<span class="' + (t.side === 'buy' ? 'up' : 'down') + '" style="font-weight:600">' + t.side.toUpperCase() + '</span>' +
        '<span>' + t.quantity + ' ' + escapeHtml(t.symbol) + '</span>' +
        '<span>' + fmtUSD(t.price) + '</span>' +
        '<span style="color:var(--text-dim)">' + new Date(t.createdAt).toLocaleTimeString() + '</span>' +
      '</div>';
    }).join('');
  } catch (e) { /* ignore */ }
}

async function resetPaperTrading() {
  try {
    await api('/api/paper-trade/reset', { body: {} });
    document.getElementById('paper-balance').textContent = '$10,000.00';
    document.getElementById('paper-trades').innerHTML = 'No trades yet — start trading!';
    document.getElementById('paper-result').innerHTML = '';
    showToast('Paper trading reset to $10,000', 'success');
  } catch (err) {
    showToast('Reset failed', 'error');
  }
}

// ─── BSC Chain Data ──────────────────────────────────────────────────────
async function loadBSCData() {
  try {
    var results = await Promise.all([
      api('/api/bsc'),
      api('/api/indicators?symbol=BTC&interval=4h'),
    ]);
    var bsc = results[0];
    var indicators = results[1];

    // BNB stats
    if (bsc.bnb) {
      document.getElementById('bsc-bnb-price').textContent = fmtUSD(bsc.bnb.price);
      var changeEl = document.getElementById('bsc-bnb-change');
      changeEl.textContent = fmtPct(bsc.bnb.change24h);
      changeEl.className = 'stat-change ' + (bsc.bnb.change24h >= 0 ? 'up' : 'down');
    }
    if (bsc.gas) {
      document.getElementById('bsc-gas').textContent = bsc.gas.low + ' / ' + bsc.gas.standard + ' / ' + bsc.gas.fast;
    }
    if (bsc.bnb && bsc.bnb.marketCap) {
      document.getElementById('bsc-mcap').textContent = '$' + fmt(bsc.bnb.marketCap / 1e9, 1) + 'B';
      if (bsc.bnb.circulatingSupply) document.getElementById('bsc-supply').textContent = 'Circulating: ' + fmt(bsc.bnb.circulatingSupply, 0) + ' BNB';
    }
    if (bsc.bnb && bsc.bnb.stakingAPY) {
      document.getElementById('bsc-staking-apy').textContent = bsc.bnb.stakingAPY + '%';
    }
    if (bsc.bnb && bsc.bnb.burnedTotal) {
      document.getElementById('bsc-burned').textContent = fmt(bsc.bnb.burnedTotal, 0) + ' BNB';
      document.getElementById('bsc-burn-pct').textContent = bsc.bnb.burnRatePercent + '% of original supply burned';
    }
    if (bsc.defi) {
      document.getElementById('bsc-defi-count').textContent = fmt(bsc.defi.totalProtocols, 0) + '+';
      document.getElementById('bsc-top-defi').textContent = bsc.defi.topProtocols.join(', ');
      if (bsc.defi.tvlEstimate) document.getElementById('bsc-tvl').textContent = bsc.defi.tvlEstimate;
    }
    if (bsc.stats) {
      if (bsc.stats.totalTransactions) document.getElementById('bsc-total-tx').textContent = bsc.stats.totalTransactions;
      if (bsc.stats.uniqueAddresses) document.getElementById('bsc-unique-addr').textContent = bsc.stats.uniqueAddresses;
    }

    // Ecosystem tokens
    if (bsc.ecosystem && bsc.ecosystem.length > 0) {
      var tbody = document.getElementById('bsc-tokens-body');
      tbody.innerHTML = bsc.ecosystem.map(function(t) {
        return '<tr>' +
          '<td><span class="coin-name"><span class="coin-icon">' + escapeHtml(t.symbol.charAt(0)) + '</span>' + escapeHtml(t.symbol) + '</span></td>' +
          '<td>' + fmtUSD(t.price) + '</td>' +
          '<td class="' + (t.change24h >= 0 ? 'up' : 'down') + '">' + fmtPct(t.change24h) + '</td>' +
        '</tr>';
      }).join('');
    }

    // Technical indicators
    if (indicators && indicators.rsi != null) {
      document.getElementById('ti-rsi').textContent = indicators.rsi;
      var rsiLabel = document.getElementById('ti-rsi-label');
      if (indicators.rsi < 30) { rsiLabel.textContent = 'Oversold'; rsiLabel.className = 'stat-change up'; }
      else if (indicators.rsi > 70) { rsiLabel.textContent = 'Overbought'; rsiLabel.className = 'stat-change down'; }
      else { rsiLabel.textContent = 'Neutral'; rsiLabel.className = 'stat-change'; }
    }
    if (indicators && indicators.macd) {
      document.getElementById('ti-macd').textContent = indicators.macd.histogram > 0 ? 'Bullish' : 'Bearish';
      document.getElementById('ti-macd-label').textContent = 'Histogram: ' + indicators.macd.histogram;
      document.getElementById('ti-macd-label').className = 'stat-change ' + (indicators.macd.histogram > 0 ? 'up' : 'down');
    }
    if (indicators && indicators.signal) {
      var sigEl = document.getElementById('ti-signal');
      sigEl.textContent = indicators.signal;
      sigEl.style.color = indicators.signal === 'buy' ? 'var(--up)' : indicators.signal === 'sell' ? 'var(--down)' : 'var(--warning)';
      document.getElementById('ti-strength').textContent = 'Strength: ' + (indicators.strength || 0);
    }
    if (indicators && indicators.bollinger) {
      var bb2 = indicators.bollinger;
      document.getElementById('ti-bollinger').innerHTML = '<strong>Bollinger Bands (20):</strong> Lower: ' + fmtUSD(bb2.lower) + ' | Middle: ' + fmtUSD(bb2.middle) + ' | Upper: ' + fmtUSD(bb2.upper);
    }

    checkDemoMode(bsc);
  } catch (err) {
    showToast('Failed to load BSC data: ' + err.message, 'error');
  }
}

// ─── AI Chat ─────────────────────────────────────────────────────────────
var _chatSending = false;
async function sendChat() {
  if (_chatSending) return;
  var input = document.getElementById('chat-input');
  var msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  _chatSending = true;

  var messagesEl = document.getElementById('chat-messages');
  messagesEl.insertAdjacentHTML('beforeend', '<div class="chat-msg user">' + escapeHtml(msg) + '</div>');
  messagesEl.insertAdjacentHTML('beforeend', '<div class="chat-msg ai" id="chat-loading"><div class="spinner" style="display:inline-block;width:16px;height:16px;margin-right:8px;vertical-align:middle"></div>Thinking...</div>');
  messagesEl.scrollTop = messagesEl.scrollHeight;

  try {
    var r = await api('/api/ai-chat', { body: { message: msg } });
    var loadingEl = document.getElementById('chat-loading');
    if (loadingEl) loadingEl.remove();
    messagesEl.insertAdjacentHTML('beforeend', '<div class="chat-msg ai">' + escapeHtml(r.reply) + '</div>');
  } catch (e) {
    var loadingEl2 = document.getElementById('chat-loading');
    if (loadingEl2) loadingEl2.remove();
    messagesEl.insertAdjacentHTML('beforeend', '<div class="chat-msg ai" style="border-color:var(--accent)">Sorry, an error occurred. Please try again.</div>');
  }
  messagesEl.scrollTop = messagesEl.scrollHeight;
  _chatSending = false;
}

function sendQuick(msg) {
  document.getElementById('chat-input').value = msg;
  sendChat();
}

// ─── Toast Notifications ─────────────────────────────────────────────────
function showToast(message, type, duration) {
  type = type || 'success';
  duration = duration || 4000;
  var container = document.getElementById('toast-container');
  var toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(function() { toast.style.opacity = '0'; setTimeout(function() { toast.remove(); }, 300); }, duration);
}

// ─── SSE Connection + Alert Listener ──────────────────────────────────────
var sseSource = null;
function connectSSE() {
  if (sseSource) sseSource.close();
  sseSource = new EventSource('/api/stream');
  sseSource.addEventListener('connected', function() { /* connected */ });
  sseSource.addEventListener('prices', function(e) {
    try {
      var data = JSON.parse(e.data);
      var flashPrice = function(el, newVal, oldVal) {
        if (!el || oldVal === undefined) return;
        el.textContent = fmtUSD(newVal);
        var cls = newVal > oldVal ? 'price-flash-up' : newVal < oldVal ? 'price-flash-down' : '';
        if (cls) { el.classList.remove('price-flash-up','price-flash-down'); void el.offsetWidth; el.classList.add(cls); }
      };
      var btc = data.find(function(d) { return d.symbol === 'BTC'; });
      var eth = data.find(function(d) { return d.symbol === 'ETH'; });
      if (btc) {
        var el = document.getElementById('dash-btc-price');
        if (el) flashPrice(el, btc.price, parseFloat(el.textContent.replace(/[$,]/g, '')));
      }
      if (eth) {
        var el2 = document.getElementById('dash-eth-price');
        if (el2) flashPrice(el2, eth.price, parseFloat(el2.textContent.replace(/[$,]/g, '')));
      }
      data.forEach(function(d) {
        var rows = document.querySelectorAll('#market-table-body tr');
        rows.forEach(function(row) {
          var nameEl = row.querySelector('.coin-name');
          if (nameEl && nameEl.textContent.includes(d.symbol)) {
            var cells = row.querySelectorAll('td');
            if (cells[1]) flashPrice(cells[1], d.price, parseFloat(cells[1].textContent.replace(/[$,]/g, '')));
            if (cells[2]) { cells[2].textContent = fmtPct(d.change); cells[2].className = d.change >= 0 ? 'up' : 'down'; }
          }
        });
      });
    } catch (ex) { /* ignore */ }
  });
  sseSource.addEventListener('alert', function(e) {
    try {
      var alertsData = JSON.parse(e.data);
      alertsData.forEach(function(a) {
        var msg = 'Alert: ' + a.symbol + ' is ' + a.direction + ' $' + fmt(a.price) + ' (now $' + fmt(a.currentPrice) + ')';
        showToast(msg, 'alert', 10000);
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('AlphaMind Alert', { body: msg, icon: '/favicon.ico' });
        }
      });
    } catch (ex) { /* ignore */ }
  });
  sseSource.onerror = function() { setTimeout(connectSSE, 5000); };
}

// Request notification permission
if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
  Notification.requestPermission();
}

// ─── Demo Mode Detection ──────────────────────────────────────────────────
var isDemoMode = false;
function checkDemoMode(response) {
  var indicator = document.getElementById('data-status-indicator');
  if (response && (response.demo || response.degraded)) {
    if (!isDemoMode) {
      isDemoMode = true;
      document.getElementById('demo-banner').classList.add('active');
    }
    if (indicator) { indicator.className = 'live-indicator show demo'; indicator.innerHTML = '<span class="status-dot demo"></span>Demo'; }
  } else if (response && !isDemoMode) {
    if (indicator) { indicator.className = 'live-indicator show live'; indicator.innerHTML = '<span class="status-dot live"></span>Live'; }
  }
}

// ─── Welcome Screen ───────────────────────────────────────────────────────
function showWelcome() {
  if (localStorage.getItem('am_welcomed')) return;
  var overlay = document.createElement('div');
  overlay.className = 'welcome-overlay';
  var card = document.createElement('div');
  card.className = 'welcome-card';
  card.innerHTML =
    '<h2>Welcome to AlphaMind Lite</h2>' +
    '<p>Your AI-powered crypto trading assistant</p>' +
    '<div class="features">' +
      '<div>📊 Real-time Market Data</div>' +
      '<div>🛡️ Risk Calculator</div>' +
      '<div>📈 Portfolio Tracking</div>' +
      '<div>🤖 AI Chat Assistant</div>' +
      '<div>😱 Fear &amp; Greed Index</div>' +
      '<div>💰 DCA Simulator</div>' +
    '</div>' +
    '<p style="color:var(--text);margin-top:12px">Start by exploring the <strong>Dashboard</strong> or add coins to your <strong>Portfolio</strong></p>';
  var btn = document.createElement('button');
  btn.className = 'btn';
  btn.style.cssText = 'margin-top:16px;padding:10px 32px;font-size:1em;cursor:pointer;background:var(--primary);color:#000;border:none;border-radius:8px;font-weight:600';
  btn.textContent = 'Get Started';
  btn.addEventListener('click', function() {
    overlay.remove();
    localStorage.setItem('am_welcomed', '1');
  });
  card.appendChild(btn);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

// ─── Whale Tracking ──────────────────────────────────────────────────────
async function loadWhaleData() {
  var content = document.getElementById('whale-content');
  if (!content) return;
  try {
    var data = await api('/api/whale');
    _whaleData = data; // Cache for sorting/export

    // Summary stats
    var el;
    el = document.getElementById('whale-btc-price');
    if (el) el.textContent = fmtUSD(data.btcPrice);
    el = document.getElementById('whale-btc-change');
    if (el) { el.textContent = fmtPct(data.btcChange); el.className = 'stat-change ' + (data.btcChange >= 0 ? 'up' : 'down'); }
    el = document.getElementById('whale-volume');
    if (el) el.textContent = data.volume24h > 1e9 ? '$' + (data.volume24h / 1e9).toFixed(1) + 'B' : fmtUSD(data.volume24h);
    el = document.getElementById('whale-trade-count');
    if (el) el.textContent = data.summary.tradeCount;
    el = document.getElementById('whale-sentiment');
    if (el) {
      var sentMap = { bullish: ['Bullish', 'up'], bearish: ['Bearish', 'down'], neutral: ['Neutral', ''] };
      var sm = sentMap[data.summary.sentiment] || sentMap.neutral;
      el.textContent = t('whale.' + data.summary.sentiment) || sm[0];
      el.className = 'stat-value ' + sm[1];
    }

    // Pressure bar
    var pressure = document.getElementById('whale-pressure');
    if (pressure) {
      var buyPct = data.summary.buyRatio || 50;
      var sellPct = data.summary.sellRatio || 50;
      pressure.innerHTML = '<div class="pressure-bar">' +
        '<div class="buy-bar" style="width:' + buyPct.toFixed(1) + '%">' + t('whale.buy') + ' ' + buyPct.toFixed(1) + '%</div>' +
        '<div class="sell-bar" style="width:' + sellPct.toFixed(1) + '%">' + t('whale.sell') + ' ' + sellPct.toFixed(1) + '%</div>' +
        '</div>';
    }

    // Large trades table (using shared render function)
    renderWhaleTradesTable(data.largeTrades);

    // Update trade count with tier info
    el = document.getElementById('whale-trade-count');
    if (el) {
      el.textContent = data.summary.tradeCount;
      if (data.summary.tier500k > 0) {
        el.insertAdjacentHTML('afterend', '<div class="stat-change" style="color:var(--text-dim);font-size:0.7em">' +
          (data.summary.tier500k > 0 ? '>$500K: ' + data.summary.tier500k : '') +
          (data.summary.tier100k > 0 ? ' | >$100K: ' + data.summary.tier100k : '') + '</div>');
      }
    }

    // On-chain transactions
    var onchainBody = document.getElementById('whale-onchain-body');
    var blockHeight = document.getElementById('whale-block-height');
    var blockHash = document.getElementById('whale-block-hash');
    if (data.onchain) {
      if (blockHeight) blockHeight.textContent = '#' + fmt(data.onchain.blockHeight, 0);
      if (blockHash) blockHash.textContent = data.onchain.blockHash;
    }
    if (onchainBody && data.onchain) {
      if (data.onchain.transactions.length === 0) {
        onchainBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-dim)">' + t('whale.noOnchain') + '</td></tr>';
      } else {
        onchainBody.innerHTML = data.onchain.transactions.map(function(tx) {
          var fullHash = tx.hash.replace('...', '');
          return '<tr>' +
            '<td style="font-family:monospace;font-size:0.85em"><a href="https://blockchain.info/tx/' + escapeHtml(fullHash) + '" target="_blank" rel="noopener" style="color:var(--secondary);text-decoration:none" title="' + t('whale.viewOnChain') + '">' + escapeHtml(tx.hash) + ' ↗</a></td>' +
            '<td style="font-weight:600">' + fmt(tx.btc, 2) + ' BTC</td>' +
            '<td>' + fmtUSD(tx.usd) + '</td>' +
            '<td><span class="whale-badge ' + tx.size + '">' + tx.size + '</span></td>' +
            '<td>' + (tx.time ? new Date(tx.time).toLocaleTimeString() : '--') + '</td>' +
            '</tr>';
        }).join('');
      }
    }

    // Liquidations section
    var liqBody = document.getElementById('whale-liq-body');
    if (liqBody && data.liquidations) {
      var liqSum = data.liquidations.summary;
      var longLiqEl = document.getElementById('whale-long-liq-vol');
      var shortLiqEl = document.getElementById('whale-short-liq-vol');
      var liqCountEl = document.getElementById('whale-liq-count');
      if (longLiqEl) longLiqEl.textContent = liqSum.longLiqVolume > 1e6 ? '$' + (liqSum.longLiqVolume / 1e6).toFixed(1) + 'M' : fmtUSD(liqSum.longLiqVolume);
      if (shortLiqEl) shortLiqEl.textContent = liqSum.shortLiqVolume > 1e6 ? '$' + (liqSum.shortLiqVolume / 1e6).toFixed(1) + 'M' : fmtUSD(liqSum.shortLiqVolume);
      if (liqCountEl) liqCountEl.textContent = liqSum.totalCount;

      if (data.liquidations.recent.length === 0) {
        liqBody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-dim)">' + t('whale.noLiq') + '</td></tr>';
      } else {
        liqBody.innerHTML = data.liquidations.recent.map(function(liq) {
          var sideLabel = liq.side === 'long_liq' ? 'LONG LIQ' : 'SHORT LIQ';
          var sideClass = liq.side === 'long_liq' ? 'sell' : 'buy';
          var tierClass = liq.tier === 'mega' ? 'whale' : liq.tier === 'large' ? 'shark' : 'dolphin';
          return '<tr>' +
            '<td>' + (liq.time ? new Date(liq.time).toLocaleTimeString() : '--') + '</td>' +
            '<td style="font-weight:600">' + escapeHtml(liq.symbol) + '</td>' +
            '<td><span class="side-badge ' + sideClass + '">' + sideLabel + '</span></td>' +
            '<td>' + fmtUSD(liq.price) + '</td>' +
            '<td>' + fmt(liq.qty, 4) + '</td>' +
            '<td style="font-weight:600"><span class="whale-badge ' + tierClass + '">' + fmtUSD(liq.usd) + '</span></td>' +
            '</tr>';
        }).join('');
      }
    }

    // Order Book Depth
    if (data.orderBook) {
      ['btc', 'eth'].forEach(function(sym) {
        var ob = data.orderBook[sym];
        var el = document.getElementById('whale-ob-' + sym);
        if (!el || !ob) return;
        var signalColor = ob.imbalanceSignal.indexOf('buy') >= 0 ? 'var(--up)' : ob.imbalanceSignal.indexOf('sell') >= 0 ? 'var(--down)' : 'var(--text-dim)';
        var bidPct = ob.bidVolume + ob.askVolume > 0 ? (ob.bidVolume / (ob.bidVolume + ob.askVolume) * 100) : 50;
        el.innerHTML =
          '<div style="margin-bottom:8px">' +
            '<span style="color:var(--text-dim)">' + t('whale.imbalance') + ': </span>' +
            '<strong style="color:' + signalColor + '">' + ob.imbalance.toFixed(2) + 'x (' + ob.imbalanceSignal.replace(/_/g, ' ') + ')</strong>' +
          '</div>' +
          '<div class="pressure-bar" style="margin-bottom:6px">' +
            '<div class="buy-bar" style="width:' + bidPct.toFixed(1) + '%">' + t('whale.bid') + ' ' + (ob.bidVolume > 1e6 ? '$' + (ob.bidVolume/1e6).toFixed(1) + 'M' : fmtUSD(ob.bidVolume)) + '</div>' +
            '<div class="sell-bar" style="width:' + (100 - bidPct).toFixed(1) + '%">' + t('whale.ask') + ' ' + (ob.askVolume > 1e6 ? '$' + (ob.askVolume/1e6).toFixed(1) + 'M' : fmtUSD(ob.askVolume)) + '</div>' +
          '</div>' +
          '<div style="font-size:0.85em;color:var(--text-dim)">' +
            t('whale.spread') + ': ' + ob.spread.toFixed(4) + '% | ' +
            t('whale.bidWalls') + ': ' + ob.bidWalls.length + ' | ' +
            t('whale.askWalls') + ': ' + ob.askWalls.length +
          '</div>';
      });
    }

    // Accumulation/Distribution
    var accDistEl = document.getElementById('whale-acc-dist');
    if (accDistEl && data.summary.accumulationDistribution) {
      var adMap = {
        accumulation: { text: t('whale.accumulation'), color: 'var(--up)', icon: '' },
        distribution: { text: t('whale.distribution'), color: 'var(--down)', icon: '' },
        neutral: { text: t('whale.adNeutral'), color: 'var(--text-dim)', icon: '' },
      };
      var ad = adMap[data.summary.accumulationDistribution] || adMap.neutral;
      accDistEl.innerHTML = '<span style="color:' + ad.color + '">' + ad.icon + ' ' + ad.text + '</span>' +
        '<span style="font-size:0.85em;color:var(--text-dim);margin-left:12px">' +
          t('whale.sentimentScore') + ': ' + (data.summary.sentimentScore || 0) +
        '</span>';
    }

    // Whale Confidence Score
    renderWhaleConfidence(data);

    // Data freshness
    var freshEl = document.getElementById('whale-update-time');
    if (freshEl) freshEl.textContent = t('whale.updated') + ' ' + new Date().toLocaleTimeString();

    showToast(t('whale.loaded'), 'success', 2000);
  } catch (err) {
    document.getElementById('whale-content').innerHTML =
      '<div class="card" style="text-align:center;padding:32px;color:var(--down)">' +
      '<p>' + t('whale.error') + '</p><p style="color:var(--text-dim);font-size:0.85em">' + escapeHtml(err.message) + '</p></div>';
  }
}

// ─── Arbitrage Scanner ────────────────────────────────────────────────────
async function loadArbitrageData() {
  try {
    var data = await api('/api/arbitrage');
    _arbData = data; // Cache for sorting/export

    // Stats
    var el;
    el = document.getElementById('arb-total-coins');
    if (el) el.textContent = data.coins.length;
    el = document.getElementById('arb-basis-count');
    if (el) el.textContent = data.opportunities.basis.length;
    el = document.getElementById('arb-volatility-count');
    if (el) el.textContent = data.opportunities.highVolatility.length;

    // Market summary banner
    if (data.marketSummary) {
      var ms = data.marketSummary;
      var summaryHtml = '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;padding:12px;background:var(--bg);border-radius:8px;font-size:0.85em">';
      summaryHtml += '<span style="color:var(--text-dim)">' + t('arb.totalCoins') + ': <strong style="color:var(--text)">' + ms.coinsScanned + '</strong></span>';
      summaryHtml += '<span style="color:var(--text-dim)">' + t('arb.basisOpps') + ': <strong class="up">' + ms.basisOppsCount + '</strong></span>';
      summaryHtml += '<span style="color:var(--text-dim)">' + t('arb.fundingRate') + ': <strong>' + fmt(ms.avgFundingRate, 4) + '%</strong></span>';
      if (ms.bestOpportunity) {
        summaryHtml += '<span style="color:var(--primary);font-weight:600">' +
          (currentLang === 'zh' ? '最佳机会' : 'Best') + ': ' + ms.bestOpportunity.symbol +
          ' (' + ms.bestOpportunity.grade + ' ' + (currentLang === 'zh' ? '评级' : 'grade') + ')</span>';
      }
      summaryHtml += '</div>';
      var statsEl = document.getElementById('arb-basis-opps');
      if (statsEl) statsEl.insertAdjacentHTML('beforebegin', '<div id="arb-market-summary">' + summaryHtml + '</div>');
      // Remove old summary if re-rendering
      var oldSummary = document.querySelectorAll('#arb-market-summary');
      if (oldSummary.length > 1) oldSummary[0].remove();
    }

    // Basis opportunities (expandable cards with fee details)
    var basisEl = document.getElementById('arb-basis-opps');
    if (basisEl) {
      if (data.opportunities.basis.length === 0) {
        basisEl.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:16px">' + t('arb.noOpps') + '</p>';
      } else {
        basisEl.innerHTML = data.opportunities.basis.map(function(o) {
          var gradeColor = o.grade === 'A' ? 'var(--up)' : o.grade === 'B' ? 'var(--secondary)' : 'var(--warning)';
          var feeHtml = '';
          if (o.feeAnalysis) {
            var fa = o.feeAnalysis;
            feeHtml = '<div class="strategy-details">' +
              '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;padding:8px;background:var(--bg-card);border-radius:6px;font-size:0.85em">' +
                '<div>' + t('arb.grossProfit') + ': <strong>' + fmtUSD(fa.grossProfit) + '</strong></div>' +
                '<div>' + t('arb.fundingIncome') + ': <strong>' + fmtUSD(fa.fundingIncome) + '</strong></div>' +
                '<div>' + t('arb.spotFee') + ': <span class="down">' + fmtUSD(fa.fees.spot) + '</span></div>' +
                '<div>' + t('arb.futuresFee') + ': <span class="down">' + fmtUSD(fa.fees.futures) + '</span></div>' +
                '<div>' + t('arb.slippage') + ': <span class="down">' + fmtUSD(fa.fees.slippage) + '</span></div>' +
                '<div>' + t('arb.totalFees') + ': <span class="down">' + fmtUSD(fa.fees.total) + '</span></div>' +
                '<div style="grid-column:span 2;border-top:1px solid var(--border);padding-top:4px;margin-top:4px">' +
                  t('arb.netProfit') + ': <strong class="' + (fa.profitable ? 'up' : 'down') + '">' + fmtUSD(fa.netProfit) + '</strong> (' + fmtPct(fa.netROI) + ')' +
                '</div>' +
              '</div>' +
            '</div>';
          }
          var oiHtml = o.openInterestUSD ? ' | OI: ' + (o.openInterestUSD > 1e9 ? '$' + (o.openInterestUSD/1e9).toFixed(1) + 'B' : '$' + (o.openInterestUSD/1e6).toFixed(1) + 'M') : '';
          return '<div class="opp-card expandable" data-expand>' +
            '<div style="display:flex;justify-content:space-between;align-items:center">' +
              '<div>' +
                '<span class="opp-symbol">' + escapeHtml(o.symbol) + '</span> ' +
                '<span class="whale-badge ' + (o.direction === 'premium' ? 'whale' : 'dolphin') + '">' + o.direction + '</span> ' +
                '<span style="display:inline-block;padding:2px 8px;border-radius:4px;background:' + gradeColor + ';color:#000;font-weight:700;font-size:0.8em">' + o.grade + '</span>' +
                '<span class="expand-icon">▼</span>' +
              '</div>' +
              '<span style="color:var(--primary);font-weight:600">' + t('arb.apy') + ': ' + o.annualizedReturn + '%</span>' +
            '</div>' +
            '<div class="opp-detail" style="margin-top:6px">' +
              t('arb.basis') + ': ' + fmtPct(o.basis) + ' | ' +
              t('arb.strategy') + ': ' + o.strategy.replace(/_/g, ' ') + oiHtml +
            '</div>' +
            feeHtml +
            '</div>';
        }).join('');
      }
    }

    // High volatility
    var volEl = document.getElementById('arb-volatility-opps');
    if (volEl) {
      if (data.opportunities.highVolatility.length === 0) {
        volEl.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:16px">' + t('arb.noVolatility') + '</p>';
      } else {
        volEl.innerHTML = data.opportunities.highVolatility.map(function(o) {
          return '<div class="opp-card">' +
            '<div style="display:flex;justify-content:space-between;align-items:center">' +
              '<span class="opp-symbol">' + escapeHtml(o.symbol) + '</span>' +
              '<span style="color:var(--warning);font-weight:600">' + fmt(o.dayRange, 2) + '% ' + (currentLang === 'zh' ? '波幅' : 'range') + '</span>' +
            '</div>' +
            '<div class="opp-detail" style="margin-top:4px">' +
              t('arb.change24h') + ': <span class="' + (o.change24h >= 0 ? 'up' : 'down') + '">' + fmtPct(o.change24h) + '</span>' +
              (o.high24h ? ' | H: ' + fmtUSD(o.high24h) + ' L: ' + fmtUSD(o.low24h) : '') +
              (o.volume ? ' | Vol: ' + (o.volume > 1e9 ? '$' + (o.volume / 1e9).toFixed(1) + 'B' : fmtUSD(o.volume)) : '') +
            '</div>' +
            '</div>';
        }).join('');
      }
    }

    // Coins table (using shared render function)
    renderArbCoinsTable(data.coins);

    // Triangular arbitrage
    var triEl = document.getElementById('arb-tri-opps');
    if (triEl && data.opportunities.triangular) {
      var triOpps = data.opportunities.triangular;
      if (triOpps.length === 0) {
        triEl.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:16px">' + t('arb.noTriArb') + '</p>';
      } else {
        triEl.innerHTML = triOpps.map(function(tri) {
          var profitClass = tri.profitable ? 'up' : 'down';
          return '<div class="opp-card">' +
            '<div style="display:flex;justify-content:space-between;align-items:center">' +
              '<span class="opp-symbol">' + escapeHtml(tri.path) + '</span>' +
              '<span class="' + profitClass + '" style="font-weight:600">' + fmtPct(tri.profitPct) + '</span>' +
            '</div>' +
            '<div class="opp-detail" style="margin-top:4px">' +
              t('arb.direction') + ': ' + tri.direction + ' | ' +
              t('arb.perTenK') + ': ' + fmtUSD(tri.perTenK) + ' | ' +
              t('arb.legs') + ': ' + tri.legs.join(' > ') +
            '</div>' +
          '</div>';
        }).join('');
      }
    }

    // Fee-adjusted profitable
    var feeEl = document.getElementById('arb-fee-adjusted');
    if (feeEl && data.opportunities.profitableAfterFees) {
      var feeOpps = data.opportunities.profitableAfterFees;
      if (feeOpps.length === 0) {
        feeEl.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:16px">' + t('arb.noFeeProfit') + '</p>';
      } else {
        feeEl.innerHTML = '<div style="font-size:0.85em;color:var(--text-dim);margin-bottom:8px">' + t('arb.feeNote') + '</div>' +
          feeOpps.map(function(f) {
          return '<div class="opp-card">' +
            '<div style="display:flex;justify-content:space-between;align-items:center">' +
              '<span class="opp-symbol">' + escapeHtml(f.symbol) + '</span>' +
              '<span class="up" style="font-weight:600">' + t('arb.netROI') + ': ' + fmtPct(f.netROI) + '</span>' +
            '</div>' +
            '<div class="opp-detail" style="margin-top:4px">' +
              t('arb.netProfit') + ': ' + fmtUSD(f.netProfit) + ' | ' +
              t('arb.basis') + ': ' + fmtPct(f.basis) + ' | ' +
              t('arb.breakEven') + ': ' + fmtPct(f.breakEvenBasis) +
            '</div>' +
          '</div>';
        }).join('');
      }
    }

    // Data freshness
    var arbFresh = document.getElementById('arb-update-time');
    if (arbFresh) arbFresh.textContent = t('arb.updated') + ' ' + new Date().toLocaleTimeString();

    showToast(t('arb.loaded'), 'success', 2000);
  } catch (err) {
    var cont = document.getElementById('arb-scanner-tab');
    if (cont) cont.innerHTML = '<div class="card" style="text-align:center;padding:32px;color:var(--down)">' +
      '<p>' + t('arb.error') + '</p><p style="color:var(--text-dim);font-size:0.85em">' + escapeHtml(err.message) + '</p></div>';
  }
}

async function loadFundingRateData() {
  try {
    var data = await api('/api/funding-rate');
    _fundingData = data;

    // Sentiment summary
    var el;
    var sentMap = { bullish: 'up', bearish: 'down', neutral: '' };
    el = document.getElementById('funding-sentiment');
    if (el) { el.textContent = t('funding.' + data.marketSentiment.sentiment) || data.marketSentiment.sentiment; el.className = 'stat-value ' + (sentMap[data.marketSentiment.sentiment] || ''); }
    el = document.getElementById('funding-avg-rate');
    if (el) el.textContent = fmt(data.marketSentiment.averageRate, 4) + '%';
    el = document.getElementById('funding-positive');
    if (el) el.textContent = data.marketSentiment.positiveCount;
    el = document.getElementById('funding-negative');
    if (el) el.textContent = data.marketSentiment.negativeCount;

    // Opportunities with sparklines
    var oppsEl = document.getElementById('funding-opps');
    if (oppsEl) {
      if (data.opportunities.length === 0) {
        oppsEl.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:16px">' + t('funding.noOpps') + '</p>';
      } else {
        oppsEl.innerHTML = data.opportunities.map(function(o) {
          var sparkHtml = o.history ? ' ' + renderSparkline(o.history.map(function(h) { return h.rate; }), 14) : '';
          var trendLabel = o.trend ? ' <span style="font-size:0.8em;color:var(--text-dim)">(' + o.trend + ')</span>' : '';
          return '<div class="opp-card">' +
            '<div style="display:flex;justify-content:space-between;align-items:center">' +
              '<div><span class="opp-symbol">' + escapeHtml(o.symbol) + '</span> ' +
              '<span class="risk-badge ' + o.riskLevel + '">' + o.riskLevel + '</span>' + trendLabel + '</div>' +
              '<div>' + sparkHtml + '</div>' +
            '</div>' +
            '<div class="opp-detail">' + t('funding.rate') + ': ' + fmt(o.fundingRate, 4) + '% | APY: ' + fmt(o.grossAPY, 1) + '% | ' + t('funding.monthly') + ': $' + fmt(o.monthlyYield, 0) + '</div>' +
            '</div>';
        }).join('');
      }
    }

    // Rates table with sparklines and trend
    var ratesBody = document.getElementById('funding-rates-body');
    if (ratesBody) {
      ratesBody.innerHTML = data.rates.map(function(r) {
        var sparkHtml = r.history ? renderSparkline(r.history.map(function(h) { return h.rate; }), 12) : '';
        var trendIcon = r.trend === 'rising' ? ' <span style="color:var(--up)">&#9650;</span>' : r.trend === 'falling' ? ' <span style="color:var(--down)">&#9660;</span>' : '';
        return '<tr>' +
          '<td style="font-weight:600">' + escapeHtml(r.symbol) + '</td>' +
          '<td class="' + (r.fundingRate > 0 ? 'up' : r.fundingRate < 0 ? 'down' : '') + '">' + fmt(r.fundingRate, 4) + '%' + trendIcon + ' ' + sparkHtml + '</td>' +
          '<td>' + fmtUSD(r.markPrice) + '</td>' +
          '<td>' + fmtUSD(r.indexPrice) + '</td>' +
          '<td>' + fmt(r.grossAPY, 1) + '%</td>' +
          '<td>' + fmt(r.netAPY, 1) + '%</td>' +
          '<td><span class="risk-badge ' + r.riskLevel + '">' + r.riskLevel + '</span></td>' +
          '<td>' + new Date(r.nextFundingTime).toLocaleTimeString() + '</td>' +
          '</tr>';
      }).join('');
    }

    // Start countdown timer (use earliest nextFundingTime)
    if (data.rates.length > 0) {
      var earliest = data.rates.reduce(function(min, r) { return r.nextFundingTime < min ? r.nextFundingTime : min; }, data.rates[0].nextFundingTime);
      startFundingCountdown(earliest);
    }

    // Data freshness
    var fundFresh = document.getElementById('funding-update-time');
    if (fundFresh) fundFresh.textContent = t('funding.updated') + ' ' + new Date().toLocaleTimeString();

    showToast(t('funding.loaded'), 'success', 2000);
  } catch (err) {
    var cont = document.getElementById('arb-funding-tab');
    if (cont) cont.innerHTML = '<div class="card" style="text-align:center;padding:32px;color:var(--down)">' +
      '<p>' + t('funding.error') + '</p><p style="color:var(--text-dim);font-size:0.85em">' + escapeHtml(err.message) + '</p></div>';
  }
}

function showArbTab() {
  document.getElementById('arb-scanner-tab').style.display = '';
  document.getElementById('arb-funding-tab').style.display = 'none';
  document.querySelectorAll('.arb-tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelector('[data-action="showArbTab"]').classList.add('active');
  loadArbitrageData();
}

function showFundingTab() {
  document.getElementById('arb-scanner-tab').style.display = 'none';
  document.getElementById('arb-funding-tab').style.display = '';
  document.querySelectorAll('.arb-tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelector('[data-action="showFundingTab"]').classList.add('active');
  loadFundingRateData();
}

// ─── Cached Data for Sorting/Export ────────────────────────────────────────
var _whaleData = null;
var _arbData = null;
var _fundingData = null;
var _nextFundingTime = 0;
var _fundingCountdownTimer = null;

// ─── Table Sorting ──────────────────────────────────────────────────────
function sortTableData(data, key, asc) {
  return data.slice().sort(function(a, b) {
    var va = a[key], vb = b[key];
    if (typeof va === 'string') return asc ? va.localeCompare(vb) : vb.localeCompare(va);
    va = va || 0; vb = vb || 0;
    return asc ? va - vb : vb - va;
  });
}

function handleSortClick(e) {
  var th = e.target.closest('th.sortable');
  if (!th) return;
  var table = th.closest('table');
  if (!table) return;
  var key = th.dataset.sort;
  var wasDesc = th.classList.contains('sort-desc');
  // Reset all sort indicators in this table
  table.querySelectorAll('th.sortable').forEach(function(h) { h.classList.remove('sort-asc', 'sort-desc'); });
  // Toggle direction
  var asc = wasDesc;
  th.classList.add(asc ? 'sort-asc' : 'sort-desc');

  if (table.id === 'whale-trades-table' && _whaleData) {
    renderWhaleTradesTable(sortTableData(_whaleData.largeTrades, key, asc));
  } else if (table.id === 'arb-coins-table' && _arbData) {
    renderArbCoinsTable(sortTableData(_arbData.coins, key, asc));
  }
}

function renderWhaleTradesTable(trades) {
  var tbody = document.getElementById('whale-trades-body');
  if (!tbody) return;
  if (!trades || trades.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-dim)">' + t('whale.noTrades') + '</td></tr>';
    return;
  }
  tbody.innerHTML = trades.map(function(tr) {
    var tierClass = tr.usd >= 500000 ? 'whale' : tr.usd >= 200000 ? 'shark' : 'dolphin';
    return '<tr>' +
      '<td>' + (tr.time ? new Date(tr.time).toLocaleTimeString() : '--') + '</td>' +
      '<td style="font-weight:600">' + escapeHtml(tr.symbol || 'BTC') + '</td>' +
      '<td><span class="side-badge ' + tr.side + '">' + tr.side.toUpperCase() + '</span></td>' +
      '<td>' + fmtUSD(tr.price) + '</td>' +
      '<td>' + fmt(tr.qty, 4) + (tr.fills > 1 ? ' <small style="color:var(--text-dim)">(' + tr.fills + ' fills)</small>' : '') + '</td>' +
      '<td style="font-weight:600"><span class="whale-badge ' + tierClass + '">' + fmtUSD(tr.usd) + '</span></td>' +
      '</tr>';
  }).join('');
}

function renderArbCoinsTable(coins) {
  var coinsBody = document.getElementById('arb-coins-body');
  if (!coinsBody) return;
  coinsBody.innerHTML = coins.map(function(c) {
    var basisClass = Math.abs(c.basis) > 0.05 ? (c.basis > 0 ? 'up' : 'down') : '';
    var gradeColor = c.riskReward && c.riskReward.grade === 'A' ? 'var(--up)' : c.riskReward && c.riskReward.grade === 'B' ? 'var(--secondary)' : 'var(--text-dim)';
    var fundingTrendIcon = c.fundingTrend === 'rising' ? ' <span style="color:var(--up)" title="Rising">&#9650;</span>' : c.fundingTrend === 'falling' ? ' <span style="color:var(--down)" title="Falling">&#9660;</span>' : '';
    var oiDisplay = c.openInterestUSD > 1e9 ? '$' + (c.openInterestUSD / 1e9).toFixed(1) + 'B' : c.openInterestUSD > 1e6 ? '$' + (c.openInterestUSD / 1e6).toFixed(1) + 'M' : fmtUSD(c.openInterestUSD || 0);
    return '<tr>' +
      '<td style="font-weight:600">' + escapeHtml(c.symbol) +
        (c.riskReward ? ' <span style="color:' + gradeColor + ';font-size:0.8em">' + c.riskReward.grade + '</span>' : '') + '</td>' +
      '<td>' + fmtUSD(c.spotPrice) + '</td>' +
      '<td>' + fmtUSD(c.futuresPrice) + '</td>' +
      '<td class="' + basisClass + '">' + fmtPct(c.basis) + '</td>' +
      '<td>' + fmt(c.fundingRate, 4) + '%' + fundingTrendIcon + '</td>' +
      '<td class="' + (Math.abs(c.fundingAPY) > 15 ? 'up' : '') + '">' + fmt(c.fundingAPY, 1) + '%</td>' +
      '<td>' + fmt(c.dayRange, 2) + '%</td>' +
      '<td>' + oiDisplay + '</td>' +
      '<td>' + (c.volume > 1e9 ? '$' + (c.volume / 1e9).toFixed(1) + 'B' : fmtUSD(c.volume)) + '</td>' +
      '</tr>';
  }).join('');
}

// ─── Whale Confidence Score ──────────────────────────────────────────────
function renderWhaleConfidence(data) {
  var score = 50; // neutral baseline
  var factors = [];

  // Factor 1: Buy/sell ratio (0-25 points)
  var buyRatio = data.summary.buyRatio || 50;
  var tradeScore = Math.round((buyRatio - 50) * 0.5);
  score += tradeScore;
  factors.push(t('whale.factorTrade') + ': ' + (tradeScore > 0 ? '+' : '') + tradeScore);

  // Factor 2: Liquidation imbalance (-15 to +15)
  if (data.liquidations && data.liquidations.summary) {
    var liq = data.liquidations.summary;
    var liqScore = 0;
    if (liq.shortLiqVolume > liq.longLiqVolume * 1.5) liqScore = 10;
    else if (liq.longLiqVolume > liq.shortLiqVolume * 1.5) liqScore = -10;
    score += liqScore;
    factors.push(t('whale.factorLiq') + ': ' + (liqScore > 0 ? '+' : '') + liqScore);
  }

  // Factor 3: Order book depth (-10 to +10)
  if (data.orderBook && data.orderBook.btc) {
    var imb = data.orderBook.btc.imbalance || 1;
    var obScore = Math.round((imb - 1) * 15);
    obScore = Math.max(-10, Math.min(10, obScore));
    score += obScore;
    factors.push(t('whale.factorOB') + ': ' + (obScore > 0 ? '+' : '') + obScore);
  }

  // Factor 4: On-chain activity
  if (data.onchain && data.onchain.transactions.length > 5) {
    score += 5;
    factors.push(t('whale.factorOnchain') + ': +5');
  }

  score = Math.max(0, Math.min(100, score));

  var label = score >= 70 ? t('whale.confBullish') : score >= 55 ? t('whale.confSlightBull') : score >= 45 ? t('whale.confNeutral') : score >= 30 ? t('whale.confSlightBear') : t('whale.confBearish');
  var color = score >= 70 ? 'var(--up)' : score >= 55 ? '#66bb6a' : score >= 45 ? 'var(--text-dim)' : score >= 30 ? '#ffa726' : 'var(--down)';

  var valEl = document.getElementById('whale-confidence-value');
  var fillEl = document.getElementById('whale-confidence-fill');
  var labelEl = document.getElementById('whale-confidence-label');
  var factorsEl = document.getElementById('whale-confidence-factors');

  if (valEl) { valEl.textContent = score; valEl.style.color = color; }
  if (fillEl) { fillEl.style.width = score + '%'; fillEl.style.background = color; }
  if (labelEl) { labelEl.textContent = label; labelEl.style.color = color; }
  if (factorsEl) { factorsEl.textContent = factors.join(' | '); }
}

// ─── Funding Countdown Timer ─────────────────────────────────────────────
function startFundingCountdown(nextTime) {
  _nextFundingTime = nextTime;
  if (_fundingCountdownTimer) clearInterval(_fundingCountdownTimer);
  updateFundingCountdown();
  _fundingCountdownTimer = setInterval(updateFundingCountdown, 1000);
}

function updateFundingCountdown() {
  var el = document.getElementById('funding-countdown');
  if (!el || !_nextFundingTime) return;
  var diff = _nextFundingTime - Date.now();
  if (diff <= 0) { el.textContent = t('funding.settling'); el.style.color = 'var(--up)'; return; }
  var h = Math.floor(diff / 3600000);
  var m = Math.floor((diff % 3600000) / 60000);
  var s = Math.floor((diff % 60000) / 1000);
  el.textContent = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}

// ─── Sparkline Renderer ──────────────────────────────────────────────────
function renderSparkline(values, height) {
  height = height || 16;
  if (!values || values.length < 2) return '';
  var max = Math.max.apply(null, values.map(function(v) { return Math.abs(v); }));
  if (max === 0) max = 1;
  var lastVal = values[values.length - 1];
  var color = lastVal >= 0 ? 'var(--up)' : 'var(--down)';
  var bars = values.map(function(v) {
    var h = Math.max(2, Math.round((Math.abs(v) / max) * height));
    var c = v >= 0 ? 'var(--up)' : 'var(--down)';
    return '<span class="sparkline-bar" style="height:' + h + 'px;background:' + c + '"></span>';
  }).join('');
  return '<span class="sparkline" style="height:' + height + 'px;line-height:' + height + 'px">' + bars + '</span>';
}

// ─── CSV Export Functions ────────────────────────────────────────────────
function downloadCSV(filename, rows) {
  var csv = rows.map(function(r) {
    return r.map(function(cell) {
      var s = String(cell == null ? '' : cell);
      return s.indexOf(',') >= 0 || s.indexOf('"') >= 0 ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',');
  }).join('\n');
  var blob = new Blob([csv], { type: 'text/csv' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  showToast(t('export.success'), 'success', 2000);
}

function exportWhaleCSV() {
  if (!_whaleData) { showToast(t('export.noData'), 'error'); return; }
  var rows = [['Time', 'Symbol', 'Side', 'Price', 'Quantity', 'USD Value', 'Fills']];
  (_whaleData.largeTrades || []).forEach(function(tr) {
    rows.push([tr.time, tr.symbol, tr.side, tr.price, tr.qty, tr.usd, tr.fills]);
  });
  if (_whaleData.liquidations) {
    rows.push([]);
    rows.push(['--- Liquidations ---']);
    rows.push(['Time', 'Symbol', 'Side', 'Price', 'Quantity', 'USD Value', 'Tier']);
    (_whaleData.liquidations.recent || []).forEach(function(l) {
      rows.push([l.time, l.symbol, l.side, l.price, l.qty, l.usd, l.tier]);
    });
  }
  downloadCSV('alphamind-whale-' + new Date().toISOString().slice(0,10) + '.csv', rows);
}

function exportWhaleTrades() {
  if (!_whaleData || !_whaleData.largeTrades) { showToast(t('export.noData'), 'error'); return; }
  var rows = [['Time', 'Symbol', 'Side', 'Price', 'Quantity', 'USD Value', 'Fills']];
  _whaleData.largeTrades.forEach(function(tr) { rows.push([tr.time, tr.symbol, tr.side, tr.price, tr.qty, tr.usd, tr.fills]); });
  downloadCSV('whale-trades-' + new Date().toISOString().slice(0,10) + '.csv', rows);
}

function exportArbCSV() {
  if (!_arbData) { showToast(t('export.noData'), 'error'); return; }
  var rows = [['Symbol', 'Spot', 'Futures', 'Basis%', 'FundingRate%', 'FundingAPY%', 'DayRange%', 'OpenInterest$', 'Volume$', 'Grade', 'NetROI%']];
  _arbData.coins.forEach(function(c) {
    rows.push([c.symbol, c.spotPrice, c.futuresPrice, c.basis.toFixed(4), c.fundingRate.toFixed(4), c.fundingAPY.toFixed(1),
      c.dayRange.toFixed(2), c.openInterestUSD || 0, c.volume, c.riskReward ? c.riskReward.grade : '', c.feeAnalysis ? c.feeAnalysis.netROI : '']);
  });
  downloadCSV('alphamind-arb-' + new Date().toISOString().slice(0,10) + '.csv', rows);
}

function exportArbCoins() { exportArbCSV(); }

// ─── Position Size Recalculation ─────────────────────────────────────────
function recalcFees() {
  if (!_arbData) return;
  var input = document.getElementById('arb-position-size');
  var size = input ? parseInt(input.value) : 10000;
  if (isNaN(size) || size < 100) { showToast(t('arb.invalidSize'), 'error'); return; }

  // Recalculate fee analysis for all coins via API
  var feeEl = document.getElementById('arb-fee-adjusted');
  if (!feeEl) return;

  // Client-side recalculation using the same formula
  var SPOT_FEE = 0.001, FUTURES_FEE = 0.0004, SLIPPAGE = 0.0005;
  var recalced = _arbData.coins.map(function(c) {
    var gross = Math.abs(c.basis / 100) * size;
    var funding = Math.abs(c.fundingRate / 100) * size;
    var fees = size * SPOT_FEE + size * FUTURES_FEE + size * SLIPPAGE * 2;
    var net = gross + funding - fees;
    return { symbol: c.symbol, basis: c.basis, netProfit: parseFloat(net.toFixed(2)), netROI: parseFloat((net / size * 100).toFixed(4)), breakEvenBasis: parseFloat((fees / size * 100).toFixed(4)), profitable: net > 0 };
  }).filter(function(c) { return c.profitable; }).sort(function(a, b) { return b.netROI - a.netROI; }).slice(0, 5);

  if (recalced.length === 0) {
    feeEl.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:16px">' + t('arb.noFeeProfit') + '</p>';
  } else {
    feeEl.innerHTML = '<div style="font-size:0.85em;color:var(--text-dim);margin-bottom:8px">' + t('arb.feeNoteCustom').replace('{size}', fmtUSD(size)) + '</div>' +
      recalced.map(function(f) {
      return '<div class="opp-card">' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
          '<span class="opp-symbol">' + escapeHtml(f.symbol) + '</span>' +
          '<span class="up" style="font-weight:600">' + t('arb.netROI') + ': ' + fmtPct(f.netROI) + '</span>' +
        '</div>' +
        '<div class="opp-detail" style="margin-top:4px">' +
          t('arb.netProfit') + ': ' + fmtUSD(f.netProfit) + ' | ' +
          t('arb.basis') + ': ' + fmtPct(f.basis) + ' | ' +
          t('arb.breakEven') + ': ' + fmtPct(f.breakEvenBasis) +
        '</div>' +
      '</div>';
    }).join('');
  }
  showToast(t('arb.feeRecalced'), 'success', 2000);
}

// ─── i18n ─────────────────────────────────────────────────────────────────
var currentLang = 'en';
var i18n = {
  en: {
    // Nav
    'nav.dashboard': 'Dashboard', 'nav.market': 'Market', 'nav.portfolio': 'Portfolio',
    'nav.sentiment': 'Sentiment', 'nav.risk': 'Risk Control', 'nav.tools': 'Tools',
    'nav.whale': 'Whale Tracking', 'nav.arb': 'Arbitrage', 'nav.bsc': 'BNB Chain', 'nav.ai': 'AI Chat',
    // Headers
    'h.whale': 'Whale Tracking', 'h.arb': 'Arbitrage Scanner',
    // Whale page
    'whale.btcPrice': 'BTC Price', 'whale.volume': '24h Volume', 'whale.tradeCount': 'Large Trades',
    'whale.sentiment': 'Sentiment', 'whale.pressure': 'Buy/Sell Pressure',
    'whale.buy': 'Buy', 'whale.sell': 'Sell',
    'whale.bullish': 'Bullish', 'whale.bearish': 'Bearish', 'whale.neutral': 'Neutral',
    'whale.trades': 'Binance Large Trades (>$500K)', 'whale.onchain': 'On-Chain BTC Transactions (≥100 BTC)',
    'whale.time': 'Time', 'whale.side': 'Side', 'whale.price': 'Price', 'whale.qty': 'Quantity', 'whale.usdValue': 'USD Value',
    'whale.hash': 'TX Hash', 'whale.btcAmount': 'BTC', 'whale.size': 'Size',
    'whale.legend': 'Size Legend',
    'whale.legendWhale': 'Whale: ≥1,000 BTC', 'whale.legendShark': 'Shark: ≥500 BTC', 'whale.legendDolphin': 'Dolphin: ≥100 BTC',
    'whale.noTrades': 'No large trades detected', 'whale.noOnchain': 'No large on-chain transactions found',
    'whale.loaded': 'Whale data updated', 'whale.error': 'Failed to load whale data',
    'whale.block': 'Block',
    // Whale liquidations & depth
    'whale.liquidations': 'Recent Liquidations (BTC + ETH)', 'whale.longLiq': 'Long Liq:', 'whale.shortLiq': 'Short Liq:',
    'whale.liqCount': 'Count:', 'whale.noLiq': 'No recent liquidations', 'whale.loadingLiq': 'Loading liquidations...',
    'whale.orderBook': 'Order Book Depth', 'whale.imbalance': 'Imbalance', 'whale.bid': 'Bid', 'whale.ask': 'Ask',
    'whale.spread': 'Spread', 'whale.bidWalls': 'Bid Walls', 'whale.askWalls': 'Ask Walls',
    'whale.accDist': 'Whale Activity Pattern', 'whale.accumulation': 'Accumulation (Smart Money Buying)',
    'whale.distribution': 'Distribution (Smart Money Selling)', 'whale.adNeutral': 'Neutral (No Clear Pattern)',
    'whale.sentimentScore': 'Sentiment Score', 'whale.th.liqSide': 'Type',
    'whale.confidence': 'Whale Confidence Score', 'whale.updated': 'Updated:',
    'whale.factorTrade': 'Trade Flow', 'whale.factorLiq': 'Liquidations', 'whale.factorOB': 'Order Book', 'whale.factorOnchain': 'On-Chain',
    'whale.confBullish': 'Strong Bullish', 'whale.confSlightBull': 'Slightly Bullish', 'whale.confNeutral': 'Neutral',
    'whale.confSlightBear': 'Slightly Bearish', 'whale.confBearish': 'Strong Bearish',
    'whale.viewOnChain': 'View on Blockchain.info', 'whale.autoRefresh': 'Auto-refresh: 30s',
    // Arb page
    'arb.scanner': 'Arbitrage Scanner', 'arb.funding': 'Funding Rates',
    'arb.totalCoins': 'Coins Scanned', 'arb.basisOpps': 'Basis Opportunities', 'arb.volatility': 'High Volatility',
    'arb.basisTitle': 'Basis Arbitrage Opportunities', 'arb.volatilityTitle': 'High Volatility Coins',
    'arb.coinsTable': 'All Coins', 'arb.symbol': 'Symbol', 'arb.spotPrice': 'Spot', 'arb.futuresPrice': 'Futures',
    'arb.basis': 'Basis', 'arb.fundingRate': 'Funding', 'arb.apy': 'APY', 'arb.dayRange': 'Day Range', 'arb.volumeCol': 'Volume',
    'arb.change24h': '24h Change', 'arb.strategy': 'Strategy',
    'arb.noOpps': 'No basis opportunities detected', 'arb.noVolatility': 'No high volatility coins',
    'arb.loaded': 'Arbitrage data updated', 'arb.error': 'Failed to load arbitrage data',
    // Arb new features
    'arb.triangular': 'Triangular Arbitrage', 'arb.noTriArb': 'No triangular arbitrage detected',
    'arb.direction': 'Direction', 'arb.perTenK': 'Per $10K', 'arb.legs': 'Legs',
    'arb.feeAdjusted': 'Fee-Adjusted Profitable', 'arb.noFeeProfit': 'No opportunities profitable after fees',
    'arb.feeNote': 'Based on $10K position. Fees: 0.1% spot + 0.04% futures + 0.05% slippage.',
    'arb.netROI': 'Net ROI', 'arb.netProfit': 'Net Profit', 'arb.breakEven': 'Break-even',
    'arb.openInterest': 'Open Interest', 'arb.loadingTri': 'Loading triangular arb...', 'arb.loadingFee': 'Loading fee analysis...',
    'arb.updated': 'Updated:', 'arb.autoRefresh': 'Auto-refresh: 30s', 'arb.positionSize': 'Position Size:',
    'arb.recalc': 'Recalculate', 'arb.invalidSize': 'Invalid position size', 'arb.feeRecalced': 'Fees recalculated',
    'arb.feeNoteCustom': 'Based on {size} position. Fees: 0.1% spot + 0.04% futures + 0.05% slippage.',
    'arb.grossProfit': 'Gross Profit', 'arb.fundingIncome': 'Funding Income', 'arb.spotFee': 'Spot Fee',
    'arb.futuresFee': 'Futures Fee', 'arb.slippage': 'Slippage', 'arb.totalFees': 'Total Fees',
    'export.success': 'Exported CSV', 'export.noData': 'No data to export',
    'funding.settling': 'Settling now!', 'funding.nextPayment': 'Next Funding Payment',
    'funding.countdownNote': 'Funding rates settle every 8 hours', 'funding.updated': 'Updated:',
    // Funding page
    'funding.title': 'Funding Rate Analysis', 'funding.sentimentLabel': 'Market Sentiment',
    'funding.avgRate': 'Avg Rate', 'funding.positive': 'Positive', 'funding.negative': 'Negative',
    'funding.oppsTitle': 'Funding Opportunities', 'funding.ratesTable': 'All Funding Rates',
    'funding.rate': 'Rate', 'funding.markPrice': 'Mark Price', 'funding.indexPrice': 'Index Price',
    'funding.grossAPY': 'Gross APY', 'funding.netAPY': 'Net APY', 'funding.risk': 'Risk', 'funding.nextFunding': 'Next Funding',
    'funding.monthly': 'Monthly Yield',
    'funding.bullish': 'Bullish', 'funding.bearish': 'Bearish', 'funding.neutral': 'Neutral',
    'funding.noOpps': 'No funding opportunities', 'funding.loaded': 'Funding data updated', 'funding.error': 'Failed to load funding data',
    // Whale HTML labels
    'whale.volume24h': '24h Volume', 'whale.largeTrades': 'Binance Large Trades (>$500K)',
    'whale.loading': 'Loading whale data...', 'whale.loadingOnchain': 'Loading on-chain data...',
    'whale.blockHeight': 'Block Height', 'whale.blockHash': 'Block Hash',
    'whale.th.time': 'Time', 'whale.th.symbol': 'Symbol', 'whale.th.side': 'Side', 'whale.th.price': 'Price',
    'whale.th.quantity': 'Quantity', 'whale.th.usdValue': 'USD Value',
    'whale.th.hash': 'TX Hash', 'whale.th.btcAmount': 'BTC Amount', 'whale.th.size': 'Size',
    // Arb HTML labels
    'arb.tab.scanner': 'Arbitrage Scanner', 'arb.tab.funding': 'Funding Rates',
    'arb.basisArbitrage': 'Basis Arbitrage Opportunities', 'arb.highVolatility': 'High Volatility Coins',
    'arb.volatilityOpps': 'High Volatility', 'arb.allCoins': 'All Coins Spread Analysis',
    'arb.loading': 'Loading arbitrage data...', 'arb.loadingBasis': 'Loading basis opportunities...',
    'arb.loadingVolatility': 'Loading volatility data...',
    'arb.th.symbol': 'Symbol', 'arb.th.spotPrice': 'Spot Price', 'arb.th.futuresPrice': 'Futures Price',
    'arb.th.basis': 'Basis (%)', 'arb.th.fundingRate': 'Funding Rate', 'arb.th.fundingApy': 'Funding APY',
    'arb.th.dayRange': 'Day Range', 'arb.th.openInterest': 'Open Interest', 'arb.th.volume': 'Volume',
    // Funding HTML labels
    'funding.sentiment': 'Sentiment', 'funding.opportunities': 'Funding Opportunities',
    'funding.rates': 'All Funding Rates', 'funding.loadingOpps': 'Loading opportunities...',
    'funding.loadingRates': 'Loading funding rates...',
    'funding.th.symbol': 'Symbol', 'funding.th.fundingRate': 'Funding Rate',
    'funding.th.markPrice': 'Mark Price', 'funding.th.indexPrice': 'Index Price',
    'funding.th.grossApy': 'Gross APY', 'funding.th.netApy': 'Net APY',
    'funding.th.riskLevel': 'Risk Level', 'funding.th.nextFunding': 'Next Funding',
    // Dashboard
    'h.dashboard': 'Dashboard', 'dash.refresh': 'Refresh',
    'dash.btcPrice': 'BTC Price', 'dash.ethPrice': 'ETH Price',
    'dash.fearGreed': 'Fear & Greed', 'dash.marketSignal': 'Market Signal',
    'dash.btcPrice24h': 'BTC Price (24h)', 'dash.fgHistory': 'Fear & Greed History (30d)',
    'dash.techAnalysis': 'Technical Analysis (BTC 4H)', 'dash.loadingIndicators': 'Loading indicators...',
    'dash.marketOverview': 'Market Overview',
    'dash.coin': 'Coin', 'dash.price': 'Price', 'dash.change24h': '24h Change',
    'dash.high24h': '24h High', 'dash.low24h': '24h Low', 'dash.volume24h': '24h Volume',
    // Risk
    'h.risk': 'Risk Control Center',
    'risk.calculator': 'Position Risk Calculator', 'risk.coin': 'Coin',
    'risk.positionSize': 'Position Size', 'risk.entryPrice': 'Entry Price (USDT)',
    'risk.leverage': 'Leverage', 'risk.calculate': 'Calculate Risk', 'risk.reset': 'Reset',
    'risk.result': 'Risk Analysis Result', 'risk.inputHint': 'Input position info and click "Calculate Risk"',
    'risk.alerts': 'Price Alerts', 'risk.targetPrice': 'Target Price',
    'risk.direction': 'Direction', 'risk.above': 'Above (price rises to)',
    'risk.below': 'Below (price drops to)', 'risk.addAlert': 'Add Alert',
    'risk.safe': 'Safe', 'risk.warning': 'Warning', 'risk.danger': 'Danger!', 'risk.liquidated': 'LIQUIDATED!',
    'risk.currentPrice': 'Current Price', 'risk.positionValue': 'Position Value',
    'risk.initialMargin': 'Initial Margin', 'risk.unrealizedPnl': 'Unrealized P&L',
    'risk.liquidationPrice': 'Liquidation Price', 'risk.distanceToLiq': 'Distance to Liq.',
    'risk.adviceSafe': 'Position is healthy. Maintain current risk management strategy.',
    'risk.adviceWarning': 'Approaching risk zone. Consider reducing position or adding margin.',
    'risk.adviceDanger': 'CRITICAL: Position at high risk of liquidation! Strongly recommend reducing leverage or closing position.',
    // Tools
    'h.tools': 'Investment Tools',
    'tools.dca': 'DCA Calculator (Dollar Cost Averaging)', 'tools.dcaCoin': 'Coin',
    'tools.monthlyInvestment': 'Monthly Investment (USDT)', 'tools.period': 'Period (months)',
    'tools.calculate': 'Calculate',
    'tools.pnl': 'Profit/Loss Calculator', 'tools.buyPrice': 'Buy Price (USDT)',
    'tools.sellPrice': 'Sell Price (USDT)', 'tools.quantity': 'Quantity',
    'tools.paper': 'Paper Trading Simulator (Virtual $10,000 USDT)',
    'tools.balance': 'Balance: ', 'tools.resetTo10k': 'Reset to $10K',
    'tools.paperCoin': 'Coin', 'tools.paperQty': 'Quantity',
    'tools.buy': 'Buy', 'tools.sell': 'Sell', 'tools.recentTrades': 'Recent Trades',
    'tools.noTrades': 'No trades yet — start trading!',
    'tools.totalInvested': 'Total Invested', 'tools.coinsAccumulated': 'Coins Accumulated',
    'tools.currentValue': 'Current Value', 'tools.currentPrice': 'Current Price',
    'tools.profit': 'Profit', 'tools.roi': 'ROI',
    'tools.cost': 'Cost', 'tools.revenue': 'Revenue', 'tools.profitLoss': 'Profit/Loss',
    // AI Chat
    'h.ai': 'AI Trading Assistant',
    'ai.welcome': 'Welcome to AlphaMind AI Assistant! I can help you with market analysis, trading advice, and risk assessment.\n\nAsk me anything about cryptocurrency markets, for example:\n- "BTC current analysis?"\n- "Should I buy now?"\n- "What are the current risks?"\n- "Market overview"',
    'ai.placeholder': 'Ask about crypto markets...',
    'ai.send': 'Send',
    'ai.btcAnalysis': 'BTC Analysis', 'ai.buyAdvice': 'Buy Advice',
    'ai.riskCheck': 'Risk Check', 'ai.marketOverview': 'Market Overview', 'ai.sellAdvice': 'Sell Advice',
    // Common
    'btn.refresh': 'Refresh',
  },
  zh: {
    // Nav
    'nav.dashboard': '仪表盘', 'nav.market': '行情', 'nav.portfolio': '投资组合',
    'nav.sentiment': '市场情绪', 'nav.risk': '风险控制', 'nav.tools': '工具',
    'nav.whale': '巨鲸追踪', 'nav.arb': '套利扫描', 'nav.bsc': 'BNB链', 'nav.ai': 'AI 对话',
    // Headers
    'h.whale': '巨鲸追踪', 'h.arb': '套利扫描',
    // Whale
    'whale.btcPrice': 'BTC 价格', 'whale.volume': '24h 成交量', 'whale.tradeCount': '大额交易',
    'whale.sentiment': '市场情绪', 'whale.pressure': '买卖压力',
    'whale.buy': '买入', 'whale.sell': '卖出',
    'whale.bullish': '看涨', 'whale.bearish': '看跌', 'whale.neutral': '中性',
    'whale.trades': '币安大额交易 (>$50万)', 'whale.onchain': '链上BTC大额交易 (≥100 BTC)',
    'whale.time': '时间', 'whale.side': '方向', 'whale.price': '价格', 'whale.qty': '数量', 'whale.usdValue': 'USD价值',
    'whale.hash': '交易哈希', 'whale.btcAmount': 'BTC数量', 'whale.size': '规模',
    'whale.legend': '规模图例',
    'whale.legendWhale': '鲸鱼: ≥1,000 BTC', 'whale.legendShark': '鲨鱼: ≥500 BTC', 'whale.legendDolphin': '海豚: ≥100 BTC',
    'whale.noTrades': '未检测到大额交易', 'whale.noOnchain': '未发现大额链上交易',
    'whale.loaded': '巨鲸数据已更新', 'whale.error': '加载巨鲸数据失败',
    'whale.block': '区块',
    // 巨鲸新功能
    'whale.liquidations': '近期爆仓 (BTC + ETH)', 'whale.longLiq': '多头爆仓:', 'whale.shortLiq': '空头爆仓:',
    'whale.liqCount': '数量:', 'whale.noLiq': '无近期爆仓', 'whale.loadingLiq': '加载爆仓数据...',
    'whale.orderBook': '订单簿深度', 'whale.imbalance': '买卖不平衡', 'whale.bid': '买盘', 'whale.ask': '卖盘',
    'whale.spread': '价差', 'whale.bidWalls': '买墙', 'whale.askWalls': '卖墙',
    'whale.accDist': '巨鲸行为模式', 'whale.accumulation': '吸筹中 (聪明钱买入)',
    'whale.distribution': '派发中 (聪明钱卖出)', 'whale.adNeutral': '中性 (无明显趋势)',
    'whale.sentimentScore': '情绪评分', 'whale.th.liqSide': '类型',
    'whale.confidence': '巨鲸信心指数', 'whale.updated': '更新于:',
    'whale.factorTrade': '交易流向', 'whale.factorLiq': '爆仓', 'whale.factorOB': '订单簿', 'whale.factorOnchain': '链上',
    'whale.confBullish': '强烈看涨', 'whale.confSlightBull': '略微看涨', 'whale.confNeutral': '中性',
    'whale.confSlightBear': '略微看跌', 'whale.confBearish': '强烈看跌',
    'whale.viewOnChain': '在 Blockchain.info 查看', 'whale.autoRefresh': '自动刷新: 30秒',
    // Arb
    'arb.scanner': '套利扫描', 'arb.funding': '资金费率',
    'arb.totalCoins': '扫描币种', 'arb.basisOpps': '基差机会', 'arb.volatility': '高波动',
    'arb.basisTitle': '基差套利机会', 'arb.volatilityTitle': '高波动币种',
    'arb.coinsTable': '全部币种', 'arb.symbol': '币种', 'arb.spotPrice': '现货', 'arb.futuresPrice': '合约',
    'arb.basis': '基差', 'arb.fundingRate': '资金费率', 'arb.apy': '年化', 'arb.dayRange': '日内波幅', 'arb.volumeCol': '成交量',
    'arb.change24h': '24h涨跌', 'arb.strategy': '策略',
    'arb.noOpps': '未检测到基差机会', 'arb.noVolatility': '无高波动币种',
    'arb.loaded': '套利数据已更新', 'arb.error': '加载套利数据失败',
    // 套利新功能
    'arb.triangular': '三角套利', 'arb.noTriArb': '未检测到三角套利机会',
    'arb.direction': '方向', 'arb.perTenK': '每$10K收益', 'arb.legs': '路径',
    'arb.feeAdjusted': '扣费后盈利机会', 'arb.noFeeProfit': '扣除手续费后无盈利机会',
    'arb.feeNote': '基于$10K仓位。手续费: 现货0.1% + 合约0.04% + 滑点0.05%',
    'arb.netROI': '净ROI', 'arb.netProfit': '净利润', 'arb.breakEven': '盈亏平衡',
    'arb.openInterest': '持仓量', 'arb.loadingTri': '加载三角套利...', 'arb.loadingFee': '加载费用分析...',
    'arb.updated': '更新于:', 'arb.autoRefresh': '自动刷新: 30秒', 'arb.positionSize': '仓位大小:',
    'arb.recalc': '重新计算', 'arb.invalidSize': '无效仓位大小', 'arb.feeRecalced': '费用已重新计算',
    'arb.feeNoteCustom': '基于 {size} 仓位。手续费: 现货0.1% + 合约0.04% + 滑点0.05%',
    'arb.grossProfit': '毛利润', 'arb.fundingIncome': '资金费收入', 'arb.spotFee': '现货手续费',
    'arb.futuresFee': '合约手续费', 'arb.slippage': '滑点', 'arb.totalFees': '总费用',
    'export.success': '已导出CSV', 'export.noData': '无数据可导出',
    'funding.settling': '正在结算!', 'funding.nextPayment': '下次资金费结算',
    'funding.countdownNote': '资金费率每8小时结算一次', 'funding.updated': '更新于:',
    // Funding
    'funding.title': '资金费率分析', 'funding.sentimentLabel': '市场情绪',
    'funding.avgRate': '平均费率', 'funding.positive': '正费率', 'funding.negative': '负费率',
    'funding.oppsTitle': '资金费率机会', 'funding.ratesTable': '全部资金费率',
    'funding.rate': '费率', 'funding.markPrice': '标记价格', 'funding.indexPrice': '指数价格',
    'funding.grossAPY': '毛年化', 'funding.netAPY': '净年化', 'funding.risk': '风险', 'funding.nextFunding': '下次结算',
    'funding.monthly': '月收益',
    'funding.bullish': '看涨', 'funding.bearish': '看跌', 'funding.neutral': '中性',
    'funding.noOpps': '无资金费率机会', 'funding.loaded': '资金费率数据已更新', 'funding.error': '加载资金费率失败',
    // Whale HTML labels
    'whale.volume24h': '24h 成交量', 'whale.largeTrades': '币安大额交易 (>$50万)',
    'whale.loading': '加载巨鲸数据...', 'whale.loadingOnchain': '加载链上数据...',
    'whale.blockHeight': '区块高度', 'whale.blockHash': '区块哈希',
    'whale.th.time': '时间', 'whale.th.symbol': '币种', 'whale.th.side': '方向', 'whale.th.price': '价格',
    'whale.th.quantity': '数量', 'whale.th.usdValue': 'USD价值',
    'whale.th.hash': '交易哈希', 'whale.th.btcAmount': 'BTC数量', 'whale.th.size': '规模',
    // Arb HTML labels
    'arb.tab.scanner': '套利扫描', 'arb.tab.funding': '资金费率',
    'arb.basisArbitrage': '基差套利机会', 'arb.highVolatility': '高波动币种',
    'arb.volatilityOpps': '高波动', 'arb.allCoins': '全币种价差分析',
    'arb.loading': '加载套利数据...', 'arb.loadingBasis': '加载基差机会...',
    'arb.loadingVolatility': '加载波动率数据...',
    'arb.th.symbol': '币种', 'arb.th.spotPrice': '现货价', 'arb.th.futuresPrice': '合约价',
    'arb.th.basis': '基差(%)', 'arb.th.fundingRate': '资金费率', 'arb.th.fundingApy': '资金年化',
    'arb.th.dayRange': '日内波幅', 'arb.th.openInterest': '持仓量', 'arb.th.volume': '成交量',
    // Funding HTML labels
    'funding.sentiment': '情绪', 'funding.opportunities': '资金费率机会',
    'funding.rates': '全部资金费率', 'funding.loadingOpps': '加载机会...',
    'funding.loadingRates': '加载资金费率...',
    'funding.th.symbol': '币种', 'funding.th.fundingRate': '资金费率',
    'funding.th.markPrice': '标记价格', 'funding.th.indexPrice': '指数价格',
    'funding.th.grossApy': '毛年化', 'funding.th.netApy': '净年化',
    'funding.th.riskLevel': '风险等级', 'funding.th.nextFunding': '下次结算',
    // Dashboard
    'h.dashboard': '仪表盘', 'dash.refresh': '刷新',
    'dash.btcPrice': 'BTC 价格', 'dash.ethPrice': 'ETH 价格',
    'dash.fearGreed': '恐慌贪婪指数', 'dash.marketSignal': '市场信号',
    'dash.btcPrice24h': 'BTC 价格 (24h)', 'dash.fgHistory': '恐慌贪婪指数走势 (30天)',
    'dash.techAnalysis': '技术分析 (BTC 4H)', 'dash.loadingIndicators': '加载指标中...',
    'dash.marketOverview': '市场总览',
    'dash.coin': '币种', 'dash.price': '价格', 'dash.change24h': '24h 涨跌',
    'dash.high24h': '24h 最高', 'dash.low24h': '24h 最低', 'dash.volume24h': '24h 成交量',
    // Risk
    'h.risk': '风控中心',
    'risk.calculator': '仓位风险计算器', 'risk.coin': '币种',
    'risk.positionSize': '持仓数量', 'risk.entryPrice': '入场价格 (USDT)',
    'risk.leverage': '杠杆倍数', 'risk.calculate': '计算风险', 'risk.reset': '重置',
    'risk.result': '风险分析结果', 'risk.inputHint': '输入仓位信息后点击"计算风险"',
    'risk.alerts': '价格预警', 'risk.targetPrice': '目标价格',
    'risk.direction': '方向', 'risk.above': '上穿（价格上涨至）',
    'risk.below': '下穿（价格下跌至）', 'risk.addAlert': '添加预警',
    'risk.safe': '安全', 'risk.warning': '警告', 'risk.danger': '危险！', 'risk.liquidated': '已爆仓！',
    'risk.currentPrice': '当前价格', 'risk.positionValue': '持仓价值',
    'risk.initialMargin': '初始保证金', 'risk.unrealizedPnl': '未实现盈亏',
    'risk.liquidationPrice': '爆仓价格', 'risk.distanceToLiq': '距爆仓距离',
    'risk.adviceSafe': '仓位健康，继续保持当前风控策略。',
    'risk.adviceWarning': '接近风险区间，考虑减仓或追加保证金。',
    'risk.adviceDanger': '警告：仓位面临爆仓高风险！强烈建议降低杠杆或平仓。',
    // Tools
    'h.tools': '投资工具',
    'tools.dca': '定投计算器（DCA）', 'tools.dcaCoin': '币种',
    'tools.monthlyInvestment': '每月投入 (USDT)', 'tools.period': '定投周期（月）',
    'tools.calculate': '计算',
    'tools.pnl': '盈亏计算器', 'tools.buyPrice': '买入价格 (USDT)',
    'tools.sellPrice': '卖出价格 (USDT)', 'tools.quantity': '数量',
    'tools.paper': '模拟交易（虚拟 $10,000 USDT）',
    'tools.balance': '余额: ', 'tools.resetTo10k': '重置为 $10K',
    'tools.paperCoin': '币种', 'tools.paperQty': '数量',
    'tools.buy': '买入', 'tools.sell': '卖出', 'tools.recentTrades': '最近交易',
    'tools.noTrades': '暂无交易 — 开始交易吧！',
    'tools.totalInvested': '总投入', 'tools.coinsAccumulated': '累计持币',
    'tools.currentValue': '当前价值', 'tools.currentPrice': '当前价格',
    'tools.profit': '盈亏', 'tools.roi': '投资回报率',
    'tools.cost': '成本', 'tools.revenue': '收入', 'tools.profitLoss': '盈亏',
    // AI Chat
    'h.ai': 'AI 智能助手',
    'ai.welcome': '欢迎使用 AlphaMind AI 智能助手！我可以帮您进行市场分析、交易建议和风险评估。\n\n您可以问我任何关于加密货币市场的问题，例如：\n- "BTC 现在行情怎么样？"\n- "该买入吗？"\n- "目前风险如何？"\n- "市场总览"',
    'ai.placeholder': '输入您的问题...',
    'ai.send': '发送',
    'ai.btcAnalysis': 'BTC 分析', 'ai.buyAdvice': '买入建议',
    'ai.riskCheck': '风险评估', 'ai.marketOverview': '市场总览', 'ai.sellAdvice': '卖出建议',
    // Common
    'btn.refresh': '刷新',
  },
};

function t(key) {
  return (i18n[currentLang] && i18n[currentLang][key]) || (i18n.en && i18n.en[key]) || key;
}

function setLang(lang) {
  if (!i18n[lang]) return;
  currentLang = lang;

  // Update toggle buttons
  document.querySelectorAll('.lang-toggle button').forEach(function(b) { b.classList.remove('active'); });
  document.querySelectorAll('.lang-toggle button').forEach(function(b) {
    if (b.textContent.trim() === (lang === 'en' ? 'EN' : '中文')) b.classList.add('active');
  });

  // Update nav items by matching data-page attribute to nav.* keys
  document.querySelectorAll('.nav-item[data-page]').forEach(function(item) {
    var page = item.dataset.page;
    var textEl = item.querySelector('.nav-text');
    var key = 'nav.' + page;
    if (textEl && i18n[lang][key]) textEl.textContent = i18n[lang][key];
  });

  // Update all elements with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach(function(el) {
    var key = el.dataset.i18n;
    if (i18n[lang][key]) el.textContent = i18n[lang][key];
  });

  // Update placeholders
  document.querySelectorAll('[data-i18n-ph]').forEach(function(el) {
    var key = el.dataset['i18nPh'];
    if (i18n[lang][key]) el.placeholder = i18n[lang][key];
  });

  // Update AI welcome message
  var welcomeEl = document.getElementById('ai-welcome-msg');
  if (welcomeEl && i18n[lang]['ai.welcome']) {
    welcomeEl.textContent = i18n[lang]['ai.welcome'];
  }

  // Update quick chat button data-quick attributes for Chinese
  var quickMap = lang === 'zh' ? {
    'BTC Analysis': ['BTC当前行情分析', 'BTC 分析'],
    'Buy Advice': ['现在该买入吗？', '买入建议'],
    'Risk Check': ['目前市场风险如何？', '风险评估'],
    'Market Overview': ['市场总览', '市场总览'],
    'Sell Advice': ['什么时候该卖出？', '卖出建议'],
  } : {
    'BTC 分析': ['BTC current analysis', 'BTC Analysis'],
    '买入建议': ['Should I buy now?', 'Buy Advice'],
    '风险评估': ['Current market risks', 'Risk Check'],
    '市场总览': ['Market overview', 'Market Overview'],
    '卖出建议': ['Sell timing advice', 'Sell Advice'],
  };
  document.querySelectorAll('.quick-btn[data-quick]').forEach(function(btn) {
    var entry = quickMap[btn.textContent.trim()];
    if (entry) {
      btn.dataset.quick = entry[0];
      btn.textContent = entry[1];
    }
  });

  localStorage.setItem('am_lang', lang);
}

// ─── Portfolio Export ─────────────────────────────────────────────────────
function exportPortfolioCSV() {
  var rows = [['Symbol', 'Amount', 'Avg Price', 'Current Value', 'PnL %']];
  var holdings = portfolio || [];
  if (holdings.length === 0) { showToast('No portfolio data to export', 'error'); return; }
  holdings.forEach(function(h) {
    rows.push([h.symbol, h.amount, h.avgPrice, '', '']);
  });
  var csv = rows.map(function(r) { return r.join(','); }).join('\n');
  var blob = new Blob([csv], { type: 'text/csv' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'alphamind-portfolio-' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Portfolio exported as CSV', 'success');
}

// ─── Keyboard Shortcuts ─────────────────────────────────────────────────
document.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  if (e.ctrlKey || e.metaKey) return;

  var pageMap = { '1': 'dashboard', '2': 'market', '3': 'portfolio', '4': 'sentiment', '5': 'risk', '6': 'tools', '7': 'whale', '8': 'arb', '9': 'bsc', '0': 'ai' };
  if (pageMap[e.key]) { e.preventDefault(); showPage(pageMap[e.key]); return; }
  if (e.key === 'r') {
    e.preventDefault();
    var active = document.querySelector('.page.active');
    if (active) {
      var id = active.id.replace('page-', '');
      if (id === 'dashboard') loadDashboard();
      else if (id === 'market') { loadMarketTable(); loadMarketChart(); }
      else if (id === 'bsc') loadBSCData();
      else if (id === 'whale') loadWhaleData();
      else if (id === 'arb') loadArbitrageData();
      showToast('Refreshed', 'success', 1500);
    }
    return;
  }
  if (e.key === 'e') { e.preventDefault(); exportPortfolioCSV(); }
});

// ─── Event Delegation (CSP-compliant — no inline handlers) ───────────────

document.addEventListener('click', function(e) {
  // Navigation items
  var navItem = e.target.closest('.nav-item[data-page]');
  if (navItem) { showPage(navItem.dataset.page); return; }

  // Data-action buttons
  var actionEl = e.target.closest('[data-action]');
  if (actionEl) {
    var action = actionEl.dataset.action;
    var actionMap = {
      'loadDashboard': loadDashboard,
      'showHelp': function() { showToast('Shortcuts: 1-8 Navigate | R Refresh | E Export', 'success', 5000); },
      'loadMarketChart': loadMarketChart,
      'addHolding': addHolding,
      'exportPortfolioCSV': exportPortfolioCSV,
      'analyzePortfolio': analyzePortfolio,
      'loadSentiment': loadSentiment,
      'calculateRisk': calculateRisk,
      'resetRisk': resetRisk,
      'addAlert': addAlert,
      'calcDCA': calcDCA,
      'calcPnL': calcPnL,
      'paperTradeBuy': function() { paperTrade('buy'); },
      'paperTradeSell': function() { paperTrade('sell'); },
      'resetPaperTrading': resetPaperTrading,
      'loadBSCData': loadBSCData,
      'loadWhaleData': loadWhaleData,
      'loadArbitrageData': loadArbitrageData,
      'showArbTab': showArbTab,
      'showFundingTab': showFundingTab,
      'sendChat': sendChat,
      'exportWhaleCSV': exportWhaleCSV,
      'exportWhaleTrades': exportWhaleTrades,
      'exportArbCSV': exportArbCSV,
      'exportArbCoins': exportArbCoins,
      'recalcFees': recalcFees,
      'mobileToggle': function() { document.querySelector('.sidebar').classList.toggle('open'); },
      'langEn': function() { setLang('en'); },
      'langZh': function() { setLang('zh'); },
    };
    if (actionMap[action]) { actionMap[action](); }
    return;
  }

  // Chart interval tabs
  var tab = e.target.closest('.tab[data-interval]');
  if (tab) { setChartInterval(tab, tab.dataset.interval); return; }

  // Quick chat buttons
  var quickBtn = e.target.closest('[data-quick]');
  if (quickBtn) { sendQuick(quickBtn.dataset.quick); return; }

  // Dynamic: remove holding
  var rmHolding = e.target.closest('[data-remove-holding]');
  if (rmHolding) { removeHolding(parseInt(rmHolding.dataset.removeHolding)); return; }

  // Dynamic: remove alert
  var rmAlert = e.target.closest('[data-remove-alert]');
  if (rmAlert) { removeAlert(parseInt(rmAlert.dataset.removeAlert)); return; }

  // Expandable opp cards
  var expandCard = e.target.closest('.opp-card.expandable');
  if (expandCard) { expandCard.classList.toggle('expanded'); return; }

  // Sortable table headers
  var sortTh = e.target.closest('th.sortable');
  if (sortTh) { handleSortClick(e); return; }
});

// Nav item keyboard support (Enter/Space)
document.addEventListener('keydown', function(e) {
  var navItem = e.target.closest('.nav-item[data-page]');
  if (navItem && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    showPage(navItem.dataset.page);
  }
});

// Chart symbol select change
var chartSymbolEl = document.getElementById('chart-symbol');
if (chartSymbolEl) chartSymbolEl.addEventListener('change', loadMarketChart);

// Chat input enter key
var chatInputEl = document.getElementById('chat-input');
if (chatInputEl) {
  chatInputEl.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') sendChat();
  });
}

// Skip-to-content link accessibility
var skipLink = document.getElementById('skip-link');
if (skipLink) {
  skipLink.addEventListener('focus', function() { this.style.left = '16px'; this.style.top = '16px'; this.style.width = 'auto'; this.style.height = 'auto'; });
  skipLink.addEventListener('blur', function() { this.style.left = '-9999px'; });
}

// ─── Init ────────────────────────────────────────────────────────────────
showWelcome();
loadDashboard();
connectSSE();

// Restore language (auto-detect Chinese browser if no saved preference)
var savedLang = localStorage.getItem('am_lang');
if (savedLang) {
  setLang(savedLang);
} else if (navigator.language && navigator.language.startsWith('zh')) {
  setLang('zh');
}

// Auto-refresh every 30 seconds for all data pages
setInterval(function() {
  var activePage = document.querySelector('.page.active');
  if (!activePage) return;
  var id = activePage.id;
  if (id === 'page-dashboard') loadDashboard();
  else if (id === 'page-whale') loadWhaleData();
  else if (id === 'page-arb') {
    var scannerTab = document.getElementById('arb-scanner-tab');
    if (scannerTab && scannerTab.style.display !== 'none') loadArbitrageData();
    else loadFundingRateData();
  }
  else if (id === 'page-bsc') loadBSCData();
}, 30000);
