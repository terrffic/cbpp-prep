#!/usr/bin/env node
/**
 * CBPP 题库自动化质量门禁
 * 用法：node tools/audit.js [--json reports/audit.json] [--verbose]
 * 退出码：0 = 全部 P0 校验通过；1 = 存在 P0 失败（不得发布）
 */
const fs = require('fs');
const path = require('path');

const JSDOM_PATH = process.env.JSDOM_PATH ||
  'C:/Users/thomas/.workbuddy/binaries/node/workspace/node_modules/jsdom';
const { JSDOM, VirtualConsole } = require(JSDOM_PATH);

const ROOT = process.cwd();
const PAGE = path.join(ROOT, 'CBPP备考中心.html');

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const jsonIdx = args.indexOf('--json');
const JSON_OUT = jsonIdx >= 0 ? args[jsonIdx + 1] : path.join(ROOT, 'reports', 'audit.json');

const P0 = [], P1 = [], INFO = [];
const fail = (m) => P0.push(m);
const warn = (m) => P1.push(m);
const info = (m) => { INFO.push(m); if (verbose) console.log('  · ' + m); };

/* ---------- 载入页面，取出题库 ---------- */
function load() {
  const html = fs.readFileSync(PAGE, 'utf8');
  const vc = new VirtualConsole();
  const errors = [];
  vc.on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://local.test/center.html',
    virtualConsole: vc,
    beforeParse(w) {
      w.scrollTo = () => { };
      w.confirm = () => true; w.alert = () => { };
      w.HTMLElement.prototype.scrollIntoView = function () { };
      w.matchMedia = () => ({ matches: false, addListener() { }, removeListener() { }, addEventListener() { }, removeEventListener() { } });
    }
  });
  return { w: dom.window, d: dom.window.document, errors };
}

const { w, d, errors } = load();
if (!w.__CBPP_EXAM) { console.error('FATAL: 页面未导出 __CBPP_EXAM，无法审计'); process.exit(2); }
if (errors.length) fail('页面脚本运行期错误：' + errors[0]);

const BANK = w.__CBPP_EXAM.bank;
const PLAN = w.__CBPP_EXAM.plan;
const buildPaper = w.__CBPP_EXAM.buildPaper;
const ENQ = w.__CBPP_EXAM.enq || {};
const DATA = w.__CBPP_LEARN ? w.__CBPP_LEARN.data : null;

/* ---------- 汇总题目清单（模考 + 分章练习） ---------- */
const examQs = [];
BANK.forEach((b, ci) => b.qs.forEach(q => examQs.push(Object.assign({}, q, { _domain: ci + 1, _chName: b.ch }))));

function walk(node, depth, out) {
  if (depth === 1 && node.q) node.q.forEach(q => out.push(Object.assign({}, q, { _domain: depth, _chName: node.t, _drill: true })));
  (node.c || []).forEach(k => walk(k, depth + 1, out));
}
const drillQs = [];
if (DATA) walk(DATA, 0, drillQs);

const all = examQs.concat(drillQs);
console.log('\n== 题库规模 ==');
console.log('  模考题目：' + examQs.length + '　分章练习：' + drillQs.length + '　合计：' + all.length);
console.log('  九域题量：' + BANK.map((b, i) => (i + 1) + ':' + b.qs.length).join(' '));

