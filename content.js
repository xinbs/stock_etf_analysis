(function() {
  'use strict';

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

  function extractAidinpanData() {
    const etfs = [];
    const seen = new Set();

    // 策略1：遍历所有文本节点，找6位纯数字代码
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      const text = (el.textContent || '').trim();
      if (!/^\d{6}$/.test(text)) continue;
      if (el.children.length > 0) continue; // 只处理叶子

      const code = text;
      if (seen.has(code)) continue;

      // 向上查找行容器
      let row = null;
      let parent = el.parentElement;
      let depth = 0;
      while (parent && depth < 12) {
        const tag = parent.tagName?.toLowerCase();
        const cls = (parent.className || '').toString();
        if (tag === 'tr' || cls.match(/row|item|list-item|stock-item|etf-row/) || parent.getAttribute('role') === 'row') {
          row = parent;
          break;
        }
        parent = parent.parentElement;
        depth++;
      }
      if (!row) row = el.parentElement;

      const rowText = row.textContent || '';

      // 提取所有百分比
      const changes = rowText.match(/([+-]?\d+\.?\d*)%/g);
      if (!changes || changes.length < 2) continue;

      const daily = parseFloat(changes[0].replace('%', ''));
      const ytd = parseFloat(changes[changes.length - 1].replace('%', ''));
      if (isNaN(daily) || isNaN(ytd)) continue;

      // 提取名称
      let name = '';
      let prev = el.previousElementSibling;
      if (!prev) prev = el.parentElement?.previousElementSibling;
      if (prev) {
        const t = prev.textContent.trim();
        if (t && /[\u4e00-\u9fa5]/.test(t) && t.length < 25 && !/^\d{6,}$/.test(t)) name = t;
      }
      if (!name) {
        const allTexts = row.querySelectorAll('*');
        for (const child of allTexts) {
          if (child.children.length > 0) continue;
          const t = child.textContent.trim();
          if (t && t !== code && /[\u4e00-\u9fa5]/.test(t) && t.length >= 4 && t.length <= 20) {
            name = t;
            break;
          }
        }
      }
      if (!name) {
        const idx = rowText.indexOf(code);
        if (idx > 0) {
          const prefix = rowText.substring(0, idx);
          const match = prefix.match(/([\u4e00-\u9fa5][\u4e00-\u9fa5a-zA-Z]*ETF?)[^\u4e00-\u9fa5]*$/);
          if (match) name = match[1];
        }
      }
      if (!name) name = code;

      seen.add(code);
      etfs.push({ code, name, sector: classifySector(name), daily, ytd });
    }

    return etfs;
  }

  function save(data) {
    try {
      chrome.storage?.local?.set({
        aidinpan_etfs: data,
        last_update: Date.now(),
        source_url: location.href
      });
    } catch (e) { console.error('save failed', e); }
  }

  // 消息监听：响应 popup 的提取请求
  chrome.runtime?.onMessage?.addListener((request, sender, sendResponse) => {
    if (request.action === 'extract') {
      const data = extractAidinpanData();
      if (data.length > 0) save(data);
      sendResponse({ data, count: data.length });
      return true;
    }
    return true;
  });

  // 页面加载后自动扫描（适用于普通网页）
  let lastJson = '';
  function doScan() {
    const data = extractAidinpanData();
    const json = JSON.stringify(data);
    if (data.length > 0 && json !== lastJson) {
      lastJson = json;
      save(data);
      console.log('[ETF助手] content.js 自动扫描:', data.length, '只ETF');
    }
  }

  setTimeout(doScan, 1500);
  setTimeout(doScan, 4000);

  // MutationObserver
  let observer = null;
  let debounceTimer = null;
  function setupObserver() {
    if (observer) observer.disconnect();
    const target = document.querySelector('table, tbody, [class*="list"], [class*="table"]') || document.body;
    observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(doScan, 1000);
    });
    observer.observe(target, { childList: true, subtree: true });
  }
  setTimeout(setupObserver, 2000);

})();
