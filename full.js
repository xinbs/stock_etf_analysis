// ======================== ECharts 可用性检查 ========================
if (typeof echarts === 'undefined') {
  const warn = document.createElement('div');
  warn.style.cssText = 'position:fixed;top:0;left:0;right:0;padding:20px;background:#da3633;color:white;z-index:99999;font-size:16px;text-align:center;';
  warn.innerHTML = '<b>ECharts 加载失败</b> — 请检查 echarts.min.js 是否存在，或刷新扩展后重试。';
  document.body.appendChild(warn);
} else {
  // ECharts 加载成功，继续执行
}

// ======================== 智能板块分类 ========================
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
};

// ======================== 全球指数配置 ========================
const INDEX_CODES = {
  // A股（腾讯实时无 YTD 字段 → 走腾讯 K 线）
  'sh000001': { name: '上证指数', market: 'A股' },
  'sz399001': { name: '深证成指', market: 'A股' },
  'sz399006': { name: '创业板指', market: 'A股' },
  'sh000688': { name: '科创50',   market: 'A股' },
  // 港股（腾讯实时无 YTD 字段 → 走腾讯 K 线；本地 JSON 仅 K 线失败时兜底）
  'hkHSI':    { name: '恒生指数',   market: '港股', historyKey: '恒生指数' },
  'hkHSTECH': { name: '恒生科技',   market: '港股' },  // 本地 JSON 只有 ETF，不可用
  // 美股：腾讯实时数据 f54 字段就是 YTD（已验证，与本地 JSON 一致）
  'usDJI':    { name: '道琼斯',     market: '美股', useF54: true, historyKey: '道琼斯' },
  'usIXIC':   { name: '纳斯达克',   market: '美股', useF54: true, historyKey: '纳斯达克' },
  'us.INX':   { name: '标普500',    market: '美股', useF54: true, historyKey: '标普500' },
  // 日韩：实时走东财 push2，失败 fallback 新浪 hq.sinajs.cn
  // YTD 字段不在东财 push2 接口里，所以 YTD 走本地 JSON（接口没有 YTD 才用本地）
  'N225':     { name: '日经225',    market: '日韩', eastmoney: '100.N225', sina: 'b_NKY', historyKey: '日经225' },
  'KS11':     { name: '韩国KOSPI',  market: '日韩', eastmoney: '100.KS11', sina: 'b_KOSPI', historyKey: '韩国KOSPI' },
};

let indexData = [];

// 启动时加载一次本地历史 JSON（sandbox 模式下 fetch 自己扩展资源会被 CSP 拦，
// 改用 full.html 里 <script> 注入 window.localIndexHistoryData）
let localIndexHistory = null;
async function loadLocalIndexHistory() {
  if (localIndexHistory) return localIndexHistory;
  if (window.localIndexHistoryData) {
    localIndexHistory = window.localIndexHistoryData;
    console.log('[history] 已加载本地指数历史 JSON（script 注入）');
  } else {
    console.warn('[history] window.localIndexHistoryData 未定义，请检查 global_indices_data.js 是否加载');
    localIndexHistory = {};
  }
  return localIndexHistory;
}

// 从本地历史 JSON 取指数的 2026 年首日开盘价
function getYearStartFromHistory(code) {
  if (!localIndexHistory) return null;
  const cfg = INDEX_CODES[code];
  if (!cfg || !cfg.historyKey) return null;
  const records = localIndexHistory[cfg.historyKey]?.records;
  if (!records || records.length === 0) return null;
  // 找 2026 年第一条记录
  for (const r of records) {
    if (r.date >= '2026-01-01') return r.open;
  }
  return null;
}