/* ---------- 1. 结构校验 ---------- */
console.log('\n== 结构校验 ==');
const idSeen = new Map();
let structBad = 0;
for (const q of all) {
  const tag = q.id || '(无ID)';
  const ns = q._drill ? 'drill' : 'exam';
  if (!q.id) { fail('题目缺少 ID：' + String(q.s).slice(0, 30)); structBad++; continue; }
  const key = ns + ':' + q.id;
  if (idSeen.has(key)) fail('同一题库内 ID 重复：' + q.id + '（' + ns + '）');
  else idSeen.set(key, 1);
  if (!q.s || !String(q.s).trim()) { fail(tag + ' 题干为空'); structBad++; }
  if (!Array.isArray(q.o) || q.o.length !== 4) { fail(tag + ' 选项数量不是 4（实际 ' + (q.o ? q.o.length : 0) + '）'); structBad++; continue; }
  const opts = q.o.map(x => String(x).trim());
  if (opts.some(x => !x)) fail(tag + ' 存在空选项');
  const uniq = new Set(opts.map(x => x.toLowerCase()));
  if (uniq.size !== 4) fail(tag + ' 选项存在重复：' + JSON.stringify(opts));
  if (typeof q.a !== 'number' || q.a < 0 || q.a > 3 || q.a !== Math.floor(q.a)) fail(tag + ' 答案索引非法：' + q.a);
  if (!q.e || String(q.e).length < 15) fail(tag + ' 解析缺失或过短');
  if (!q._drill) {
    const m = /^(?:ch|x|g|n)(\d+)-/.exec(q.id);
    if (m && Number(m[1]) !== q._domain) fail(tag + ' 所在知识域错误：ID 前缀为第 ' + m[1] + ' 域，实际放在第 ' + q._domain + ' 域');
  }
  if (!q.sEn) warn(tag + ' 缺少英文题干 sEn');
  if (!q.oEn) warn(tag + ' 缺少英文选项 oEn');
  else {
    if (!Array.isArray(q.oEn) || q.oEn.length !== 4) fail(tag + ' 英文选项数量与中文不一致');
    else if (new Set(q.oEn.map(x => String(x).trim().toLowerCase())).size !== 4) fail(tag + ' 英文选项存在重复');
  }
  if (!q.eEn) warn(tag + ' 缺少英文解析 eEn');
}
console.log('  题目总数 ' + all.length + '，结构异常 ' + structBad + ' 题');

/* ---------- 2. 计算题独立复算 ---------- */
console.log('\n== 计算题独立复算 ==');
const calcDetail = [];
function parseNums(s, re) { const m = String(s).match(re); return m ? m.slice(1).map(Number) : null; }
for (const q of examQs) {
  let expect = null, note = '';
  if (/^g5-dpmo/.test(q.id)) {
    const p = parseNums(q.s, /每个单元有\s*(\d+)\s*个产生缺陷的机会，抽检\s*(\d+)\s*个单元共发现\s*(\d+)\s*个缺陷/);
    if (!p) { fail(q.id + ' 题干参数无法解析'); continue; }
    const [op, u, df] = p;
    expect = Math.round(df / u / op * 1e6);
    note = `DPMO = ${df}/${u}/${op} × 1e6`;
  } else if (/^g5-pce/.test(q.id)) {
    const p = parseNums(q.s, /总周期时间为\s*(\d+)\s*小时，其中真正增值时间为\s*(\d+)\s*小时/);
    if (!p) { fail(q.id + ' 题干参数无法解析'); continue; }
    expect = Math.round(p[1] / p[0] * 1000) / 10;
    note = `PCE = ${p[1]}/${p[0]}`;
  } else if (/^g5-fpy/.test(q.id)) {
    const p = parseNums(q.s, /共处理\s*(\d+)\s*单，其中\s*(\d+)\s*单发生过返工/);
    if (!p) { fail(q.id + ' 题干参数无法解析'); continue; }
    expect = Math.round((p[0] - p[1]) / p[0] * 100);
    note = `FPY = (${p[0]}-${p[1]})/${p[0]}`;
  } else if (/^g6-dmaic/.test(q.id)) {
    const map = [
      [/SIPOC|项目章程|charter/i, 'Define'],
      [/MSA|测量系统分析|基线|measurement system|baseline/i, 'Measure'],
      [/假设检验|回归|hypothesis|regression/i, 'Analyze'],
      [/DOE|试验设计|design of experiments/i, 'Improve'],
      [/控制图|控制计划|control chart|control plan/i, 'Control'],
      [/帕累托|Pareto/i, 'Analyze']
    ];
    for (const [re, phase] of map) if (re.test(q.s) && re.test(q.sEn || '')) { expect = phase; break; }
    note = 'DMAIC 阶段';
  }
  if (expect === null) continue;
  const chosen = String(q.o[q.a]).trim();
  let ok = false;
  if (typeof expect === 'number') {
    const v = parseFloat(chosen);
    ok = !isNaN(v) && Math.abs(v - expect) < 0.05;
  } else ok = chosen === expect;
  calcDetail.push({ id: q.id, expect, chosen, ok, note });
  if (!ok) fail(q.id + ' 答案与独立复算不一致：应为 ' + expect + '，实际选项为 ' + chosen + '（' + note + '）');
}
const calcOk = calcDetail.filter(x => x.ok).length;
console.log('  复算 ' + calcDetail.length + ' 题，通过 ' + calcOk + '，失败 ' + (calcDetail.length - calcOk));

