let state = { period: 'realtime', timeline: 'intraday', chartMetric: 'mainNet', data: null, selected: null, sort: { key: 'mainNet', dir: 'desc' } };
let chart = null;
let rankChart = null;

const $ = (id) => document.getElementById(id);

function moneyYi(v, digits = 2) {
  if (v == null || v === '') return '-';
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  const yi = n / 1e8;
  return `${yi >= 0 ? '+' : ''}${yi.toFixed(digits)}亿`;
}

function axisYi(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  const yi = n / 1e8;
  const abs = Math.abs(yi);
  const digits = abs >= 10 ? 0 : abs >= 1 ? 1 : 2;
  return `${yi.toFixed(digits)}亿`;
}

function pct(v) {
  if (v == null || v === '') return '-';
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function cls(v) {
  if (v == null || v === '') return 'flat';
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return 'flat';
  return n > 0 ? 'up' : 'down';
}

function setActionStatus(message, type = '') {
  const el = $('actionStatus');
  if (!el) return;
  el.textContent = message || '';
  el.className = `action-status ${type}`.trim();
}

function formatRefreshResult(result) {
  if (result?.skipped) return result.reason || '非交易时段，已跳过实时拉取，展示缓存数据';
  if (!result?.success) return `刷新失败：${result?.error || '未知错误'}`;
  const changed = Number(result.changed || 0);
  const saved = Number(result.saved || 0);
  const expected = Number(result.expected || saved);
  const failed = Number(result.failed || 0);
  const intradaySaved = Number(result.intraday?.saved || 0);
  const intradayFailed = Number(result.intraday?.failed || 0);
  const time = result.capturedAt ? new Date(result.capturedAt).toLocaleTimeString() : new Date().toLocaleTimeString();
  const base = failed > 0 ? `成功 ${saved}/${expected} 只，失败 ${failed} 只` : `已确认 ${saved} 只`;
  const changedText = changed > 0 ? `${base}，变化 ${changed} 只` : `数据未变化，${base}`;
  const intradayText = intradaySaved > 0 || intradayFailed > 0 ? `，日内 ${intradaySaved} 条${intradayFailed > 0 ? `，日内失败 ${intradayFailed} 只` : ''}` : '';
  const errorText = failed > 0 && result.errors?.[0]?.error ? `；首个错误：${result.errors[0].error}` : '';
  return `刷新成功 ${time}：${changedText}${intradayText}${errorText}`;
}

function metricLabel(key) {
  return ({
    mainNet: '主力',
    retailNet: '散户',
    amount: '成交额',
    superLargeNet: '超大单',
    largeNet: '大单',
    midNet: '中单',
    smallNet: '小单'
  })[key] || key;
}

function hasValue(v) {
  return v != null && v !== '' && Number.isFinite(Number(v));
}

async function api(path, options) {
  const res = await fetch(path, options);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function postAction(action, payload = {}) {
  return api('/api/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload })
  });
}

async function load() {
  $('subtitle').textContent = '正在加载 ETF 资金流...';
  state.data = await api(`/api/fund-flows?period=${state.period}`);
  state.selected = state.data.sectors.find(s => s.sector === state.selected?.sector) || state.data.sectors[0] || null;
  render();
  await renderTimeline();
}

function renderSummary() {
  const d = state.data;
  $('topIn').innerHTML = (d.summary.inflowTop5 || []).map(s => s.sector).join('、') || '-';
  $('topOut').innerHTML = (d.summary.outflowTop5 || []).map(s => s.sector).join('、') || '-';
  $('coverage').textContent = `${d.summary.etfCount} 只 ETF / ${d.summary.sectorCount} 个板块`;
  const latest = d.sectors.map(s => s.latestAt).filter(Boolean).sort().at(-1);
  $('updatedAt').textContent = latest ? new Date(latest).toLocaleString() : '-';
  $('subtitle').textContent = `${labelPeriod(state.period)} · ${d.summary.etfCount} 只 ETF · ${new Date(d.generatedAt).toLocaleString()}`;
  $('rankChartPeriod').textContent = labelPeriod(state.period);
  $('tablePeriodLabel').textContent = labelPeriod(state.period);
  updateRankChartHelp();
}

function labelPeriod(p) {
  return ({ realtime: '实时', day: '当日', '3d': '近3日', '5d': '近5日', '10d': '近10日', '15d': '近15日', month: '本月', '3m': '近3个月', '6m': '近半年', '1y': '近一年' })[p] || p;
}

function renderRank() {
  const rows = sortedSectors();
  renderSortHeaders();
  $('rankBody').innerHTML = rows.map(s => `
    <tr data-sector="${s.sector}" class="${s.sector === state.selected?.sector ? 'selected' : ''}">
      <td><strong>${s.sector}</strong>${s.sampleWarning ? ' <span class="tag warn">样本少</span>' : ''}${s.partial ? ' <span class="tag bad">部分数据</span>' : ''}</td>
      <td><span class="money ${cls(s.mainNet)}">${moneyYi(s.mainNet)}</span></td>
      <td>${pct(s.mainRatio)}</td>
      <td class="${cls(s.superLargeNet)}">${moneyYi(s.superLargeNet)}</td>
      <td class="${cls(s.largeNet)}">${moneyYi(s.largeNet)}</td>
      <td>${s.etfCount}/${s.expectedCount}</td>
    </tr>
  `).join('');
  document.querySelectorAll('#rankBody tr').forEach(tr => {
    tr.addEventListener('click', async () => {
      state.selected = state.data.sectors.find(s => s.sector === tr.dataset.sector) || state.selected;
      render();
      await renderTimeline();
    });
  });
}

function sortedSectors() {
  const rows = [...(state.data?.sectors || [])];
  const { key, dir } = state.sort;
  const sign = dir === 'asc' ? 1 : -1;
  return rows.sort((a, b) => {
    let av;
    let bv;
    if (key === 'sector') {
      return String(a.sector).localeCompare(String(b.sector), 'zh-CN') * sign;
    }
    if (key === 'etfCount') {
      av = Number(a.etfCount) / Math.max(1, Number(a.expectedCount));
      bv = Number(b.etfCount) / Math.max(1, Number(b.expectedCount));
    } else {
      av = Number(a[key]);
      bv = Number(b[key]);
    }
    if (!Number.isFinite(av)) av = dir === 'asc' ? Infinity : -Infinity;
    if (!Number.isFinite(bv)) bv = dir === 'asc' ? Infinity : -Infinity;
    return (av - bv) * sign;
  });
}

function renderSortHeaders() {
  document.querySelectorAll('th.sortable').forEach(th => {
    const label = th.dataset.baseLabel || th.textContent.replace(/[↑↓]\s*$/, '').trim();
    th.dataset.baseLabel = label;
    th.textContent = th.dataset.sort === state.sort.key ? `${label} ${state.sort.dir === 'asc' ? '↑' : '↓'}` : label;
  });
}

function renderDetail() {
  const s = state.selected;
  if (!s) return;
  $('detailTitle').textContent = s.sector;
  $('detailDesc').textContent = `${labelPeriod(state.period)} · ${s.etfCount}/${s.expectedCount} 只 ETF 有资金流数据`;
  $('detailMoney').textContent = moneyYi(s.mainNet);
  $('detailMoney').className = `money ${cls(s.mainNet)}`;
  $('metrics').innerHTML = [
    ['主力净流入', moneyYi(s.mainNet)],
    ['主力净占比', pct(s.mainRatio)],
    ['成交额', moneyYi(s.amount, 1)],
    ['超大单', moneyYi(s.superLargeNet)],
    ['大单', moneyYi(s.largeNet)],
    ['散户', moneyYi(s.retailNet)],
    ['中单', moneyYi(s.midNet)],
    ['小单', moneyYi(s.smallNet)]
  ].map(([label, val]) => `<div class="metric"><div class="label">${label}</div><div class="val">${val}</div></div>`).join('');
  $('etfBody').innerHTML = (s.etfs || []).map(e => `
    <tr>
      <td>${e.name}</td>
      <td>${e.code}</td>
      <td class="${cls(e.mainNet)}">${moneyYi(e.mainNet)}</td>
      <td>${pct(e.mainRatio)}</td>
      <td>${moneyYi(e.amount, 1)}</td>
      <td class="${cls(e.changePct)}">${pct(e.changePct)}</td>
    </tr>
  `).join('') || '<tr><td colspan="6" class="muted">该周期明细来自历史日表，暂无单 ETF 快照明细</td></tr>';
}

function renderStatus() {
  $('statusCards').innerHTML = (state.data.status || []).map(s => `
    <div class="card stat">
      <div class="label">${s.provider}</div>
      <div class="val" style="font-size:14px">${s.last_success_at ? new Date(s.last_success_at).toLocaleString() : '暂无成功'}</div>
      <div class="muted" style="font-size:12px;margin-top:6px">${s.last_error ? `错误：${s.last_error}` : `数据：${s.row_count || 0} 条`}</div>
    </div>
  `).join('') || '<div class="card muted">暂无数据源状态</div>';
}

function render() {
  renderSummary();
  renderFlowRankChart();
  renderRank();
  renderDetail();
  renderStatus();
}

function renderFlowRankChart() {
  if (!rankChart) {
    rankChart = echarts.init($('rankChart'));
    rankChart.on('click', async (params) => {
      const sector = params?.name;
      if (!sector) return;
      state.selected = state.data.sectors.find(s => s.sector === sector) || state.selected;
      render();
      await renderTimeline();
    });
  }
  const sectors = state.data?.sectors || [];
  const metric = state.chartMetric;
  const rows = [...sectors]
    .filter(r => hasValue(r[metric]))
    .sort((a, b) => Number(b[metric]) - Number(a[metric]));
  const isAmount = metric === 'amount';
  rankChart.setOption({
    backgroundColor: 'transparent',
    graphic: rows.length ? [] : [{
      type: 'text',
      left: 'center',
      top: 'middle',
      style: {
        text: isAmount ? '当前周期暂无成交额数据' : '当前周期暂无资金流数据',
        fill: '#8b949e',
        fontSize: 16,
        fontWeight: 700
      }
    }],
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#161b22',
      borderColor: '#30363d',
      textStyle: { color: '#c9d1d9' },
      formatter(items) {
        const item = items?.[0];
        const row = rows[item?.dataIndex];
        if (!row) return '';
        const mainLine = isAmount
          ? `${metricLabel(metric)}：${moneyYi(row[metric])}`
          : `${metricLabel(metric)}净额：${moneyYi(row[metric])}`;
        return `${row.sector}<br>${mainLine}<br>主力净流入：${moneyYi(row.mainNet)}<br>散户净额：${moneyYi(row.retailNet)}<br>ETF：${row.etfCount}/${row.expectedCount}`;
      }
    },
    grid: { left: 118, right: 86, top: 12, bottom: 28 },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#8b949e', formatter: axisYi },
      splitLine: { lineStyle: { color: '#30363d', type: 'dashed' } }
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: rows.map(r => r.sector),
      axisLabel: { color: '#c9d1d9', fontWeight: 700 },
      axisLine: { lineStyle: { color: '#30363d' } }
    },
    series: [{
      name: isAmount ? metricLabel(metric) : `${metricLabel(metric)}净额`,
      type: 'bar',
      data: rows.map(r => ({
        value: r[metric],
        itemStyle: { color: isAmount ? '#58a6ff' : Number(r[metric]) >= 0 ? '#ff7b72' : '#7ee787' },
        label: { position: isAmount || Number(r[metric]) >= 0 ? 'right' : 'left' }
      })),
      barMaxWidth: 18,
      label: {
        show: true,
        formatter: p => moneyYi(p.value),
        color: '#c9d1d9',
        fontWeight: 700
      },
      labelLayout: { hideOverlap: true }
    }]
  }, true);
}

