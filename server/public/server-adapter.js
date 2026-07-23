(function () {
  const nativeFetch = window.fetch.bind(window);
  const EXTERNAL_HOSTS = new Set([
    'qt.gtimg.cn',
    'web.ifzq.gtimg.cn',
    'hq.sinajs.cn',
    'query1.finance.yahoo.com',
    'query2.finance.yahoo.com',
    'push2.eastmoney.com',
    'push2his.eastmoney.com'
  ]);

  window.fetch = function patchedFetch(input, init) {
    const raw = typeof input === 'string' ? input : input && input.url;
    if (raw && /^https?:\/\//i.test(raw)) {
      try {
        const url = new URL(raw);
        if (EXTERNAL_HOSTS.has(url.hostname)) {
          return nativeFetch('/api/proxy?url=' + encodeURIComponent(raw), init);
        }
      } catch (e) {}
    }
    return nativeFetch(input, init);
  };

  async function api(path, body) {
    const res = await nativeFetch(path, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  function pick(obj, keys) {
    if (keys == null) return { ...obj };
    if (typeof keys === 'string') return { [keys]: obj[keys] };
    if (Array.isArray(keys)) {
      const out = {};
      keys.forEach(k => { out[k] = obj[k]; });
      return out;
    }
    if (typeof keys === 'object') return { ...keys, ...obj };
    return {};
  }

  window.chrome = window.chrome || {};
  window.chrome.runtime = window.chrome.runtime || {};
  window.chrome.runtime.lastError = null;
  window.chrome.runtime.getURL = (p) => '/extension/' + String(p || '').replace(/^\/+/, '');
  window.chrome.runtime.sendMessage = (message, callback) => {
    api('/api/message', message || {})
      .then(data => callback && callback(data))
      .catch(err => callback && callback({ success: false, error: err.message }));
  };

  window.chrome.storage = window.chrome.storage || {};
  window.chrome.storage.local = {
    get(keys, callback) {
      const local = JSON.parse(localStorage.getItem('stockAnalysisStorage') || '{}');
      const needMarketCache = keys == null || keys === 'aidinpan_etfs' || (Array.isArray(keys) && (keys.includes('aidinpan_etfs') || keys.includes('aidinpan_indices')));
      const done = (extra) => callback && callback(pick({ ...local, ...extra }, keys));
      if (!needMarketCache) return setTimeout(() => done({}), 0);
      api('/api/cache')
        .then(cache => done(cache))
        .catch(() => done({}));
    },
    set(values, callback) {
      const local = JSON.parse(localStorage.getItem('stockAnalysisStorage') || '{}');
      localStorage.setItem('stockAnalysisStorage', JSON.stringify({ ...local, ...(values || {}) }));
      callback && setTimeout(callback, 0);
    },
    remove(keys, callback) {
      const local = JSON.parse(localStorage.getItem('stockAnalysisStorage') || '{}');
      (Array.isArray(keys) ? keys : [keys]).forEach(k => delete local[k]);
      localStorage.setItem('stockAnalysisStorage', JSON.stringify(local));
      callback && setTimeout(callback, 0);
    },
    clear(callback) {
      localStorage.removeItem('stockAnalysisStorage');
      callback && setTimeout(callback, 0);
    }
  };
})();