/* ---------- 3. 答案位置分布 ---------- */
console.log('\n== 答案位置分布 ==');
const dist = [0, 0, 0, 0];
examQs.forEach(q => { if (q.a >= 0 && q.a <= 3) dist[q.a]++; });
const total = examQs.length;
const pct = dist.map(x => Math.round(x / total * 100));
console.log('  A/B/C/D = ' + dist.join('/') + '（' + pct.join('/') + '%）');
dist.forEach((n, i) => {
  const share = n / total;
  if (share > 0.35) warn('答案位置偏斜：选项 ' + 'ABCD'[i] + ' 占 ' + Math.round(share * 100) + '%（>35%）');
});
if (Math.max(...pct) - Math.min(...pct) > 20) warn('答案位置分布极差 ' + (Math.max(...pct) - Math.min(...pct)) + ' 个百分点（>20）');

/* ---------- 4. 组卷校验 ---------- */
console.log('\n== 五套卷组卷校验 ==');
const papers = [];
for (let n = 1; n <= 5; n++) {
  const p = buildPaper(n);
  const ids = p.map(q => q.id);
  const byDom = {};
  p.forEach(q => { const ci = BANK.findIndex(b => b.qs.some(x => x.id === q.id)); byDom[ci + 1] = (byDom[ci + 1] || 0) + 1; });
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  papers.push({ n, count: p.length, ids, byDom });
  if (p.length !== 140) fail('第 ' + n + ' 套题量 ' + p.length + ' ≠ 140');
  if (dup.length) fail('第 ' + n + ' 套存在重复题：' + [...new Set(dup)].join(','));
  PLAN.forEach((want, i) => {
    const got = byDom[i + 1] || 0;
    if (got !== want) fail('第 ' + n + ' 套第 ' + (i + 1) + ' 域题量 ' + got + ' ≠ 蓝图 ' + want);
  });
  console.log('  第 ' + n + ' 套：' + p.length + ' 题，域分布 ' + Object.keys(byDom).sort((a, b) => a - b).map(k => byDom[k]).join('/'));
}
/* 两两重合 */
let maxOverlap = 0, sumOverlap = 0, pairs = 0;
const overlapMatrix = [];
for (let i = 0; i < papers.length; i++) for (let j = i + 1; j < papers.length; j++) {
  const a = new Set(papers[i].ids);
  const inter = papers[j].ids.filter(x => a.has(x)).length;
  overlapMatrix.push({ a: papers[i].n, b: papers[j].n, same: inter, pct: Math.round(inter / 140 * 100) });
  maxOverlap = Math.max(maxOverlap, inter); sumOverlap += inter; pairs++;
}
const uniqAll = new Set(papers.flatMap(p => p.ids)).size;
console.log('  两两重合：' + overlapMatrix.map(x => 'P' + x.a + '-P' + x.b + ' ' + x.same + '(' + x.pct + '%)').join('  '));
console.log('  五套合计独立题目：' + uniqAll + ' / 700 个答题位');
info('平均两两重合 ' + Math.round(sumOverlap / pairs) + ' 题，最高 ' + maxOverlap + ' 题');
if (maxOverlap / 140 > 0.35) warn('存在高重合卷对（最高 ' + Math.round(maxOverlap / 140 * 100) + '%），五套不能视为独立测评');
/* 分章练习与模考重合 */
const examIdSet = new Set(examQs.map(q => q.id));
const drillInBank = drillQs.filter(q => examIdSet.has(q.id)).length;
console.log('  分章练习与模考重合：' + drillInBank + ' / ' + drillQs.length);
/* 练习池设计：分章练习 = 本章精选题（36 道）+ 该知识域题库全部题目，因此重合是设计结果，不是缺陷。
   这里改为「信息」并给出实际练习题量，避免把设计当作告警。 */
const drillPoolSize = DATA.c.map((ch, i) => {
  const own = (ch.q || []).map(q => q.id);
  const bankIds = (BANK[i] && BANK[i].qs || []).map(q => q.id);
  return new Set(own.concat(bankIds)).size;
});
console.log('  分章练习池题量：' + drillPoolSize.join(' / ') + '（合计 ' + drillPoolSize.reduce((a,b)=>a+b,0) + '）');
if (drillInBank > 0) info('分章练习与模考题库重合 ' + drillInBank + ' 题：本章精选题同时收录在题库中，属设计（练习池＝该域全部题目）');