function updateRankChartHelp() {
  const help = $('rankChartHelp');
  if (!help) return;
  if (state.chartMetric === 'amount') {
    help.textContent = '成交额为 ETF 总成交金额；目前实时/当日使用东财快照字段，长周期成交额需补完整历史成交额后展示';
  } else {
    help.textContent = '按 ETF 自身资金流汇总，红色为净流入，绿色为净流出；主力=超大单+大单，散户=中单+小单';
  }
}

async function renderTimeline() {
  if (!state.selected) return;
  const data = await api(`/api/fund-flows/timeline?sector=${encodeURIComponent(state.selected.sector)}&period=${state.timeline}`);
  if (!chart) chart = echarts.init($('flowChart'));
  const rows = data.rows || [];
  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#161b22',
      borderColor: '#30363d',
      textStyle: { color: '#c9d1d9' },
      valueFormatter: v => moneyYi(v)
    },
    legend: { top: 0, textStyle: { color: '#8b949e' } },
    grid: { left: '8%', right: '4%', top: 36, bottom: 34 },
    xAxis: { type: 'category', data: rows.map(r => r.time), axisLabel: { color: '#8b949e' }, axisLine: { lineStyle: { color: '#30363d' } } },
    yAxis: { type: 'value', axisLabel: { color: '#8b949e', formatter: axisYi }, splitLine: { lineStyle: { color: '#30363d', type: 'dashed' } } },
    dataZoom: rows.length > 40 ? [{ type: 'inside' }, { type: 'slider', bottom: 0, height: 18, textStyle: { color: '#8b949e' } }] : [],
    series: [
      { name: '主力净流入', type: 'line', showSymbol: false, data: rows.map(r => r.main_net), lineStyle: { width: 2, color: '#ffa657' }, areaStyle: { opacity: 0.08 } },
      { name: '超大单', type: 'line', showSymbol: false, data: rows.map(r => r.super_large_net), lineStyle: { width: 1, color: '#ff7b72' } },
      { name: '大单', type: 'line', showSymbol: false, data: rows.map(r => r.large_net), lineStyle: { width: 1, color: '#58a6ff' } }
    ]
  }, true);
}

