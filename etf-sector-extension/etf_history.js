// etf_history.js — 一次性工具：从腾讯 K 线拉 38 个 ETF 每日数据，写入 etfs store
// 月报再按需聚合 sector 月度累计涨跌

import { ETF_CODES, classifySector } from './shared.js';
import { bulkImportETFs } from './db.js';

const DEFAULT_YEAR = 2026;
const DEFAULT_START = '2026-01-01';
const DEFAULT_END = '2026-07-01';

async function fetchETF(code, startDate, endDate, limit = 200) {
  const prefix = code.startsWith('sh') ? 'sh' : 'sz';
  const num = code.replace(/^[a-z]+/, '');
  const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${prefix}${num},day,${startDate},${endDate},${limit},qfq`;
  try {
    const r = await fetch(url);
    const d = await r.json();
    const stockData = d.data?.[`${prefix}${num}`];
    if (!stockData) return [];
    return stockData.qfqday || stockData.day || [];
  } catch (e) {
    console.error(`[etf] fetch failed ${code}`, e);
    return [];
  }
}

async function runWithLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// 主入口：拉 ETF K 线，每日 record (code + close) 写入 etfs store
export async function fetchAndStoreETFHistory({
  year = DEFAULT_YEAR,
  startDate = DEFAULT_START,
  endDate = DEFAULT_END,
  codes = null,
  batchSize = 200,
} = {}) {
  const codesToFetch = codes || Object.keys(ETF_CODES);
  console.log(`[etf] fetching ${codesToFetch.length} ETF klines ${startDate} ~ ${endDate}`);

  const records = [];
  const summary = {};

  // 并发拉所有 ETF K 线（限流 6）
  const results = await runWithLimit(codesToFetch, 6, async (code) => {
    const klines = await fetchETF(code, startDate, endDate);
    return { code, name: ETF_CODES[code], klines };
  });

  for (const { code, name, klines } of results) {
    const sector = classifySector(name);
    summary[code] = { name, klines: klines.length };
    if (klines.length === 0) continue;
    for (const k of klines) {
      const [dateStr, open, close, high, low] = k;
      const date = dateStr.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
      if (date >= endDate) continue;
      records.push({
        date,
        code,
        name,
        sector,
        close: parseFloat(close),
        open: parseFloat(open),
        high: parseFloat(high),
        low: parseFloat(low),
        source: 'tencent_qq_etf_kline',
        capturedAt: Date.parse(date) || Date.now(),
      });
    }
  }

  if (records.length === 0) {
    return { success: false, error: 'no records', summary };
  }

  const result = await bulkImportETFs(records, batchSize);
  console.log(`[etf] stored: ${records.length} etf records (${result.added} added, ${result.updated} updated)`);
  return {
    success: true,
    added: result.added,
    updated: result.updated,
    totalEtfRecords: records.length,
    summary,
    dateRange: [startDate, endDate],
  };
}