// ======================== ECharts 可用性检查 ========================
if (typeof echarts === 'undefined') {
  const warn = document.createElement('div');
  warn.style.cssText = 'position:fixed;top:0;left:0;right:0;padding:20px;background:#da3633;color:white;z-index:99999;font-size:16px;text-align:center;';
  warn.innerHTML = '<b>ECharts 加载失败</b> — 请检查 echarts.min.js 是否存在，或刷新扩展后重试。';
  document.body.appendChild(warn);
}

// ======================== 智能板块分类 ========================
function classifySector(name) {
  const n = name;
  if (n.includes('新能源车')) return '新能源/汽车';
  if (n.includes('光伏')) return '新能源/光伏';
  if (n.includes('新能源')) return '新能源';
  if (n.includes('创新药')) return '医药/创新药';
  if (n.includes('医疗创新')) return '医药/医疗创新';
  if (n.includes('医疗')) return '医药/医疗';
  if (n.includes('中药')) return '医药/中药';
  if (n.includes('稀土')) return '有色金属/稀土';
  if (n.includes('稀有金属') || n.includes('有色金属')) return '有色金属/材料';
  if (n.includes('半导体') || n.includes('芯片') || n.includes('科创芯片')) return '半导体/芯片';
  if (n.includes('通信')) return '通信';
  if (n.includes('证券') || n.includes('券商')) return '金融/非银';
  if (n.includes('银行')) return '金融/银行';
  if (n.includes('黄金')) return '黄金/贵金属';
  if (n.includes('煤炭')) return '能源/煤炭';
  if (n.includes('机器人')) return '机器人/制造';
  if (n.includes('央企')) return '央企/改革';
  if (n.includes('云计算')) return '科技/云计算';
  if (n.includes('计算机')) return '科技/计算机';
  if (n.includes('软件')) return '科技/软件';
  if (n.includes('红利')) return '红利/策略';
  if (n.includes('基建')) return '基建/建筑';
  if (n.includes('航空') || n.includes('航天')) return '航天航空';
  if (n.includes('国防') || n.includes('军工')) return '国防/军工';
  if (n.includes('家电')) return '消费/家电';
  if (n.includes('钢铁')) return '钢铁/材料';
  if (n.includes('房地产')) return '房地产';
  if (n.includes('游戏')) return '传媒/文娱';
  if (n.includes('传媒') || n.includes('影视')) return '传媒/文娱';
  if (n.includes('食品') || n.includes('饮料')) return '消费/食品饮料';
  if (n.includes('酒') || n.includes('白酒')) return '消费/白酒';
  if (n.includes('教育')) return '教育';
  return '其他';
}

const ETF_CODES = {
  'sh513310': '中韩半导体ETF', 'sh515050': '通信ETF华夏', 'sh515880': '通信ETF国泰',
  'sh588200': '科创芯片ETF嘉', 'sh512480': '半导体ETF国联', 'sz159995': '芯片ETF华夏',
  'sh562800': '稀有金属ETF嘉', 'sh515220': '煤炭ETF国泰', 'sh516150': '稀土ETF嘉实',
  'sh562500': '机器人ETF华夏', 'sh515790': '光伏ETF华泰柏', 'sh512950': '央企改革ETF华',
  'sh512400': '有色金属ETF南', 'sh516160': '新能源ETF南方', 'sh515700': '新能源车ETF平',
  'sh516510': '云计算ETF易方', 'sh515080': '中证红利ETF招', 'sh512720': '计算机ETF国泰',
  'sh518880': '黄金ETF华安', 'sh516970': '基建ETF广发', 'sh512670': '国防ETF鹏华',
  'sh512800': '银行ETF华宝', 'sz159996': '家电ETF国泰', 'sh512660': '军工ETF国泰',
  'sh512880': '证券ETF国泰', 'sh512000': '券商ETF华宝', 'sz159647': '中药ETF鹏华',
  'sh512170': '医疗ETF华宝', 'sh515210': '钢铁ETF国泰', 'sh516820': '医疗创新ETF平',
  'sh512200': '房地产ETF南方', 'sh512980': '传媒ETF广发', 'sh515170': '食品饮料ETF华',
  'sh516620': '影视ETF国泰', 'sh513360': '教育ETF博时', 'sh515230': '软件ETF国泰',
  'sh512690': '酒ETF鹏华', 'sh516010': '游戏ETF国泰',
  'sz159227': '航空航天ETF华夏', 'sz159992': '创新药ETF银华',
};

