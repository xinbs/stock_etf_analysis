import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import {
  ETF_CODES,
  DEFAULT_YTD,
  INDEX_CODES,
  classifySector,
  fmtDate,
  fmtYearMonth
} from '../../etf-sector-extension/shared.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(SERVER_ROOT, '..');
const EXT_ROOT = path.join(PROJECT_ROOT, 'etf-sector-extension');
const DATA_DIR = process.env.DATA_DIR || path.join(SERVER_ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const FUND_FLOW_DB_FILE = path.join(DATA_DIR, 'fund_flows.sqlite');
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';

let dbCache = null;
let fundFlowDb = null;

function send(res, status, body, headers = {}) {
  const payload = Buffer.isBuffer(body) || typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': typeof body === 'object' && !Buffer.isBuffer(body) ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers
  });
  res.end(payload);
}

function json(res, body, status = 200) {
  send(res, status, body, { 'Content-Type': 'application/json; charset=utf-8' });
}

function today() {
  return fmtDate(new Date());
}

// ---- A股交易时段判断（固定按 Asia/Shanghai，避免容器/宿主机时区差异）----
function shanghaiNow() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs + 8 * 3600000);
}

function isTradingDay(d = shanghaiNow()) {
  const w = d.getDay();
  return w >= 1 && w <= 5; // 法定节假日未内置，节假日会少量空跑但不限流
}

// 交易时段（含集合竞价与收盘后 10 分钟缓冲）：09:25-11:35、12:55-15:10
// 收盘后东财实时资金流接口拉不到有效数据，非交易时段一律不请求外部接口
function isTradingTime(d = shanghaiNow()) {
  if (!isTradingDay(d)) return false;
  const m = d.getHours() * 60 + d.getMinutes();
  return (m >= 565 && m <= 695) || (m >= 775 && m <= 910);
}

function tradingTimeSkipResult() {
  return {
    success: true,
    skipped: true,
    reason: '当前非 A 股交易时段（或已收盘），实时资金流已定型，不再请求外部接口，页面展示缓存数据',
    tradeDate: today()
  };
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

async function loadDb() {
  if (dbCache) return dbCache;
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    dbCache = JSON.parse(await fs.readFile(DB_FILE, 'utf8'));
  } catch (e) {
    dbCache = { etfs: [], indices: [], sectors: [], cache: {}, meta: {} };
  }
  for (const row of dbCache.etfs || []) {
    if (row.name) row.sector = classifySector(row.name);
  }
  for (const row of dbCache.cache?.aidinpan_etfs || []) {
    if (row.name) row.sector = classifySector(row.name);
  }
  return dbCache;
}

async function saveDb() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(dbCache, null, 2));
}

async function getFundFlowDb() {
  if (fundFlowDb) return fundFlowDb;
  await fs.mkdir(DATA_DIR, { recursive: true });
  fundFlowDb = new DatabaseSync(FUND_FLOW_DB_FILE);
  fundFlowDb.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS etf_fund_flow_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      market_code TEXT NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      sector TEXT NOT NULL,
      captured_at TEXT NOT NULL,
      trade_date TEXT NOT NULL,
      price REAL,
      change_pct REAL,
      amount REAL,
      main_net REAL,
      main_ratio REAL,
      super_large_net REAL,
      large_net REAL,
      mid_net REAL,
      small_net REAL,
      flow_3d REAL,
      flow_5d REAL,
      flow_10d REAL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(provider, market_code, captured_at)
    );

    CREATE TABLE IF NOT EXISTS etf_fund_flow_daily (
      provider TEXT NOT NULL,
      market_code TEXT NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      sector TEXT NOT NULL,
      trade_date TEXT NOT NULL,
      main_net REAL,
      small_net REAL,
      mid_net REAL,
      large_net REAL,
      super_large_net REAL,
      main_ratio REAL,
      close REAL,
      change_pct REAL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(provider, market_code, trade_date)
    );

    CREATE TABLE IF NOT EXISTS etf_fund_flow_intraday (
      provider TEXT NOT NULL,
      market_code TEXT NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      sector TEXT NOT NULL,
      trade_date TEXT NOT NULL,
      minute_time TEXT NOT NULL,
      main_net REAL,
      small_net REAL,
      mid_net REAL,
      large_net REAL,
      super_large_net REAL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(provider, market_code, minute_time)
    );

    CREATE TABLE IF NOT EXISTS fund_flow_provider_status (
      provider TEXT PRIMARY KEY,
      last_success_at TEXT,
      last_error_at TEXT,
      last_error TEXT,
      duration_ms INTEGER,
      row_count INTEGER,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS board_fund_flow_reference (
      provider TEXT NOT NULL,
      board_type TEXT NOT NULL,
      board_code TEXT NOT NULL,
      board_name TEXT NOT NULL,
      captured_at TEXT NOT NULL,
      trade_date TEXT NOT NULL,
      main_net REAL,
      main_ratio REAL,
      change_pct REAL,
      source_payload TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(provider, board_type, board_code, captured_at)
    );

    CREATE INDEX IF NOT EXISTS idx_etf_flow_snapshots_sector_time ON etf_fund_flow_snapshots(sector, captured_at);
    CREATE INDEX IF NOT EXISTS idx_etf_flow_daily_sector_date ON etf_fund_flow_daily(sector, trade_date);
    CREATE INDEX IF NOT EXISTS idx_etf_flow_intraday_sector_time ON etf_fund_flow_intraday(sector, minute_time);
  `);
  const tables = ['etf_fund_flow_snapshots', 'etf_fund_flow_daily', 'etf_fund_flow_intraday'];
  for (const [marketCode, name] of Object.entries(ETF_CODES)) {
    const sector = classifySector(name);
    for (const table of tables) {
      fundFlowDb.prepare(`UPDATE ${table} SET sector = ? WHERE market_code = ? AND sector <> ?`).run(sector, marketCode, sector);
    }
  }
  return fundFlowDb;
}

function marketCodeToSecid(marketCode) {
  const code = String(marketCode || '').replace(/^[a-z]+/i, '');
  if (String(marketCode || '').startsWith('sh')) return `1.${code}`;
  if (String(marketCode || '').startsWith('sz')) return `0.${code}`;
  if (code.startsWith('6') || code.startsWith('5')) return `1.${code}`;
  return `0.${code}`;
}

function numOrNull(v) {
  if (v == null || v === '' || v === '-') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function etfUniverse() {
  return Object.entries(ETF_CODES).map(([marketCode, name]) => ({
    provider: 'eastmoney_etf',
    marketCode,
    secid: marketCodeToSecid(marketCode),
    code: marketCode.replace(/^[a-z]+/i, ''),
    name,
    sector: classifySector(name)
  }));
}

function expectedSectorCounts() {
  const counts = new Map();
  for (const e of etfUniverse()) counts.set(e.sector, (counts.get(e.sector) || 0) + 1);
  return counts;
}

function setProviderStatus(db, provider, status) {
  db.prepare(`
    INSERT INTO fund_flow_provider_status
      (provider, last_success_at, last_error_at, last_error, duration_ms, row_count, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(provider) DO UPDATE SET
      last_success_at = COALESCE(excluded.last_success_at, fund_flow_provider_status.last_success_at),
      last_error_at = COALESCE(excluded.last_error_at, fund_flow_provider_status.last_error_at),
      last_error = excluded.last_error,
      duration_ms = excluded.duration_ms,
      row_count = excluded.row_count,
      updated_at = excluded.updated_at
  `).run(
    provider,
    status.success ? status.at : null,
    status.success ? null : status.at,
    status.error || null,
    status.durationMs ?? null,
    status.rowCount ?? null,
    status.at
  );
}

function fundFlowChanged(prev, next) {
  if (!prev) return true;
  const fields = ['price', 'changePct', 'amount', 'mainNet', 'mainRatio', 'superLargeNet', 'largeNet', 'midNet', 'smallNet', 'flow3d', 'flow5d', 'flow10d'];
  return fields.some(field => {
    const a = numOrNull(prev[field === 'changePct' ? 'change_pct' :
      field === 'mainNet' ? 'main_net' :
      field === 'mainRatio' ? 'main_ratio' :
      field === 'superLargeNet' ? 'super_large_net' :
      field === 'largeNet' ? 'large_net' :
      field === 'midNet' ? 'mid_net' :
      field === 'smallNet' ? 'small_net' :
      field === 'flow3d' ? 'flow_3d' :
      field === 'flow5d' ? 'flow_5d' :
      field === 'flow10d' ? 'flow_10d' :
      field]);
    const b = numOrNull(next[field]);
    if (a == null && b == null) return false;
    if (a == null || b == null) return true;
    return Math.abs(a - b) > 0.000001;
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

function normalizeEastmoneyEtfSnapshotRows(universe, diff, capturedAt, tradeDate) {
  const byCode = new Map((diff || []).map(r => [String(r.f12), r]));
  return universe.map(e => {
    const r = byCode.get(e.code);
    if (!r) return null;
    return {
      provider: e.provider,
      marketCode: e.marketCode,
      code: e.code,
      name: e.name,
      sector: e.sector,
      capturedAt,
      tradeDate,
      price: numOrNull(r.f2),
      changePct: numOrNull(r.f3),
      amount: numOrNull(r.f6),
      mainNet: numOrNull(r.f62),
      mainRatio: numOrNull(r.f184),
      superLargeNet: numOrNull(r.f66),
      largeNet: numOrNull(r.f72),
      midNet: numOrNull(r.f78),
      smallNet: numOrNull(r.f84),
      flow3d: numOrNull(r.f267),
      flow5d: numOrNull(r.f269),
      flow10d: numOrNull(r.f271)
    };
  }).filter(r => r && Number.isFinite(r.mainNet));
}

async function fetchEastmoneyEtfSnapshotBatch(universe) {
  const secids = universe.map(e => e.secid).join(',');
  const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&secids=${encodeURIComponent(secids)}&fields=f12,f14,f2,f3,f6,f62,f184,f66,f69,f72,f75,f78,f81,f84,f87,f267,f269,f271`;
  const data = await fetchJson(url, { headers: { Referer: 'https://quote.eastmoney.com/' } });
  return data.data?.diff || [];
}

async function fetchEastmoneyEtfSnapshot() {
  const universe = etfUniverse();
  const capturedAt = new Date().toISOString();
  const tradeDate = today();
  const batches = chunkArray(universe, 4);
  const rows = [];
  const errors = [];
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    let diff = null;
    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        diff = await fetchEastmoneyEtfSnapshotBatch(batch);
        break;
      } catch (e) {
        lastError = e;
        if (attempt < 3) await sleep(500 * attempt);
      }
    }
    if (diff) {
      rows.push(...normalizeEastmoneyEtfSnapshotRows(batch, diff, capturedAt, tradeDate));
    } else {
      const failedCodes = [];
      for (const etf of batch) {
        let oneDiff = null;
        let oneError = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            oneDiff = await fetchEastmoneyEtfSnapshotBatch([etf]);
            break;
          } catch (e) {
            oneError = e;
            if (attempt < 2) await sleep(500);
          }
        }
        if (oneDiff) {
          rows.push(...normalizeEastmoneyEtfSnapshotRows([etf], oneDiff, capturedAt, tradeDate));
        } else {
          failedCodes.push(etf.marketCode);
        }
        await sleep(300);
        lastError = oneError || lastError;
      }
      if (failedCodes.length) {
        errors.push({
          batch: i + 1,
          codes: failedCodes,
          error: lastError?.message || 'unknown error'
        });
      }
    }
    if (i < batches.length - 1) await sleep(700);
  }
  if (!rows.length) {
    const sample = errors.slice(0, 2).map(e => e.error).join('; ');
    throw new Error(sample || 'eastmoney_etf snapshot returned no rows');
  }
  return { rows, errors, expected: universe.length, capturedAt, tradeDate };
}

