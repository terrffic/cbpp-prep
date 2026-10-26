const fs=require('fs'),path=require('path');
const {JSDOM,VirtualConsole}=require(process.env.JSDOM_PATH||'C:/Users/thomas/.workbuddy/binaries/node/workspace/node_modules/jsdom');
const dom=new JSDOM(fs.readFileSync('CBPP备考中心.html','utf8'),{runScripts:'dangerously',url:'https://local.test/',virtualConsole:new VirtualConsole()});
const BANK=dom.window.__CBPP_EXAM.bank;
const [from,to]=process.argv.slice(2).map(Number);
BANK.forEach((b,i)=>{
  if(i<from||i>to) return;
  console.log('\n### DOMAIN '+(i+1)+' — '+b.name+' ('+b.qs.length+' 题)');
  b.qs.forEach(q=>{
    console.log('\n['+q.id+'] '+q.s);
    q.o.forEach((o,k)=>console.log('   '+(k===q.a?'*':' ')+String.fromCharCode(65+k)+'. '+o));
    console.log('   E: '+q.e);
  });
});
