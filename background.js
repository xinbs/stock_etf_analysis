// background.js — Service Worker（ES module）
// 实时获取 ETF / 指数数据并持久化到 IndexedDB，同时提供消息接口给 full.js

import { ETF_CODES, DEFAULT_YTD, INDEX_CODES, classifySector, fmtDate, fmtYearMonth } from './shared.js';
import {
  openDB, saveIndexRecord, saveSectorRecord, saveETFRecord,
  getSectorsByMonth, getAllAvailableMonths, bulkImportIndices,
  getIndexByDate, hasTodayMarketRecord, setMeta, getMeta
} from './db.js';

const COLLECTION_ALARM_NAME = 'dailyCollect';
const ALARM_PERIOD_MINUTES = 5;

// ===== 指数 K 线年初开盘价（复用 full.js 逻辑） =====
async function getYearStartPrice(code, year) {
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
      return parseFloat(days[0][1]);
    } catch (e) { return null; }
  }
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
      return parseFloat(days[0][1]);
    } catch (e) { return null; }
  }
  return null;
}

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

const YTD_CACHE_PREFIX = 'yearStartCache';

async function getYearStartPricesCached(codes, year) {
  const cacheKey = (code) => `${YTD_CACHE_PREFIX}:${year}:${code}`;
  let store = {};
  try {
    store = (await chrome.storage?.local?.get(null)) || {};
  } catch (e) {}
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
  const fetched = await runWithLimit(missing, 6, async (code) => {
    const price = await getYearStartPrice(code, year);
    return { code, price };
  });
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

// ===== 拉取指数数据 =====
async function fetchIndexData() {
  const tencentKeys = Object.keys(INDEX_CODES).filter(k => !INDEX_CODES[k].eastmoney);
  const tencentUrl = `https://qt.gtimg.cn/q=${tencentKeys.join(',')}`;
  const results = [];

  try {
    const resp = await fetch(tencentUrl);
    const text = await resp.text();
    for (const line of text.trim().split(';').filter(l => l.trim())) {
      const match = line.match(/v_([a-zA-Z0-9_\.]+)="(.*)"/);
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
      let ytdFromTencent = null;
      if (cfg.market === '美股' && fields.length > 54) {
        const f54 = parseFloat(fields[54]);
        if (!isNaN(f54) && f54 !== 0) ytdFromTencent = f54;
      }
      results.push({ code: key, name: cfg.name, market: cfg.market, price, change, changePct, ytd: ytdFromTencent });
    }
  } catch (e) { console.error('[bg] fetchIndexData tencent failed', e); }

  // 日韩
  const eastmoneyKeys = Object.keys(INDEX_CODES).filter(k => INDEX_CODES[k].eastmoney);
  for (const key of eastmoneyKeys) {
    const cfg = INDEX_CODES[key];
    let pushed = false;
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
          results.push({ code: key, name: cfg.name, market: cfg.market, price, change, changePct });
          pushed = true;
        }
      }
    } catch (e) { console.log(`[bg] ${key} eastmoney failed: ${e.message}`); }

    if (!pushed && cfg.sina) {
      try {
        const resp = await fetch('https://hq.sinajs.cn/list=' + cfg.sina, {
          headers: { 'Referer': 'https://finance.sina.com.cn/' }
        });
        if (!resp.ok) throw new Error('http ' + resp.status);
        const text = await resp.text();
        const m = text.match(/="([^"]+)"/);
        if (m) {
          const f = m[1].split(',');
          const price = parseFloat(f[1]);
          const change = parseFloat(f[2]);
          const changePct = parseFloat(f[3]);
          if (!isNaN(price) && !isNaN(changePct)) {
            results.push({ code: key, name: cfg.name, market: cfg.market, price, change, changePct });
            pushed = true;
          }
        }
      } catch (e) { console.log(`[bg] ${key} sina failed: ${e.message}`); }
    }
  }

  // 用 K 线计算其余指数 YTD
  const year = new Date().getFullYear();
  const needYtd = results.filter(r => r.ytd === null || r.ytd === undefined).map(r => r.code);
  const ytdMap = await getYearStartPricesCached(needYtd, year);
  results.forEach(r => {
    if (r.ytd === null || r.ytd === undefined) {
      const start = ytdMap[r.code];
      if (start && start > 0) {
        r.ytd = +(((r.price - start) / start) * 100).toFixed(2);
      } else {
        r.ytd = null;
      }
    } else {
      r.ytd = parseFloat(r.ytd.toFixed(2));
    }
  });

  return results;
}