document.querySelectorAll('.period').forEach(btn => {
  btn.addEventListener('click', async () => {
    state.period = btn.dataset.period;
    document.querySelectorAll('.period').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    await load();
  });
});

document.querySelectorAll('.timeline').forEach(btn => {
  btn.addEventListener('click', async () => {
    state.timeline = btn.dataset.period;
    document.querySelectorAll('.timeline').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    await renderTimeline();
  });
});

document.querySelectorAll('.metric-mode').forEach(btn => {
  btn.addEventListener('click', () => {
    state.chartMetric = btn.dataset.metric;
    document.querySelectorAll('.metric-mode').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateRankChartHelp();
    renderFlowRankChart();
  });
});

document.querySelectorAll('th.sortable').forEach(th => {
  th.addEventListener('click', () => {
    const key = th.dataset.sort;
    if (state.sort.key === key) {
      state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
    } else {
      state.sort.key = key;
      state.sort.dir = key === 'sector' ? 'asc' : 'desc';
    }
    renderRank();
  });
});

$('refreshBtn').addEventListener('click', async () => {
  $('refreshBtn').disabled = true;
  $('refreshBtn').textContent = '刷新中...';
  setActionStatus('正在请求东方财富 ETF 资金流...', '');
  try {
    const result = await postAction('updateEtfFundFlows');
    setActionStatus(formatRefreshResult(result), result?.success ? (Number(result.failed || 0) > 0 ? 'warn' : Number(result.changed || 0) > 0 ? 'ok' : 'warn') : 'bad');
    $('refreshBtn').textContent = '更新页面中...';
    await load();
    await refreshUpdateStatus();
  } catch (e) {
    setActionStatus(`刷新失败：${e.message}`, 'bad');
    await load().catch(() => {});
  } finally {
    $('refreshBtn').disabled = false;
    $('refreshBtn').textContent = '刷新资金流';
  }
});

