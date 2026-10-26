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

console.log('\nRESULT(live): ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