const DEFAULT_YTD = {
  'sh513310': 133.37, 'sh515050': 73.91, 'sh515880': 69.52, 'sh588200': 61.83,
  'sh512480': 56.9, 'sz159995': 48.96, 'sh562800': 23.98, 'sh515220': 17.41,
  'sh516150': 14.03, 'sh562500': 12.07, 'sh515790': 7.17, 'sh512950': 6.75,
  'sh512400': 6.64, 'sh516160': 5.88, 'sh515700': 3.36, 'sh516510': 0.41,
  'sh515080': 0.2, 'sh512720': -1.0, 'sh518880': -3.62, 'sh516970': -3.88,
  'sh512670': -4.31, 'sh512800': -4.62, 'sz159996': -6.07, 'sh512660': -6.48,
  'sh512880': -10.82, 'sh512000': -10.88, 'sz159647': -13.61, 'sh512170': -14.12,
  'sh515210': -15.92, 'sh516820': -16.07, 'sh512200': -16.81, 'sh512980': -17.84,
  'sh515170': -18.07, 'sh516620': -19.09, 'sh513360': -19.96, 'sh515230': -20.54,
  'sh512690': -23.32, 'sh516010': -27.57,
  'sz159227': -16.41, 'sz159992': 2.89,
};

// ======================== 全球指数配置 ========================
const INDEX_CODES = {
  'sh000001': { name: '上证指数', market: 'A股' },
  'sz399001': { name: '深证成指', market: 'A股' },
  'sz399006': { name: '创业板指', market: 'A股' },
  'sh000688': { name: '科创50',   market: 'A股' },
  'hkHSI':    { name: '恒生指数',   market: '港股' },
  'hkHSTECH': { name: '恒生科技',   market: '港股' },
  'usDJI':    { name: '道琼斯',     market: '美股' },
  'usIXIC':   { name: '纳斯达克',   market: '美股' },
  'usSPX':    { name: '标普500',    market: '美股' },
  'N225':     { name: '日经225',    market: '日韩', eastmoney: '100.N225' },
  'KS11':     { name: '韩国KOSPI',  market: '日韩', eastmoney: '100.KS11' },
};

let indexData = [];

async function fetchIndexData() {
  const tencentKeys = Object.keys(INDEX_CODES).filter(k => !INDEX_CODES[k].eastmoney);
  const tencentUrl = `https://qt.gtimg.cn/q=${tencentKeys.join(',')}`;
  const results = [];
  try {
    const resp = await fetch(tencentUrl);
    const text = await resp.text();
    for (const line of text.trim().split(';').filter(l => l.trim())) {
      const match = line.match(/v_([a-zA-Z0-9_]+)="(.*)"/);
      if (!match) continue;
      const key = match[1];
      const fields = match[2].split('~');
      if (fields.length < 35) continue;
      const cfg = INDEX_CODES[key];
      if (!cfg) continue;
      const price = parseFloat(fields[3]);
      const changePct = parseFloat(fields[32]);
      const prevClose = parseFloat(fields[4]);
      const change = price - prevClose;
      if (isNaN(price) || isNaN(changePct)) continue;
      results.push({ code: key, name: cfg.name, market: cfg.market, price, change, changePct });
    }
  } catch (e) { console.error('fetchIndexData tencent failed', e); }

  const eastmoneyKeys = Object.keys(INDEX_CODES).filter(k => INDEX_CODES[k].eastmoney);
  for (const key of eastmoneyKeys) {
    const cfg = INDEX_CODES[key];
    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${cfg.eastmoney}&fields=f43,f57,f58,f60,f170`;
    try {
      const resp = await fetch(url);
      const json = await resp.json();
      const d = json.data;
      if (!d) continue;
      const price = d.f43 / 100;
      const prevClose = d.f60 / 100;
      const changePct = d.f170 / 100;
      const change = price - prevClose;
      if (isNaN(price) || isNaN(changePct)) continue;
      results.push({ code: key, name: cfg.name, market: cfg.market, price, change, changePct });
    } catch (e) { console.error('fetchIndexData eastmoney failed', e); }
  }
  return results;
}

async function getYearStartPrice(code, year) {
  const prefix = code.startsWith('sh') ? 'sh' : 'sz';
  const num = code.replace(/^[a-z]+/, '');
  const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${prefix}${num},day,${year}-01-01,${year}-01-10,10,qfq`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    const stockData = data.data?.[`${prefix}${num}`];
    if (!stockData) return null;
    const days = stockData.qfqday || stockData.day;
    if (!days || days.length === 0) return null;
    return parseFloat(days[0][2]);
  } catch (e) { return null; }
}