// ===== 拉取 ETF 数据 =====
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
    const etfs = [];
    for (const key of Object.keys(ETF_CODES)) {
      const current = currentData[key];
      etfs.push({
        code: current?.code || key.replace(/^[a-z]+/, ''),
        name: ETF_CODES[key],
        sector: classifySector(ETF_CODES[key]),
        daily: current?.changePct || 0,
        ytd: parseFloat((DEFAULT_YTD[key] || 0).toFixed(2)),
        currentPrice: current?.currentPrice || 0,
      });
    }

    // 异步拉 K 线覆盖 YTD
    const year = new Date().getFullYear();
    getYearStartPricesCached(Object.keys(ETF_CODES), year).then(yearStartMap => {
      for (const e of etfs) {
        const key = Object.keys(ETF_CODES).find(k => ETF_CODES[k] === e.name);
        if (!key) continue;
        const current = currentData[key];
        const start = yearStartMap[key];
        if (current && start && start > 0) {
          const calcYtd = ((current.currentPrice - start) / start * 100);
          if (!isNaN(calcYtd)) e.ytd = parseFloat(calcYtd.toFixed(2));
        }
      }
    });

    return etfs;
  } catch (e) {
    console.error('[bg] fetchETFData failed', e);
    return null;
  }
}

// ===== 板块聚合 =====
function aggregateSectors(etfs) {
  const m = {};
  for (const e of etfs) {
    (m[e.sector] = m[e.sector] || []).push(e);
  }
  return Object.entries(m).map(([sector, arr]) => ({
    sector,
    count: arr.length,
    avgDaily: +(arr.reduce((a, b) => a + b.daily, 0) / arr.length).toFixed(2),
    avgYtd: +(arr.reduce((a, b) => a + b.ytd, 0) / arr.length).toFixed(2),
  }));
}

// ===== 主采集函数 =====
async function collectDailyData(force = false) {
  console.log('[bg] collectDailyData start, force=' + force);
  const today = fmtDate(new Date());
  const capturedAt = Date.now();

  // 并行拉取
  const [indices, etfs] = await Promise.all([fetchIndexData(), fetchETFData()]);
  if (!indices || indices.length === 0) {
    console.warn('[bg] collectDailyData: no index data');
    return { success: false, error: 'no index data' };
  }

  // 写入指数（按 code+date 去重）
  let indexSaved = 0;
  for (const idx of indices) {
    if (!force) {
      const exists = await hasTodayMarketRecord(idx.market);
      if (exists) continue;
    }
    await saveIndexRecord({
      date: today,
      code: idx.code,
      name: idx.name,
      market: idx.market,
      open: null,
      high: null,
      low: null,
      close: idx.price,
      change: idx.change,
      changePct: idx.changePct,
      ytd: idx.ytd,
      source: 'tencent_qt',
      capturedAt,
    });
    indexSaved++;
  }

  // 写入 ETF 明细 + 板块聚合
  let etfSaved = 0, sectorSaved = 0;
  if (etfs && etfs.length > 0) {
    for (const e of etfs) {
      await saveETFRecord({
        date: today,
        code: e.code,
        name: e.name,
        sector: e.sector,
        close: e.currentPrice,
        daily: e.daily,
        ytd: e.ytd,
        capturedAt,
      });
      etfSaved++;
    }
    const sectors = aggregateSectors(etfs);
    for (const s of sectors) {
      await saveSectorRecord({
        date: today,
        sector: s.sector,
        count: s.count,
        avgDaily: s.avgDaily,
        avgYtd: s.avgYtd,
        capturedAt,
      });
      sectorSaved++;
    }
  }

  console.log(`[bg] collectDailyData done: indices=${indexSaved}, etfs=${etfSaved}, sectors=${sectorSaved}`);
  return { success: true, indexSaved, etfSaved, sectorSaved };
}

// ===== 历史数据导入 =====
async function importHistoryIfNeeded() {
  const imported = await getMeta('historyImported');
  if (imported) return { skipped: true };

  // 从 chrome.runtime.getURL 加载 global_indices_2y.json
  try {
    const url = chrome.runtime.getURL('global_indices_2y.json');
    const resp = await fetch(url);
    const json = await resp.json();
    const records = [];
    const codeMap = {};
    for (const [key, cfg] of Object.entries(INDEX_CODES)) {
      if (cfg.historyKey && json[cfg.historyKey]) codeMap[cfg.historyKey] = key;
    }

    for (const [historyKey, obj] of Object.entries(json)) {
      const code = codeMap[historyKey];
      const cfg = INDEX_CODES[code];
      if (!code || !cfg || !Array.isArray(obj.records)) continue;
      const recs = obj.records;
      // 找出每年第一条记录作为该年 YTD 基线
      const yearStarts = {}; // year -> close
      for (const r of recs) {
        const y = r.date.slice(0, 4);
        if (!(y in yearStarts)) yearStarts[y] = r.close;
      }
      for (let i = 0; i < recs.length; i++) {
        const r = recs[i];
        const y = r.date.slice(0, 4);
        const prev = i > 0 ? recs[i - 1] : null;
        const change = prev ? +(r.close - prev.close).toFixed(4) : null;
        const changePct = prev ? +(((r.close - prev.close) / prev.close) * 100).toFixed(4) : null;
        const ytd = yearStarts[y] > 0 ? +(((r.close - yearStarts[y]) / yearStarts[y]) * 100).toFixed(4) : null;
        records.push({
          date: r.date,
          code,
          name: cfg.name,
          market: cfg.market,
          open: r.open,
          high: r.high,
          low: r.low,
          close: r.close,
          change,
          changePct,
          ytd,
          source: 'global_indices_2y_json',
          capturedAt: Date.parse(r.date) || Date.now(),
        });
      }
    }

    const { added, updated } = await bulkImportIndices(records);
    await setMeta('historyImported', true);
    console.log(`[bg] history import done: added=${added}, updated=${updated}`);
    return { added, updated };
  } catch (e) {
    console.error('[bg] history import failed', e);
    return { error: e.message };
  }
}

