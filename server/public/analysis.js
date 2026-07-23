let state = { mode: 'swing', data: null, selected: null, filters: { low: false, trend: false, excludeHot: true } };
let chart = null;

const $ = (id) => document.getElementById(id);
const fmt = (v, d = 1) => Number.isFinite(v) ? v.toFixed(d) : '-';
const signed = (v, d = 1) => Number.isFinite(v) ? `${v >= 0 ? '+' : ''}${v.toFixed(d)}%` : '-';

function tagClass(t) {
  if (t === '低位企稳' || t === '趋势转强' || t === '高位回踩确认' || t === '高位回踩企稳迹象') return 'good';
  if (t === '高位追涨' || t === '风险偏高' || t === '高位回踩偏弱') return 'hot';
  if (t === '强势突破' || t === '高位回踩' || t === '高位回踩观察') return 'warn';
  return '';
}

async function api(path, options) {
  const res = await fetch(path, options);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function load() {
  $('subtitle').textContent = '正在加载分析数据...';
  state.data = await api(`/api/analysis?mode=${state.mode}${state.selected?.sector ? `&sector=${encodeURIComponent(state.selected.sector)}` : ''}`);
  state.selected = state.data.sectors.find(s => s.sector === state.data.detailSector) || state.data.sectors[0] || null;
  render();
}

async function loadSectorDetail(sector) {
  const next = await api(`/api/analysis?mode=${state.mode}&sector=${encodeURIComponent(sector)}`);
  state.data = next;
  state.selected = next.sectors.find(s => s.sector === next.detailSector) || next.sectors.find(s => s.sector === sector) || next.sectors[0] || null;
  render();
}

function renderSummary() {
  const d = state.data;
  $('top5').innerHTML = d.summary.top5.map(x => x.sector).join('、') || '-';
  $('lowStable').textContent = d.summary.lowStableCount;
  $('trendUp').textContent = d.summary.trendUpCount;
  $('highRisk').textContent = d.summary.highRiskCount;
  $('historyRange').textContent = d.history.minDate ? `${d.history.minDate} ~ ${d.history.maxDate}` : '无历史';
  $('subtitle').textContent = `模式：${state.mode} · ${d.summary.sectorCount} 个板块 · ${d.summary.etfCount} 只 ETF · ${new Date(d.generatedAt).toLocaleString()}`;
  const warn = $('historyWarn');
  warn.style.display = d.history.insufficient ? 'block' : 'none';
  warn.textContent = d.history.message;
}

function filteredSectors() {
  let rows = [...(state.data?.sectors || [])];
  if (state.filters.low) rows = rows.filter(s => s.labels.includes('低位企稳'));
  if (state.filters.trend) rows = rows.filter(s => s.labels.includes('趋势转强'));
  if (state.filters.excludeHot) rows = rows.filter(s => !s.labels.includes('高位追涨'));
  return rows;
}

function renderRank() {
  const rows = filteredSectors();
  if (!rows.find(r => r.sector === state.selected?.sector)) state.selected = rows[0] || state.data.sectors[0] || null;
  $('rankBody').innerHTML = rows.map(s => `
    <tr data-sector="${s.sector}" class="${s.sector === state.selected?.sector ? 'selected' : ''}">
      <td><strong>${s.sector}</strong>${s.sampleWarning ? ' <span class="tag warn">样本少</span>' : ''}</td>
      <td><span class="score">${fmt(s.opportunityScore)}</span></td>
      <td>${fmt(s.scores.position)}</td>
      <td>${fmt(s.scores.trend)}</td>
      <td>${fmt(s.scores.momentum)}</td>
      <td>${fmt(s.scores.risk)}</td>
      <td>${s.labels.map(t => `<span class="tag ${tagClass(t)}">${t}</span>`).join('')}</td>
      <td>${s.leader.name}</td>
    </tr>
  `).join('');
  document.querySelectorAll('#rankBody tr').forEach(tr => {
    tr.addEventListener('click', async () => {
      $('detailDesc').textContent = '正在加载板块 K 线...';
      await loadSectorDetail(tr.dataset.sector);
    });
  });
}

function renderDetail() {
  const s = state.selected;
  if (!s) return;
  if (!s.etfs?.[0]?.kline) {
    $('detailTitle').textContent = s.sector;
    $('detailDesc').textContent = '点击左侧板块加载 K 线详情';
    $('detailScore').textContent = fmt(s.opportunityScore);
    $('detailTags').innerHTML = s.labels.map(t => `<span class="tag ${tagClass(t)}">${t}</span>`).join('');
    $('metrics').innerHTML = '';
    $('etfBody').innerHTML = '';
    chart?.clear();
    return;
  }
  $('detailTitle').textContent = s.sector;
  $('detailDesc').textContent = s.explanation;
  $('detailScore').textContent = fmt(s.opportunityScore);
  $('detailTags').innerHTML = s.labels.map(t => `<span class="tag ${tagClass(t)}">${t}</span>`).join('');
  $('metrics').innerHTML = [
    ['250日位置', `${fmt(s.metrics.positionPct, 0)}%`],
    ['今日', signed(s.metrics.ret1)],
    ['近5日', signed(s.metrics.ret5)],
    ['近20日', signed(s.metrics.ret20)],
    ['20日高点回撤', signed(s.metrics.pullback20High)],
    ['日内收盘位置', `${fmt(s.metrics.closeLocation, 0)}%`],
    ['离MA20', signed(s.metrics.ma20DistancePct)],
    ['60日回撤', signed(s.metrics.drawdown60)]
  ].map(([label, val]) => `<div class="metric"><div class="label">${label}</div><div class="val">${val}</div></div>`).join('');

  $('etfBody').innerHTML = s.etfs.map(e => `
    <tr>
      <td>${e.name}${e.isRealtime ? ' <span class="tag warn">实时</span>' : ''}</td>
      <td>${e.code}</td>
      <td><span class="tag ${tagClass(e.phase?.label)}">${e.phase?.label || '-'}</span></td>
      <td>${fmt(e.opportunityScore)}</td>
      <td>${signed(e.metrics.ret1)}</td>
      <td>${signed(e.metrics.ret20)}</td>
      <td>${fmt(e.metrics.positionPct, 0)}%</td>
    </tr>
  `).join('');

  renderChart(s.etfs[0]);
}

function renderChart(etf) {
  if (!chart) chart = echarts.init($('klineChart'));
  const rows = etf.kline || [];
  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: '#161b22', borderColor: '#30363d', textStyle: { color: '#c9d1d9' } },
    legend: { top: 0, textStyle: { color: '#8b949e' } },
    grid: { left: '8%', right: '4%', top: 34, bottom: 34 },
    xAxis: { type: 'category', data: rows.map(r => r.date), axisLabel: { color: '#8b949e' }, axisLine: { lineStyle: { color: '#30363d' } } },
    yAxis: { type: 'value', scale: true, axisLabel: { color: '#8b949e' }, splitLine: { lineStyle: { color: '#30363d', type: 'dashed' } } },
    dataZoom: [{ type: 'inside' }, { type: 'slider', bottom: 0, height: 18, textStyle: { color: '#8b949e' } }],
    series: [
      { name: etf.name, type: 'candlestick', data: rows.map(r => [r.open, r.close, r.low, r.high]), itemStyle: { color: '#ff7b72', color0: '#7ee787', borderColor: '#ff7b72', borderColor0: '#7ee787' } },
      { name: 'MA5', type: 'line', showSymbol: false, data: rows.map(r => r.ma5), lineStyle: { width: 1, color: '#58a6ff' } },
      { name: 'MA20', type: 'line', showSymbol: false, data: rows.map(r => r.ma20), lineStyle: { width: 1, color: '#d2a8ff' } },
      { name: 'MA60', type: 'line', showSymbol: false, data: rows.map(r => r.ma60), lineStyle: { width: 1, color: '#ffa657' } },
      { name: 'MA120', type: 'line', showSymbol: false, data: rows.map(r => r.ma120), lineStyle: { width: 1, color: '#7ee787' } }
    ]
  }, true);
}