// 资金流更新入口：交易时段外直接跳过；并发调用共享同一个 in-flight 任务，避免重复打满接口
let fundFlowInflight = null;
let intradayRotation = 0;

async function updateEtfFundFlows(options = {}) {
  const { force = false } = options;
  if (!force && !isTradingTime()) return tradingTimeSkipResult();
  if (fundFlowInflight) return fundFlowInflight;
  fundFlowInflight = doUpdateEtfFundFlows(options).finally(() => { fundFlowInflight = null; });
  return fundFlowInflight;
}

async function doUpdateEtfFundFlows(options = {}) {
  // intradaySlices>1 时日内逐 ETF 数据按分片轮换更新，把请求量摊到多次调度里
  const { intraday = true, intradaySlices = 1 } = options;
  const started = Date.now();
  const provider = 'eastmoney_etf';
  const db = await getFundFlowDb();
  try {
    const previous = new Map(latestSnapshotRows(db).map(r => [r.market_code, r]));
    const snapshot = await fetchEastmoneyEtfSnapshot();
    const rows = snapshot.rows;
    const changedCount = rows.filter(r => fundFlowChanged(previous.get(r.marketCode), r)).length;
    const stmt = db.prepare(`
      INSERT INTO etf_fund_flow_snapshots
        (provider, market_code, code, name, sector, captured_at, trade_date, price, change_pct, amount,
         main_net, main_ratio, super_large_net, large_net, mid_net, small_net, flow_3d, flow_5d, flow_10d)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider, market_code, captured_at) DO UPDATE SET
        price = excluded.price,
        change_pct = excluded.change_pct,
        amount = excluded.amount,
        main_net = excluded.main_net,
        main_ratio = excluded.main_ratio,
        super_large_net = excluded.super_large_net,
        large_net = excluded.large_net,
        mid_net = excluded.mid_net,
        small_net = excluded.small_net,
        flow_3d = excluded.flow_3d,
        flow_5d = excluded.flow_5d,
        flow_10d = excluded.flow_10d
    `);
    db.exec('BEGIN');
    try {
      for (const r of rows) {
        stmt.run(
          r.provider, r.marketCode, r.code, r.name, r.sector, r.capturedAt, r.tradeDate,
          r.price, r.changePct, r.amount, r.mainNet, r.mainRatio, r.superLargeNet,
          r.largeNet, r.midNet, r.smallNet, r.flow3d, r.flow5d, r.flow10d
        );
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    let intraday = { skipped: true, saved: 0, failed: 0 };
    if (intraday) {
      const universe = etfUniverse();
      const sliceCount = Math.max(1, Math.min(Number(intradaySlices) || 1, universe.length));
      const sliceIndex = (intradayRotation++) % sliceCount;
      const sliceCodes = sliceCount > 1
        ? universe.filter((_, i) => i % sliceCount === sliceIndex).map(e => e.marketCode)
        : null;
      intraday = await updateEtfFundFlowIntraday(300, sliceCodes).catch(e => ({ success: false, error: e.message, saved: 0 }));
      intraday.sliceCount = sliceCount;
      intraday.sliceIndex = sliceIndex;
    }
    const missing = Math.max(0, snapshot.expected - rows.length);
    const partialError = snapshot.errors.length ? `${missing} ETF failed: ${snapshot.errors[0].error}` : null;
    setProviderStatus(db, provider, {
      success: rows.length > 0,
      at: new Date().toISOString(),
      durationMs: Date.now() - started,
      rowCount: rows.length,
      error: partialError
    });
    return {
      success: true,
      saved: rows.length,
      expected: snapshot.expected,
      failed: missing,
      partial: missing > 0,
      errors: snapshot.errors.slice(0, 5),
      changed: changedCount,
      unchanged: Math.max(0, rows.length - changedCount),
      capturedAt: snapshot.capturedAt,
      tradeDate: snapshot.tradeDate,
      durationMs: Date.now() - started,
      intraday
    };
  } catch (e) {
    setProviderStatus(db, provider, { success: false, at: new Date().toISOString(), durationMs: Date.now() - started, rowCount: 0, error: e.message });
    return { success: false, error: e.message };
  }
}

async function fetchEastmoneyDailyFlow(etf, limit = 80) {
  const fields = 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63';
  const url = `https://push2his.eastmoney.com/api/qt/stock/fflow/daykline/get?lmt=${limit}&klt=101&secid=${encodeURIComponent(etf.secid)}&fields1=f1,f2,f3,f7&fields2=${fields}`;
  const data = await fetchJson(url, { headers: { Referer: 'https://quote.eastmoney.com/' } });
  return (data.data?.klines || []).map(line => {
    const f = String(line).split(',');
    return {
      provider: etf.provider,
      marketCode: etf.marketCode,
      code: etf.code,
      name: etf.name,
      sector: etf.sector,
      tradeDate: f[0],
      mainNet: numOrNull(f[1]),
      smallNet: numOrNull(f[2]),
      midNet: numOrNull(f[3]),
      largeNet: numOrNull(f[4]),
      superLargeNet: numOrNull(f[5]),
      mainRatio: numOrNull(f[6]),
      close: numOrNull(f[11]),
      changePct: numOrNull(f[12])
    };
  }).filter(r => r.tradeDate && Number.isFinite(r.mainNet));
}

async function backfillEtfFundFlows(limit = 80, marketCodes = null) {
  const started = Date.now();
  const provider = 'eastmoney_etf_daily';
  const db = await getFundFlowDb();
  let saved = 0;
  let failed = 0;
  const errors = [];
  const stmt = db.prepare(`
    INSERT INTO etf_fund_flow_daily
      (provider, market_code, code, name, sector, trade_date, main_net, small_net, mid_net, large_net,
       super_large_net, main_ratio, close, change_pct, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(provider, market_code, trade_date) DO UPDATE SET
      name = excluded.name,
      sector = excluded.sector,
      main_net = excluded.main_net,
      small_net = excluded.small_net,
      mid_net = excluded.mid_net,
      large_net = excluded.large_net,
      super_large_net = excluded.super_large_net,
      main_ratio = excluded.main_ratio,
      close = excluded.close,
      change_pct = excluded.change_pct,
      updated_at = excluded.updated_at
  `);
  const requested = Array.isArray(marketCodes) && marketCodes.length > 0 ? new Set(marketCodes) : null;
  const universe = requested ? etfUniverse().filter(etf => requested.has(etf.marketCode)) : etfUniverse();
  for (const etf of universe) {
    try {
      const rows = await fetchEastmoneyDailyFlow(etf, limit);
      db.exec('BEGIN');
      try {
        for (const r of rows) {
          stmt.run(
            r.provider, r.marketCode, r.code, r.name, r.sector, r.tradeDate, r.mainNet,
            r.smallNet, r.midNet, r.largeNet, r.superLargeNet, r.mainRatio, r.close,
            r.changePct, new Date().toISOString()
          );
          saved++;
        }
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    } catch (e) {
      failed++;
      errors.push(`${etf.marketCode}: ${e.message}`);
    }
  }
  const ok = saved > 0;
  setProviderStatus(db, provider, {
    success: ok,
    at: new Date().toISOString(),
    durationMs: Date.now() - started,
    rowCount: saved,
    error: failed > 0 ? `partial failed=${failed}: ${errors.slice(0, 3).join('; ')}` : (ok ? null : errors.slice(0, 3).join('; '))
  });
  return { success: ok, saved, failed, expected: universe.length, errors: errors.slice(0, 8), limit };
}

async function getFundFlowDailyCoverage() {
  const db = await getFundFlowDb();
  const row = db.prepare(`
    SELECT COUNT(*) AS rows,
           COUNT(DISTINCT market_code) AS etfs,
           MIN(trade_date) AS min_date,
           MAX(trade_date) AS max_date
    FROM etf_fund_flow_daily
    WHERE provider = 'eastmoney_etf'
  `).get();
  return {
    rows: Number(row?.rows || 0),
    etfs: Number(row?.etfs || 0),
    minDate: row?.min_date || null,
    maxDate: row?.max_date || null
  };
}

async function ensureInitialEtfFundFlowBackfill() {
  const coverage = await getFundFlowDailyCoverage();
  const expected = etfUniverse().length;
  if (coverage.etfs >= expected && coverage.rows >= expected * 180) {
    return { success: true, skipped: true, reason: 'daily history already initialized', coverage };
  }
  const result = await backfillEtfFundFlows(260);
  return { ...result, skipped: false, coverage };
}

async function fetchEastmoneyIntradayFlow(etf, limit = 8) {
  const fields = 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63';
  const url = `https://push2.eastmoney.com/api/qt/stock/fflow/kline/get?lmt=${limit}&klt=1&secid=${encodeURIComponent(etf.secid)}&fields1=f1,f2,f3,f7&fields2=${fields}`;
  const data = await fetchJson(url, { headers: { Referer: 'https://quote.eastmoney.com/' } });
  return (data.data?.klines || []).map(line => {
    const f = String(line).split(',');
    const minuteTime = f[0];
    return {
      provider: etf.provider,
      marketCode: etf.marketCode,
      code: etf.code,
      name: etf.name,
      sector: etf.sector,
      tradeDate: minuteTime.slice(0, 10),
      minuteTime,
      mainNet: numOrNull(f[1]),
      smallNet: numOrNull(f[2]),
      midNet: numOrNull(f[3]),
      largeNet: numOrNull(f[4]),
      superLargeNet: numOrNull(f[5])
    };
  }).filter(r => r.minuteTime && Number.isFinite(r.mainNet));
}

async function updateEtfFundFlowIntraday(limit = 300, marketCodes = null) {
  const db = await getFundFlowDb();
  let saved = 0;
  let failed = 0;
  const errors = [];
  const universe = etfUniverse();
  const targets = Array.isArray(marketCodes) && marketCodes.length
    ? universe.filter(e => marketCodes.includes(e.marketCode))
    : universe;
  const stmt = db.prepare(`
    INSERT INTO etf_fund_flow_intraday
      (provider, market_code, code, name, sector, trade_date, minute_time, main_net, small_net, mid_net,
       large_net, super_large_net, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(provider, market_code, minute_time) DO UPDATE SET
      main_net = excluded.main_net,
      small_net = excluded.small_net,
      mid_net = excluded.mid_net,
      large_net = excluded.large_net,
      super_large_net = excluded.super_large_net,
      updated_at = excluded.updated_at
  `);
  for (const etf of targets) {
    try {
      let rows = null;
      let lastError = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          rows = await fetchEastmoneyIntradayFlow(etf, limit);
          break;
        } catch (e) {
          lastError = e;
          if (attempt < 2) await sleep(250);
        }
      }
      if (!rows) throw lastError || new Error('intraday fetch failed');
      db.exec('BEGIN');
      try {
        for (const r of rows) {
          stmt.run(
            r.provider, r.marketCode, r.code, r.name, r.sector, r.tradeDate, r.minuteTime,
            r.mainNet, r.smallNet, r.midNet, r.largeNet, r.superLargeNet, new Date().toISOString()
          );
          saved++;
        }
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    } catch (e) {
      failed++;
      errors.push(`${etf.marketCode}: ${e.message}`);
    }
    await sleep(150);
  }
  return { success: saved > 0, saved, failed, errors: errors.slice(0, 5), limit };
}

function latestSnapshotRows(db) {
  return db.prepare(`
    SELECT s.*
    FROM etf_fund_flow_snapshots s
    JOIN (
      SELECT provider, market_code, MAX(captured_at) AS captured_at
      FROM etf_fund_flow_snapshots
      WHERE provider = 'eastmoney_etf'
      GROUP BY provider, market_code
    ) latest
      ON s.provider = latest.provider
     AND s.market_code = latest.market_code
     AND s.captured_at = latest.captured_at
  `).all();
}

function dailyRowsForPeriod(db, period) {
  if (period === 'month') {
    const ym = fmtYearMonth(new Date());
    return db.prepare(`
      SELECT * FROM etf_fund_flow_daily
      WHERE provider = 'eastmoney_etf' AND trade_date LIKE ?
    `).all(`${ym}-%`);
  }
  const n = period === '1y' ? 252 : period === '6m' ? 126 : period === '3m' ? 63 : period === '15d' ? 15 : period === '10d' ? 10 : period === '5d' ? 5 : period === '3d' ? 3 : 1;
  const dates = db.prepare(`
    SELECT DISTINCT trade_date FROM etf_fund_flow_daily
    WHERE provider = 'eastmoney_etf'
    ORDER BY trade_date DESC
    LIMIT ?
  `).all(n).map(r => r.trade_date);
  if (!dates.length) return [];
  const start = dates.at(-1);
  return db.prepare(`
    SELECT * FROM etf_fund_flow_daily
    WHERE provider = 'eastmoney_etf' AND trade_date >= ?
  `).all(start);
}

function aggregateFundFlowRows(rows, period, source = 'snapshot') {
  const expectedCounts = expectedSectorCounts();
  const groups = new Map();
  for (const sector of expectedCounts.keys()) groups.set(sector, []);
  for (const r of rows) {
    const sector = r.sector;
    if (!groups.has(sector)) groups.set(sector, []);
    groups.get(sector).push(r);
  }
  return Array.from(groups.entries()).map(([sector, arr]) => {
    const expectedCount = expectedCounts.get(sector) || arr.length;
    const latestByEtf = new Map();
    if (source === 'snapshot') {
      for (const r of arr) latestByEtf.set(r.market_code, r);
    }
    const etfs = source === 'snapshot' ? Array.from(latestByEtf.values()) : arr;
    const mainNet = etfs.reduce((sum, r) => sum + (Number(r.main_net) || 0), 0);
    const amount = etfs.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const ratio = amount ? (mainNet / amount) * 100 : average(etfs.map(r => numOrNull(r.main_ratio)));
    const superLargeNet = etfs.reduce((sum, r) => sum + (Number(r.super_large_net) || 0), 0);
    const largeNet = etfs.reduce((sum, r) => sum + (Number(r.large_net) || 0), 0);
    const midNet = etfs.reduce((sum, r) => sum + (Number(r.mid_net) || 0), 0);
    const smallNet = etfs.reduce((sum, r) => sum + (Number(r.small_net) || 0), 0);
    const retailNet = midNet + smallNet;
    let members;
    if (source === 'snapshot') {
      members = etfs.map(r => ({
        marketCode: r.market_code,
        code: r.code,
        name: r.name,
        mainNet: Number(r.main_net),
        mainRatio: numOrNull(r.main_ratio),
        amount: numOrNull(r.amount),
        changePct: numOrNull(r.change_pct),
        flow3d: numOrNull(r.flow_3d),
        flow5d: numOrNull(r.flow_5d),
        flow10d: numOrNull(r.flow_10d),
        capturedAt: r.captured_at
      })).sort((a, b) => b.mainNet - a.mainNet);
    } else {
      const byEtf = new Map();
      for (const r of etfs) {
        const cur = byEtf.get(r.market_code) || {
          marketCode: r.market_code,
          code: r.code,
          name: r.name,
          mainNet: 0,
          superLargeNet: 0,
          largeNet: 0,
          midNet: 0,
          smallNet: 0,
          ratios: []
        };
        cur.mainNet += Number(r.main_net) || 0;
        cur.superLargeNet += Number(r.super_large_net) || 0;
        cur.largeNet += Number(r.large_net) || 0;
        cur.midNet += Number(r.mid_net) || 0;
        cur.smallNet += Number(r.small_net) || 0;
        if (Number.isFinite(Number(r.main_ratio))) cur.ratios.push(Number(r.main_ratio));
        byEtf.set(r.market_code, cur);
      }
      members = Array.from(byEtf.values()).map(r => ({
        marketCode: r.marketCode,
        code: r.code,
        name: r.name,
        mainNet: +r.mainNet.toFixed(2),
        mainRatio: roundOrNull(average(r.ratios), 2),
        amount: null,
        changePct: null,
        superLargeNet: +r.superLargeNet.toFixed(2),
        largeNet: +r.largeNet.toFixed(2),
        midNet: +r.midNet.toFixed(2),
        smallNet: +r.smallNet.toFixed(2)
      })).sort((a, b) => b.mainNet - a.mainNet);
    }
    const latestAt = etfs.map(r => r.captured_at || r.trade_date || r.minute_time).filter(Boolean).sort().at(-1) || null;
    const hasData = etfs.length > 0;
    return {
      sector,
      period,
      source,
      expectedCount,
      etfCount: new Set(etfs.map(r => r.market_code)).size,
      missingCount: Math.max(0, expectedCount - new Set(etfs.map(r => r.market_code)).size),
      sampleWarning: expectedCount === 1,
      partial: new Set(etfs.map(r => r.market_code)).size < expectedCount,
      mainNet: hasData ? +mainNet.toFixed(2) : null,
      mainRatio: ratio == null ? null : +ratio.toFixed(2),
      amount: amount ? +amount.toFixed(2) : null,
      superLargeNet: hasData ? +superLargeNet.toFixed(2) : null,
      largeNet: hasData ? +largeNet.toFixed(2) : null,
      midNet: hasData ? +midNet.toFixed(2) : null,
      smallNet: hasData ? +smallNet.toFixed(2) : null,
      retailNet: hasData ? +retailNet.toFixed(2) : null,
      latestAt,
      etfs: members
    };
  }).sort((a, b) => {
    if (a.mainNet == null) return b.mainNet == null ? a.sector.localeCompare(b.sector, 'zh-CN') : 1;
    if (b.mainNet == null) return -1;
    return b.mainNet - a.mainNet;
  });
}

async function getFundFlows(period = 'realtime') {
  const db = await getFundFlowDb();
  const safePeriod = ['realtime', 'day', '3d', '5d', '10d', '15d', 'month', '3m', '6m', '1y'].includes(period) ? period : 'realtime';
  let rows;
  let source;
  if (['realtime', 'day', '3d', '5d', '10d'].includes(safePeriod)) {
    rows = latestSnapshotRows(db).map(r => {
      const key = safePeriod === '3d' ? 'flow_3d' : safePeriod === '5d' ? 'flow_5d' : safePeriod === '10d' ? 'flow_10d' : 'main_net';
      const isSingleDaySnapshot = safePeriod === 'realtime' || safePeriod === 'day';
      return {
        ...r,
        main_net: numOrNull(r[key]) ?? numOrNull(r.main_net),
        amount: isSingleDaySnapshot ? r.amount : null,
        main_ratio: isSingleDaySnapshot ? r.main_ratio : null
      };
    }).filter(r => Number.isFinite(Number(r.main_net)));
    source = 'snapshot';
  } else {
    rows = dailyRowsForPeriod(db, safePeriod);
    source = 'daily';
  }
  const sectors = aggregateFundFlowRows(rows, safePeriod, source);
  const status = db.prepare('SELECT * FROM fund_flow_provider_status ORDER BY provider').all();
  return {
    success: true,
    period: safePeriod,
    generatedAt: new Date().toISOString(),
    source: 'eastmoney_etf',
    stale: !rows.length,
    summary: {
      sectorCount: sectors.length,
      etfCount: new Set(rows.map(r => r.market_code)).size,
      inflowTop5: sectors.filter(s => s.mainNet > 0).slice(0, 5),
      outflowTop5: [...sectors].sort((a, b) => a.mainNet - b.mainNet).filter(s => s.mainNet < 0).slice(0, 5)
    },
    status,
    sectors
  };
}

async function getFundFlowEtfs(sector, period = 'day') {
  const data = await getFundFlows(period);
  const row = data.sectors.find(s => s.sector === sector) || data.sectors[0] || null;
  return { success: true, period: data.period, sector: row?.sector || null, etfs: row?.etfs || [], row };
}

async function getFundFlowTimeline(sector, period = 'intraday') {
  const db = await getFundFlowDb();
  const targetSector = sector || etfUniverse()[0]?.sector;
  if (period === 'intraday') {
    const dateRow = db.prepare(`
      SELECT MAX(trade_date) AS trade_date FROM etf_fund_flow_intraday
      WHERE provider = 'eastmoney_etf' AND sector = ?
    `).get(targetSector);
    const tradeDate = dateRow?.trade_date;
    const rows = tradeDate ? db.prepare(`
      SELECT minute_time AS time,
             SUM(main_net) AS main_net,
             SUM(small_net) AS small_net,
             SUM(mid_net) AS mid_net,
             SUM(large_net) AS large_net,
             SUM(super_large_net) AS super_large_net,
             COUNT(DISTINCT market_code) AS etf_count
      FROM etf_fund_flow_intraday
      WHERE provider = 'eastmoney_etf' AND sector = ? AND trade_date = ?
      GROUP BY minute_time
      ORDER BY minute_time
    `).all(targetSector, tradeDate) : [];
    return { success: true, sector: targetSector, period: 'intraday', tradeDate: tradeDate || null, rows };
  }
  const start = period === 'month' ? `${fmtYearMonth(new Date())}-01` : '0000-00-00';
  const rows = db.prepare(`
    SELECT trade_date AS time,
           SUM(main_net) AS main_net,
           SUM(small_net) AS small_net,
           SUM(mid_net) AS mid_net,
           SUM(large_net) AS large_net,
           SUM(super_large_net) AS super_large_net,
           COUNT(DISTINCT market_code) AS etf_count
    FROM etf_fund_flow_daily
    WHERE provider = 'eastmoney_etf' AND sector = ? AND trade_date >= ?
    GROUP BY trade_date
    ORDER BY trade_date
  `).all(targetSector, start);
  return { success: true, sector: targetSector, period: period === 'month' ? 'month' : 'daily', rows };
}

async function getFundFlowSourceStatus() {
  const db = await getFundFlowDb();
  return { success: true, status: db.prepare('SELECT * FROM fund_flow_provider_status ORDER BY provider').all() };
}

function hasValidOhlc(r) {
  return (
    Number.isFinite(Number(r.open)) && Number(r.open) > 0 &&
    Number.isFinite(Number(r.high)) && Number(r.high) > 0 &&
    Number.isFinite(Number(r.low)) && Number(r.low) > 0 &&
    Number.isFinite(Number(r.close)) && Number(r.close) > 0
  );
}

async function cleanInvalidRealtimeEtfs() {
  const db = await loadDb();
  const before = db.etfs.length;
  db.etfs = db.etfs.filter(r => !(String(r.source || '').includes('realtime') && !hasValidOhlc(r)));
  const removed = before - db.etfs.length;
  if (removed > 0) await saveDb();
  return { success: true, removed };
}

function upsert(arr, rec, keys) {
  const idx = arr.findIndex(x => keys.every(k => x[k] === rec[k]));
  if (idx >= 0) arr[idx] = { ...arr[idx], ...rec };
  else arr.push(rec);
}

function clamp(v, min = 0, max = 100) {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function average(values) {
  const arr = values.filter(Number.isFinite);
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}

function sma(values, period) {
  return values.map((_, i) => {
    if (i + 1 < period) return null;
    const slice = values.slice(i + 1 - period, i + 1);
    return average(slice);
  });
}

function pctChange(values, days) {
  if (values.length <= days) return null;
  const prev = values[values.length - 1 - days];
  const last = values[values.length - 1];
  return prev > 0 ? ((last - prev) / prev) * 100 : null;
}

function stddev(values) {
  const arr = values.filter(Number.isFinite);
  if (arr.length < 2) return null;
  const avg = average(arr);
  const variance = average(arr.map(v => (v - avg) ** 2));
  return Math.sqrt(variance);
}

function maxDrawdown(values) {
  let peak = -Infinity;
  let maxDd = 0;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    peak = Math.max(peak, v);
    if (peak > 0) maxDd = Math.min(maxDd, ((v - peak) / peak) * 100);
  }
  return maxDd;
}

function lastFinite(arr) {
  for (let i = arr.length - 1; i >= 0; i--) if (Number.isFinite(arr[i])) return arr[i];
  return null;
}

function roundOrNull(v, digits = 1) {
  return Number.isFinite(v) ? +v.toFixed(digits) : null;
}

function countConsecutiveAbove(values, baselines) {
  let count = 0;
  for (let i = values.length - 1; i >= 0; i--) {
    if (!Number.isFinite(values[i]) || !Number.isFinite(baselines[i]) || values[i] < baselines[i]) break;
    count++;
  }
  return count;
}

function classifyTechnicalPhase(metrics) {
  const highPosition = metrics.positionPct != null && metrics.positionPct >= 65;
  const lowPosition = metrics.positionPct != null && metrics.positionPct < 35;
  const trendIntact = metrics.aboveMA20 && metrics.aboveMA60 && metrics.ma20Slope != null && metrics.ma20Slope > 0;
  const recentPullback = (metrics.ret5 != null && metrics.ret5 < -2) || (metrics.pullback20High != null && metrics.pullback20High < -5);
  const closeStrong = metrics.closeLocation != null && metrics.closeLocation >= 55;
  const closeWeak = metrics.closeLocation != null && metrics.closeLocation < 40;
  const aboveMA20Firm = metrics.aboveMA20 && (metrics.ma20DistancePct == null || metrics.ma20DistancePct > -1);
  const stabilizationAttempt = recentPullback && aboveMA20Firm && closeStrong;
  const stabilizationConfirmed = stabilizationAttempt && trendIntact && metrics.aboveMA20Days >= 2 && (metrics.ret1 == null || metrics.ret1 >= -0.5);

  if (lowPosition && metrics.aboveMA20) {
    return { key: 'low_stabilizing', label: '低位企稳', stabilizationAttempt: true, stabilizationConfirmed: false, highPosition, recentPullback, trendIntact, closeWeak };
  }
  if (highPosition && trendIntact && recentPullback && stabilizationConfirmed) {
    return { key: 'high_pullback_confirmed', label: '高位回踩确认', stabilizationAttempt, stabilizationConfirmed, highPosition, recentPullback, trendIntact, closeWeak };
  }
  if (highPosition && trendIntact && recentPullback && stabilizationAttempt) {
    return { key: 'high_pullback_attempt', label: '高位回踩企稳迹象', stabilizationAttempt, stabilizationConfirmed, highPosition, recentPullback, trendIntact, closeWeak };
  }
  if (highPosition && trendIntact && recentPullback) {
    return { key: 'high_pullback_watch', label: closeWeak ? '高位回踩偏弱' : '高位回踩观察', stabilizationAttempt, stabilizationConfirmed, highPosition, recentPullback, trendIntact, closeWeak };
  }
  if (highPosition && trendIntact) {
    return { key: 'high_trend', label: '高位强趋势', stabilizationAttempt, stabilizationConfirmed, highPosition, recentPullback, trendIntact, closeWeak };
  }
  if (trendIntact) {
    return { key: 'trend_up', label: '趋势上行', stabilizationAttempt, stabilizationConfirmed, highPosition, recentPullback, trendIntact, closeWeak };
  }
  if (!metrics.aboveMA60) {
    return { key: 'broken_or_weak', label: '趋势待修复', stabilizationAttempt, stabilizationConfirmed, highPosition, recentPullback, trendIntact, closeWeak };
  }
  return { key: 'watch', label: '观察中', stabilizationAttempt, stabilizationConfirmed, highPosition, recentPullback, trendIntact, closeWeak };
}

function makeExplanation(metrics) {
  const parts = [];
  if (Number.isFinite(metrics.positionPct)) parts.push(`处于近250日 ${metrics.positionPct.toFixed(0)}% 分位`);
  if (metrics.aboveMA20 && metrics.ma20Slope > 0) parts.push('MA20 上行且站上 MA20');
  else if (metrics.aboveMA20) parts.push('站上 MA20');
  else parts.push('仍在 MA20 下方');
  if (Number.isFinite(metrics.ret20)) parts.push(`近20日 ${metrics.ret20 >= 0 ? '+' : ''}${metrics.ret20.toFixed(1)}%`);
  if (metrics.highRisk) parts.push('风险偏高');
  else parts.push('风险可控');
  return parts.join('，');
}

function scoreETF(records, realtime) {
  const rows = records
    .filter(r => (
      Number.isFinite(Number(r.open)) && Number(r.open) > 0 &&
      Number.isFinite(Number(r.close)) && Number(r.close) > 0 &&
      Number.isFinite(Number(r.high || r.close)) && Number(r.high || r.close) > 0 &&
      Number.isFinite(Number(r.low || r.close)) && Number(r.low || r.close) > 0
    ))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map(r => ({
      date: r.date,
      open: Number(r.open),
      high: Number(r.high || r.close),
      low: Number(r.low || r.close),
      close: Number(r.close),
      volume: Number(r.volume || 0)
    }));
  if (rows.length === 0) return null;

  const last = rows[rows.length - 1];
  const rawRealtimePrice = Number(realtime?.price);
  const rawRealtimePrevClose = Number(realtime?.realtimePrevClose);
  let realtimePrice = rawRealtimePrice;
  if (Number.isFinite(rawRealtimePrice) && rawRealtimePrice > 0 && Number.isFinite(rawRealtimePrevClose) && rawRealtimePrevClose > 0 && last.close > 0) {
    realtimePrice = rawRealtimePrice * (last.close / rawRealtimePrevClose);
  }
  const realtimeDate = today();
  const isRealtime = Number.isFinite(realtimePrice) && realtimePrice > 0 && Math.abs(realtimePrice - last.close) > 1e-8;
  if (isRealtime && realtimeDate > last.date) {
    rows.push({
      date: realtimeDate,
      open: last.close,
      high: Math.max(last.close, realtimePrice),
      low: Math.min(last.close, realtimePrice),
      close: realtimePrice,
      volume: 0,
      isRealtime: true
    });
  } else if (isRealtime) {
    last.close = realtimePrice;
    last.high = Math.max(last.high, realtimePrice);
    last.low = Math.min(last.low, realtimePrice);
    last.isRealtime = true;
  }

  const closes = rows.map(r => r.close);
  const highs = rows.map(r => r.high);
  const lows = rows.map(r => r.low);
  const volumes = rows.map(r => r.volume);
  const ma5 = sma(closes, 5);
  const ma20 = sma(closes, 20);
  const ma60 = sma(closes, 60);
  const ma120 = sma(closes, 120);
  const latestRow = rows[rows.length - 1];
  const lastClose = closes[closes.length - 1];
  const lastMA5 = lastFinite(ma5);
  const lastMA20 = lastFinite(ma20);
  const lastMA60 = lastFinite(ma60);
  const lastMA120 = lastFinite(ma120);

  const range250 = closes.slice(-250);
  const high250 = Math.max(...highs.slice(-250));
  const low250 = Math.min(...lows.slice(-250));
  const positionPct = high250 > low250 ? ((lastClose - low250) / (high250 - low250)) * 100 : null;

  const ma20Prev = ma20.length > 6 ? ma20[ma20.length - 6] : null;
  const ma60Prev = ma60.length > 6 ? ma60[ma60.length - 6] : null;
  const ma20Slope = lastMA20 && ma20Prev ? ((lastMA20 - ma20Prev) / ma20Prev) * 100 : null;
  const ma60Slope = lastMA60 && ma60Prev ? ((lastMA60 - ma60Prev) / ma60Prev) * 100 : null;
  const aboveMA20 = lastMA20 ? lastClose >= lastMA20 : false;
  const aboveMA60 = lastMA60 ? lastClose >= lastMA60 : false;
  const aboveMA120 = lastMA120 ? lastClose >= lastMA120 : false;

  const ret5 = pctChange(closes, 5);
  const ret1 = pctChange(closes, 1);
  const ret20 = pctChange(closes, 20);
  const ret60 = pctChange(closes, 60);
  const ret120 = pctChange(closes, 120);
  const ret250 = pctChange(closes, 250);
  const prev20High = highs.slice(-21, -1);
  const is20dBreakout = prev20High.length > 0 && lastClose >= Math.max(...prev20High);
  const high20 = Math.max(...highs.slice(-20));
  const pullback20High = Number.isFinite(high20) && high20 > 0 ? ((lastClose - high20) / high20) * 100 : null;
  const closeLocation = latestRow.high > latestRow.low ? ((lastClose - latestRow.low) / (latestRow.high - latestRow.low)) * 100 : 50;
  const ma20DistancePct = lastMA20 ? ((lastClose - lastMA20) / lastMA20) * 100 : null;
  const ma60DistancePct = lastMA60 ? ((lastClose - lastMA60) / lastMA60) * 100 : null;
  const aboveMA20Days = countConsecutiveAbove(closes, ma20);
  const aboveMA60Days = countConsecutiveAbove(closes, ma60);
  const avgVol20 = average(volumes.slice(-21, -1));
  const volumeRatio20 = avgVol20 && avgVol20 > 0 ? last.volume / avgVol20 : null;
  const volumeBreakout = is20dBreakout && volumeRatio20 != null && volumeRatio20 >= 1.15;

  const returns20 = [];
  for (let i = Math.max(1, closes.length - 20); i < closes.length; i++) {
    if (closes[i - 1] > 0) returns20.push(((closes[i] - closes[i - 1]) / closes[i - 1]) * 100);
  }
  const volatility20 = stddev(returns20);
  const drawdown60 = maxDrawdown(closes.slice(-60));
  const drawdown250 = maxDrawdown(range250);

  let positionScore = 50;
  if (Number.isFinite(positionPct)) {
    if (positionPct <= 35) positionScore = 90 - Math.abs(positionPct - 25) * 0.8;
    else if (positionPct <= 65) positionScore = 72 - (positionPct - 35) * 0.8;
    else positionScore = 48 - (positionPct - 65) * 0.9;
    if (lastMA20 && lastClose < lastMA20) positionScore -= 18;
    if (lastClose <= low250 * 1.03) positionScore -= 20;
  }
  positionScore = clamp(positionScore);

  let trendScore = 35;
  if (aboveMA20) trendScore += 18;
  if (aboveMA60) trendScore += 18;
  if (aboveMA120) trendScore += 12;
  if (lastMA5 && lastMA20 && lastMA5 >= lastMA20) trendScore += 10;
  if (lastMA20 && lastMA60 && lastMA20 >= lastMA60) trendScore += 10;
  if (ma20Slope && ma20Slope > 0) trendScore += 10;
  if (ma60Slope && ma60Slope > 0) trendScore += 6;
  trendScore = clamp(trendScore);

  let momentumScore = 45;
  if (ret5 != null) momentumScore += clamp(ret5 * 2, -18, 18);
  if (ret20 != null) momentumScore += clamp(ret20 * 1.2, -24, 24);
  if (ret60 != null) momentumScore += clamp(ret60 * 0.45, -15, 15);
  if (is20dBreakout) momentumScore += 12;
  if (volumeBreakout) momentumScore += 8;
  if (aboveMA20 && ret20 != null && ret20 > 0 && positionPct != null && positionPct < 55) momentumScore += 8;
  momentumScore = clamp(momentumScore);

  let riskScore = 85;
  if (volatility20 != null) riskScore -= clamp((volatility20 - 1.2) * 9, 0, 28);
  if (drawdown60 != null) riskScore -= clamp(Math.abs(drawdown60) - 8, 0, 28);
  if (lastMA60 && lastClose < lastMA60) riskScore -= 20;
  if (lastMA120 && lastClose < lastMA120) riskScore -= 12;
  riskScore = clamp(riskScore);

  const labels = [];
  const metricsForPhase = {
    positionPct,
    ret1,
    ret5,
    pullback20High,
    closeLocation,
    ma20DistancePct,
    ma60DistancePct,
    ma20Slope,
    aboveMA20,
    aboveMA60,
    aboveMA120,
    aboveMA20Days,
    aboveMA60Days
  };
  const phase = classifyTechnicalPhase(metricsForPhase);
  if (phase.label !== '观察中') labels.push(phase.label);
  if (positionPct != null && positionPct < 35 && aboveMA20 && !labels.includes('低位企稳')) labels.push('低位企稳');
  if (ma20Slope != null && ma20Slope > 0 && aboveMA20 && aboveMA60) labels.push('趋势转强');
  if (is20dBreakout || volumeBreakout) labels.push('强势突破');
  if (positionPct != null && positionPct > 80 && momentumScore >= 65 && !phase.recentPullback) labels.push('高位追涨');
  const highRisk = riskScore < 45 || (lastMA60 && lastClose < lastMA60) || (drawdown60 != null && drawdown60 < -18);
  if (highRisk) labels.push('风险偏高');
  if (labels.length === 0) labels.push('观察中');

  return {
    code: records[0].code,
    marketCode: records[0].marketCode || records[0].code,
    name: records[0].name,
    sector: records[0].sector,
    tradingDays: rows.length,
    latestDate: latestRow.date,
    latestClose: +lastClose.toFixed(4),
    isRealtime,
    scores: {
      position: +positionScore.toFixed(1),
      trend: +trendScore.toFixed(1),
      momentum: +momentumScore.toFixed(1),
      risk: +riskScore.toFixed(1)
    },
    metrics: {
      positionPct: positionPct == null ? null : +positionPct.toFixed(1),
      high250: Number.isFinite(high250) ? +high250.toFixed(4) : null,
      low250: Number.isFinite(low250) ? +low250.toFixed(4) : null,
      ma5: lastMA5 == null ? null : +lastMA5.toFixed(4),
      ma20: lastMA20 == null ? null : +lastMA20.toFixed(4),
      ma60: lastMA60 == null ? null : +lastMA60.toFixed(4),
      ma120: lastMA120 == null ? null : +lastMA120.toFixed(4),
      ma20Slope: ma20Slope == null ? null : +ma20Slope.toFixed(2),
      ma60Slope: ma60Slope == null ? null : +ma60Slope.toFixed(2),
      aboveMA20,
      aboveMA60,
      aboveMA120,
      ret1: ret1 == null ? null : +ret1.toFixed(2),
      ret5: ret5 == null ? null : +ret5.toFixed(2),
      ret20: ret20 == null ? null : +ret20.toFixed(2),
      ret60: ret60 == null ? null : +ret60.toFixed(2),
      ret120: ret120 == null ? null : +ret120.toFixed(2),
      ret250: ret250 == null ? null : +ret250.toFixed(2),
      volatility20: volatility20 == null ? null : +volatility20.toFixed(2),
      drawdown60: drawdown60 == null ? null : +drawdown60.toFixed(2),
      drawdown250: drawdown250 == null ? null : +drawdown250.toFixed(2),
      pullback20High: pullback20High == null ? null : +pullback20High.toFixed(2),
      closeLocation: closeLocation == null ? null : +closeLocation.toFixed(1),
      ma20DistancePct: ma20DistancePct == null ? null : +ma20DistancePct.toFixed(2),
      ma60DistancePct: ma60DistancePct == null ? null : +ma60DistancePct.toFixed(2),
      aboveMA20Days,
      aboveMA60Days,
      volumeRatio20: volumeRatio20 == null ? null : +volumeRatio20.toFixed(2),
      is20dBreakout,
      highRisk
    },
    phase: {
      key: phase.key,
      label: phase.label,
      highPosition: phase.highPosition,
      recentPullback: phase.recentPullback,
      trendIntact: phase.trendIntact,
      stabilizationAttempt: phase.stabilizationAttempt,
      stabilizationConfirmed: phase.stabilizationConfirmed,
      closeWeak: phase.closeWeak
    },
    labels,
    explanation: makeExplanation({ positionPct, aboveMA20, ma20Slope, ret20, highRisk }),
    kline: rows.slice(-180).map((r, i) => {
      const sourceIdx = rows.length - Math.min(rows.length, 180) + i;
      return {
      date: r.date,
      open: +r.open.toFixed(4),
      close: +r.close.toFixed(4),
      low: +r.low.toFixed(4),
      high: +r.high.toFixed(4),
      volume: r.volume,
      ma5: ma5[sourceIdx] == null ? null : +ma5[sourceIdx].toFixed(4),
      ma20: ma20[sourceIdx] == null ? null : +ma20[sourceIdx].toFixed(4),
      ma60: ma60[sourceIdx] == null ? null : +ma60[sourceIdx].toFixed(4),
      ma120: ma120[sourceIdx] == null ? null : +ma120[sourceIdx].toFixed(4),
      isRealtime: Boolean(r.isRealtime)
      };
    })
  };
}

function normalizeKLineDate(s) {
  return String(s || '').replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
}

async function fetchText(url, init = {}) {
  try {
    const resp = await fetch(url, {
      ...init,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Referer: 'https://finance.sina.com.cn/',
        ...(init.headers || {})
      }
    });
    if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
    return resp.text();
  } catch (e) {
    const host = (() => {
      try {
        return new URL(url).host;
      } catch {
        return 'upstream';
      }
    })();
    const cause = e.cause?.code || e.cause?.message || e.code || '';
    throw new Error(`${host}: ${e.message}${cause ? ` (${cause})` : ''}`);
  }
}

async function fetchJson(url, init = {}) {
  const text = await fetchText(url, init);
  return JSON.parse(text);
}

function parseTencentLines(text) {
  const out = new Map();
  for (const line of text.trim().split(';').filter(Boolean)) {
    const m = line.match(/v_([a-zA-Z0-9_.]+)="(.*)"/);
    if (!m) continue;
    out.set(m[1], m[2].split('~'));
  }
  return out;
}

function tencentKLineCode(code) {
  if (code === 'usDJI') return 'us.DJI';
  if (code === 'usIXIC') return 'us.IXIC';
  return code;
}

async function fetchTencentKLines(code, startDate, endDate, limit = 600) {
  const kCode = tencentKLineCode(code);
  const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${kCode},day,${startDate},${endDate},${limit},qfq`;
  const data = await fetchJson(url);
  const stock = data.data?.[kCode];
  const rows = stock?.qfqday || stock?.day || [];
  return rows.map(r => ({
    date: normalizeKLineDate(r[0]),
    open: Number(r[1]),
    close: Number(r[2]),
    high: Number(r[3]),
    low: Number(r[4]),
    volume: Number(r[5] || 0)
  })).filter(r => Number.isFinite(r.open) && Number.isFinite(r.close));
}

async function fetchYahooKLines(symbol, startDate, endDate) {
  const p1 = Math.floor(Date.parse(`${startDate}T00:00:00Z`) / 1000);
  const p2 = Math.floor(Date.parse(`${endDate}T00:00:00Z`) / 1000) + 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d`;
  const data = await fetchJson(url);
  const r = data.chart?.result?.[0];
  const ts = r?.timestamp || [];
  const q = r?.indicators?.quote?.[0] || {};
  return ts.map((t, i) => ({
    date: new Date(t * 1000).toISOString().slice(0, 10),
    open: q.open?.[i],
    close: q.close?.[i],
    high: q.high?.[i],
    low: q.low?.[i],
    volume: q.volume?.[i] || 0
  })).filter(r => Number.isFinite(r.open) && Number.isFinite(r.close));
}

async function getYearStartPrice(code, year) {
  if (code === 'N225') return (await fetchYahooKLines('^N225', `${year}-01-01`, `${year}-01-15`))[0]?.open || null;
  if (code === 'KS11') return (await fetchYahooKLines('^KS11', `${year}-01-01`, `${year}-01-15`))[0]?.open || null;
  return (await fetchTencentKLines(code, `${year}-01-01`, `${year}-01-15`, 20))[0]?.open || null;
}

async function fetchETFData() {
  const keys = Object.keys(ETF_CODES);
  const lines = parseTencentLines(await fetchText(`https://qt.gtimg.cn/q=${keys.join(',')}`));
  const year = new Date().getFullYear();
  const rows = [];
  for (const key of keys) {
    const f = lines.get(key);
    const currentPrice = Number(f?.[3]);
    const realtimePrevClose = Number(f?.[4]);
    const changePct = Number(f?.[32]);
    const start = await getYearStartPrice(key, year).catch(() => null);
    const ytd = start && currentPrice ? ((currentPrice - start) / start) * 100 : DEFAULT_YTD[key] || 0;
    rows.push({
      code: key.replace(/^[a-z]+/, ''),
      marketCode: key,
      displayCode: key.replace(/^[a-z]+/, ''),
      name: ETF_CODES[key],
      sector: classifySector(ETF_CODES[key]),
      daily: Number.isFinite(changePct) ? +changePct.toFixed(2) : 0,
      ytd: +ytd.toFixed(2),
      price: Number.isFinite(currentPrice) ? currentPrice : null,
      realtimePrevClose: Number.isFinite(realtimePrevClose) ? realtimePrevClose : null
    });
  }
  return rows;
}

async function fetchIndexData() {
  const keys = Object.keys(INDEX_CODES).filter(k => !INDEX_CODES[k].eastmoney);
  const lines = parseTencentLines(await fetchText(`https://qt.gtimg.cn/q=${keys.join(',')}`));
  const year = new Date().getFullYear();
  const rows = [];
  for (const key of keys) {
    const cfg = INDEX_CODES[key];
    const f = lines.get(key);
    if (!f) continue;
    const price = Number(f[3]);
    const prevClose = Number(f[4]);
    const changePct = Number(f[32]);
    let ytd = cfg.useF54 ? Number(f[54]) : NaN;
    if (!Number.isFinite(ytd) || ytd === 0 || key.startsWith('hk') || key.startsWith('sh') || key.startsWith('sz')) {
      const start = await getYearStartPrice(key, year).catch(() => null);
      ytd = start && price ? ((price - start) / start) * 100 : NaN;
    }
    if (Number.isFinite(price)) {
      rows.push({
        code: key,
        name: cfg.name,
        market: cfg.market,
        price,
        change: Number.isFinite(prevClose) ? price - prevClose : 0,
        changePct: Number.isFinite(changePct) ? +changePct.toFixed(2) : 0,
        ytd: Number.isFinite(ytd) ? +ytd.toFixed(2) : null
      });
    }
  }

  const sina = await fetchText('https://hq.sinajs.cn/list=b_NKY,b_KOSPI').catch(() => '');
  for (const line of sina.split('\n').filter(Boolean)) {
    const code = line.includes('b_NKY') ? 'N225' : line.includes('b_KOSPI') ? 'KS11' : null;
    if (!code) continue;
    const cfg = INDEX_CODES[code];
    const m = line.match(/="([^"]+)"/);
    const f = (m?.[1] || '').split(',');
    const price = Number(f[1]);
    const change = Number(f[2]);
    const changePct = Number(f[3]);
    const start = await getYearStartPrice(code, year).catch(() => null);
    const ytd = start && price ? ((price - start) / start) * 100 : null;
    if (Number.isFinite(price)) {
      rows.push({ code, name: cfg.name, market: cfg.market, price, change, changePct, ytd: ytd == null ? null : +ytd.toFixed(2) });
    }
  }
  return rows;
}