/* ---------- 5. 双语一致性 ---------- */
console.log('\n== 中英双语一致性 ==');
let enStemMissing = 0, enOptMissing = 0, enExpMissing = 0;
examQs.forEach(q => { if (!q.sEn) enStemMissing++; if (!q.oEn) enOptMissing++; if (!q.eEn) enExpMissing++; });
console.log('  模考：英文题干缺 ' + enStemMissing + '，英文选项缺 ' + enOptMissing + '，英文解析缺 ' + enExpMissing);
if (enStemMissing || enOptMissing || enExpMissing) fail('模考题仍存在英文缺失');
/* 英文选项数与答案索引是否同步（同一索引指向同一语义，只能由人工复核，这里检查长度与数字一致性） */
function normNums(s) {
  /* 先把中文数量级归一：5 万元 → 50000、1.2 亿 → 120000000，再抽取数字并去掉千分位/小数尾零 */
  const t = String(s)
    .replace(/(\d),(?=\d)/g, '$1')            /* 去掉英文千分位：50,000 → 50000 */
    .replace(/(\d+(?:\.\d+)?)\s*(万|亿)/g,
      (m, n, u) => String(parseFloat(n) * (u === '万' ? 1e4 : 1e8)));
  return (t.match(/-?\d+(?:\.\d+)?/g) || []).map(x => String(parseFloat(x)));
}
let numMismatch = 0;
examQs.forEach(q => {
  if (!q.oEn) return;
  const zh = String(q.o[q.a]), en = String(q.oEn[q.a]);
  const nzA = normNums(zh), neA = normNums(en);
  if (nzA.length && neA.length && nzA.join(',') !== neA.join(',')) {
    numMismatch++; warn(q.id + ' 正确选项的中英文数字不一致：' + zh + ' vs ' + en);
  }
});
console.log('  正确选项数字一致性：' + (examQs.length - numMismatch) + '/' + examQs.length);
/* 分章练习的英文来自 ENQ，检查覆盖率 */
if (drillQs.length) {
  const miss = drillQs.filter(q => !ENQ[q.id]);
  console.log('  分章练习英文覆盖：' + (drillQs.length - miss.length) + '/' + drillQs.length);
  if (miss.length) warn('分章练习缺英文：' + miss.map(q => q.id).join(','));
}

/* ---------- 6. 内容风险扫描 ---------- */
console.log('\n== 内容风险扫描 ==');
const RISK = [
  { re: /必考|历年高频|送分题|押题|真题重现/, why: '无依据的应试化表述' },
  { re: /完全一致|高度还原|一模一样|100%\s*相同/, why: '对真实考试的过度断言' },
  { re: /(失败率|成功率)[^。；]{0,12}\d{1,2}\s*%/, why: '未注明出处的统计数字' },
  { re: /普遍低于\s*\d+\s*%|通常只有\s*\d+\s*%/, why: '未注明出处的经验性比例' },
  { re: /（约\s*\d{1,2}\s*%）|\(about \d{1,2}\s*%\)/, why: '未注明出处的比例（括号约数写法）' },
  { re: /高达\s*\d{1,3}\s*%/, why: '未注明出处的比例' },
  { re: /(绝大多数企业|行业普遍|业内公认)/, why: '以「公认」代替依据' },
  { re: /唯一(正确|可行)的(做法|路径|方式)/, why: '绝对化单一解' },
  { re: /必须(首先|永远|一律)/, why: '绝对化规则表述' },
  { re: /(必然|一定会)(导致|造成|失败|成功)/, why: '绝对化因果' }
];
const riskHits = [];
for (const q of all) {
  const blob = [q.s, q.e, q.sEn, q.eEn].join(' ');
  for (const r of RISK) if (r.re.test(blob)) riskHits.push({ id: q.id, why: r.why, where: 'stem/explanation' });
}
const SILLY = ['纸质时代', '公告栏', '传真', '个人英雄主义', '无管理上马', '退回纸质', '临时项目群', '电话报数', '增加 50 名录入员',
  '完全等同', '没有区别', '毫无影响', '永不失效', '把日志删掉', '只有一张图', '只发邮件', '随机指派', '改回纯手工',
  '与流程无关', '与 BPM 无关', '两者互不相关', '没有连接', '不做度量', '不考核', '毫无关系'];
const sillyHits = [];
examQs.forEach(q => {
  /* 只有「短语式」的凑数项才算缺陷：长度 <12 且命中词表；
     带具体理由的长干扰项（如「两者完全等同，只是叫法不同」）是有效干扰项，不在此列 */
  const bad = q.o.filter(o => String(o).trim().length < 12 && SILLY.some(s => String(o).includes(s)));
  if (bad.length) sillyHits.push({ id: q.id, opts: bad });
});
console.log('  无依据/绝对化表述：' + riskHits.length + ' 处');