$('backfillBtn').addEventListener('click', async () => {
  $('backfillBtn').disabled = true;
  $('backfillBtn').textContent = '补历史中...';
  setActionStatus('正在补 ETF 历史资金流...', '');
  try {
    const result = await postAction('backfillEtfFundFlows', { limit: 260 });
    if (result?.success) {
      setActionStatus(`补历史完成：写入 ${result.saved || 0} 条，失败 ${result.failed || 0} 只`, result.failed ? 'warn' : 'ok');
    } else {
      setActionStatus(`补历史失败：${result?.error || '未知错误'}`, 'bad');
    }
    $('backfillBtn').textContent = '更新页面中...';
    await load();
  } catch (e) {
    setActionStatus(`补历史失败：${e.message}`, 'bad');
    await load().catch(() => {});
  } finally {
    $('backfillBtn').disabled = false;
    $('backfillBtn').textContent = '补历史资金流';
  }
});

window.addEventListener('resize', () => {
  chart?.resize();
  rankChart?.resize();
});

// ---- 自动更新状态（精简行 + 详情弹窗）----
function fmtLogTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleTimeString('zh-CN', { hour12: false });
}

function logSummaryText(log) {
  const result = log.success ? '成功' : '失败';
  const snap = `快照 ${log.snapshot_saved}/${log.snapshot_expected || log.snapshot_saved}`;
  const failText = log.snapshot_failed > 0 ? `，失败 ${log.snapshot_failed}` : '';
  const intra = log.slice_count
    ? `日内分片 ${(log.slice_index ?? 0) + 1}/${log.slice_count}（+${log.intraday_saved} 条${log.intraday_failed > 0 ? `，失败 ${log.intraday_failed}` : ''}）`
    : `日内 +${log.intraday_saved} 条`;
  return `${result} · ${snap}${failText} · ${intra}`;
}

