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
      infoHtml += '<span>Signal: <strong style="color:' + (indicators.signal === 'buy' ? 'var(--up)' : indicators.signal === 'sell' ? 'var(--down)' : 'var(--warning)') + '">' + indicators.signal.toUpperCase() + '</strong></span>';
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

  var r = await api('/api/risk', { body: { symbol: symbol, quantity: quantity, entryPrice: entryPrice, leverage: leverage } });
  if (r.error) { document.getElementById('risk-result').innerHTML = '<div class="loading">' + escapeHtml(r.error) + '</div>'; return; }

  var riskColors = { safe: 'risk-safe', warning: 'risk-warning', danger: 'risk-danger', liquidated: 'risk-danger' };
  var riskLabels = { safe: 'Safe', warning: 'Warning', danger: 'Danger!', liquidated: 'LIQUIDATED!' };
  var pnlCls = r.pnlAmount >= 0 ? 'up' : 'down';

  document.getElementById('risk-result').innerHTML =
    '<div class="card-title">Risk Analysis Result</div>' +
    '<div class="risk-meter" style="margin-bottom:16px;font-size:1.2em">' +
      '<div class="risk-dot ' + riskColors[r.riskRating] + '"></div>' +
      riskLabels[r.riskRating] +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
      '<div><small style="color:var(--text-dim)">Current Price</small><br><strong>' + fmtUSD(r.currentPrice) + '</strong></div>' +
      '<div><small style="color:var(--text-dim)">Position Value</small><br><strong>' + fmtUSD(r.currentValue) + '</strong></div>' +
      '<div><small style="color:var(--text-dim)">Initial Margin</small><br><strong>' + fmtUSD(r.initialMargin) + '</strong></div>' +
      '<div class="' + pnlCls + '"><small style="color:var(--text-dim)">Unrealized P&amp;L</small><br><strong>' + fmtUSD(r.pnlAmount) + ' (' + fmtPct(r.pnlPercentage) + ')</strong></div>' +
      '<div><small style="color:var(--text-dim)">Liquidation Price</small><br><strong style="color:var(--accent)">' + fmtUSD(r.liquidationPrice) + '</strong></div>' +
      '<div><small style="color:var(--text-dim)">Distance to Liq.</small><br><strong>' + fmt(r.liquidationDistance) + '%</strong></div>' +
    '</div>' +
    '<div class="advice-box" style="margin-top:16px">' +
      (r.riskRating === 'safe' ? 'Position is healthy. Maintain current risk management strategy.' :
        r.riskRating === 'warning' ? 'Approaching risk zone. Consider reducing position or adding margin.' :
        'CRITICAL: Position at high risk of liquidation! Strongly recommend reducing leverage or closing position.') +
    '</div>';
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

  var r = await api('/api/dca', { body: { symbol: symbol, monthlyAmount: monthlyAmount, months: months } });
  if (r.error) { document.getElementById('dca-result').innerHTML = '<p>' + escapeHtml(r.error) + '</p>'; return; }

  var profitCls = r.profit >= 0 ? 'up' : 'down';
  document.getElementById('dca-result').innerHTML =
    '<div class="dca-result">' +
      '<div class="dca-item"><div class="dca-item-label">Total Invested</div><div class="dca-item-value">' + fmtUSD(r.totalInvested) + '</div></div>' +
      '<div class="dca-item"><div class="dca-item-label">Coins Accumulated</div><div class="dca-item-value">' + r.totalCoins.toFixed(6) + '</div></div>' +
      '<div class="dca-item"><div class="dca-item-label">Current Value</div><div class="dca-item-value">' + fmtUSD(r.currentValue) + '</div></div>' +
      '<div class="dca-item"><div class="dca-item-label">Current Price</div><div class="dca-item-value">' + fmtUSD(r.currentPrice) + '</div></div>' +
      '<div class="dca-item"><div class="dca-item-label">Profit</div><div class="dca-item-value ' + profitCls + '">' + fmtUSD(r.profit) + '</div></div>' +
      '<div class="dca-item"><div class="dca-item-label">ROI</div><div class="dca-item-value ' + profitCls + '">' + fmtPct(r.profitPercent) + '</div></div>' +
    '</div>' +
    '<div class="advice-box" style="margin-top:12px">' +
      'DCA Strategy: Investing $' + monthlyAmount + '/month for ' + months + ' months at current ' + symbol + ' price. ' +
      'Regular investment reduces timing risk and smooths out volatility.' +
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
      '<div class="dca-item"><div class="dca-item-label">Cost</div><div class="dca-item-value">' + fmtUSD(buy * qty) + '</div></div>' +
      '<div class="dca-item"><div class="dca-item-label">Revenue</div><div class="dca-item-value">' + fmtUSD(sell * qty) + '</div></div>' +
      '<div class="dca-item"><div class="dca-item-label">Profit/Loss</div><div class="dca-item-value ' + cls + '">' + fmtUSD(profit) + ' (' + fmtPct(pct) + ')</div></div>' +
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
  sseSource.addEventListener('connected', function() { console.log('SSE connected'); });
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

// ─── i18n (basic) ─────────────────────────────────────────────────────────
var i18n = {
  en: { dashboard: 'Dashboard', market: 'Market', portfolio: 'Portfolio', sentiment: 'Sentiment', risk: 'Risk Control', tools: 'Tools', ai: 'AI Chat' },
  zh: { dashboard: '仪表盘', market: '行情', portfolio: '投资组合', sentiment: '市场情绪', risk: '风险控制', tools: '工具', ai: 'AI 对话' },
};
function setLang(lang) {
  if (!i18n[lang]) return;
  document.querySelectorAll('.lang-toggle button').forEach(function(b) { b.classList.remove('active'); });
  document.querySelectorAll('.lang-toggle button').forEach(function(b) {
    if (b.textContent.trim() === (lang === 'en' ? 'EN' : '中文')) b.classList.add('active');
  });
  var t = i18n[lang];
  var navItems = document.querySelectorAll('.nav-item .nav-text');
  var keys = Object.keys(t);
  navItems.forEach(function(el, i) { if (keys[i] && t[keys[i]]) el.textContent = t[keys[i]]; });
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

  var pageMap = { '1': 'dashboard', '2': 'market', '3': 'portfolio', '4': 'sentiment', '5': 'risk', '6': 'tools', '7': 'ai', '8': 'bsc' };
  if (pageMap[e.key]) { e.preventDefault(); showPage(pageMap[e.key]); return; }
  if (e.key === 'r') {
    e.preventDefault();
    var active = document.querySelector('.page.active');
    if (active) {
      var id = active.id.replace('page-', '');
      if (id === 'dashboard') loadDashboard();
      else if (id === 'market') { loadMarketTable(); loadMarketChart(); }
      else if (id === 'bsc') loadBSCData();
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
      'addAlert': addAlert,
      'calcDCA': calcDCA,
      'calcPnL': calcPnL,
      'paperTradeBuy': function() { paperTrade('buy'); },
      'paperTradeSell': function() { paperTrade('sell'); },
      'resetPaperTrading': resetPaperTrading,
      'loadBSCData': loadBSCData,
      'sendChat': sendChat,
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

// Restore language
var savedLang = localStorage.getItem('am_lang');
if (savedLang && savedLang !== 'en') setLang(savedLang);

// Auto-refresh every 30 seconds
setInterval(function() {
  var activePage = document.querySelector('.page.active');
  if (activePage && activePage.id === 'page-dashboard') loadDashboard();
}, 30000);
