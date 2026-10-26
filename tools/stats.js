#!/usr/bin/env node
/** 生成交付报告所需的结构化统计：node tools/stats.js → reports/stats.json */
const fs=require('fs'),path=require('path');
const {JSDOM,VirtualConsole}=require(process.env.JSDOM_PATH||'C:/Users/thomas/.workbuddy/binaries/node/workspace/node_modules/jsdom');
const dom=new JSDOM(fs.readFileSync('CBPP备考中心.html','utf8'),{runScripts:'dangerously',url:'https://local.test/',virtualConsole:new VirtualConsole(),
  beforeParse(w){w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});}});
const {bank:BANK,plan:PLAN,buildPaper}=dom.window.__CBPP_EXAM;
const all=BANK.flatMap(b=>b.qs);
const dist=[0,0,0,0]; all.forEach(q=>dist[q.a]++);
/* 模板题：同一段解析被多题共用 */
const byExp={}; all.forEach(q=>{const k=String(q.e||'').slice(0,60);(byExp[k]=byExp[k]||[]).push(q.id);});
const families=Object.entries(byExp).filter(([,v])=>v.length>1).sort((a,b)=>b[1].length-a[1].length);
const tmplIds=new Set(families.flatMap(([,v])=>v));
/* 弱干扰项代理指标：同一题内选项长度极差过大（≥18 字或最长/最短 ≥3 倍），
   会让考生靠「谁最长」猜答案，属干扰项质量缺陷。短选项本身不算缺陷（概念题正常）。 */
const lens=q=>q.o.map(o=>String(o).trim().length);
const weak=all.filter(q=>{const L=lens(q);const mn=Math.min(...L),mx=Math.max(...L);
  return (mx-mn>=18)||(mn>0&&mx/mn>=3);}).map(q=>q.id);
/* 卷间重合 */
const papers=[1,2,3,4,5].map(n=>buildPaper(n).map(q=>q.id));
const ov=[];
for(let a=0;a<5;a++)for(let b=a+1;b<5;b++){const s=new Set(papers[a]);const i=papers[b].filter(x=>s.has(x)).length;ov.push({pair:'P'+(a+1)+'-P'+(b+1),n:i,pct:Math.round(i/140*100)});}
const union=new Set(papers.flat()).size;
const out={
  generatedAt:new Date().toISOString(),
  totals:{exam:all.length,drill:36},
  domainCounts:BANK.map((b,i)=>({domain:i+1,items:b.qs.length,plan:PLAN[i]})),
  answerDistribution:dist.map(n=>({n,pct:Math.round(n/all.length*100)})),
  templateFamilies:families.map(([k,v])=>({head:k.slice(0,28),count:v.length,ids:v.slice(0,12)})),
  templateItems:tmplIds.size,
  weakDistractorItems:weak.length,
  papers:ov,unionAcrossPapers:union,
  drillOverlap:36
};
fs.writeFileSync(path.join('reports','stats.json'),JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,1).slice(0,2000));