function aggregateSectors(etfs, date) {
  const groups = new Map();
  for (const e of etfs) {
    const k = e.sector;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }
  return Array.from(groups.entries()).map(([sector, arr]) => ({
    date,
    sector,
    count: arr.length,
    avgDaily: +(arr.reduce((a, b) => a + (b.daily || 0), 0) / arr.length).toFixed(2),
    avgYtd: +(arr.reduce((a, b) => a + (b.ytd || 0), 0) / arr.length).toFixed(2)
  }));
}

async function collectNow() {
  const db = await loadDb();
  const date = today();
  const [etfs, indices] = await Promise.all([fetchETFData(), fetchIndexData()]);
  for (const i of indices) {
    upsert(db.indices, { ...i, date, close: i.price, open: null, source: 'server_realtime', capturedAt: Date.now() }, ['date', 'code']);
  }
  for (const s of aggregateSectors(etfs, date)) upsert(db.sectors, s, ['date', 'sector']);
  db.cache = { aidinpan_etfs: etfs, aidinpan_indices: indices, last_update: Date.now(), source: 'tencent_api' };
  await saveDb();
  return { success: true, etfs: etfs.length, indices: indices.length };
}

async function ensureCache() {
  const db = await loadDb();
  if (!db.cache?.aidinpan_etfs?.length || !db.cache?.aidinpan_indices?.length) await collectNow();
  return (await loadDb()).cache;
}

