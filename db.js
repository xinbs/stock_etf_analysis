// db.js — IndexedDB 封装（ES module）
// 采集端（background.js）写入，展示端（full.js）只读

const DB_NAME = 'etf_index_history';
const DB_VERSION = 1;

const STORES = {
  indices: { keyPath: 'id', autoIncrement: true, indexes: ['date', 'code', 'market'] },
  etfs:    { keyPath: 'id', autoIncrement: true, indexes: ['date', 'code', 'sector'] },
  sectors: { keyPath: 'id', autoIncrement: true, indexes: ['date', 'sector'] },
  meta:    { keyPath: 'key' },
};

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      for (const [name, cfg] of Object.entries(STORES)) {
        if (db.objectStoreNames.contains(name)) continue;
        const store = db.createObjectStore(name, { keyPath: cfg.keyPath, autoIncrement: cfg.autoIncrement });
        for (const idx of cfg.indexes || []) {
          store.createIndex(idx, idx, { unique: false });
        }
      }
    };
  });
  return dbPromise;
}

async function transaction(storeNames, mode = 'readonly') {
  const db = await openDB();
  return db.transaction(storeNames, mode);
}

function requestToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ===== indices =====
export async function saveIndexRecord(record) {
  const tx = await transaction('indices', 'readwrite');
  const store = tx.objectStore('indices');
  const idx = store.index('date');
  const existing = await requestToPromise(idx.getAll(IDBKeyRange.only(record.date)));
  const dup = existing.find(r => r.code === record.code);
  if (dup) {
    Object.assign(dup, record, { id: dup.id });
    await requestToPromise(store.put(dup));
    return { action: 'updated', id: dup.id };
  }
  const id = await requestToPromise(store.add(record));
  return { action: 'added', id };
}

export async function getIndicesByDateRange(start, end) {
  const tx = await transaction('indices', 'readonly');
  const store = tx.objectStore('indices');
  const idx = store.index('date');
  return requestToPromise(idx.getAll(IDBKeyRange.bound(start, end)));
}

export async function getIndexByDate(date, code) {
  const tx = await transaction('indices', 'readonly');
  const store = tx.objectStore('indices');
  const idx = store.index('date');
  const all = await requestToPromise(idx.getAll(IDBKeyRange.only(date)));
  return all.find(r => r.code === code) || null;
}

export async function hasTodayIndexRecord(code) {
  const today = fmtDate(new Date());
  const r = await getIndexByDate(today, code);
  return !!r;
}

export async function hasTodayMarketRecord(market) {
  const today = fmtDate(new Date());
  const tx = await transaction('indices', 'readonly');
  const store = tx.objectStore('indices');
  const idx = store.index('date');
  const all = await requestToPromise(idx.getAll(IDBKeyRange.only(today)));
  return all.some(r => r.market === market);
}

// ===== sectors =====
export async function saveSectorRecord(record) {
  const tx = await transaction('sectors', 'readwrite');
  const store = tx.objectStore('sectors');
  const idx = store.index('date');
  const existing = await requestToPromise(idx.getAll(IDBKeyRange.only(record.date)));
  const dup = existing.find(r => r.sector === record.sector);
  if (dup) {
    Object.assign(dup, record, { id: dup.id });
    await requestToPromise(store.put(dup));
    return { action: 'updated', id: dup.id };
  }
  const id = await requestToPromise(store.add(record));
  return { action: 'added', id };
}

export async function getSectorsByDateRange(start, end) {
  const tx = await transaction('sectors', 'readonly');
  const store = tx.objectStore('sectors');
  const idx = store.index('date');
  return requestToPromise(idx.getAll(IDBKeyRange.bound(start, end)));
}

export async function getSectorsByMonth(yearMonth) {
  const start = `${yearMonth}-01`;
  // 简单取该月最后一天
  const [y, m] = yearMonth.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;
  return getSectorsByDateRange(start, end);
}

export async function getAllAvailableMonths() {
  const tx = await transaction('sectors', 'readonly');
  const store = tx.objectStore('sectors');
  const idx = store.index('date');
  const all = await requestToPromise(idx.getAllKeys());
  const months = new Set();
  for (const key of all) {
    if (typeof key === 'string' && key.length >= 7) {
      months.add(key.slice(0, 7));
    }
  }
  return Array.from(months).sort();
}