async function fetchETFData() {
  const codes = Object.keys(ETF_CODES).join(',');
  const url = `https://qt.gtimg.cn/q=${codes}`;
  try {
    const response = await fetch(url);
    const text = await response.text();
    const currentData = {};
    const lines = text.trim().split(';').filter(l => l.trim());
    for (const line of lines) {
      const match = line.match(/v_([a-z]{2}\d{6})="(.*)"/);
      if (!match) continue;
      const key = match[1];
      const fields = match[2].split('~');
      if (fields.length < 35) continue;
      currentData[key] = { code: fields[2], currentPrice: parseFloat(fields[3]), changePct: parseFloat(fields[32]) };
    }
    const year = new Date().getFullYear();
    const yearStartPromises = Object.keys(ETF_CODES).map(async (key) => {
      const price = await getYearStartPrice(key, year);
      return { key, price };
    });
    const yearStartResults = await Promise.all(yearStartPromises);
    const etfs = [];
    for (const key of Object.keys(ETF_CODES)) {
      const current = currentData[key];
      const yearStart = yearStartResults.find(r => r.key === key);
      let ytd = DEFAULT_YTD[key] || 0;
      if (current && yearStart && yearStart.price && yearStart.price > 0) {
        const calcYtd = ((current.currentPrice - yearStart.price) / yearStart.price * 100);
        if (!isNaN(calcYtd)) ytd = calcYtd;
      }
      etfs.push({
        code: current?.code || key.replace(/^[a-z]+/, ''),
        name: ETF_CODES[key],
        sector: classifySector(ETF_CODES[key]),
        daily: current?.changePct || 0,
        ytd: parseFloat(ytd.toFixed(2)),
      });
    }
    return etfs;
  } catch (e) { console.error('fetchETFData failed', e); return null; }
}