async function fetchAndStoreETFHistory() {
  const db = await loadDb();
  const year = new Date().getFullYear();
  const start = `${year - 1}-01-01`;
  const end = fmtDate(new Date(Date.now() + 86400000));
  let saved = 0;
  for (const [marketCode, name] of Object.entries(ETF_CODES)) {
    const days = await fetchTencentKLines(marketCode, start, end, 600).catch(() => []);
    let prev = null;
    const yearStart = days.find(d => d.date.startsWith(String(year)))?.open || null;
    for (const d of days) {
      const rec = {
        date: d.date,
        code: marketCode.replace(/^[a-z]+/, ''),
        marketCode,
        displayCode: marketCode.replace(/^[a-z]+/, ''),
        name,
        sector: classifySector(name),
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.volume,
        daily: prev?.close ? +(((d.close - prev.close) / prev.close) * 100).toFixed(4) : 0,
        ytd: yearStart ? +(((d.close - yearStart) / yearStart) * 100).toFixed(4) : 0,
        priceBasis: 'qfq',
        source: 'server_tencent_kline'
      };
      upsert(db.etfs, rec, ['date', 'marketCode']);
      prev = d;
      saved++;
    }
  }
  await saveDb();
  return { success: true, saved };
}

async function fetchAndStoreRecentETFHistory(daysBack = 30) {
  const db = await loadDb();
  const start = fmtDate(new Date(Date.now() - daysBack * 86400000));
  const end = fmtDate(new Date(Date.now() + 86400000));
  let saved = 0;
  for (const [marketCode, name] of Object.entries(ETF_CODES)) {
    const days = await fetchTencentKLines(marketCode, start, end, 80).catch(() => []);
    const existing = db.etfs
      .filter(r => (r.marketCode || r.code) === marketCode && r.date < start && Number.isFinite(Number(r.close)) && Number(r.close) > 0)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    let prev = existing.at(-1) || null;
    const year = new Date().getFullYear();
    const yearStart = db.etfs
      .filter(r => (r.marketCode || r.code) === marketCode && String(r.date).startsWith(String(year)) && Number.isFinite(Number(r.open)) && Number(r.open) > 0)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))[0]?.open || days.find(d => d.date.startsWith(String(year)))?.open || null;
    for (const d of days) {
      const rec = {
        date: d.date,
        code: marketCode.replace(/^[a-z]+/, ''),
        marketCode,
        displayCode: marketCode.replace(/^[a-z]+/, ''),
        name,
        sector: classifySector(name),
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.volume,
        daily: prev?.close ? +(((d.close - Number(prev.close)) / Number(prev.close)) * 100).toFixed(4) : 0,
        ytd: yearStart ? +(((d.close - yearStart) / yearStart) * 100).toFixed(4) : 0,
        priceBasis: 'qfq',
        source: 'server_tencent_kline'
      };
      upsert(db.etfs, rec, ['date', 'marketCode']);
      prev = rec;
      saved++;
    }
  }
  await saveDb();
  return { success: true, saved, start, end };
}