async function refreshUpdateStatus() {
  try {
    const data = await api('/api/fund-flows/update-log?limit=20');
    const latest = data.logs?.[0];
    const dot = $('autoDot');
    if (!latest) {
      dot.className = 'dot';
      $('autoText').textContent = data.trading
        ? '交易时段，自动更新进行中（每 10 分钟一轮）'
        : '当前非交易时段，自动更新已暂停，展示缓存数据';
      return;
    }
    const kindLabel = latest.kind === 'manual' ? '手动' : '自动';
    dot.className = `dot ${latest.success ? (latest.snapshot_failed > 0 ? 'warn' : 'ok') : 'bad'}`;
    const paused = data.trading ? '' : '（非交易时段，自动更新暂停）';
    $('autoText').textContent = `最近${kindLabel}更新 ${fmtLogTime(latest.started_at)}：${logSummaryText(latest)} ${paused}`;
    // 详情弹窗内容
    $('updateModalMeta').textContent = `服务器时间 ${new Date(data.serverTime).toLocaleString('zh-CN', { hour12: false })} · ${data.trading ? '交易时段，每 10 分钟自动更新一轮' : '当前非交易时段，自动更新暂停'}`;
    $('updateLogBody').innerHTML = (data.logs || []).map(log => `
      <tr>
        <td>${new Date(log.started_at).toLocaleString('zh-CN', { hour12: false })}</td>
        <td>${log.kind === 'manual' ? '手动' : '自动'}</td>
        <td class="${log.success ? 'down' : 'up'}">${log.success ? '成功' : '失败'}</td>
        <td>${log.snapshot_saved}/${log.snapshot_expected || log.snapshot_saved}${log.snapshot_failed > 0 ? `（失败 ${log.snapshot_failed}）` : ''}</td>
        <td>${log.changed || 0}</td>
        <td>${log.slice_count ? `分片 ${(log.slice_index ?? 0) + 1}/${log.slice_count}，` : ''}+${log.intraday_saved} 条${log.intraday_failed > 0 ? `，失败 ${log.intraday_failed}` : ''}</td>
        <td>${log.duration_ms != null ? (log.duration_ms / 1000).toFixed(1) + 's' : '-'}</td>
        <td class="muted">${log.error || ''}</td>
      </tr>`).join('');
  } catch (e) {
    $('autoText').textContent = '自动更新状态获取失败：' + e.message;
    $('autoDot').className = 'dot bad';
  }
}

$('updateDetailBtn').addEventListener('click', async () => {
  await refreshUpdateStatus();
  $('updateModal').classList.add('show');
});
$('updateModalClose').addEventListener('click', () => $('updateModal').classList.remove('show'));
$('updateModal').addEventListener('click', e => {
  if (e.target === $('updateModal')) $('updateModal').classList.remove('show');
});

refreshUpdateStatus();
setInterval(refreshUpdateStatus, 60 * 1000);

load().catch(e => {
  $('subtitle').textContent = '加载失败：' + e.message;
  console.error(e);
});