// ======================== 默认数据 ========================
const DEFAULT = [
  {code:"513310",name:"中韩半导体ETF",daily:0.94,ytd:133.37},
  {code:"515050",name:"通信ETF华夏",daily:1.93,ytd:73.91},
  {code:"515880",name:"通信ETF国泰",daily:0.69,ytd:69.52},
  {code:"588200",name:"科创芯片ETF嘉",daily:1.28,ytd:61.83},
  {code:"512480",name:"半导体ETF国联",daily:1.91,ytd:56.9},
  {code:"159995",name:"芯片ETF华夏",daily:1.74,ytd:48.96},
  {code:"562800",name:"稀有金属ETF嘉",daily:-0.52,ytd:23.98},
  {code:"515220",name:"煤炭ETF国泰",daily:-1.47,ytd:17.41},
  {code:"516150",name:"稀土ETF嘉实",daily:-1.0,ytd:14.03},
  {code:"562500",name:"机器人ETF华夏",daily:0.0,ytd:12.07},
  {code:"515790",name:"光伏ETF华泰柏",daily:-0.29,ytd:7.17},
  {code:"512950",name:"央企改革ETF华",daily:0.97,ytd:6.75},
  {code:"512400",name:"有色金属ETF南",daily:0.29,ytd:6.64},
  {code:"516160",name:"新能源ETF南方",daily:-0.39,ytd:5.88},
  {code:"515700",name:"新能源车ETF平",daily:-0.92,ytd:3.36},
  {code:"516510",name:"云计算ETF易方",daily:-0.24,ytd:0.41},
  {code:"515080",name:"中证红利ETF招",daily:-0.84,ytd:0.2},
  {code:"512720",name:"计算机ETF国泰",daily:0.42,ytd:-1.0},
  {code:"518880",name:"黄金ETF华安",daily:0.17,ytd:-3.62},
  {code:"516970",name:"基建ETF广发",daily:-0.61,ytd:-3.88},
  {code:"512670",name:"国防ETF鹏华",daily:1.17,ytd:-4.31},
  {code:"512800",name:"银行ETF华宝",daily:-0.88,ytd:-4.62},
  {code:"159996",name:"家电ETF国泰",daily:-0.2,ytd:-6.07},
  {code:"512660",name:"军工ETF国泰",daily:1.34,ytd:-6.48},
  {code:"512880",name:"证券ETF国泰",daily:-0.18,ytd:-10.82},
  {code:"512000",name:"券商ETF华宝",daily:-0.19,ytd:-10.88},
  {code:"159647",name:"中药ETF鹏华",daily:-1.41,ytd:-13.61},
  {code:"512170",name:"医疗ETF华宝",daily:-0.34,ytd:-14.12},
  {code:"515210",name:"钢铁ETF国泰",daily:-1.85,ytd:-15.92},
  {code:"516820",name:"医疗创新ETF平",daily:-0.66,ytd:-16.07},
  {code:"512200",name:"房地产ETF南方",daily:-0.95,ytd:-16.81},
  {code:"512980",name:"传媒ETF广发",daily:-1.8,ytd:-17.84},
  {code:"515170",name:"食品饮料ETF华",daily:-1.32,ytd:-18.07},
  {code:"516620",name:"影视ETF国泰",daily:-2.39,ytd:-19.09},
  {code:"513360",name:"教育ETF博时",daily:-0.69,ytd:-19.96},
  {code:"515230",name:"软件ETF国泰",daily:-0.97,ytd:-20.54},
  {code:"512690",name:"酒ETF鹏华",daily:-1.91,ytd:-23.32},
  {code:"516010",name:"游戏ETF国泰",daily:-1.9,ytd:-27.57},
  {code:"159227",name:"航空航天ETF华夏",daily:5.45,ytd:-16.41},
  {code:"159992",name:"创新药ETF银华",daily:3.14,ytd:2.89},
];
DEFAULT.forEach(e => e.sector = classifySector(e.name));

let data = [...DEFAULT];
let sortCol = 'daily', sortDir = 'desc';
let dataSource = '默认';
let dailyChart = null, ytdChart = null, indexChart = null;

function updateStatus(msg) {
  document.getElementById('statusLine').textContent = msg;
}

function analyze() {
  const m = {};
  data.forEach(e => { (m[e.sector] = m[e.sector] || []).push(e); });
  return Object.entries(m).map(([s, arr]) => ({
    sector: s, count: arr.length,
    avgDaily: +(arr.reduce((a,b)=>a+b.daily,0)/arr.length).toFixed(2),
    avgYtd: +(arr.reduce((a,b)=>a+b.ytd,0)/arr.length).toFixed(2),
  }));
}

function badge(v) {
  if (v>0) return '<span class="badge up">+'+v+'%</span>';
  if (v<0) return '<span class="badge down">'+v+'%</span>';
  return '<span class="badge flat">0%</span>';
}