async function importGlobalIndexJson() {
  const db = await loadDb();
  const raw = JSON.parse(await fs.readFile(path.join(EXT_ROOT, 'global_indices_2y.json'), 'utf8'));
  const keyToCode = new Map();
  for (const [code, cfg] of Object.entries(INDEX_CODES)) if (cfg.historyKey) keyToCode.set(cfg.historyKey, code);
  let saved = 0;
  for (const [historyKey, obj] of Object.entries(raw)) {
    const code = keyToCode.get(historyKey);
    const cfg = INDEX_CODES[code];
    if (!code || !cfg || !Array.isArray(obj.records)) continue;
    for (const r of obj.records) {
      upsert(db.indices, {
        date: r.date,
        code,
        name: cfg.name,
        market: cfg.market,
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
        price: r.close,
        source: 'global_indices_2y_json'
      }, ['date', 'code']);
      saved++;
    }
  }
  await saveDb();
  return { success: true, saved };
}

async function fetchAshareHistory() {
  const db = await loadDb();
  const year = new Date().getFullYear();
  const start = `${year - 1}-01-01`;
  const end = fmtDate(new Date(Date.now() + 86400000));
  let saved = 0;
  for (const code of ['sh000001', 'sz399001', 'sz399006', 'sh000688']) {
    const cfg = INDEX_CODES[code];
    const days = await fetchTencentKLines(code, start, end, 600).catch(() => []);
    for (const d of days) {
      upsert(db.indices, { date: d.date, code, name: cfg.name, market: cfg.market, ...d, price: d.close, source: 'server_tencent_index_kline' }, ['date', 'code']);
      saved++;
    }
  }
  await saveDb();
  return { success: true, saved };
}