export async function hasTodaySectorRecord(sector) {
  const today = fmtDate(new Date());
  const tx = await transaction('sectors', 'readonly');
  const store = tx.objectStore('sectors');
  const idx = store.index('date');
  const all = await requestToPromise(idx.getAll(IDBKeyRange.only(today)));
  return all.some(r => r.sector === sector);
}

// ===== etfs（原始明细，可选） =====
export async function saveETFRecord(record) {
  const tx = await transaction('etfs', 'readwrite');
  const store = tx.objectStore('etfs');
  const idx = store.index('date');
  const existing = await requestToPromise(idx.getAll(IDBKeyRange.only(record.date)));
  const dup = existing.find(r => r.code === record.code);
  if (dup) {
    Object.assign(dup, record, { id: dup.id });
    await requestToPromise(store.put(dup));
    return { action: 'updated', id: dup.id };
  }
  const id = await requestToPromise(store.add(record));
  return { action: 'added', id };
}

// ===== meta =====
export async function setMeta(key, value) {
  const tx = await transaction('meta', 'readwrite');
  const store = tx.objectStore('meta');
  return requestToPromise(store.put({ key, value }));
}

export async function getMeta(key) {
  const tx = await transaction('meta', 'readonly');
  const store = tx.objectStore('meta');
  const r = await requestToPromise(store.get(key));
  return r ? r.value : undefined;
}

// ===== 批量导入 =====
// 注意：长 transaction 在 IDB 里会被自动 commit/abort（数秒后）。
// 拆成小批次，每批独立 transaction。
export async function bulkImportIndices(records, batchSize = 200) {
  let added = 0, updated = 0;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const result = await bulkImportBatch(batch);
    added += result.added;
    updated += result.updated;
  }
  return { added, updated };
}

async function bulkImportBatch(records) {
  const db = await openDB();
  const tx = db.transaction('indices', 'readwrite');
  const store = tx.objectStore('indices');
  const dateIdx = store.index('date');
  let added = 0, updated = 0;
  for (const rec of records) {
    const existing = await requestToPromise(dateIdx.getAll(IDBKeyRange.only(rec.date)));
    const dup = existing.find(r => r.code === rec.code);
    if (dup) {
      Object.assign(dup, rec, { id: dup.id });
      await requestToPromise(store.put(dup));
      updated++;
    } else {
      await requestToPromise(store.add(rec));
      added++;
    }
  }
  // 等 transaction 提交
  await new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  return { added, updated };
}

// 清掉 source = 'global_indices_2y_json' 的旧历史记录（v1 → v2 升级用）
export async function clearHistoryIndices(batchSize = 200) {
  // 先一次性取所有记录（readonly tx 不易超时）
  const db = await openDB();
  const ro = db.transaction('indices', 'readonly');
  const all = await requestToPromise(ro.objectStore('indices').getAll());
  const toDelete = all.filter(r => r.source === 'global_indices_2y_json');
  if (toDelete.length === 0) return 0;

  let cleared = 0;
  // 分批 delete，每个 batch 独立 readwrite tx
  for (let i = 0; i < toDelete.length; i += batchSize) {
    const batch = toDelete.slice(i, i + batchSize);
    const tx = db.transaction('indices', 'readwrite');
    const store = tx.objectStore('indices');
    for (const r of batch) {
      await requestToPromise(store.delete(r.id));
      cleared++;
    }
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
  return cleared;
}

// ===== 工具 =====
function fmtDate(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 兼容：在浏览器全局脚本中挂载到 self.db
if (typeof self !== 'undefined' && !('exports' in self)) {
  self.db = {
    openDB,
    saveIndexRecord,
    saveSectorRecord,
    saveETFRecord,
    getIndicesByDateRange,
    getIndexByDate,
    getSectorsByDateRange,
    getSectorsByMonth,
    getAllAvailableMonths,
    bulkImportIndices,
    hasTodayIndexRecord,
    hasTodayMarketRecord,
    hasTodaySectorRecord,
    setMeta,
    getMeta,
  };
}