function renderCharts() {
  const sectors = analyze();
  const dailySorted = [...sectors].sort((a,b) => a.avgDaily - b.avgDaily);
  const ytdSorted = [...sectors].sort((a,b) => a.avgYtd - b.avgYtd);
  const upColor = '#ff7b72';
  const downColor = '#7ee787';
  const gridColor = '#30363d';
  const textColor = '#c9d1d9';

  const commonOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#161b22',
      borderColor: '#30363d',
      textStyle: { color: textColor },
      formatter: function(params) {
        const p = params[0];
        return p.name + '<br/>' + p.seriesName + ': ' + (p.value >= 0 ? '+' : '') + p.value + '%';
      }
    },
    grid: { left: '22%', right: '18%', top: '3%', bottom: '3%' },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#8b949e', fontSize: 11, formatter: '{value}%' },
      splitLine: { lineStyle: { color: gridColor, type: 'dashed' } },
      axisLine: { lineStyle: { color: gridColor } }
    },
    yAxis: {
      type: 'category',
      axisLabel: { color: textColor, fontSize: 11, interval: 0, width: 130, overflow: 'break' },
      axisLine: { lineStyle: { color: gridColor } },
      axisTick: { show: false }
    },
    animationDuration: 600
  };

  if (!dailyChart) dailyChart = echarts.init(document.getElementById('dailyChart'));
  dailyChart.setOption({
    ...commonOption,
    yAxis: { ...commonOption.yAxis, data: dailySorted.map(s => s.sector) },
    series: [{
      name: '当日涨跌',
      type: 'bar',
      data: dailySorted.map(s => ({
        value: s.avgDaily,
        itemStyle: { color: s.avgDaily >= 0 ? upColor : downColor, borderRadius: 3 }
      })),
      label: {
        show: true, position: 'right', color: textColor, fontSize: 11, fontWeight: 'bold',
        formatter: function(p) {
          const s = dailySorted[p.dataIndex];
          return (p.value >= 0 ? '+' : '') + p.value + '%  (' + s.count + '只)';
        }
      },
      barWidth: '55%'
    }]
  }, true);

  if (!ytdChart) ytdChart = echarts.init(document.getElementById('ytdChart'));
  ytdChart.setOption({
    ...commonOption,
    grid: { left: '22%', right: '22%', top: '3%', bottom: '3%' },
    yAxis: { ...commonOption.yAxis, data: ytdSorted.map(s => s.sector) },
    series: [{
      name: '年度涨跌',
      type: 'bar',
      data: ytdSorted.map(s => ({
        value: s.avgYtd,
        itemStyle: { color: s.avgYtd >= 0 ? upColor : downColor, borderRadius: 3 }
      })),
      label: {
        show: true, position: 'right', color: textColor, fontSize: 11, fontWeight: 'bold',
        formatter: function(p) {
          const s = ytdSorted[p.dataIndex];
          return (p.value >= 0 ? '+' : '') + p.value + '%  (' + s.count + '只)';
        }
      },
      barWidth: '55%'
    }]
  }, true);
}

function renderTable() {
  let sorted = [...data];
  sorted.sort((a,b) => {
    if (typeof a[sortCol] === 'number') return sortDir === 'asc' ? a[sortCol] - b[sortCol] : b[sortCol] - a[sortCol];
    return sortDir === 'asc' ? a[sortCol].localeCompare(b[sortCol]) : b[sortCol].localeCompare(a[sortCol]);
  });
  document.getElementById('tbody').innerHTML = sorted.map((e) => `
    <tr><td>${e.name}</td><td><span class="code">${e.code}</span></td>
    <td><span class="tag">${e.sector}</span></td><td>${badge(e.daily)}</td><td>${badge(e.ytd)}</td>
    <td><button class="del-btn" data-code="${e.code}">删除</button></td></tr>
  `).join('');
  document.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', (ev) => { deleteETF(ev.target.dataset.code); });
  });
  ['name','code','sector','daily','ytd'].forEach(c => {
    const el = document.getElementById('th-'+c)?.querySelector('span');
    if (el) el.className = 'arrow';
  });
  const active = document.getElementById('th-'+sortCol)?.querySelector('span');
  if (active) active.className = sortDir === 'asc' ? 'asc' : 'desc';
}

function renderStats() {
  const up = data.filter(e => e.daily > 0).length;
  const down = data.filter(e => e.daily < 0).length;
  const flat = data.length - up - down;
  const avgD = (data.reduce((a,b) => a+b.daily, 0) / data.length).toFixed(2);
  const avgY = (data.reduce((a,b) => a+b.ytd, 0) / data.length).toFixed(2);
  document.getElementById('statsPanel').innerHTML = `
    <div class="stat"><div class="val" style="color:#ff7b72">${up}</div><div class="lbl">上涨</div></div>
    <div class="stat"><div class="val" style="color:#7ee787">${down}</div><div class="lbl">下跌</div></div>
    <div class="stat"><div class="val" style="color:#8b949e">${flat}</div><div class="lbl">平盘</div></div>
    <div class="stat"><div class="val" style="color:#58a6ff">${avgD}%</div><div class="lbl">平均涨跌</div></div>
    <div class="stat"><div class="val" style="color:#d2a8ff">${avgY}%</div><div class="lbl">平均年度</div></div>
    <div class="stat"><div class="val" style="color:#e6edf3">${data.length}</div><div class="lbl">ETF总数</div></div>
  `;
}