async function fetchIndexData() {
  // 1. 腾讯 API：A股 + 港股 + 美股
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
      // 美股：腾讯实时数据 f54 字段是 YTD 涨跌百分比（港股/日韩暂未拿到可靠字段，走 K 线/外部 API）
      let ytdFromTencent = null;
      if (cfg.market === '美股' && fields.length > 54) {
        const f54 = parseFloat(fields[54]);
        if (!isNaN(f54) && f54 !== 0) ytdFromTencent = f54;
      }
      results.push({
        code: key,
        name: cfg.name,
        market: cfg.market,
        price: price,
        change: change,
        changePct: changePct,
        ytd: ytdFromTencent,  // 美股立即填；A 股/港股稍后用 K 线填
      });
    }
  } catch (e) { console.error('fetchIndexData tencent failed', e); }

  // 2. 日韩指数：先试东财，失败 fallback 到新浪
  const eastmoneyKeys = Object.keys(INDEX_CODES).filter(k => INDEX_CODES[k].eastmoney);
  for (const key of eastmoneyKeys) {
    const cfg = INDEX_CODES[key];
    let pushed = false;

    // 2a) 优先尝试东财 push2
    const eastmoneyUrl = `https://push2.eastmoney.com/api/qt/stock/get?secid=${cfg.eastmoney}&fields=f43,f57,f58,f60,f170`;
    try {
      const resp = await fetch(eastmoneyUrl);
      if (!resp.ok) throw new Error('http ' + resp.status);
      const json = await resp.json();
      const d = json.data;
      if (d && d.f43 && d.f60 && d.f170 !== undefined) {
        const price = d.f43 / 100;
        const prevClose = d.f60 / 100;
        const changePct = d.f170 / 100;
        const change = price - prevClose;
        if (!isNaN(price) && !isNaN(changePct)) {
          console.log(`[日韩] ${key} 东财成功: price=${price} changePct=${changePct}`);
          results.push({
            code: key, name: cfg.name, market: cfg.market,
            price, change, changePct,
          });
          pushed = true;
        }
      } else {
        console.log(`[日韩] ${key} 东财返回 data 为空`);
      }
    } catch (e) { console.log(`[日韩] ${key} 东财失败: ${e.message}`); }

    // 2b) 东财失败 fallback 到新浪 hq.sinajs.cn
    if (!pushed && cfg.sina) {
      try {
        const resp = await fetch('https://hq.sinajs.cn/list=' + cfg.sina, {
          headers: { 'Referer': 'https://finance.sina.com.cn/' }
        });
        if (!resp.ok) throw new Error('http ' + resp.status);
        const text = await resp.text();
        const m = text.match(/="([^"]+)"/);
        if (m) {
          const fields = m[1].split(',');
          const name = cfg.name || fields[0];
          const price = parseFloat(fields[1]);
          const change = parseFloat(fields[2]);
          const changePct = parseFloat(fields[3]);
          if (!isNaN(price) && !isNaN(changePct)) {
            console.log(`[日韩] ${key} 新浪成功: price=${price} changePct=${changePct}`);
            results.push({
              code: key, name, market: cfg.market,
              price, change, changePct,
            });
          } else {
            console.log(`[日韩] ${key} 新浪数据解析失败: fields=${fields.slice(0,5)}`);
          }
        } else {
          console.log(`[日韩] ${key} 新浪返回内容无匹配: ${text.slice(0,80)}`);
        }
      } catch (e) {
        console.log(`[日韩] ${key} 新浪失败: ${e.message}`);
      }
    }

    // 2c) 双重失败：从本地 JSON 取最新收盘价作为"准实时价"（数据会有 1 天延迟但有数据总比没数据好）
    if (!pushed && cfg.historyKey && localIndexHistory) {
      const records = localIndexHistory[cfg.historyKey]?.records;
      if (records && records.length > 0) {
        const latest = records[records.length - 1];
        const prev = records.length > 1 ? records[records.length - 2] : null;
        const price = latest.close;
        const change = prev ? (latest.close - prev.close) : 0;
        const changePct = prev ? ((latest.close - prev.close) / prev.close * 100) : 0;
        console.log(`[日韩] ${key} 本地JSON兜底: price=${price} date=${latest.date}`);
        results.push({
          code: key, name: cfg.name, market: cfg.market,
          price, change, changePct,
          ytdSource: 'local-json-fallback',
        });
        pushed = true;
      }
    }
  }

  // 3. YTD 计算优先级：接口数据（K 线）> 本地 JSON > null
  //  - 美股：腾讯 f54 字段已在 tencent 阶段填好，直接用
  //  - 港股/A 股/日韩：先用 K 线（接口）异步算；K 线拿不到的回退本地 JSON
  const year = new Date().getFullYear();
  const allNonF54 = results.filter(idx => idx.ytd === null || idx.ytd === undefined).map(r => r.code);

  // 先用本地 JSON 同步占位（让用户立刻看到数字，等 K 线回来再覆盖）
  results.forEach(idx => {
    if (idx.ytd !== null && idx.ytd !== undefined) return;
    const localStart = getYearStartFromHistory(idx.code);
    if (localStart && localStart > 0) {
      idx.ytd = +(((idx.price - localStart) / localStart) * 100).toFixed(2);
      idx.ytdSource = 'local-json';
    } else {
      idx.ytd = null;
      idx.ytdSource = null;
    }
  });

  // 异步尝试接口（K 线）：对所有非 f54 的指数都试（港股 K 线本来就跑通）
  if (allNonF54.length > 0) {
    getYearStartPricesCached(allNonF54, year).then(ytdMap => {
      let updated = 0;
      results.forEach(idx => {
        const start = ytdMap[idx.code];
        if (start && start > 0) {
          const newYtd = +(((idx.price - start) / start) * 100).toFixed(2);
          // 接口 K 线拿到 → 覆盖本地 JSON（接口数据优先）
          idx.ytd = newYtd;
          idx.ytdSource = 'kline';
          updated++;
        }
      });
      if (updated > 0 && typeof onIndexYTDUpdated === 'function') {
        onIndexYTDUpdated(results);
      }
    });
  }

  return results;
}