// ===== 收盘判断 =====
function isMarketJustClosed(market) {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const hm = hour * 60 + minute;
  const inRange = (startH, startM, endH, endM) => {
    const start = startH * 60 + startM;
    const end = endH * 60 + endM;
    return hm >= start && hm <= end;
  };
  switch (market) {
    case 'A股': return inRange(15, 0, 15, 30);
    case '港股': return inRange(16, 0, 16, 30);
    case '美股': return inRange(5, 0, 5, 30); // 次日北京时间
    case '日韩': return inRange(15, 0, 15, 30); // 日经；韩国 15:30 收盘取前一段
    default: return false;
  }
}

function shouldCollectNow() {
  const markets = ['A股', '港股', '美股', '日韩'];
  return markets.some(isMarketJustClosed);
}

// ===== 监听消息 =====
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchETF') {
    fetchETFData().then(data => {
      if (data && data.length > 0) {
        chrome.storage.local.set({
          aidinpan_etfs: data,
          last_update: Date.now(),
          source: 'tencent_api'
        });
        sendResponse({ data, success: true, count: data.length });
      } else {
        sendResponse({ data: null, success: false, error: 'fetch failed' });
      }
    });
    return true;
  }
  if (request.action === 'collectNow') {
    collectDailyData(request.force || false).then(result => sendResponse(result));
    return true;
  }
  if (request.action === 'getMonthlySectors') {
    (async () => {
      const sectors = await getSectorsByMonth(request.yearMonth);
      sendResponse({ success: true, sectors });
    })();
    return true;
  }
  if (request.action === 'getAvailableMonths') {
    (async () => {
      const months = await getAllAvailableMonths();
      sendResponse({ success: true, months });
    })();
    return true;
  }
  if (request.action === 'getIndexMonthly') {
    (async () => {
      const [y, m] = request.yearMonth.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const start = `${request.yearMonth}-01`;
      const end = `${request.yearMonth}-${String(lastDay).padStart(2, '0')}`;
      const { getIndicesByDateRange } = await import('./db.js');
      const indices = await getIndicesByDateRange(start, end);
      // 每个 code 取该月最后一条
      const latest = {};
      for (const r of indices) {
        if (!latest[r.code] || r.date > latest[r.code].date) latest[r.code] = r;
      }
      sendResponse({ success: true, indices: Object.values(latest) });
    })();
    return true;
  }
  if (request.action === 'reimportHistory') {
    (async () => {
      await setMeta('historyImported', false);
      const result = await importHistoryIfNeeded();
      sendResponse({ success: true, result });
    })();
    return true;
  }
  if (request.action === 'recollectDaily') {
    (async () => {
      const result = await collectDailyData(true);
      sendResponse({ success: true, result });
    })();
    return true;
  }
  if (request.action === 'dbStatus') {
    (async () => {
      const months = await getAllAvailableMonths();
      const imported = await getMeta('historyImported');
      sendResponse({ success: true, months, historyImported: !!imported });
    })();
    return true;
  }
  return true;
});

// ===== 安装 / 启动 / 定时器 =====
chrome.runtime.onInstalled.addListener(() => {
  console.log('[bg] onInstalled');
  openDB().then(() => importHistoryIfNeeded()).then(() => collectDailyData());
  chrome.alarms.create(COLLECTION_ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[bg] onStartup');
  openDB().then(() => importHistoryIfNeeded()).then(() => {
    if (shouldCollectNow()) collectDailyData();
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === COLLECTION_ALARM_NAME) {
    console.log('[bg] alarm fired');
    if (shouldCollectNow()) {
      collectDailyData();
    }
  }
});

// 兜底：打开插件时 service worker 可能被唤醒，这里也做一次检查
collectDailyData();