async function fetchRecentAshareHistory(daysBack = 30) {
  const db = await loadDb();
  const start = fmtDate(new Date(Date.now() - daysBack * 86400000));
  const end = fmtDate(new Date(Date.now() + 86400000));
  let saved = 0;
  for (const code of ['sh000001', 'sz399001', 'sz399006', 'sh000688']) {
    const cfg = INDEX_CODES[code];
    const days = await fetchTencentKLines(code, start, end, 80).catch(() => []);
    for (const d of days) {
      upsert(db.indices, { date: d.date, code, name: cfg.name, market: cfg.market, ...d, price: d.close, source: 'server_tencent_index_kline' }, ['date', 'code']);
      saved++;
    }
  }
  await saveDb();
  return { success: true, saved, start, end };
}

async function updateDailyHistory() {
  const [etfHistory, ashareHistory, realtime] = await Promise.all([
    fetchAndStoreRecentETFHistory(45),
    fetchRecentAshareHistory(45),
    collectNow()
  ]);
  const db = await loadDb();
  db.meta.lastDailyHistoryUpdate = new Date().toISOString();
  await saveDb();
  return { success: true, etfHistory, ashareHistory, realtime };
}

function byMonth(records, ym) {
  return records.filter(r => String(r.date || '').startsWith(ym));
}

