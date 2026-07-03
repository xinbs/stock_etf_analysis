// popup.js - 直接获取数据，不依赖 Service Worker

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
};

const DEFAULT_MONTHLY = {
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
};

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
      currentData[key] = {
        code: fields[2],
        currentPrice: parseFloat(fields[3]),
        changePct: parseFloat(fields[32]),
      };
    }
    // 获取月初开盘价并计算月涨跌
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const monthStart = `${year}-${month}-01`;
    const today = now.toISOString().split('T')[0];
    const monthStartPromises = Object.keys(ETF_CODES).map(async (key) => {
      const prefix = key.startsWith('sh') ? 'sh' : 'sz';
      const num = key.replace(/^[a-z]+/, '');
      const klineUrl = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${prefix}${num},day,${monthStart},${today},640,qfq`;
      try {
        const resp = await fetch(klineUrl);
        const data = await resp.json();
        const stock = data.data?.[`${prefix}${num}`];
        const days = stock?.qfqday || stock?.day;
        if (days && days.length > 0) {
          return { key, open: parseFloat(days[0][1]) };
        }
        return { key, open: null };
      } catch (e) { return { key, open: null }; }
    });
    const monthStartResults = await Promise.all(monthStartPromises);
    const etfs = [];
    for (const key of Object.keys(ETF_CODES)) {
      const current = currentData[key];
      const ms = monthStartResults.find(r => r.key === key);
      let monthly = DEFAULT_MONTHLY[key] || 0;
      if (current && ms?.open && ms.open > 0) {
        const calcMonthly = ((current.currentPrice - ms.open) / ms.open * 100);
        if (!isNaN(calcMonthly)) monthly = calcMonthly;
      }
      etfs.push({
        code: current?.code || key.replace(/^[a-z]+/, ''),
        name: ETF_CODES[key],
        sector: classifySector(ETF_CODES[key]),
        daily: current?.changePct || 0,
        monthly: parseFloat(monthly.toFixed(2)),
      });
    }
    return etfs;
  } catch (e) { console.error('fetchETFData failed', e); return null; }
}

// 智能板块分类
function classifySector(name) {
  const n = name;
  if (n.includes('新能源车')) return '新能源/汽车';
  if (n.includes('光伏')) return '新能源/光伏';
  if (n.includes('新能源')) return '新能源';
  if (n.includes('医疗创新')) return '医药/医疗';
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

let etfData = [];
let dataSource = '默认';

function analyzeSectors(data) {
  const map = {};
  data.forEach(e => { (map[e.sector] = map[e.sector] || []).push(e); });
  return Object.entries(map).map(([sector, list]) => ({
    sector, count: list.length,
    avgDaily: +(list.reduce((s, x) => s + x.daily, 0) / list.length).toFixed(2),
    avgMonthly: +(list.reduce((s, x) => s + x.monthly, 0) / list.length).toFixed(2),
  }));
}

function badge(v) {
  if (v > 0) return `<span class="badge up">+${v}%</span>`;
  if (v < 0) return `<span class="badge down">${v}%</span>`;
  return `<span class="badge flat">0%</span>`;
}

function renderAll() {
  if (etfData.length === 0) {
    document.getElementById('dailyList').innerHTML = '<div class="msg">暂无数据，点击刷新</div>';
    document.getElementById('monthlyList').innerHTML = '<div class="msg">暂无数据</div>';
    document.getElementById('statsPanel').innerHTML = '<div class="stat"><div class="val" style="color:#8b949e">--</div><div class="lbl">数据</div></div>';
    document.getElementById('statusBar').textContent = '等待获取数据...';
    return;
  }

  const sectors = analyzeSectors(etfData);
  const dailySorted = [...sectors].sort((a, b) => b.avgDaily - a.avgDaily).slice(0, 5);
  document.getElementById('dailyList').innerHTML = dailySorted.map(s => `
    <div class="row"><span>${s.sector}</span><span><span class="count">${s.count}只</span>${badge(s.avgDaily)}</span></div>
  `).join('');

  const monthlySorted = [...sectors].sort((a, b) => b.avgMonthly - a.avgMonthly).slice(0, 5);
  document.getElementById('monthlyList').innerHTML = monthlySorted.map(s => `
    <div class="row"><span>${s.sector}</span><span><span class="count">${s.count}只</span>${badge(s.avgMonthly)}</span></div>
  `).join('');

  const up = etfData.filter(e => e.daily > 0).length;
  const down = etfData.filter(e => e.daily < 0).length;
  const flat = etfData.length - up - down;
  document.getElementById('statsPanel').innerHTML = `
    <div class="stat"><div class="val" style="color:#ff7b72">${up}</div><div class="lbl">上涨</div></div>
    <div class="stat"><div class="val" style="color:#7ee787">${down}</div><div class="lbl">下跌</div></div>
    <div class="stat"><div class="val" style="color:#8b949e">${flat}</div><div class="lbl">平盘</div></div>
  `;

  document.getElementById('statusBar').textContent = `${dataSource} · ${etfData.length}只ETF`;
}

async function loadFromStorage() {
  try {
    const result = await chrome.storage?.local?.get(['aidinpan_etfs', 'last_update', 'source']);
    if (result?.aidinpan_etfs && result.aidinpan_etfs.length > 0) {
      if (result.source !== 'tencent_api') {
        console.log('检测到旧版数据，自动刷新...');
        refreshData();
        return false;
      }
      etfData = result.aidinpan_etfs.map(e => ({ ...e, sector: classifySector(e.name) }));
      dataSource = '腾讯财经';
      renderAll();
      return true;
    }
  } catch (e) {}
  return false;
}

async function refreshData() {
  const btn = document.getElementById('scanBtn');
  btn.textContent = '⏳ 获取中...';
  try {
    const etfs = await fetchETFData();
    if (etfs && etfs.length > 0) {
      etfData = etfs.map(e => ({ ...e, sector: classifySector(e.name) }));
      dataSource = '腾讯财经';
      renderAll();
      btn.textContent = '✅ 已更新';
      // 保存到 storage
      try {
        chrome.storage?.local?.set({
          aidinpan_etfs: etfs,
          last_update: Date.now(),
          source: 'tencent_api'
        });
      } catch (e) {}
    } else {
      btn.textContent = '⚠️ 失败';
    }
  } catch (e) {
    console.error(e);
    btn.textContent = '❌ 失败';
  }
  setTimeout(() => btn.textContent = '🔍 刷新数据', 2000);
}

document.getElementById('scanBtn').addEventListener('click', refreshData);
document.getElementById('openBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('full.html') });
});

(async () => {
  const loaded = await loadFromStorage();
  if (!loaded) {
    try {
      const etfs = await fetchETFData();
      if (etfs && etfs.length > 0) {
        etfData = etfs.map(e => ({ ...e, sector: classifySector(e.name) }));
        dataSource = '腾讯财经';
        renderAll();
      }
    } catch (e) {}
  }
})();
