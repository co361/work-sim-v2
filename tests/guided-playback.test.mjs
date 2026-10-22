import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const base=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,base),'utf8');
function reportContext(){const ctx=vm.createContext({console,Date});ctx.window=ctx;for(const f of ['try/js/ncs.js','try/js/ncs_eval.js','try/guided-core.js','try/guided-report-data.js'])vm.runInContext(read(f),ctx);return ctx;}
test('automatic or mixed demo records contain no student score/evidence and leave manual data intact',()=>{
 const c=reportContext(),R=c.GuidedDemoRules;
 const cards={demo3_material:{status:'done',guidedMaterialReceived:true},demo3_reply:{status:'done',guidedDraftUsed:true,guidedEvidenceAtSend:true,text:R.draft},demo3_call:{status:'done',choice:'verify'}};
 const original=JSON.stringify(cards),manual=c.GuidedReportData.actual(cards,{cards:[]},'2026-10-22');
 const automatic=c.GuidedReportData.actual(cards,{cards:[]},'2026-10-22',{automated:true});
 assert.equal(manual.kind,'actual-demo-actions');assert.equal(manual.result.score,100);
 assert(Object.values(manual.progress.done['1'].cards).some(x=>x.ev));
 assert.equal(automatic.kind,'automated-demo-actions');assert.equal(automatic.synthetic,false);assert.equal(automatic.officialAssessment,false);
 assert.equal(automatic.result.score,null);assert(automatic.result.parts.every(x=>x.points===null));
 assert(Object.values(automatic.progress.done['1'].cards).every(x=>x.score===null&&x.ev===''));
 assert.equal(JSON.stringify(cards),original);assert.equal(manual.result.score,100);
});
test('2.5x motion uses bounded substeps while 1x and pause integration retain existing tick behavior',()=>{
 const html=read('try-office.html'),fn=html.match(/function demoTick\(raw\)\{[^\n]+/)[0],calls=[];
 const ctx=vm.createContext({DEMO_RATE:1,simTick:dt=>calls.push(dt),Math});vm.runInContext(fn,ctx);
 ctx.demoTick(0.04);assert.equal(calls.length,1);assert.equal(calls[0],0.04);
 calls.length=0;ctx.DEMO_RATE=2.5;ctx.demoTick(0.04);assert(calls.every(dt=>dt<=0.05));assert.equal(calls.reduce((a,b)=>a+b),0.1);
 calls.length=0;ctx.demoTick(8);assert(calls.length<=3);assert(calls.every(dt=>dt<=0.05));assert.equal(calls.reduce((a,b)=>a+b),0.125);
 calls.length=0;ctx.demoTick(-1);assert.equal(calls.reduce((a,b)=>a+b),0);
 assert(html.includes('if(!FROZEN) demoTick(raw)'));
});