/* 选项长度线索：唯一最长选项＝正确答案的比例。四选一时随机水平 25%，
   显著高于 45% 说明考生可"挑最长的"蒙对，属效度缺陷（不阻断发布，但必须记录）。 */
let uniqMaxHit = 0, maxTotal = 0;
examQs.forEach(q => {
  const L = q.o.map(o => String(o).length), mx = Math.max(...L);
  const idx = L.map((v, i) => v === mx ? i : -1).filter(i => i >= 0);
  if (idx.length !== 1) return;
  maxTotal++;
  if (idx[0] === q.a) uniqMaxHit++;
});
const cuePct = maxTotal ? Math.round(uniqMaxHit / maxTotal * 100) : 0;
console.log('  唯一最长项＝答案：' + uniqMaxHit + '/' + maxTotal + '（' + cuePct + '%，随机水平 25%）');
if (cuePct > 45) warn('选项长度线索明显：' + cuePct + '% 的题目正确答案是最长选项（应补充等长干扰项）');
console.log('  明显凑数干扰项：' + sillyHits.length + ' 题');
riskHits.slice(0, 40).forEach(r => info('风险 ' + r.id + '：' + r.why));
sillyHits.forEach(r => info('干扰项 ' + r.id + '：' + r.opts.join(' / ')));
if (sillyHits.length) warn('存在 ' + sillyHits.length + ' 题含明显凑数干扰项，需重写');

/* 讲义/知识树正文同样受表述纪律约束：这里对 DATA 里所有节点正文做同样扫描，命中即 P0 */
if (DATA) {
  const nodeHits = [];
  (function walk(n, pathArr) {
    const nm = pathArr.concat(n.t || '');
    const body = [n.d || '', n.note || ''].join(' ');
    for (const r of RISK) if (r.re.test(body)) nodeHits.push({ path: nm.join(' / '), why: r.why });
    (n.c || []).forEach(k => walk(k, nm));
  })(DATA, []);
  console.log('  讲义正文风险表述：' + nodeHits.length + ' 处');
  nodeHits.slice(0, 30).forEach(h => info('讲义 ' + h.path + '：' + h.why));
  if (nodeHits.length) fail('讲义正文仍含 ' + nodeHits.length + ' 处无依据/绝对化表述（不得发布）');
} else {
  warn('未取到 __CBPP_LEARN.data，讲义正文扫描被跳过');
}

/* ---------- 7. 覆盖度（按官方 19 个二级领域计数） ---------- */
console.log('\n== 九域题量是否满足蓝图 ==');
const cap = BANK.map((b, i) => b.qs.length);
PLAN.forEach((need, i) => {
  if (cap[i] < need) fail('第 ' + (i + 1) + ' 域题量 ' + cap[i] + ' 小于单卷需求 ' + need + '，组卷必然重复');
});
const slack = cap.map((c, i) => c - PLAN[i]);
console.log('  各域容量 - 单卷需求 = ' + slack.join(' / '));

/* ---------- 输出 ---------- */
const report = {
  generatedAt: new Date().toISOString(),
  totals: { exam: examQs.length, drill: drillQs.length, all: all.length },
  domainCounts: cap,
  plan: PLAN,
  calc: { total: calcDetail.length, pass: calcOk, detail: calcDetail },
  answerDistribution: dist,
  papers: papers.map(p => ({ n: p.n, count: p.count, byDomain: p.byDom })),
  overlapMatrix, uniqueAcrossPapers: uniqAll,
  drillBankOverlap: drillInBank,
  p0: P0, p1: P1, info: INFO
};
fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true });
fs.writeFileSync(JSON_OUT, JSON.stringify(report, null, 2), 'utf8');

console.log('\n== 结论 ==');
console.log('  P0 失败：' + P0.length + ' 项');
P0.slice(0, 40).forEach(m => console.log('   ✗ ' + m));
if (P0.length > 40) console.log('   ... 其余 ' + (P0.length - 40) + ' 项见 JSON');
console.log('  P1 警告：' + P1.length + ' 项');
P1.slice(0, 20).forEach(m => console.log('   ! ' + m));
if (P1.length > 20) console.log('   ... 其余 ' + (P1.length - 20) + ' 项见 JSON');
console.log('  报告：' + JSON_OUT);
console.log(P0.length ? '\nGATE: FAIL（不得发布）' : '\nGATE: PASS');
process.exit(P0.length ? 1 : 0);