function dateRange(records, start, end) {
  return records.filter(r => r.date >= start && r.date <= end);
}

const ANALYSIS_WEIGHTS = {
  short: { momentum: 0.4, trend: 0.3, position: 0.15, risk: 0.15 },
  swing: { position: 0.3, trend: 0.3, momentum: 0.25, risk: 0.15 },
  long: { position: 0.35, trend: 0.35, risk: 0.2, momentum: 0.1 }
};

function weightedScore(scores, mode) {
  const w = ANALYSIS_WEIGHTS[mode] || ANALYSIS_WEIGHTS.swing;
  return +Object.entries(w).reduce((sum, [k, weight]) => sum + (scores[k] || 0) * weight, 0).toFixed(1);
}

function stripEtfKline(etf) {
  const { kline, ...rest } = etf;
  return rest;
}

function stripSectorKline(sector) {
  return { ...sector, etfs: sector.etfs.map(stripEtfKline) };
}

function labelRatio(arr, label) {
  const count = arr.filter(e => e.labels.includes(label)).length;
  return { count, ratio: arr.length ? count / arr.length : 0 };
}

function phaseRatio(arr, keys) {
  const keySet = new Set(keys);
  const count = arr.filter(e => keySet.has(e.phase?.key)).length;
  return { count, ratio: arr.length ? count / arr.length : 0 };
}

function buildSectorLabels(arr, scores, metrics, leader) {
  const lowStable = labelRatio(arr, '低位企稳');
  const trendUp = labelRatio(arr, '趋势转强');
  const breakout = labelRatio(arr, '强势突破');
  const highChase = labelRatio(arr, '高位追涨');
  const highRisk = labelRatio(arr, '风险偏高');
  const highPullback = phaseRatio(arr, ['high_pullback_watch', 'high_pullback_attempt', 'high_pullback_confirmed']);
  const pullbackAttempt = phaseRatio(arr, ['high_pullback_attempt', 'high_pullback_confirmed']);
  const pullbackConfirmed = phaseRatio(arr, ['high_pullback_confirmed']);
  const labels = [];

  if (pullbackConfirmed.ratio >= 0.5) labels.push('高位回踩确认');
  else if (pullbackAttempt.ratio >= 0.5) labels.push('高位回踩企稳迹象');
  else if (highPullback.ratio >= 0.5) labels.push('高位回踩');
  if (metrics.positionPct != null && metrics.positionPct < 35 && lowStable.ratio >= 0.5) labels.push('低位企稳');
  if (trendUp.ratio >= 0.5 || (scores.trend >= 70 && metrics.positionPct != null && metrics.positionPct < 80)) labels.push('趋势转强');
  if (breakout.ratio >= 0.5 || (arr.length === 1 && leader.labels.includes('强势突破'))) labels.push('强势突破');
  if ((metrics.positionPct != null && metrics.positionPct > 80 && scores.momentum >= 65) || highChase.ratio >= 0.5) labels.push('高位追涨');
  if (highRisk.ratio >= 0.5 || scores.risk < 45) labels.push('风险偏高');
  if (labels.length === 0) labels.push('观察中');

  return {
    labels,
    labelStats: {
      lowStable: { count: lowStable.count, ratio: +lowStable.ratio.toFixed(2) },
      trendUp: { count: trendUp.count, ratio: +trendUp.ratio.toFixed(2) },
      breakout: { count: breakout.count, ratio: +breakout.ratio.toFixed(2) },
      highChase: { count: highChase.count, ratio: +highChase.ratio.toFixed(2) },
      highRisk: { count: highRisk.count, ratio: +highRisk.ratio.toFixed(2) },
      highPullback: { count: highPullback.count, ratio: +highPullback.ratio.toFixed(2) },
      pullbackAttempt: { count: pullbackAttempt.count, ratio: +pullbackAttempt.ratio.toFixed(2) },
      pullbackConfirmed: { count: pullbackConfirmed.count, ratio: +pullbackConfirmed.ratio.toFixed(2) }
    }
  };
}

function makeSectorExplanation(metrics, scores, signals) {
  const parts = [];
  if (metrics.positionPct != null) parts.push(`近250日位置 ${metrics.positionPct.toFixed(0)}%`);
  if (metrics.ret5 != null) parts.push(`近5日 ${metrics.ret5 >= 0 ? '+' : ''}${metrics.ret5.toFixed(1)}%`);
  if (metrics.ret20 != null) parts.push(`近20日 ${metrics.ret20 >= 0 ? '+' : ''}${metrics.ret20.toFixed(1)}%`);
  if (metrics.pullback20High != null) parts.push(`较20日高点 ${metrics.pullback20High.toFixed(1)}%`);
  if (signals.labelStats.highPullback.ratio >= 0.5) parts.push('属于高位趋势回踩');
  if (signals.labelStats.pullbackConfirmed.ratio >= 0.5) parts.push('多数 ETF 已给出企稳确认');
  else if (signals.labelStats.pullbackAttempt.ratio >= 0.5) parts.push('多数 ETF 有企稳迹象');
  else if (signals.labelStats.highPullback.ratio >= 0.5) parts.push('暂未确认企稳');
  if (scores.risk < 45 || signals.labelStats.highRisk.ratio >= 0.5) parts.push('风险偏高');
  return parts.join('，');
}

async function getAnalysis(mode = 'swing', detailSector = null) {
  await cleanInvalidRealtimeEtfs();
  const db = await loadDb();
  const safeMode = ANALYSIS_WEIGHTS[mode] ? mode : 'swing';
  const realtimeByCode = new Map((db.cache?.aidinpan_etfs || []).map(e => [e.marketCode || e.code, e]));
  const byCode = new Map();
  for (const r of db.etfs) {
    const key = r.marketCode || r.code;
    const hasOhlc = Number.isFinite(Number(r.open)) && Number.isFinite(Number(r.close));
    const qfqLike = r.priceBasis === 'qfq' || String(r.source || '').includes('kline');
    if (!key || !hasOhlc || !qfqLike) continue;
    if (!byCode.has(key)) byCode.set(key, []);
    byCode.get(key).push(r);
  }

  const etfs = [];
  for (const [code, rows] of byCode) {
    const score = scoreETF(rows, realtimeByCode.get(code));
    if (!score) continue;
    score.opportunityScore = weightedScore(score.scores, safeMode);
    etfs.push(score);
  }

  const bySector = new Map();
  for (const e of etfs) {
    if (!bySector.has(e.sector)) bySector.set(e.sector, []);
    bySector.get(e.sector).push(e);
  }

  const sectors = Array.from(bySector.entries()).map(([sector, arr]) => {
    const leader = [...arr].sort((a, b) => b.opportunityScore - a.opportunityScore)[0];
    const scores = {
      position: +average(arr.map(e => e.scores.position)).toFixed(1),
      trend: +average(arr.map(e => e.scores.trend)).toFixed(1),
      momentum: +average(arr.map(e => e.scores.momentum)).toFixed(1),
      risk: +average(arr.map(e => e.scores.risk)).toFixed(1)
    };
    const metrics = {
      positionPct: roundOrNull(average(arr.map(e => e.metrics.positionPct)), 1),
      ret20: roundOrNull(average(arr.map(e => e.metrics.ret20)), 2),
      ret5: roundOrNull(average(arr.map(e => e.metrics.ret5)), 2),
      ret1: roundOrNull(average(arr.map(e => e.metrics.ret1)), 2),
      ret60: roundOrNull(average(arr.map(e => e.metrics.ret60)), 2),
      drawdown60: roundOrNull(average(arr.map(e => e.metrics.drawdown60)), 2),
      pullback20High: roundOrNull(average(arr.map(e => e.metrics.pullback20High)), 2),
      closeLocation: roundOrNull(average(arr.map(e => e.metrics.closeLocation)), 1),
      ma20DistancePct: roundOrNull(average(arr.map(e => e.metrics.ma20DistancePct)), 2),
      ma60DistancePct: roundOrNull(average(arr.map(e => e.metrics.ma60DistancePct)), 2)
    };
    const sectorSignals = buildSectorLabels(arr, scores, metrics, leader);
    return {
      sector,
      count: arr.length,
      sampleWarning: arr.length === 1,
      opportunityScore: +average(arr.map(e => e.opportunityScore)).toFixed(1),
      scores,
      metrics,
      labels: sectorSignals.labels,
      labelStats: sectorSignals.labelStats,
      leader: {
        code: leader.code,
        marketCode: leader.marketCode,
        name: leader.name,
        score: leader.opportunityScore
      },
      etfs: arr.sort((a, b) => b.opportunityScore - a.opportunityScore),
      explanation: makeSectorExplanation(metrics, scores, sectorSignals)
    };
  }).sort((a, b) => b.opportunityScore - a.opportunityScore);

  const allDates = db.etfs
    .filter(r => Number.isFinite(Number(r.open)) && Number.isFinite(Number(r.close)))
    .map(r => r.date)
    .sort();
  const maxTradingDays = etfs.length ? Math.max(...etfs.map(e => e.tradingDays)) : 0;
  const lowStableCount = sectors.filter(s => s.labels.includes('低位企稳')).length;
  const trendUpCount = sectors.filter(s => s.labels.includes('趋势转强')).length;
  const highRiskCount = sectors.filter(s => s.labels.includes('风险偏高')).length;

  const selectedSector = sectors.find(s => s.sector === detailSector)?.sector || sectors[0]?.sector || null;
  const responseSectors = sectors.map(s => s.sector === selectedSector ? s : stripSectorKline(s));
  const slimWatchlists = {
    worthWatching: sectors.filter(s => s.opportunityScore >= 62 && !s.labels.includes('强势突破') && !s.labels.includes('风险偏高')).slice(0, 8).map(stripSectorKline),
    alreadyStrong: sectors.filter(s => s.labels.includes('趋势转强') && s.metrics.positionPct >= 35).slice(0, 8).map(stripSectorKline),
    avoid: sectors.filter(s => s.labels.includes('风险偏高') || s.scores.risk < 45).sort((a, b) => a.scores.risk - b.scores.risk).slice(0, 8).map(stripSectorKline)
  };

  return {
    success: true,
    mode: safeMode,
    detailSector: selectedSector,
    generatedAt: new Date().toISOString(),
    history: {
      minDate: allDates[0] || null,
      maxDate: allDates.at(-1) || null,
      maxTradingDays,
      insufficient: maxTradingDays < 120,
      message: maxTradingDays < 120 ? 'ETF 历史不足 120 个交易日，请先补 ETF 历史。' : ''
    },
    summary: {
      top5: sectors.slice(0, 5).map(s => ({ sector: s.sector, score: s.opportunityScore, labels: s.labels, leader: s.leader })),
      lowStableCount,
      trendUpCount,
      highRiskCount,
      sectorCount: sectors.length,
      etfCount: etfs.length
    },
    watchlists: slimWatchlists,
    sectors: responseSectors
  };
}