async function getYearStartPrice(code, year) {
  // 1) 美股/日韩：直接从 INDEX_CODES 配置里读手工维护的年初初始价
  const cfg = INDEX_CODES[code];
  if (cfg && cfg.yearStartPrice) {
    return cfg.yearStartPrice;
  }

  // 2) 港股 (hk 前缀) 走腾讯 K 线
  if (code.startsWith('hk')) {
    const pureCode = code.replace(/^hk/, '');
    const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=hk${pureCode},day,${year}-01-01,${year}-01-10,10,qfq`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      const stockData = data.data?.[`hk${pureCode}`];
      if (!stockData) return null;
      const days = stockData.qfqday || stockData.day;
      if (!days || days.length === 0) return null;
      return parseFloat(days[0][1]); // 开盘价
    } catch (e) { return null; }
  }

  // 3) A股 (sh/sz 前缀) 走腾讯 K 线
  if (code.startsWith('sh') || code.startsWith('sz')) {
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
      return parseFloat(days[0][1]); // 开盘价
    } catch (e) { return null; }
  }

  return null;
}

// 限流并发工具：按 concurrency 个一批执行 promise
async function runWithLimit(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// 缓存键：yearStartCache:{year}:{code}
const YTD_CACHE_PREFIX = 'yearStartCache';

// 批量获取 K 线开盘价：先读 chrome.storage 缓存，缺失的才去拉，限流 6 并发
async function getYearStartPricesCached(codes, year) {
  const cacheKey = (code) => `${YTD_CACHE_PREFIX}:${year}:${code}`;
  let store = {};
  try {
    store = (await chrome.storage?.local?.get(null)) || {};
  } catch (e) { /* storage 不可用时退化为无缓存 */ }

  const map = {};
  const missing = [];
  for (const code of codes) {
    const cached = store[cacheKey(code)];
    if (typeof cached === 'number' && cached > 0) {
      map[code] = cached;
    } else {
      missing.push(code);
    }
  }

  if (missing.length === 0) return map;

  // 限流 6 并发（与 Chrome 单域并发上限对齐）
  const fetched = await runWithLimit(missing, 6, async (code) => {
    const price = await getYearStartPrice(code, year);
    return { code, price };
  });

  // 写回缓存（只缓存有效值）
  const toWrite = {};
  for (const { code, price } of fetched) {
    if (price && price > 0) {
      map[code] = price;
      toWrite[cacheKey(code)] = price;
    }
  }
  if (Object.keys(toWrite).length > 0) {
    try { await chrome.storage?.local?.set(toWrite); } catch (e) {}
  }
  return map;
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
    // YTD：先用 DEFAULT_YTD 实时出图；K 线拉取在后台异步进行，拉到后再覆盖
    const year = new Date().getFullYear();
    const etfs = [];
    for (const key of Object.keys(ETF_CODES)) {
      const current = currentData[key];
      const ytd = DEFAULT_YTD[key] || 0;
      etfs.push({
        code: current?.code || key.replace(/^[a-z]+/, ''),
        name: ETF_CODES[key],
        sector: classifySector(ETF_CODES[key]),
        daily: current?.changePct || 0,
        ytd: parseFloat(ytd.toFixed(2)),
      });
    }

    // 后台异步：拉 K 线覆盖 YTD（不阻塞首屏渲染）
    getYearStartPricesCached(Object.keys(ETF_CODES), year).then(yearStartMap => {
      let updated = 0;
      for (const e of etfs) {
        const key = Object.keys(ETF_CODES).find(k => ETF_CODES[k] === e.name);
        if (!key) continue;
        const current = currentData[key];
        const start = yearStartMap[key];
        if (current && start && start > 0) {
          const calcYtd = ((current.currentPrice - start) / start * 100);
          if (!isNaN(calcYtd)) {
            e.ytd = parseFloat(calcYtd.toFixed(2));
            updated++;
          }
        }
      }
      if (updated > 0 && typeof onETFYTDUpdated === 'function') {
        onETFYTDUpdated(etfs);
      }
    });

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
];
DEFAULT.forEach(e => e.sector = classifySector(e.name));

let data = [...DEFAULT];
let sortCol = 'daily', sortDir = 'desc';
let dataSource = '默认';
let dailyChart = null, ytdChart = null, indexChart = null, indexYtdChart = null;
let monthlySectorChart = null, bestWorstChart = null, sectorTrendChart = null, indexVsSectorChart = null;
let monthlyDataCache = null;
let availableMonthsCache = null;

// ======================== 从扩展 Storage 读取 ========================
function loadFromStorage() {
  try {
    chrome.storage?.local?.get(['aidinpan_etfs', 'last_update', 'source'], (result) => {
      if (result?.aidinpan_etfs && result.aidinpan_etfs.length > 0) {
        // 如果数据来自旧版本（没有 source 或 source 不是 tencent_api），自动刷新
        if (result.source !== 'tencent_api') {
          console.log('检测到旧版数据，自动刷新...');
          refreshAll();
          return;
        }
        data = result.aidinpan_etfs.map(e => ({ ...e, sector: classifySector(e.name) }));
        dataSource = result.source === 'tencent_api' ? '腾讯财经' : '爱盯盘';
        const age = result.last_update ? Math.round((Date.now() - result.last_update) / 1000) : 0;
        const ageStr = age < 60 ? '刚刚' : age < 3600 ? `${Math.round(age/60)}分钟前` : `${Math.round(age/3600)}小时前`;
        updateStatus(`${dataSource} · ${data.length}只ETF · ${ageStr}`);
        renderCharts();
        renderTable();
        renderStats();
      } else {
        // 没有数据，自动刷新
        refreshAll();
      }
    });
  } catch (e) {}
}

function updateStatus(msg) {
  document.getElementById('statusLine').textContent = msg;
}

// ======================== 分析 ========================
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

// ======================== ECharts 渲染 ========================
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
      axisLabel: { 
        color: textColor, 
        fontSize: 11,
        interval: 0,
        width: 130,
        overflow: 'break'
      },
      axisLine: { lineStyle: { color: gridColor } },
      axisTick: { show: false }
    },
    animationDuration: 600
  };

  // 当日涨跌图
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

  // 年度涨跌图
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

// ======================== 表格和统计 ========================
function renderTable() {
  let sorted = [...data];
  sorted.sort((a,b) => {
    if (typeof a[sortCol] === 'number') return sortDir === 'asc' ? a[sortCol] - b[sortCol] : b[sortCol] - a[sortCol];
    return sortDir === 'asc' ? a[sortCol].localeCompare(b[sortCol]) : b[sortCol].localeCompare(a[sortCol]);
  });
  document.getElementById('tbody').innerHTML = sorted.map((e, idx) => `
    <tr><td>${e.name}</td><td><span class="code">${e.code}</span></td>
    <td><span class="tag">${e.sector}</span></td><td>${badge(e.daily)}</td><td>${badge(e.ytd)}</td>
    <td><button class="del-btn" data-code="${e.code}">删除</button></td></tr>
  `).join('');

  // 绑定删除按钮事件
  document.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      const code = ev.target.dataset.code;
      deleteETF(code);
    });
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

// ======================== 全球指数渲染 ========================
function renderIndexAll() {
  console.log('[debug] renderIndexAll called, indexData.length=' + indexData.length);
  indexData.forEach((d, i) => {
    console.log(`  [${i}] ${d.code} ${d.name} market=${d.market} price=${d.price} ytd=${d.ytd} ytdSource=${d.ytdSource}`);
  });
  if (indexData.length === 0) {
    document.getElementById('indexSection').style.display = 'none';
    return;
  }
  document.getElementById('indexSection').style.display = 'block';
  renderIndexCards();
  // 主动渲染指数 YTD 图表（即使 tab-chart 隐藏也把数据 setOption 进去，切到时再 resize）
  const withYtd = indexData.filter(d => typeof d.ytd === 'number').length;
  console.log('[debug] renderIndexAll: indexData with valid ytd = ' + withYtd);
  if (withYtd > 0) {
    renderIndexYtdChart();
  }
  if (indexChart) indexChart.resize();
  if (indexYtdChart) indexYtdChart.resize();
}

function renderIndexCards() {
  // 按市场分组
  const groups = {};
  indexData.forEach(idx => {
    (groups[idx.market] = groups[idx.market] || []).push(idx);
  });

  // 市场顺序
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
      const priceStr = idx.price >= 10000
        ? idx.price.toLocaleString('zh-CN', {maximumFractionDigits: 2})
        : idx.price.toFixed(2);
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
  const upColor = '#ff7b72';
  const downColor = '#7ee787';
  const gridColor = '#30363d';
  const textColor = '#c9d1d9';

  if (!indexChart) indexChart = echarts.init(document.getElementById('indexChartBox'));
  indexChart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#161b22',
      borderColor: '#30363d',
      textStyle: { color: textColor },
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
      name: '涨跌幅',
      type: 'bar',
      data: sorted.map(s => ({
        value: s.changePct,
        itemStyle: { color: s.changePct >= 0 ? upColor : downColor, borderRadius: 3 }
      })),
      label: {
        show: true, position: 'right', color: textColor, fontSize: 11, fontWeight: 'bold',
        formatter: function(p) {
          const sign = p.value >= 0 ? '+' : '';
          return sign + p.value.toFixed(2) + '%';
        }
      },
      barWidth: '55%'
    }],
    animationDuration: 600
  }, true);
}

function renderIndexYtdChart() {
  // 仅展示能拿到 ytd 的指数
  const items = indexData.filter(d => typeof d.ytd === 'number');
  if (items.length === 0) return;
  const sorted = [...items].sort((a, b) => a.ytd - b.ytd);
  const upColor = '#ff7b72';
  const downColor = '#7ee787';
  const gridColor = '#30363d';
  const textColor = '#c9d1d9';

  if (!indexYtdChart) indexYtdChart = echarts.init(document.getElementById('indexYtdChart'));
  indexYtdChart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#161b22',
      borderColor: '#30363d',
      textStyle: { color: textColor },
      formatter: function(params) {
        const p = params[0];
        const sign = p.value >= 0 ? '+' : '';
        return p.name + '<br/>今年涨跌: ' + sign + p.value.toFixed(2) + '%';
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
      name: '今年涨跌',
      type: 'bar',
      data: sorted.map(s => ({
        value: s.ytd,
        itemStyle: { color: s.ytd >= 0 ? upColor : downColor, borderRadius: 3 }
      })),
      label: {
        show: true, position: 'right', color: textColor, fontSize: 11, fontWeight: 'bold',
        formatter: function(p) {
          const sign = p.value >= 0 ? '+' : '';
          return sign + p.value.toFixed(2) + '%';
        }
      },
      barWidth: '55%'
    }],
    animationDuration: 600
  }, true);
}

// ======================== 月报功能 ========================
async function loadAvailableMonths() {
  return new Promise((resolve) => {
    if (!chrome.runtime?.sendMessage) return resolve([]);
    chrome.runtime.sendMessage({ action: 'getAvailableMonths' }, (res) => {
      resolve(res?.success ? res.months : []);
    });
  });
}

async function loadMonthlySectors(yearMonth) {
  return new Promise((resolve) => {
    if (!chrome.runtime?.sendMessage) return resolve([]);
    chrome.runtime.sendMessage({ action: 'getMonthlySectors', yearMonth }, (res) => {
      resolve(res?.success ? res.sectors : []);
    });
  });
}

function getLastDayOfMonth(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function getPrevMonths(yearMonth, count) {
  const [y, m] = yearMonth.split('-').map(Number);
  const res = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    res.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return res;
}

async function loadSectorTrendData(endYearMonth) {
  const months = getPrevMonths(endYearMonth, 6);
  const all = {};
  for (const ym of months) {
    const records = await loadMonthlySectors(ym);
    all[ym] = aggregateMonthlySectors(records);
  }
  return { months, data: all };
}

async function loadIndexMonthlyData(yearMonth) {
  return new Promise((resolve) => {
    if (!chrome.runtime?.sendMessage) return resolve([]);
    chrome.runtime.sendMessage({ action: 'getIndexMonthly', yearMonth }, (res) => {
      resolve(res?.success ? res.indices : []);
    });
  });
}

// 把一个月内按 sector 的日记录聚合成一条月记录
function aggregateMonthlySectors(records) {
  const map = {};
  for (const r of records) {
    if (!map[r.sector]) {
      map[r.sector] = { sector: r.sector, count: r.count, sumDaily: 0, sumYtd: 0, n: 0 };
    }
    map[r.sector].sumDaily += r.avgDaily;
    map[r.sector].sumYtd += r.avgYtd;
    map[r.sector].n += 1;
  }
  return Object.values(map).map(s => ({
    sector: s.sector,
    count: s.count,
    avgDaily: s.n ? +(s.sumDaily / s.n).toFixed(2) : 0,
    avgYtd: s.n ? +(s.sumYtd / s.n).toFixed(2) : 0,
  }));
}

// 把一个月内按 code 的指数日记录聚合成一条月记录（月均涨跌幅）
function aggregateMonthlyIndices(records) {
  const map = {};
  for (const r of records) {
    if (!map[r.code]) {
      map[r.code] = { code: r.code, name: r.name, market: r.market, sumChangePct: 0, sumYtd: 0, n: 0 };
    }
    if (typeof r.changePct === 'number') map[r.code].sumChangePct += r.changePct;
    if (typeof r.ytd === 'number') map[r.code].sumYtd += r.ytd;
    map[r.code].n += 1;
  }
  return Object.values(map).map(i => ({
    code: i.code,
    name: i.name,
    market: i.market,
    changePct: i.n ? +(i.sumChangePct / i.n).toFixed(2) : 0,
    ytd: i.n ? +(i.sumYtd / i.n).toFixed(2) : 0,
  }));
}

async function renderMonthlyReport() {
  try {
    updateStatus('正在加载月报...');
    if (!availableMonthsCache) availableMonthsCache = await loadAvailableMonths();

    // 初始化/同步月份下拉
    const monthSelect = document.getElementById('monthSelect');
    if (monthSelect) {
      const currentVal = monthSelect.value;
      monthSelect.innerHTML = '';
      if (availableMonthsCache.length === 0) {
        const opt = document.createElement('option');
        opt.value = fmtYearMonth(new Date());
        opt.textContent = opt.value;
        monthSelect.appendChild(opt);
      } else {
        for (const m of availableMonthsCache) {
          const opt = document.createElement('option');
          opt.value = m;
          opt.textContent = m;
          monthSelect.appendChild(opt);
        }
      }
      if (currentVal && Array.from(monthSelect.options).some(o => o.value === currentVal)) {
        monthSelect.value = currentVal;
      } else if (availableMonthsCache.length > 0) {
        monthSelect.value = availableMonthsCache[availableMonthsCache.length - 1];
      }
    }

    const yearMonth = monthSelect?.value || fmtYearMonth(new Date());
    const rawSectorRecords = await loadMonthlySectors(yearMonth);
    monthlyDataCache = aggregateMonthlySectors(rawSectorRecords);
    if (!monthlyDataCache || monthlyDataCache.length === 0) {
      updateStatus(`${yearMonth} 暂无板块数据，请明日收盘后再查看`);
      return;
    }

    // 板块过滤器
    const sectorFilter = document.getElementById('sectorFilter');
    if (sectorFilter) {
      const currentFilter = sectorFilter.value;
      const allSectors = [...new Set(monthlyDataCache.map(s => s.sector))].sort();
      sectorFilter.innerHTML = '<option value="">全部</option>';
      for (const s of allSectors) {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        sectorFilter.appendChild(opt);
      }
      if (allSectors.includes(currentFilter)) sectorFilter.value = currentFilter;
    }

    const filtered = sectorFilter?.value
      ? monthlyDataCache.filter(s => s.sector === sectorFilter.value)
      : monthlyDataCache;

    // 4 个图
    renderMonthlySectorChart(filtered);
    renderBestWorstChart(filtered);
    await renderSectorTrendChart(yearMonth);
    await renderIndexVsSectorChart(yearMonth, filtered);

    updateStatus(`${yearMonth} 月报 · ${filtered.length} 个板块`);
  } catch (e) {
    console.error('renderMonthlyReport failed', e);
    updateStatus('月报加载失败: ' + e.message);
  }
}

function renderMonthlySectorChart(sectors) {
  const sorted = [...sectors].sort((a, b) => a.avgDaily - b.avgDaily);
  const upColor = '#ff7b72';
  const downColor = '#7ee787';
  const gridColor = '#30363d';
  const textColor = '#c9d1d9';
  const el = document.getElementById('monthlySectorChart');
  if (!el) return;
  if (!monthlySectorChart) monthlySectorChart = echarts.init(el);
  monthlySectorChart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#161b22',
      borderColor: '#30363d',
      textStyle: { color: textColor },
      formatter: p => `${p[0].name}<br/>日均涨跌: ${p[0].value >= 0 ? '+' : ''}${p[0].value.toFixed(2)}%`
    },
    grid: { left: '22%', right: '16%', top: '3%', bottom: '3%' },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#8b949e', fontSize: 11, formatter: '{value}%' },
      splitLine: { lineStyle: { color: gridColor, type: 'dashed' } },
      axisLine: { lineStyle: { color: gridColor } }
    },
    yAxis: {
      type: 'category',
      data: sorted.map(s => s.sector),
      axisLabel: { color: textColor, fontSize: 11, interval: 0, width: 130, overflow: 'break' },
      axisLine: { lineStyle: { color: gridColor } },
      axisTick: { show: false }
    },
    series: [{
      name: '日均涨跌',
      type: 'bar',
      data: sorted.map(s => ({
        value: s.avgDaily,
        itemStyle: { color: s.avgDaily >= 0 ? upColor : downColor, borderRadius: 3 }
      })),
      label: {
        show: true, position: 'right', color: textColor, fontSize: 11, fontWeight: 'bold',
        formatter: p => `${p.value >= 0 ? '+' : ''}${p.value.toFixed(2)}% (${sorted[p.dataIndex].count}只)`
      },
      barWidth: '55%'
    }],
    animationDuration: 600
  }, true);
}

function renderBestWorstChart(sectors) {
  const sorted = [...sectors].sort((a, b) => b.avgDaily - a.avgDaily);
  const topN = 5;
  const best = sorted.slice(0, topN).reverse();
  const worst = sorted.slice(-topN);
  const upColor = '#ff7b72';
  const downColor = '#7ee787';
  const gridColor = '#30363d';
  const textColor = '#c9d1d9';
  const el = document.getElementById('bestWorstChart');
  if (!el) return;
  if (!bestWorstChart) bestWorstChart = echarts.init(el);
  const names = [...worst.map(s => s.sector), ...best.map(s => s.sector)];
  const values = [...worst.map(s => s.avgDaily), ...best.map(s => s.avgDaily)];
  bestWorstChart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#161b22',
      borderColor: '#30363d',
      textStyle: { color: textColor },
      formatter: p => `${p[0].name}<br/>日均涨跌: ${p[0].value >= 0 ? '+' : ''}${p[0].value.toFixed(2)}%`
    },
    grid: { left: '24%', right: '16%', top: '8%', bottom: '8%' },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#8b949e', fontSize: 11, formatter: '{value}%' },
      splitLine: { lineStyle: { color: gridColor, type: 'dashed' } },
      axisLine: { lineStyle: { color: gridColor } }
    },
    yAxis: {
      type: 'category',
      data: names,
      axisLabel: { color: textColor, fontSize: 11, interval: 0, width: 130, overflow: 'break' },
      axisLine: { lineStyle: { color: gridColor } },
      axisTick: { show: false }
    },
    series: [{
      name: '日均涨跌',
      type: 'bar',
      data: values.map(v => ({
        value: v,
        itemStyle: { color: v >= 0 ? upColor : downColor, borderRadius: 3 }
      })),
      label: {
        show: true, position: 'right', color: textColor, fontSize: 11, fontWeight: 'bold',
        formatter: p => `${p.value >= 0 ? '+' : ''}${p.value.toFixed(2)}%`
      },
      barWidth: '55%'
    }],
    animationDuration: 600
  }, true);
}

async function renderSectorTrendChart(endYearMonth) {
  const { months, data: all } = await loadSectorTrendData(endYearMonth);
  const sectorSet = new Set();
  for (const ym of months) {
    (all[ym] || []).forEach(s => sectorSet.add(s.sector));
  }
  const sectors = Array.from(sectorSet).sort();
  const colors = [
    '#58a6ff', '#7ee787', '#ff7b72', '#d2a8ff', '#ffa657',
    '#79c0ff', '#56d364', '#f0883e', '#a371f7', '#3fb950'
  ];
  const el = document.getElementById('sectorTrendChart');
  if (!el) return;
  if (!sectorTrendChart) sectorTrendChart = echarts.init(el);
  const series = sectors.map((sector, idx) => ({
    name: sector,
    type: 'line',
    smooth: true,
    symbol: 'circle',
    symbolSize: 6,
    data: months.map(ym => {
      const s = (all[ym] || []).find(x => x.sector === sector);
      return s ? s.avgYtd : null;
    }),
    lineStyle: { width: 2 },
    itemStyle: { color: colors[idx % colors.length] }
  }));
  sectorTrendChart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#161b22',
      borderColor: '#30363d',
      textStyle: { color: '#c9d1d9' },
      formatter: function(params) {
        let html = params[0].axisValue + '<br/>';
        for (const p of params) {
          if (p.value === null || p.value === undefined) continue;
          const sign = p.value >= 0 ? '+' : '';
          html += `<span style="color:${p.color}">●</span> ${p.seriesName}: ${sign}${p.value.toFixed(2)}%<br/>`;
        }
        return html;
      }
    },
    legend: {
      type: 'scroll',
      top: 0,
      textStyle: { color: '#8b949e', fontSize: 10 },
      pageIconColor: '#c9d1d9',
      pageTextStyle: { color: '#c9d1d9' }
    },
    grid: { left: '10%', right: '6%', top: '18%', bottom: '10%' },
    xAxis: {
      type: 'category',
      data: months,
      axisLabel: { color: '#8b949e', fontSize: 11 },
      axisLine: { lineStyle: { color: '#30363d' } }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#8b949e', fontSize: 11, formatter: '{value}%' },
      splitLine: { lineStyle: { color: '#30363d', type: 'dashed' } },
      axisLine: { lineStyle: { color: '#30363d' } }
    },
    series,
    animationDuration: 600
  }, true);
}

async function renderIndexVsSectorChart(yearMonth, sectors) {
  const rawIndices = await loadIndexMonthlyData(yearMonth);
  const indices = aggregateMonthlyIndices(rawIndices);
  const el = document.getElementById('indexVsSectorChart');
  if (!el) return;
  if (!indexVsSectorChart) indexVsSectorChart = echarts.init(el);
  const textColor = '#c9d1d9';
  const gridColor = '#30363d';
  const indexNames = indices.map(i => i.name);
  const indexValues = indices.map(i => i.changePct ?? i.ytd ?? 0);
  const sectorNames = sectors.map(s => s.sector);
  const sectorValues = sectors.map(s => s.avgDaily);
  indexVsSectorChart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#161b22',
      borderColor: '#30363d',
      textStyle: { color: textColor }
    },
    legend: {
      data: ['指数', '板块'],
      textStyle: { color: '#8b949e', fontSize: 11 }
    },
    grid: { left: '18%', right: '18%', top: '14%', bottom: '18%' },
    xAxis: [
      {
        type: 'category',
        data: indexNames,
        axisLabel: { color: '#8b949e', fontSize: 10, interval: 0, rotate: 30, width: 90, overflow: 'break' },
        axisLine: { lineStyle: { color: gridColor } }
      },
      {
        type: 'category',
        data: sectorNames,
        axisLabel: { color: '#8b949e', fontSize: 10, interval: 0, rotate: 30, width: 90, overflow: 'break' },
        axisLine: { lineStyle: { color: gridColor } },
        position: 'bottom',
        offset: 40
      }
    ],
    yAxis: [
      {
        type: 'value',
        name: '指数',
        position: 'left',
        axisLabel: { color: '#8b949e', fontSize: 11, formatter: '{value}%' },
        splitLine: { lineStyle: { color: gridColor, type: 'dashed' } },
        axisLine: { lineStyle: { color: gridColor } }
      },
      {
        type: 'value',
        name: '板块',
        position: 'right',
        axisLabel: { color: '#8b949e', fontSize: 11, formatter: '{value}%' },
        splitLine: { show: false },
        axisLine: { lineStyle: { color: gridColor } }
      }
    ],
    series: [
      {
        name: '指数',
        type: 'bar',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: indexValues.map(v => ({
          value: v,
          itemStyle: { color: v >= 0 ? '#ff7b72' : '#7ee787', borderRadius: 3 }
        })),
        label: { show: true, position: 'top', color: textColor, fontSize: 10, formatter: p => `${p.value >= 0 ? '+' : ''}${p.value.toFixed(2)}%` },
        barWidth: '40%'
      },
      {
        name: '板块',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: sectorValues.map(v => ({
          value: v,
          itemStyle: { color: v >= 0 ? '#58a6ff' : '#d2a8ff', borderRadius: 3 }
        })),
        label: { show: true, position: 'top', color: textColor, fontSize: 10, formatter: p => `${p.value >= 0 ? '+' : ''}${p.value.toFixed(2)}%` },
        barWidth: '40%'
      }
    ],
    animationDuration: 600
  }, true);
}

function fmtYearMonth(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// 后台 K 线拉取完成后回调：覆盖 ytd 并刷新图表
function onETFYTDUpdated(etfs) {
  data = etfs;
  renderCharts();
  renderTable();
  renderStats();
  toast('YTD 数据已更新');
}
function onIndexYTDUpdated(indices) {
  indexData = indices;
  if (indexYtdChart) {
    renderIndexYtdChart();
    indexYtdChart.resize();
  }
  console.log('index YTD 已更新');
}

function refreshAll() {
  updateStatus('正在获取实时数据...');
  Promise.all([loadLocalIndexHistory(), fetchETFData(), fetchIndexData()]).then(([_hist, etfs, indices]) => {
    if (etfs && etfs.length > 0) {
      data = etfs;
      dataSource = '腾讯财经';
      updateStatus(`${dataSource} · ${data.length}只ETF · 刚刚`);
      renderCharts();
      renderTable();
      renderStats();
      // 指数数据
      if (indices && indices.length > 0) {
        indexData = indices;
        renderIndexAll();
      }
      toast('数据已刷新');
      // 触发后台采集（best-effort，不阻塞）
      try {
        chrome.runtime?.sendMessage?.({ action: 'collectNow' });
      } catch (e) {}
      // 保存到 storage 供 popup 使用
      try {
        chrome.storage?.local?.set({
          aidinpan_etfs: etfs,
          aidinpan_indices: indices,
          last_update: Date.now(),
          source: 'tencent_api'
        });
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
    renderCharts();
    renderTable();
    renderStats();
    document.getElementById('editor').style.display = 'none';
    toast('数据已保存');
  } catch(e) { alert('JSON格式错误: ' + e.message); }
}
function restore() {
  if (!confirm('确定恢复默认数据？')) return;
  data = [...DEFAULT];
  document.getElementById('ta').value = JSON.stringify(data, null, 2);
  renderCharts();
  renderTable();
  renderStats();
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
  renderCharts();
  renderTable();
  renderStats();
  updateStatus(`${dataSource} · ${data.length}只ETF`);
  toast('已删除 ' + code);
  try {
    chrome.storage?.local?.set({ aidinpan_etfs: data, last_update: Date.now(), source: 'tencent_api' });
  } catch (e) {}
}

async function addETF() {
  const codeInput = document.getElementById('addCode').value.trim().toLowerCase();
  const nameInput = document.getElementById('addName').value.trim();
  if (!codeInput || !nameInput) {
    toast('请填写代码和名称');
    return;
  }
  // 验证格式
  const match = codeInput.match(/^(sh|sz)(\d{6})$/);
  if (!match) {
    toast('代码格式错误，如 sh510300');
    return;
  }
  const prefix = match[1];
  const num = match[2];
  const key = prefix + num;

  // 检查是否已存在
  if (data.find(e => e.code === num)) {
    toast('该 ETF 已存在');
    return;
  }

  const btn = document.getElementById('btnAdd');
  btn.textContent = '获取中...';
  btn.disabled = true;

  try {
    // 获取当前价和日涨跌
    const url = `https://qt.gtimg.cn/q=${key}`;
    const resp = await fetch(url);
    const text = await resp.text();
    const lineMatch = text.match(/v_[a-z]{2}\d{6}="(.*)"/);
    if (!lineMatch) {
      toast('获取数据失败，请检查代码是否正确');
      btn.textContent = '添加';
      btn.disabled = false;
      return;
    }
    const fields = lineMatch[1].split('~');
    if (fields.length < 35) {
      toast('数据格式异常');
      btn.textContent = '添加';
      btn.disabled = false;
      return;
    }
    const currentPrice = parseFloat(fields[3]);
    const changePct = parseFloat(fields[32]);

    // 获取年初价计算 YTD
    const year = new Date().getFullYear();
    const yearStartPrice = await getYearStartPrice(key, year);
    let ytd = 0;
    if (yearStartPrice && yearStartPrice > 0) {
      ytd = ((currentPrice - yearStartPrice) / yearStartPrice) * 100;
    }

    const newETF = {
      code: num,
      name: nameInput,
      sector: classifySector(nameInput),
      daily: parseFloat(changePct.toFixed(2)),
      ytd: parseFloat(ytd.toFixed(2)),
    };

    data.push(newETF);
    renderCharts();
    renderTable();
    renderStats();
    updateStatus(`${dataSource} · ${data.length}只ETF`);
    toast('已添加 ' + nameInput);

    // 清空输入框并关闭对话框
    document.getElementById('addCode').value = '';
    document.getElementById('addName').value = '';
    document.getElementById('addDialog').style.display = 'none';

    // 保存到 storage
    try {
      chrome.storage?.local?.set({ aidinpan_etfs: data, last_update: Date.now(), source: 'tencent_api' });
    } catch (e) {}
  } catch (e) {
    console.error('addETF failed', e);
    toast('添加失败: ' + e.message);
  }

  btn.textContent = '添加';
  btn.disabled = false;
}