function renderIndexAll() {
  if (indexData.length === 0) {
    document.getElementById('indexSection').style.display = 'none';
    return;
  }
  document.getElementById('indexSection').style.display = 'block';
  renderIndexCards();
  renderIndexChart();
}

function renderIndexCards() {
  const groups = {};
  indexData.forEach(idx => { (groups[idx.market] = groups[idx.market] || []).push(idx); });
  const marketOrder = ['A股', '港股', '美股', '日韩'];
  let html = '';
  for (const market of marketOrder) {
    const items = groups[market];
    if (!items || items.length === 0) continue;
    html += `<div class="index-market-group">`;
    html += `<div class="index-market-title">${market}</div>`;
    html += `<div class="index-grid">`;
    for (const idx of items) {
      const up = idx.changePct >= 0;
      const cls = up ? 'up' : idx.changePct < 0 ? 'down' : 'flat';
      const sign = up ? '+' : '';
      const priceStr = idx.price >= 10000 ? idx.price.toLocaleString('zh-CN', {maximumFractionDigits: 2}) : idx.price.toFixed(2);
      const changeStr = Math.abs(idx.change).toFixed(2);
      html += `
        <div class="index-card">
          <span class="index-market-label">${market}</span>
          <div class="index-name">${idx.name}</div>
          <div class="index-price">${priceStr}</div>
          <div class="index-change-row">
            <span class="index-change ${cls}">${sign}${idx.change >= 0 ? '+' : '-'}${changeStr}</span>
            <span class="index-change-pct ${cls}">${sign}${idx.changePct.toFixed(2)}%</span>
          </div>
        </div>
      `;
    }
    html += `</div></div>`;
  }
  document.getElementById('indexCards').innerHTML = html;
}

function renderIndexChart() {
  const sorted = [...indexData].sort((a, b) => a.changePct - b.changePct);
  const upColor = '#ff7b72', downColor = '#7ee787', gridColor = '#30363d', textColor = '#c9d1d9';
  if (!indexChart) indexChart = echarts.init(document.getElementById('indexChartBox'));
  indexChart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      backgroundColor: '#161b22', borderColor: '#30363d', textStyle: { color: textColor },
      formatter: function(params) {
        const p = params[0];
        const sign = p.value >= 0 ? '+' : '';
        return p.name + '<br/>涨跌: ' + sign + p.value.toFixed(2) + '%';
      }
    },
    grid: { left: '22%', right: '15%', top: '5%', bottom: '5%' },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#8b949e', fontSize: 11, formatter: '{value}%' },
      splitLine: { lineStyle: { color: gridColor, type: 'dashed' } },
      axisLine: { lineStyle: { color: gridColor } }
    },
    yAxis: {
      type: 'category',
      data: sorted.map(s => s.name),
      axisLabel: { color: textColor, fontSize: 11, interval: 0, width: 120, overflow: 'break' },
      axisLine: { lineStyle: { color: gridColor } },
      axisTick: { show: false }
    },
    series: [{
      name: '涨跌幅', type: 'bar',
      data: sorted.map(s => ({ value: s.changePct, itemStyle: { color: s.changePct >= 0 ? upColor : downColor, borderRadius: 3 } })),
      label: { show: true, position: 'right', color: textColor, fontSize: 11, fontWeight: 'bold',
        formatter: function(p) { const sign = p.value >= 0 ? '+' : ''; return sign + p.value.toFixed(2) + '%'; } },
      barWidth: '55%'
    }],
    animationDuration: 600
  }, true);
}

function refreshAll() {
  updateStatus('正在获取实时数据...');
  Promise.all([fetchETFData(), fetchIndexData()]).then(([etfs, indices]) => {
    if (etfs && etfs.length > 0) {
      data = etfs;
      dataSource = '腾讯财经';
      updateStatus(`${dataSource} · ${data.length}只ETF · 刚刚`);
      renderCharts(); renderTable(); renderStats();
      if (indices && indices.length > 0) { indexData = indices; renderIndexAll(); }
      toast('数据已刷新');
      try {
        chrome.storage?.local?.set({ aidinpan_etfs: etfs, aidinpan_indices: indices, last_update: Date.now(), source: 'tencent_api' });
      } catch (e) {}
    } else {
      updateStatus('获取数据失败');
      toast('获取失败');
    }
  }).catch(e => {
    console.error(e);
    updateStatus('刷新失败: ' + e.message);
    toast('刷新失败');
  });
}