function renderWatchlist(id, rows) {
  $(id).innerHTML = (rows || []).map(s => `<li><span>${s.sector}</span><strong>${fmt(s.opportunityScore)}</strong></li>`).join('') || '<li class="muted">暂无</li>';
}

function renderWatchlists() {
  renderWatchlist('watchWorth', state.data.watchlists.worthWatching);
  renderWatchlist('watchStrong', state.data.watchlists.alreadyStrong);
  renderWatchlist('watchAvoid', state.data.watchlists.avoid);
}

function render() {
  renderSummary();
  renderRank();
  renderDetail();
  renderWatchlists();
}

document.querySelectorAll('.mode').forEach(btn => {
  btn.addEventListener('click', async () => {
    state.mode = btn.dataset.mode;
    document.querySelectorAll('.mode').forEach(b => { b.classList.remove('active', 'btn'); b.classList.add('btn3'); });
    btn.classList.add('active', 'btn');
    btn.classList.remove('btn3');
    await load();
  });
});

$('lowFilter').addEventListener('click', () => { state.filters.low = !state.filters.low; $('lowFilter').classList.toggle('active', state.filters.low); renderRank(); renderDetail(); });
$('trendFilter').addEventListener('click', () => { state.filters.trend = !state.filters.trend; $('trendFilter').classList.toggle('active', state.filters.trend); renderRank(); renderDetail(); });
$('excludeHot').addEventListener('click', () => { state.filters.excludeHot = !state.filters.excludeHot; $('excludeHot').classList.toggle('active', state.filters.excludeHot); renderRank(); renderDetail(); });
$('refreshBtn').addEventListener('click', load);
$('historyBtn').addEventListener('click', async () => {
  $('historyBtn').textContent = '补历史中...';
  $('historyBtn').disabled = true;
  await api('/api/message', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'fetchETFHistory' }) });
  $('historyBtn').disabled = false;
  $('historyBtn').textContent = '补 ETF 历史';
  await load();
});
window.addEventListener('resize', () => chart?.resize());
load().catch(e => {
  $('subtitle').textContent = '加载失败：' + e.message;
  console.error(e);
});
