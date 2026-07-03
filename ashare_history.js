// ashare_history.js — 一次性工具：从腾讯 K 线拉 A 股 4 个指数历史每日数据写入 IDB
// 只在用户点击"补 A 股历史"按钮时调用

import { INDEX_CODES } from './shared.js';
import { bulkImportIndices } from './db.js';

const ASHARE_CODES = ['sh000001', 'sz399001', 'sz399006', 'sh000688'];
const DEFAULT_YEAR = 2026;

// 拉单个指数的 K 线（含 6 月最后一天）
async function fetchKLine(code, year) {
  const prefix = code.startsWith('sh') ? 'sh' : 'sz';
  const num = code.replace(/^[a-z]+/, '');
  // 拉 6 月 1 - 7 月 5 (含一点冗余)
  const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${prefix}${num},day,${year}-06-01,${year}-07-05,30,qfq`;
  try {
    const r = await fetch(url);
    const d = await r.json();
    const stockData = d.data?.[`${prefix}${num}`];
    if (!stockData) return [];
    const days = stockData.qfqday || stockData.day;
    return days || [];
  } catch (e) {
    console.error(`[ashare] fetchKLine failed for ${code}`, e);
    return [];
  }
}

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 主入口：拉 A 股 4 个指数 6 月每日数据，写入 IDB
export async function fetchAndStoreAJune(year = DEFAULT_YEAR) {
  const records = [];
  const summary = {};

  for (const code of ASHARE_CODES) {
    const cfg = INDEX_CODES[code];
    if (!cfg) continue;
    const klines = await fetchKLine(code, year);
    summary[code] = { name: cfg.name, count: klines.length };

    if (klines.length === 0) continue;

    // 算每年首日作为 YTD 基线（这里只关心 6 月，但保持一致）
    const yearStart = klines[0][1]; // 第一条的 open
    let prev = null;
    for (const k of klines) {
      // 腾讯 K 线字段：0=date, 1=open, 2=close, 3=high, 4=low, 5=volume, ...
      const [dateStr, open, close, high, low] = k;
      const date = dateStr.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
      // 跳过 7 月数据
      if (date >= `${year}-07-01`) continue;
      const change = prev ? +(close - prev).toFixed(4) : null;
      const changePct = prev ? +(((close - prev) / prev) * 100).toFixed(4) : null;
      const ytd = yearStart > 0 ? +(((close - yearStart) / yearStart) * 100).toFixed(4) : null;
      records.push({
        date,
        code,
        name: cfg.name,
        market: cfg.market,
        open: parseFloat(open),
        high: parseFloat(high),
        low: parseFloat(low),
        close: parseFloat(close),
        change,
        changePct,
        ytd,
        source: 'tencent_qq_kline',
        capturedAt: Date.parse(date) || Date.now(),
      });
      prev = close;
    }
    console.log(`[ashare] ${cfg.name} (${code}) fetched ${klines.length} klines, yearStart=${yearStart}`);
  }

  if (records.length === 0) {
    return { success: false, error: 'no records', summary };
  }

  const { added, updated } = await bulkImportIndices(records);
  return { success: true, added, updated, summary, totalRecords: records.length };
}