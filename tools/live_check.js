#!/usr/bin/env node
/**
 * 线上冒烟：对「从 GitHub Pages 下载回来的真实字节」跑一次启动与关键数据断言。
 * 与 audit.js 的区别：audit.js 验的是本地源码；本脚本验的是线上真正发给浏览器的字节。
 * 用法：node tools/live_check.js .workbuddy/tmp/live
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require(process.env.JSDOM_PATH ||
  'C:/Users/thomas/.workbuddy/binaries/node/workspace/node_modules/jsdom');

const DIR = process.argv[2] || path.join('.workbuddy', 'tmp', 'live');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ok   ' + msg); } else { fail++; console.log('  FAIL ' + msg); } };

const page = path.join(DIR, 'CBPP备考中心.html');
const html = fs.readFileSync(page, 'utf8');
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://terrffic.github.io/cbpp-prep/CBPP%E5%A4%87%E8%80%83%E4%B8%AD%E5%BF%83.html',
  pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
  beforeParse(w) {
    w.scrollTo = () => {};
    w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  }
});
const w = dom.window, d = w.document;

console.log('== 线上字节启动 ==');
ok(!!w.__CBPP_EXAM && !!w.__CBPP_LEARN, '两个模块均已在线上字节中导出（__CBPP_EXAM / __CBPP_LEARN）');
const BANK = w.__CBPP_EXAM.bank, PLAN = w.__CBPP_EXAM.plan;
const all = BANK.flatMap(b => b.qs);
ok(BANK.length === 9, '九个知识域（' + BANK.length + '）');
ok(all.length >= 320, '题库题量（' + all.length + '）');
ok(PLAN.reduce((a, b) => a + b, 0) === 140, '单卷配额合计 140');
const doms = w.__CBPP_LEARN.data;
let nodes = 0; (function walk(n) { nodes++; (n.c || []).forEach(walk); })(doms);
ok(nodes >= 116, '知识树节点（' + nodes + '）');
ok(d.querySelectorAll('#tree .node-row').length > 80, '知识树在线上可渲染（' + d.querySelectorAll('#tree .node-row').length + ' 行）');
ok(d.querySelectorAll('#palette, .palette').length >= 1, '考试答题卡容器存在');
ok(typeof w.__centerSwitch === 'function', '入口切换函数可用');

console.log('\n== 线上入口 ==');
const idx = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
for (let i = 1; i <= 9; i++) ok(idx.includes('#drill' + i), '目录页含第 ' + i + ' 域练习入口');
for (let i = 1; i <= 5; i++) ok(idx.includes('#paper' + i), '目录页含第 ' + i + ' 套卷入口');
ok(/#exam|#wrong|#stats/.test(idx), '目录页含模考/错题/统计入口');
/* 排除「非官方及格线 / 不是官方及格线」这类免责表述后再判定：
   这些句子本身就是在否认「官方及格线」，属正确写法，不能算违规。 */
const stripDisclaimer = t => t.replace(/[（(]?\s*非官方及格线\s*[)）]?/g, '')
  .replace(/不是\s*官方及格线/g, '').replace(/并非\s*官方及格线/g, '');
const BANNED = [/官方及格线/, /官方(固定)?(通过|合格)分数/, /与(真实|真题)(考试)?(完全|高度)一致/,
  /历[年次]真题/, /高度还原/, /全部题目.{0,6}真实难度/, /达到.{0,8}即(可)?保证通过/,
  /Identical to the real/, /same as the real exam/i];
