// shared.js — 全扩展共享的常量与工具函数（ES module）

export const ETF_CODES = {
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

export const DEFAULT_YTD = {
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

export const INDEX_CODES = {
  // A股（腾讯实时无 YTD 字段 → 走腾讯 K 线）
  'sh000001': { name: '上证指数', market: 'A股' },
  'sz399001': { name: '深证成指', market: 'A股' },
  'sz399006': { name: '创业板指', market: 'A股' },
  'sh000688': { name: '科创50',   market: 'A股' },
  // 港股（腾讯实时无 YTD 字段 → 走腾讯 K 线；本地 JSON 仅 K 线失败时兜底）
  'hkHSI':    { name: '恒生指数',   market: '港股', historyKey: '恒生指数' },
  'hkHSTECH': { name: '恒生科技',   market: '港股' },
  // 美股：腾讯实时数据 f54 字段就是 YTD
  'usDJI':    { name: '道琼斯',     market: '美股', useF54: true, historyKey: '道琼斯' },
  'usIXIC':   { name: '纳斯达克',   market: '美股', useF54: true, historyKey: '纳斯达克' },
  'us.INX':   { name: '标普500',    market: '美股', useF54: true, historyKey: '标普500' },
  // 日韩：实时走东财 push2，失败 fallback 新浪 hq.sinajs.cn
  'N225':     { name: '日经225',    market: '日韩', eastmoney: '100.N225', sina: 'b_NKY', historyKey: '日经225' },
  'KS11':     { name: '韩国KOSPI',  market: '日韩', eastmoney: '100.KS11', sina: 'b_KOSPI', historyKey: '韩国KOSPI' },
};

export function classifySector(name) {
  const n = name;
  if (n.includes('新能源车')) return '新能源/汽车';
  if (n.includes('光伏')) return '新能源/光伏';
  if (n.includes('新能源')) return '新能源';
  if (n.includes('创新药')) return '医药/创新药';
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

// 日期工具
export function fmtDate(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fmtYearMonth(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