function sort(col) {
  if (sortCol === col) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
  else { sortCol = col; sortDir = 'desc'; }
  renderTable();
}

function toggleEdit() {
  const el = document.getElementById('editor');
  if (el.style.display === 'block') { el.style.display = 'none'; return; }
  document.getElementById('ta').value = JSON.stringify(data, null, 2);
  el.style.display = 'block';
}
function saveEdit() {
  try {
    const v = JSON.parse(document.getElementById('ta').value);
    if (!Array.isArray(v)) throw new Error('必须是数组');
    data = v.map(e => ({...e, sector: classifySector(e.name)}));
    renderCharts(); renderTable(); renderStats();
    document.getElementById('editor').style.display = 'none';
    toast('数据已保存');
  } catch(e) { alert('JSON格式错误: ' + e.message); }
}
function restore() {
  if (!confirm('确定恢复默认数据？')) return;
  data = [...DEFAULT];
  document.getElementById('ta').value = JSON.stringify(data, null, 2);
  renderCharts(); renderTable(); renderStats();
  toast('已恢复默认');
}
function cancelEdit() { document.getElementById('editor').style.display = 'none'; }
function exportJson() {
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'etf_data.json'; a.click();
  URL.revokeObjectURL(a.href); toast('已导出');
}
function deleteETF(code) {
  if (!confirm('确定删除 ' + code + '？')) return;
  data = data.filter(e => e.code !== code);
  renderCharts(); renderTable(); renderStats();
  updateStatus(`${dataSource} · ${data.length}只ETF`);
  toast('已删除 ' + code);
  try { chrome.storage?.local?.set({ aidinpan_etfs: data, last_update: Date.now(), source: 'tencent_api' }); } catch (e) {}
}

async function addETF() {
  const codeInput = document.getElementById('addCode').value.trim().toLowerCase();
  const nameInput = document.getElementById('addName').value.trim();
  if (!codeInput || !nameInput) { toast('请填写代码和名称'); return; }
  const match = codeInput.match(/^(sh|sz)(\d{6})$/);
  if (!match) { toast('代码格式错误，如 sh510300'); return; }
  const prefix = match[1], num = match[2], key = prefix + num;
  if (data.find(e => e.code === num)) { toast('该 ETF 已存在'); return; }
  const btn = document.getElementById('btnAdd');
  btn.textContent = '获取中...'; btn.disabled = true;
  try {
    const url = `https://qt.gtimg.cn/q=${key}`;
    const resp = await fetch(url);
    const text = await resp.text();
    const lineMatch = text.match(/v_[a-z]{2}\d{6}="(.*)"/);
    if (!lineMatch) { toast('获取数据失败'); btn.textContent = '添加'; btn.disabled = false; return; }
    const fields = lineMatch[1].split('~');
    if (fields.length < 35) { toast('数据格式异常'); btn.textContent = '添加'; btn.disabled = false; return; }
    const currentPrice = parseFloat(fields[3]);
    const changePct = parseFloat(fields[32]);
    const year = new Date().getFullYear();
    const yearStartPrice = await getYearStartPrice(key, year);
    let ytd = 0;
    if (yearStartPrice && yearStartPrice > 0) ytd = ((currentPrice - yearStartPrice) / yearStartPrice) * 100;
    data.push({ code: num, name: nameInput, sector: classifySector(nameInput), daily: parseFloat(changePct.toFixed(2)), ytd: parseFloat(ytd.toFixed(2)) });
    renderCharts(); renderTable(); renderStats();
    updateStatus(`${dataSource} · ${data.length}只ETF`);
    toast('已添加 ' + nameInput);
    document.getElementById('addCode').value = '';
    document.getElementById('addName').value = '';
    document.getElementById('addDialog').style.display = 'none';
    try { chrome.storage?.local?.set({ aidinpan_etfs: data, last_update: Date.now(), source: 'tencent_api' }); } catch (e) {}
  } catch (e) {
    console.error('addETF failed', e);
    toast('添加失败: ' + e.message);
  }
  btn.textContent = '添加'; btn.disabled = false;
}