async function handleMessage(msg) {
  const db = await loadDb();
  switch (msg.action) {
    case 'collectNow':
    case 'recollectDaily':
      return collectNow();
    case 'getAvailableMonths': {
      const months = new Set([...db.etfs, ...db.indices, ...db.sectors].map(r => String(r.date || '').slice(0, 7)).filter(Boolean));
      return { success: true, months: Array.from(months).sort() };
    }
    case 'getMonthETFs':
      return { success: true, etfs: byMonth(db.etfs, msg.yearMonth || '') };
    case 'getETFMonths': {
      const data = {};
      for (const ym of msg.months || []) data[ym] = byMonth(db.etfs, ym);
      return { success: true, data };
    }
    case 'getMonthlySectors':
      return { success: true, sectors: byMonth(db.sectors, msg.yearMonth || '') };
    case 'getIndexMonthly':
      return { success: true, indices: byMonth(db.indices, msg.yearMonth || '') };
    case 'getIndexRangeByMonths': {
      const data = {};
      for (const ym of msg.months || []) {
        const [y, m] = ym.split('-').map(Number);
        data[ym] = dateRange(db.indices, `${ym}-01`, `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`);
      }
      return { success: true, data };
    }
    case 'getSectorRangeByMonths': {
      const data = {};
      for (const ym of msg.months || []) data[ym] = byMonth(db.sectors, ym);
      return { success: true, data };
    }
    case 'fetchETFHistory':
      return fetchAndStoreETFHistory();
    case 'updateEtfFundFlows':
      // 手动刷新同样走分片轮换（快照全量 + 1/4 日内分片），非交易时段自动跳过外部请求
      return updateEtfFundFlows({ intradaySlices: 4, force: !!msg.force });
    case 'backfillEtfFundFlows':
      return backfillEtfFundFlows(Number(msg.limit || 80), msg.marketCodes);
    case 'updateDailyHistory':
      return updateDailyHistory();
    case 'cleanInvalidRealtimeEtfs':
      return cleanInvalidRealtimeEtfs();
    case 'fetchAshareJune':
      return fetchAshareHistory();
    case 'reimportHistory':
      return importGlobalIndexJson();
    case 'nukeAndReimport':
      dbCache = { etfs: [], indices: [], sectors: [], cache: {}, meta: {} };
      await saveDb();
      return { success: true, histResult: await importGlobalIndexJson(), ashareHistory: await fetchAshareHistory(), etfHistory: await fetchAndStoreETFHistory(), daily: await collectNow() };
    case 'dbStatus':
      return {
        success: true,
        indicesCount: db.indices.length,
        sectorsCount: db.sectors.length,
        etfsCount: db.etfs.length,
        indicesMinDate: db.indices.map(r => r.date).sort()[0] || null,
        indicesMaxDate: db.indices.map(r => r.date).sort().at(-1) || null,
        historyImported: db.meta.historyImported || null
      };
    case 'probeMonthETFs': {
      const rows = byMonth(db.etfs, msg.yearMonth || '');
      const codeFirstLast = {};
      for (const r of rows) {
        const key = r.marketCode || r.code;
        const v = codeFirstLast[key] || { name: r.name, sector: r.sector, firstDate: r.date, firstClose: r.close, lastDate: r.date, lastClose: r.close };
        if (r.date < v.firstDate) Object.assign(v, { firstDate: r.date, firstClose: r.close });
        if (r.date > v.lastDate) Object.assign(v, { lastDate: r.date, lastClose: r.close });
        codeFirstLast[key] = v;
      }
      return { success: true, totalRecords: rows.length, uniqueDates: Array.from(new Set(rows.map(r => r.date))).sort(), codeFirstLast };
    }
    default:
      return { success: false, error: `unsupported action: ${msg.action}` };
  }
}

async function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };
  const body = await fs.readFile(filePath);
  send(res, 200, body, { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': 'public, max-age=60' });
}

async function serveApp(res) {
  let html = await fs.readFile(path.join(EXT_ROOT, 'full.html'), 'utf8');
  html = html.replace('<script src="global_indices_data.js?v=1"></script>', '<script src="/adapter.js"></script>\n  <script src="global_indices_data.js?v=1"></script>');
  send(res, 200, html, { 'Content-Type': 'text/html; charset=utf-8' });
}

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname === '/' || url.pathname === '/index.html') return await serveApp(res);
    if (url.pathname === '/analysis') return await serveFile(res, path.join(SERVER_ROOT, 'public/analysis.html'));
    if (url.pathname === '/fund-flow') return await serveFile(res, path.join(SERVER_ROOT, 'public/fund-flow.html'));
    if (url.pathname === '/health') return json(res, { ok: true });
    if (url.pathname === '/adapter.js') return await serveFile(res, path.join(SERVER_ROOT, 'public/server-adapter.js'));
    if (url.pathname === '/analysis.js') return await serveFile(res, path.join(SERVER_ROOT, 'public/analysis.js'));
    if (url.pathname === '/fund-flow.js') return await serveFile(res, path.join(SERVER_ROOT, 'public/fund-flow.js'));
    if (url.pathname === '/api/cache') return json(res, await ensureCache());
    if (url.pathname === '/api/analysis') return json(res, await getAnalysis(url.searchParams.get('mode') || 'swing', url.searchParams.get('sector')));
    if (url.pathname === '/api/fund-flows') return json(res, await getFundFlows(url.searchParams.get('period') || 'realtime'));
    if (url.pathname === '/api/fund-flows/etfs') return json(res, await getFundFlowEtfs(url.searchParams.get('sector'), url.searchParams.get('period') || 'day'));
    if (url.pathname === '/api/fund-flows/timeline') return json(res, await getFundFlowTimeline(url.searchParams.get('sector'), url.searchParams.get('period') || 'intraday'));
    if (url.pathname === '/api/fund-flows/source-status') return json(res, await getFundFlowSourceStatus());
    if (url.pathname === '/api/message' && req.method === 'POST') return json(res, await handleMessage(await readBody(req)));
    if (url.pathname === '/api/proxy') {
      const target = url.searchParams.get('url');
      if (!target || !/^https?:\/\//i.test(target)) return json(res, { error: 'bad url' }, 400);
      const upstream = await fetch(target, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://finance.sina.com.cn/' } });
      const body = Buffer.from(await upstream.arrayBuffer());
      res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(body);
    }

    const rel = decodeURIComponent(url.pathname.replace(/^\/extension\//, '/').replace(/^\/+/, ''));
    const filePath = path.resolve(EXT_ROOT, rel);
    if (filePath.startsWith(EXT_ROOT)) return await serveFile(res, filePath);
    return send(res, 404, 'not found');
  } catch (e) {
    console.error('[server]', e);
    if (e.code === 'ENOENT') return send(res, 404, 'not found');
    return json(res, { success: false, error: e.message }, 500);
  }
}

http.createServer(route).listen(PORT, HOST, () => {
  console.log(`stock-analysis server listening on http://${HOST}:${PORT}`);
  const logFlowResult = tag => r => {
    if (r?.skipped) return console.log(`[scheduler] ${tag} skipped: ${r.reason}`);
    console.log(`[scheduler] ${tag} saved=${r.saved || 0} failed=${r.failed || 0} intradaySaved=${r.intraday?.saved || 0}`);
  };
  setTimeout(() => {
    updateDailyHistory().then(r => {
      console.log(`[scheduler] daily history updated etf=${r.etfHistory.saved} ashare=${r.ashareHistory.saved}`);
    }).catch(e => console.warn('[scheduler] daily history update failed:', e.message));
    if (isTradingDay()) {
      backfillEtfFundFlows(8).then(r => {
        console.log(`[scheduler] etf fund flow startup recent backfilled saved=${r.saved} failed=${r.failed}`);
      }).catch(e => console.warn('[scheduler] etf fund flow backfill failed:', e.message));
    }
    // 非交易时段 updateEtfFundFlows 内部自动跳过，不请求外部接口
    updateEtfFundFlows({ intradaySlices: 2 }).then(logFlowResult('startup fund flow'))
      .catch(e => console.warn('[scheduler] etf fund flow update failed:', e.message));
  }, 5000);
  setInterval(() => {
    updateDailyHistory().then(r => {
      console.log(`[scheduler] daily history updated etf=${r.etfHistory.saved} ashare=${r.ashareHistory.saved}`);
    }).catch(e => console.warn('[scheduler] daily history update failed:', e.message));
  }, 6 * 60 * 60 * 1000);
  // 交易时段内每 10 分钟一轮：全量快照（10 个批量请求）+ 1/4 日内分片（10 个请求），
  // 每只 ETF 的日内数据约 40 分钟轮更新一次，避免一次性打满东财接口
  setInterval(() => {
    if (!isTradingTime()) return;
    updateEtfFundFlows({ intradaySlices: 4 }).then(logFlowResult('etf fund flow'))
      .catch(e => console.warn('[scheduler] etf fund flow update failed:', e.message));
  }, 10 * 60 * 1000);
  // 日级历史回补：仅交易日执行（周末无新数据），日线接口收盘后仍可用
  setInterval(() => {
    if (!isTradingDay()) return;
    backfillEtfFundFlows(8).then(r => {
      console.log(`[scheduler] etf fund flow recent backfilled saved=${r.saved} failed=${r.failed}`);
    }).catch(e => console.warn('[scheduler] etf fund flow backfill failed:', e.message));
  }, 6 * 60 * 60 * 1000);
});