function toast(m) { const t = document.getElementById('toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2000); }

// 窗口大小变化时重绘图表
window.addEventListener('resize', () => {
  dailyChart?.resize();
  ytdChart?.resize();
  indexChart?.resize();
  indexYtdChart?.resize();
  monthlySectorChart?.resize();
  bestWorstChart?.resize();
  sectorTrendChart?.resize();
  indexVsSectorChart?.resize();
});

function renderDefault() {
  dataSource = '默认';
  updateStatus('默认数据 · 38只ETF · 点击刷新获取最新');
  renderCharts();
  renderTable();
  renderStats();
}

// 自动初始化：优先读缓存，否则直接刷新，有超时保护
setTimeout(() => {
  let initDone = false;
  function doInit() {
    if (initDone) return;
    initDone = true;
    refreshAll();
  }
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
          renderCharts();
          renderTable();
          renderStats();
          if (result?.aidinpan_indices && result.aidinpan_indices.length > 0) {
            indexData = result.aidinpan_indices;
            renderIndexAll();
          }
          toast('已加载缓存数据');
        } else {
          renderDefault();
          refreshAll();
        }
      });
      setTimeout(() => {
        if (!initDone) {
          initDone = true;
          renderDefault();
          refreshAll();
        }
      }, 3000);
    } else {
      initDone = true;
      renderDefault();
      refreshAll();
    }
  } catch (e) {
    console.error('init error', e);
    if (!initDone) {
      initDone = true;
      renderDefault();
    }
  }
}, 300);