const hits = [];
for (const t of [['index', stripDisclaimer(idx)], ['page', stripDisclaimer(html)]]) {
  for (const re of BANNED) { const m = t[1].match(re); if (m) hits.push(t[0] + ':' + m[0]); }
}
ok(hits.length === 0, '线上页面无禁止性表述' + (hits.length ? '（命中 ' + hits.slice(0, 5).join(', ') + '）' : ''));
const svg = fs.readFileSync(path.join(DIR, 'CBPP考点思维导图.html'), 'utf8');
const exam = fs.readFileSync(path.join(DIR, 'CBPP模拟考试系统.html'), 'utf8');
ok(/url=CBPP备考中心\.html#study/.test(svg), '思维导图入口已收敛到统一页');
ok(/url=CBPP备考中心\.html#exam/.test(exam), '考试入口已收敛到统一页');

console.log('\n== 本轮增量：精讲改版 ==');
/* 1) 关键考核点前置：每个知识点卡片都有考点框，且是卡片内第一个元素 */
const keyboxes = [...d.querySelectorAll('#tree .keybox')];
const proses = [...d.querySelectorAll('#tree .prose')];
ok(keyboxes.length >= nodes - 1, '关键考核点蓝框（' + keyboxes.length + ' / 知识点 ' + (nodes - 1) + '）');
ok(proses.length >= nodes - 1, '展开讲解段落（' + proses.length + ' 段）');
let keyFirst = 0;
keyboxes.forEach(kb => { const card = kb.parentElement; if (card && card.firstElementChild === kb) keyFirst++; });
ok(keyboxes.length > 0 && keyFirst === keyboxes.length, '考点框为卡片首元素，已前置（' + keyFirst + '/' + keyboxes.length + '）');
ok(keyboxes.every(kb => kb.querySelectorAll('li').length > 0), '考点框无空条目');
ok(proses.every(p => p.textContent.trim().length >= 20), '展开讲解均有实质内容（≥20 字）');

/* 2) 线条细化 */
ok(/border-left:\s*1px solid #e5eaf1/.test(html), '思维导图连接线 = 1px');
ok(/\.detail-inner\s*\{[^}]*border-left:\s*2px/.test(html), '卡片左侧竖条 = 2px');

/* 3) 每章练习题量 */
const badges = [...d.querySelectorAll('#tree [data-chap]')];
ok(badges.length === 9, '九章各一个练习入口（' + badges.length + '）');
const drillNums = badges.map(b => { const m = (b.textContent || '').match(/(\d+)\s*题/); return m ? +m[1] : 0; });
ok(drillNums.every(n => n >= 30), '每章练习池 ≥30 题（' + drillNums.join(' / ') + '）');
ok(drillNums.reduce((a, b) => a + b, 0) >= 300, '练习池合计 ' + drillNums.reduce((a, b) => a + b, 0) + ' 题');

/* 4) 错题分析与靶向练习 */
const anBtn = d.getElementById('modeAnalysis');
ok(!!anBtn, '首页有「错题分析」入口');
if (anBtn) {
  /* 造几条错题元数据，验证线上字节确实能读出来并聚合 */
  const seed = {};
  [[0, 0, 3], [0, 1, 1], [3, 0, 2]].forEach(([di, qi, n], i) => {
    const q = BANK[di] && BANK[di].qs[qi];
    if (q) seed[q.id] = { n, streak: 0, last: Date.now() - 864e5 * (i + 1), first: Date.now() - 864e5 * (i + 3), mastered: false };
  });
  w.localStorage.setItem('cbpp_wrong_v1', JSON.stringify(seed));
  anBtn.click();
  const view = d.getElementById('viewAnalysis');
  const tiles = view.querySelectorAll('.an-tile');
  ok(!view.classList.contains('hidden'), '错题分析视图可打开');
  ok(tiles.length === 6, '六个指标块（' + tiles.length + '）');
  ok(/错题总数/.test(view.textContent) && /已掌握/.test(view.textContent), '指标含错题总数与已掌握');
  ok(view.querySelectorAll('.an-row').length >= 2, '按域 / 二级领域条形图有数据（' + view.querySelectorAll('.an-row').length + ' 行）');
  ok(/最需要先补的是/.test(view.textContent), '给出「最需要先补」的结论句');
  const pr = view.querySelector('#anPractice');
  ok(!!pr && !pr.disabled, '靶向练习按钮可用');
  if (pr && !pr.disabled) {
    pr.click();
    ok(d.querySelectorAll('#qCard .xopt').length >= 2, '靶向练习已开考并渲染作答选项');
    const strong = view.querySelector('#anWeak');
    ok(!!strong && /只练未掌握/.test(strong.textContent), '「只练未掌握」入口存在');
  }
}

console.log('\nRESULT(live): ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
