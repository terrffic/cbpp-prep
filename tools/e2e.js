#!/usr/bin/env node
/**
 * CBPP 备考中心 端到端回归测试
 * 用法：node tools/e2e.js
 * 退出码 0 = 全部通过
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require(process.env.JSDOM_PATH ||
  'C:/Users/thomas/.workbuddy/binaries/node/workspace/node_modules/jsdom');

const ROOT = process.cwd();
const FILE = path.join(ROOT, 'CBPP备考中心.html');
const html = fs.readFileSync(FILE, 'utf8');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ok   · ' + msg); } else { fail++; console.log('  FAIL · ' + msg); } };

function load(hash, seed) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://local.test/center.html' + (hash || ''), virtualConsole: vc,
    beforeParse(w) {
      w.scrollTo = () => { }; w.confirm = () => true; w.alert = () => { };
      w.HTMLElement.prototype.scrollIntoView = function () { };
      w.matchMedia = () => ({ matches: false, addListener() { }, removeListener() { }, addEventListener() { }, removeEventListener() { } });
      if (seed) seed(w);
    }
  });
  return { dom, w: dom.window, d: dom.window.document, errors };
}
const hidden = (d, id) => d.getElementById(id).classList.contains('hidden');

console.log('\n== 1. 页面加载与题库自洽 ==');
{
  const { w, d, errors } = load();
  ok(errors.length === 0, '无脚本错误' + (errors.length ? '：' + errors[0] : ''));
  const bank = w.__CBPP_EXAM.bank;
  const total = bank.reduce((n, b) => n + b.qs.length, 0);
  ok(total >= 300, '题库题量 ' + total);
  ok(bank.length === 9, '九个知识域，实际 ' + bank.length);
  const badge = d.getElementById('bankBadge').textContent;
  ok(badge.indexOf(String(total)) >= 0, '页面题量徽章与题库一致：' + badge);
  const nodes = d.querySelectorAll('#tree .node-row').length;
  ok(nodes > 100, '知识树节点数 ' + nodes);
  const chapters = d.querySelectorAll('#tree .node-row.chapter').length;
  ok(chapters === 9, '知识树章节数 ' + chapters);
  const plan = w.__CBPP_EXAM.plan;
  ok(plan.reduce((a, b) => a + b, 0) === 140, '单卷配额合计 140');
}

console.log('\n== 2. 分章练习 ==');
{
  const { w, d, errors } = load();
  const badges = [...d.querySelectorAll('#tree .q-badge')];
  ok(badges.length === 9, '九个章节练习入口，实际 ' + badges.length);
  badges[0].dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok(d.getElementById('quizOverlay').classList.contains('show'), '练习弹窗打开');
  const opts = d.querySelectorAll('#quizModal .opt');
  ok(opts.length === 4, '渲染 4 个选项');
  opts[0].dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok(!!d.querySelector('#qExp'), '作答后出现解析');
  const lang = d.getElementById('qLang');
  if (lang) {
    lang.click();
    ok(d.querySelectorAll('#quizModal .opt').length === 4, '切换中英对照后选项仍为 4 个');
    ok(!!d.getElementById('qExp'), '切换后解析仍在（不重置作答）');
  }
  d.getElementById('qQuit').click();
  ok(!d.getElementById('quizOverlay').classList.contains('show'), '练习弹窗可关闭');
  d.getElementById('openStats').click();
  ok(d.getElementById('statsOverlay').classList.contains('show'), '统计面板打开');
  ok(/练习统计/.test(d.getElementById('statsModal').textContent), '统计面板内容已渲染');
  d.getElementById('closeStats').click();
  ok(errors.length === 0, '无脚本错误');
}

console.log('\n== 3. 全真模拟考试完整流程 ==');
{
  const { w, d, errors } = load();
  w.switchTab('exam');
  d.querySelector('.mode-card[data-p="2"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok(!d.getElementById('paperStartBar').classList.contains('hidden'), '选中试卷后出现「开始考试」');
  d.getElementById('paperStartBtn').click();
  ok(!hidden(d, 'viewExam'), '进入答题页');
  ok(/^\d{2,3}:\d{2}$/.test(d.getElementById('timer').textContent), '倒计时启动：' + d.getElementById('timer').textContent);
  ok(d.querySelectorAll('#palette .pal-cell').length === 140, '答题卡 140 格');
  for (let i = 0; i < 3; i++) {
    const opts = d.querySelectorAll('#qCard .xopt');
    ok(opts.length === 4, '第 ' + (i + 1) + ' 题渲染 4 个选项');
    opts[i].dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    if (i < 2) d.getElementById('nextBtn').click();
  }
  ok(d.querySelectorAll('#palette .pal-cell.done').length >= 3, '答题卡记录已答状态');
  d.getElementById('flagBtn').click();
  ok(d.querySelectorAll('#palette .pal-cell.flag').length >= 1, '标记复查生效');
  d.getElementById('submitBtn').click();
  ok(hidden(d, 'viewResult'), '第一次点交卷只做确认，不直接交卷');
  d.getElementById('submitBtn').click();
  ok(!hidden(d, 'viewResult'), '第二次点交卷 → 成绩单');
  ok(/成绩单/.test(d.getElementById('viewResult').textContent), '成绩单已渲染');
  ok(/训练参考线/.test(d.getElementById('viewResult').textContent), '成绩单使用「训练参考线」表述');
  const rvTxt = d.getElementById('viewResult').textContent;
  ok(!/(?<!非)官方及格线/.test(rvTxt), '成绩单未把 70% 说成官方及格线（仅允许「非官方及格线」免责说明）');
  ok(!/完全一致|高度还原|历年真题/.test(rvTxt), '成绩单无「完全一致/高度还原/历年真题」类断言');
  d.getElementById('rvBtn').click();
  ok(!hidden(d, 'viewReview'), '进入解析页');
  d.getElementById('rvBack').click();
  ok(!hidden(d, 'viewResult'), '解析页 → 返回成绩单');
  d.getElementById('centerBtn').click();
  ok(!hidden(d, 'viewHome'), '成绩单 → 返回模考列表');
  d.getElementById('modeBook').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok(!hidden(d, 'viewBook'), '打开错题本');
  ok(/考试历史/.test(d.getElementById('viewBook').textContent), '错题本含考试历史');
  d.getElementById('bkCenter').click();
  ok(!hidden(d, 'viewHome'), '错题本 → 返回模考列表');
  ok(errors.length === 0, '无脚本错误');
}

console.log('\n== 4. 深链路由 ==');
[['#domain3', 'tabMap'], ['#drill2', 'tabMap'], ['#paper3', 'tabExam'], ['#wrong', 'tabExam'], ['#stats', 'tabMap'], ['#outline', 'tabMap']].forEach(([hash, tab]) => {
  const { d } = load(hash);
  ok(!hidden(d, tab), hash + ' → ' + tab + ' 显示');
});
{
  const { d } = load('#paper3');
  ok(!hidden(d, 'viewExam'), '#paper3 直接进入答题页');
  ok(/第 3 套/.test(d.body.textContent), '#paper3 加载的是第 3 套');
}

console.log('\n== 5. 存储版本迁移 ==');
{
  const legacy = {
    wrong: { 'x1-1': 2 },
    hist: [{ title: '全真模拟卷 · 第1套', date: '2026-08-01 10:00', score: 82, right: 115, total: 140, pass: true, dur: 150 }],
    active: { ids: ['x1-1'], sel: { 'x1-1': 0 }, left: 300 }
  };
  const { w, d } = load('', (win) => win.localStorage.setItem('cbpp_exam_v1', JSON.stringify(legacy)));
  const saved = JSON.parse(w.localStorage.getItem('cbpp_exam_v1'));
  ok(saved.bankRev !== undefined, '写入题库版本号：' + saved.bankRev);
  ok(saved.hist[0].legacy === true, '旧成绩已标记 legacy');
  ok(saved.active === null, '旧版本未完成考试已作废（避免按旧选项顺序判分）');
  w.switchTab('exam');
  d.getElementById('modeBook').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok(/旧题库/.test(d.getElementById('viewBook').textContent), '错题本中显示「旧题库」标记');
}

console.log('\n== 6. 存储损坏容错 ==');
{
  const { w, d, errors } = load('', (win) => win.localStorage.setItem('cbpp_exam_v1', '{not-json'));
  ok(errors.length === 0, '损坏数据不致页面报错');
  w.switchTab('exam');
  ok(!hidden(d, 'viewHome'), '仍能进入考试首页');
  const fixed = JSON.parse(w.localStorage.getItem('cbpp_exam_v1'));
  ok(Array.isArray(fixed.hist) && typeof fixed.wrong === 'object', '损坏数据被重置为合法结构');
}

console.log('\n== 7. 答案位置与解析完整性 ==');
{
  const { w } = load();
  const all = w.__CBPP_EXAM.bank.reduce((a, b) => a.concat(b.qs), []);
  const dist = [0, 0, 0, 0];
  all.forEach(q => dist[q.a]++);
  const pct = dist.map(n => Math.round(n / all.length * 100));
  ok(Math.max(...pct) <= 35, '答案位置分布无偏斜：A/B/C/D = ' + pct.join('/') + '%');
  ok(all.every(q => q.e && q.e.length >= 15), '每题都有解析');
  ok(all.every(q => q.eEn && q.eEn.length >= 15), '每题都有英文解析');
  ok(all.every(q => q.oEn && q.oEn.length === 4), '每题 4 个英文选项');
}

console.log('\n== 8. 全文表述扫描（禁止性断言 / 复习内容完整性）==');
{
  const { w, d } = load();
  const txt = d.body.textContent;
  [['必考', '「必考」类断言'], ['送分题', '「送分题」类断言'], ['历年高频', '「历年高频」类断言'],
   ['与真实考试完全一致', '「与真实考试完全一致」类断言'], ['高度还原历年真题', '「高度还原历年真题」类断言'],
   ['官方固定及格线', '「官方固定及格线」类断言'], ['失败率约 70%', '无来源失败率数字'],
   ['普遍低于 10%', '无来源比例数字']].forEach(([kw, label]) => {
    ok(txt.indexOf(kw) < 0, '全文无' + label + (txt.indexOf(kw) < 0 ? '' : '（仍出现）'));
  });
  const pct70 = (txt.match(/70%/g) || []).length;
  const target = (txt.match(/训练参考线/g) || []).length;
  ok(target >= 5 && pct70 > 0, '70% 相关表述均以「训练参考线」限定（70% 出现 ' + pct70 + ' 次，训练参考线 ' + target + ' 次）');
  const abbr = d.querySelectorAll('#tree table tr').length;
  ok(abbr >= 57, '缩写表行数（含表头）' + abbr + ' ≥ 57');
  const nodes = d.querySelectorAll('#tree .node-row').length;
  ok(nodes >= 115, '知识树节点 ' + nodes + ' ≥ 115');
  const rows = [...d.querySelectorAll('#tree .node-row')];
  const titles = rows.map(r => (r.querySelector('.node-label').childNodes[0].textContent || '').trim());
  ok(titles.every(Boolean), '知识树节点标题均非空（' + titles.length + ' 个）');
  // 同一章内节点标题不得重复（跨章允许同名，如每章都有「★ 英文缩写速查」）
  const dup = [];
  d.querySelectorAll('#tree .node-row.chapter').forEach(chRow => {
    const chLi = chRow.parentElement;
    const seen = {};
    [...chLi.querySelectorAll('.node-row')].slice(1).forEach(r => {
      const t = (r.querySelector('.node-label').childNodes[0].textContent || '').trim();
      if (seen[t]) dup.push(t); seen[t] = 1;
    });
  });
  ok(dup.length === 0, '同一章内节点标题无重复' + (dup.length ? '：' + dup.slice(0, 3).join(' / ') : ''));
  const empty = rows.filter(r => {
    const body = r.parentElement.querySelector('.detail .detail-inner');
    return !body || body.textContent.trim().length < 20;
  }).length;
  ok(empty === 0, '全部节点都有精讲正文（空节点 ' + empty + ' 个）');
  const withEn = rows.filter(r => !!r.parentElement.querySelector('.detail .en-note')).length;
  ok(withEn >= 50, '带英文要点（EN note）的节点 ' + withEn + ' 个');
}

console.log('\nRESULT: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