// ======================== 事件绑定 ========================
// 指数 tab 切换
document.querySelectorAll('.index-tab').forEach(tab => {
  tab.addEventListener('click', (e) => {
    const targetTab = e.target.dataset.tab;
    document.querySelectorAll('.index-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.index-tab-panel').forEach(p => p.classList.remove('active'));
    e.target.classList.add('active');
    document.getElementById('tab-' + targetTab).classList.add('active');
    if (targetTab === 'chart') {
      if (!indexChart) {
        renderIndexChart();
      } else {
        indexChart.resize();
      }
      if (indexData.some(d => typeof d.ytd === 'number')) {
        if (!indexYtdChart) {
          renderIndexYtdChart();
        } else {
          indexYtdChart.resize();
        }
      }
    } else if (targetTab === 'monthly') {
      renderMonthlyReport();
    } else if (targetTab === 'sector') {
      // 首次切到板块 tab 时图表可能未初始化，触发一次渲染
      if (!dailyChart || !ytdChart) {
        renderCharts();
      } else {
        dailyChart.resize();
        ytdChart.resize();
      }
    }
  });
});
document.getElementById('btnAddOpen').addEventListener('click', () => {
  document.getElementById('addDialog').style.display = 'block';
  document.getElementById('addCode').focus();
});
document.getElementById('btnAddClose').addEventListener('click', () => {
  document.getElementById('addDialog').style.display = 'none';
});
document.getElementById('btnAddCancel').addEventListener('click', () => {
  document.getElementById('addDialog').style.display = 'none';
});
// 编辑对话框
document.getElementById('btnEdit').addEventListener('click', () => {
  document.getElementById('ta').value = JSON.stringify(data, null, 2);
  document.getElementById('editor').style.display = 'block';
});
document.getElementById('btnEditClose').addEventListener('click', () => {
  document.getElementById('editor').style.display = 'none';
});
// 其他按钮
document.getElementById('btnRefresh').addEventListener('click', refreshAll);
document.getElementById('btnExport').addEventListener('click', exportJson);
document.getElementById('btnSave').addEventListener('click', saveEdit);
document.getElementById('btnRestore').addEventListener('click', restore);
document.getElementById('btnCancel').addEventListener('click', cancelEdit);
// 月报控件
document.getElementById('monthSelect')?.addEventListener('change', () => {
  availableMonthsCache = null; // 允许重新加载当前选择
  renderMonthlyReport();
});
document.getElementById('sectorFilter')?.addEventListener('change', renderMonthlyReport);
document.getElementById('btnMonthlyRefresh')?.addEventListener('click', () => {
  availableMonthsCache = null;
  monthlyDataCache = null;
  renderMonthlyReport();
});
// 添加
document.getElementById('btnAdd').addEventListener('click', addETF);
document.getElementById('addCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') addETF(); });
document.getElementById('addName').addEventListener('keydown', (e) => { if (e.key === 'Enter') addETF(); });
// 表头排序
document.getElementById('th-name').addEventListener('click', () => sort('name'));
document.getElementById('th-code').addEventListener('click', () => sort('code'));
document.getElementById('th-sector').addEventListener('click', () => sort('sector'));
document.getElementById('th-daily').addEventListener('click', () => sort('daily'));
document.getElementById('th-ytd').addEventListener('click', () => sort('ytd'));