function toast(m) { const t = document.getElementById('toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2000); }

window.addEventListener('resize', () => { dailyChart?.resize(); ytdChart?.resize(); indexChart?.resize(); });

function renderDefault() {
  dataSource = '默认';
  updateStatus('默认数据 · 40只ETF · 点击刷新获取最新');
  renderCharts(); renderTable(); renderStats();
}

// 自动初始化：优先读缓存，否则直接刷新
setTimeout(() => {
  let initDone = false;
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local?.get) {
      chrome.storage.local.get(['aidinpan_etfs', 'aidinpan_indices', 'last_update', 'source'], (result) => {
        if (initDone) return;
        initDone = true;
        if (result?.aidinpan_etfs && result.aidinpan_etfs.length > 0 && result.source === 'tencent_api') {
          data = result.aidinpan_etfs.map(e => ({ ...e, sector: classifySector(e.name) }));
          dataSource = '腾讯财经';
          const age = result.last_update ? Math.round((Date.now() - result.last_update) / 1000) : 0;
          const ageStr = age < 60 ? '刚刚' : age < 3600 ? `${Math.round(age/60)}分钟前` : `${Math.round(age/3600)}小时前`;
          updateStatus(`${dataSource} · ${data.length}只ETF · ${ageStr}`);
          renderCharts(); renderTable(); renderStats();
          if (result?.aidinpan_indices && result.aidinpan_indices.length > 0) { indexData = result.aidinpan_indices; renderIndexAll(); }
          toast('已加载缓存数据');
        } else {
          renderDefault(); refreshAll();
        }
      });
      setTimeout(() => { if (!initDone) { initDone = true; renderDefault(); refreshAll(); } }, 3000);
    } else {
      initDone = true; renderDefault(); refreshAll();
    }
  } catch (e) {
    console.error('init error', e);
    if (!initDone) { initDone = true; renderDefault(); }
  }
}, 300);

// ======================== 事件绑定 ========================
document.querySelectorAll('.index-tab').forEach(tab => {
  tab.addEventListener('click', (e) => {
    const targetTab = e.target.dataset.tab;
    document.querySelectorAll('.index-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.index-tab-panel').forEach(p => p.classList.remove('active'));
    e.target.classList.add('active');
    document.getElementById('tab-' + targetTab).classList.add('active');
    if (targetTab === 'chart' && indexChart) indexChart.resize();
  });
});

document.getElementById('btnAddOpen').addEventListener('click', () => { document.getElementById('addDialog').style.display = 'block'; document.getElementById('addCode').focus(); });
document.getElementById('btnAddClose').addEventListener('click', () => { document.getElementById('addDialog').style.display = 'none'; });
document.getElementById('btnAddCancel').addEventListener('click', () => { document.getElementById('addDialog').style.display = 'none'; });
document.getElementById('btnEdit').addEventListener('click', () => { document.getElementById('ta').value = JSON.stringify(data, null, 2); document.getElementById('editor').style.display = 'block'; });
document.getElementById('btnEditClose').addEventListener('click', () => { document.getElementById('editor').style.display = 'none'; });
document.getElementById('btnRefresh').addEventListener('click', refreshAll);
document.getElementById('btnExport').addEventListener('click', exportJson);
document.getElementById('btnSave').addEventListener('click', saveEdit);
document.getElementById('btnRestore').addEventListener('click', restore);
document.getElementById('btnCancel').addEventListener('click', cancelEdit);
document.getElementById('btnAdd').addEventListener('click', addETF);
document.getElementById('addCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') addETF(); });
document.getElementById('addName').addEventListener('keydown', (e) => { if (e.key === 'Enter') addETF(); });
document.getElementById('th-name').addEventListener('click', () => sort('name'));
document.getElementById('th-code').addEventListener('click', () => sort('code'));
document.getElementById('th-sector').addEventListener('click', () => sort('sector'));
document.getElementById('th-daily').addEventListener('click', () => sort('daily'));
document.getElementById('th-ytd').addEventListener('click', () => sort('ytd'));
