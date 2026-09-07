/* ======================================================================
   7일차 「결정」 — 아침 분기 카드 → 단서 취합표(자동) → 팀장 자료 6조각 → 결정 칸(취합표 12·계산 3·아이디어·결정) → 보고서 5칸 → 발표 → 루브릭 → 엔딩 A/B/C → 7일 역량
   ====================================================================== */
window.EP7=(function(){
  let E=null; const F={table:{},calc:{},idea:'',decision:{},dropped:'',report:{},reflection:'',key:'p3',q:{}}; let preRes={}; let result=null;
  const rename=(s)=>{ if(!E||!E.rename||typeof s!=='string') return s; let t=s; for(const [a,b] of Object.entries(E.rename)) t=t.split(a).join(b); return t; };
  const nums=(t)=>(String(t||'').match(/\d[\d,\.]*/g)||[]).filter(x=>x.replace(/[,\.]/g,'').length>0);
  function clues(){ return ((P&&P.clues&&P.clues[E.caseId])||[]).concat(S.clues.filter(k=>k.caseId===E.caseId)); }
  /* 화면에 내부 용어(카드 아이디·행동 키)를 내보내지 않는다 */
  const ACT_WORD=/(^|[^가-힣A-Za-z])(hold|reply|reply2|delegate|confirm|reject|approve|deliver|ask|report|visit|work|pick|none|timeout|verify|notify|promise|refuse|accept|dismiss|refund)(?![가-힣A-Za-z])/g;
  const humanize=(s)=>String(s==null?'':s).replace(ACT_WORD,(m,a,k)=>a+actLabel(k));
  const dayLabel=(d)=>/^\d+$/.test(String(d))?String(d)+'일차':String(d).replace(/^(\d+)\s+/,'$1일차 ');
  const srcName=(r,k)=>{ const c=k&&CARD(k.card); if(c&&c.subj) return c.subj;
    if(r.label) return rename(r.label);
    if(k&&k.note) return rename(String(k.note).split(/[·\n]/)[0].trim());
    return dayLabel(r.day)+' 업무'; };
  function rowFilled(row){ const ks=clues(); return ks.find(k=>(row.cards||[]).includes(k.card)||(k.label&&row.day===k.label)||(k.card==='evening'&&/저녁/.test(row.day))); }
  function missingRows(){ return E.clueRows.filter(r=>!rowFilled(r)); }

  function start(){ E=D.ep7; S.phase='ep7'; S.running=false; $('ep7').classList.add('open'); ['inbox','card','side','endbar'].forEach(id=>{ const e=$(id); if(e) e.style.display='none'; });
    for(const c of D.cards) S.cards[c.id]=S.cards[c.id]||{arrived:true,arrivedAt:0,status:'new'};
    const cur=P.cur; if(cur&&cur.day===7&&cur.ep7&&Q.get('fresh')!=='1'){ Object.assign(F,cur.ep7.form||{}); preRes=cur.ep7.pre||{}; toast('이어서 합니다'); }
    render(); go(D.cards.length&&!Object.keys(preRes).length?'pre':'clue'); saveProgress(); }
  function snapshot(){ return {form:JSON.parse(JSON.stringify(F)),pre:preRes}; }
  /* 칸을 채울 때마다(0.8초 뒤) 진행을 저장한다 — 탭을 옮기지 않고 새로고침해도 쓴 것이 남게 */
  let bumpTm=null; function bump(){ clearTimeout(bumpTm); bumpTm=setTimeout(()=>{ try{ saveProgress(); }catch(e){} },800); }
  const STEPS=[['pre','아침 메일'],['clue','1 단서 모음'],['frag','2 팀장 자료'],['decide','3 결정'],['report','4 보고서'],['present','5 발표']];
  function render(){ const w=$('ep7Wrap'); w.innerHTML=''; w.appendChild(h('h1',null,`${D.teamName} 7일차 「${D.title}」`)); w.appendChild(h('div','sub',`${D.date||''} · 10시 회의 전에 한 장.`));
    const bl=h('div','brief'); for(const l of (D.dialog.briefing||[])){ const d=h('div','say'); d.appendChild(h('div','who',l.who)); d.appendChild(h('div','tx '+(l.role==='동기'?'msg':''),(l.text||'').replace(/○○씨/g,(S.name||'○○')+'씨'))); bl.appendChild(d); } w.appendChild(bl);
    const tabs=h('div','steps'); for(const [k,l] of STEPS){ if(k==='pre'&&!D.cards.length) continue; const b=mkBtn(l,'stepb',()=>go(k)); b.dataset.k=k; tabs.appendChild(b); } w.appendChild(tabs);
    const body=h('div','stepbody'); body.id='ep7Body'; w.appendChild(body); }
  function go(k){ document.querySelectorAll('#ep7 .stepb').forEach(b=>b.classList.toggle('cur',b.dataset.k===k)); const body=$('ep7Body'); body.innerHTML=''; ({pre:renderPre,clue:renderClue,frag:renderFrag,decide:renderDecide,report:renderReport,present:renderPresent})[k](body); window.scrollTo(0,0); saveProgress(); }
  /* 0) 아침 분기 카드 */
  function renderPre(box){ box.appendChild(h('h3',null,'08:50 — 회의 전에 먼저 온 것')); box.appendChild(h('p','muted','어제의 선택이 오늘 아침을 바꿨어요. 발표 준비 시간이 그만큼 줄어요.'));
    for(const c of D.cards){ const st=S.cards[c.id]; const card=h('div','box precard'); card.appendChild(h('div','from',`${c.from}${c.role?' ('+c.role+')':''} · 소요 ${c.cost||3}분`)); card.appendChild(h('div','subj',c.subj)); card.appendChild(h('pre','body',c.body));
      if(preRes[c.id]){ const r=preRes[c.id]; card.appendChild(h('div','res',`${actLabel(r.act)} · ${r.score}점 — ${r.comment||''}`)); box.appendChild(card); continue; }
      const acts=h('div','acts'); const ta=document.createElement('textarea'); ta.placeholder='회신 내용'; ta.style.display='none'; card.appendChild(ta);
      for(const k of Object.keys(c.act||{})){ const textual=(k===c.best&&c.compose)||k==='reply'; acts.appendChild(mkBtn(textual?composerLabel(c,k):actLabel(k),k===c.best?'pri':'',async()=>{ if(textual){ if(ta.style.display==='none'){ ta.style.display='block'; ta.focus(); acts.querySelectorAll('.btn').forEach(b=>{ if(b.textContent==='보내기') b.remove(); }); acts.appendChild(mkBtn('보내기','pri',()=>submitPre(c,k,ta.value))); return; } } else submitPre(c,k,null); })); }
      card.appendChild(acts); box.appendChild(card); }
    box.appendChild(mkBtn('단서 모음으로 →','pri',()=>go('clue'))); }
  function submitPre(c,k,text){ const st=S.cards[c.id]; let score, comment, detail=null; if(text!=null){ if(text.replace(/\s/g,'').length<8){ toast('내용이 너무 짧아요.'); return; } const g=gradeText(c,text); score=g.score; comment=(c.act[k]&&c.act[k][1])||''; if(g.forbid.length){ score=Math.min(score,20); comment='금지 표현: '+g.forbid.join(', ')+'. '+comment; st.forbidHit=true; } if(k!==c.best&&c.act[k]) score=Math.min(score,c.act[k][0]); detail=g; st.text=text; }
    else { score=c.act[k][0]; comment=c.act[k][1]; }
    preRes[c.id]={act:k,score,comment,text:text||null,forbidHit:!!st.forbidHit}; st.status='done'; st.act=k; st.score=score; for(const a of (c.ncs||['3','10'])) if(S.ncs[a]) S.ncs[a].push(score); runBranch(c.id,k===c.best?'ok':k); toast(`${actLabel(k)} · ${score}점`); go('pre'); }
  /* 1) 단서 취합표 */
  function renderClue(box){ box.appendChild(h('h3',null,'단서 모음 — 6일 동안 내가 처리한 것에서 자동으로 뽑았어요')); const t=document.createElement('table'); t.className='sheet'; const hd=t.insertRow(); for(const x of ['일차','출처','단서','숫자']) hd.appendChild(h('th',null,x));
    for(const r of E.clueRows){ const k=rowFilled(r); const tr=t.insertRow(); tr.className=k?'':'gap'; tr.appendChild(h('td',null,dayLabel(r.day)));
      tr.appendChild(h('td',null,srcName(r,k))); tr.appendChild(h('td',null,k?rename(k.note):`(비었음 — ${humanize(r.empty)})`)); tr.appendChild(h('td',null,k?(k.value||r.value):'—')); }
    box.appendChild(t); const m=missingRows(); box.appendChild(h('p',m.length>=2?'bad':'muted',m.length?`빈 칸 ${m.length}개. ${E.clueNote||''}`:'빈 칸이 없어요. 6일을 잘 모았어요.'));
    box.appendChild(mkBtn('팀장 자료 보기 →','pri',()=>go('frag'))); }
  /* 2) 팀장 자료 */
  function renderFrag(box){ box.appendChild(h('h3',null,`팀장 자료 6조각 — ${rename(E.fragTitle||'')}`)); for(const f of E.fragments){ const d=document.createElement('details'); d.open=true; d.appendChild(h('summary',null,`${'①②③④⑤⑥'[f.n-1]||f.n} ${f.title}`)); d.appendChild(h('pre','body',rename(f.body))); box.appendChild(d); } box.appendChild(mkBtn('결정 칸으로 →','pri',()=>go('decide'))); }
  /* 3) 결정 칸 */
  function inputRow(label,unit,val,onch,hint){ const row=h('div','irow'); row.appendChild(h('label',null,label)); const inp=document.createElement('input'); inp.type='text'; inp.value=val||''; inp.placeholder=hint||''; inp.oninput=()=>{ onch(inp.value); bump(); }; row.appendChild(inp); if(unit) row.appendChild(h('span','unit',unit)); return row; }
  function renderDecide(box){ box.appendChild(h('h3',null,'① 취합표 12칸 — 자료 조각의 숫자를 옮겨 적고 저장하면 ✅/✗')); const g=h('div','grid2');
    for(const t of E.table){ const row=inputRow(`${'①②③④⑤⑥'[t.frag-1]||''} ${t.label}`,t.unit,F.table[t.key],v=>{ F.table[t.key]=v; },''); const mark=h('span','mark'); row.appendChild(mark); const chk=()=>{ const v=F.table[t.key]; if(!v){ mark.textContent=''; return; } mark.textContent=normNum(v)===normNum(t.answer)?'✅':'✗'; }; row.querySelector('input').addEventListener('change',chk); chk(); g.appendChild(row); }
    box.appendChild(g); box.appendChild(h('p','muted','저장(칸 밖 클릭)하면 맞았는지 표시돼요.'));
    box.appendChild(h('h3',null,'② 계산 3칸 — 답은 어디에도 인쇄돼 있지 않아요')); for(const c of E.criteria){ const row=inputRow(c.label,c.unit,F.calc[c.key],v=>{ F.calc[c.key]=v; },c.hint); const mark=h('span','mark'); row.appendChild(mark); const chk=()=>{ const v=F.calc[c.key]; mark.textContent=!v?'':normNum(v)===normNum(c.answer)?'✅':'✗'; }; row.querySelector('input').addEventListener('change',chk); chk(); box.appendChild(row); }
    box.appendChild(h('h3',null,'③ 아이디어 1장 — 취합표의 숫자 하나를 이렇게 바꾸자 (얼마에서 얼마로)')); const ta=document.createElement('textarea'); ta.value=F.idea; ta.placeholder=(E.ideaExamples&&E.ideaExamples[0])?'예: '+E.ideaExamples[0]:''; ta.oninput=()=>{ F.idea=ta.value; bump(); }; box.appendChild(ta);
    box.appendChild(h('h3',null,'④ 결정')); for(const f of E.decisionFields){ box.appendChild(inputRow(f,'',F.decision[f],v=>{ F.decision[f]=v; },'')); } const td=document.createElement('textarea'); td.value=F.dropped; td.placeholder='버린 안 1개와 이유'; td.oninput=()=>{ F.dropped=td.value; bump(); }; box.appendChild(h('label','lbl','버린 안과 이유')); box.appendChild(td);
    box.appendChild(mkBtn('보고서로 →','pri',()=>go('report'))); }
  /* 4) 보고서 */
  function renderReport(box){ box.appendChild(h('h3',null,'보고서 1장 — 5칸 (각 0/1/2점)')); for(const r of E.report){ const d=h('div','rfield'); d.appendChild(h('label','lbl',r.title)); d.appendChild(h('div','muted',r.desc)); const ta=document.createElement('textarea'); ta.value=F.report[r.key]||''; ta.placeholder='좋은 예: '+r.example.replace(/^"|"$/g,''); ta.oninput=()=>{ F.report[r.key]=ta.value; bump(); }; d.appendChild(ta); box.appendChild(d); }
    box.appendChild(h('h3',null,'회고 (참고 · 점수에는 넣지 않습니다)')); const tr=document.createElement('textarea'); tr.value=F.reflection; tr.placeholder=E.reflection; tr.oninput=()=>{ F.reflection=tr.value; bump(); }; box.appendChild(tr);
    box.appendChild(mkBtn('발표로 →','pri',()=>go('present'))); }
  /* 5) 발표 */
  function renderPresent(box){ box.appendChild(h('h3',null,'발표 — 핵심 문장 하나를 골라 읽고, 팀장 질문 3개에 답해요')); const sel=document.createElement('select'); for(const r of E.report){ const o=document.createElement('option'); o.value=r.key; o.textContent=`${r.title}: ${(F.report[r.key]||'(비어 있음)').split('\n')[0].slice(0,50)}`; sel.appendChild(o); } sel.value=F.key; sel.onchange=()=>{ F.key=sel.value; bump(); }; box.appendChild(sel);
    E.questions.forEach((q,i)=>{ const d=h('div','qbox'); d.appendChild(h('div','q',`팀장: "${q.q}"`)); q.choices.forEach((c,j)=>{ const l=document.createElement('label'); l.className='opt'; const r=document.createElement('input'); r.type='radio'; r.name='q'+i; r.checked=F.q[i]===j; r.onchange=()=>{ F.q[i]=j; bump(); }; l.appendChild(r); l.appendChild(document.createTextNode(' '+c.label)); d.appendChild(l); }); box.appendChild(d); });
    box.appendChild(mkBtn('발표 끝 — 팀장 판단 듣기','pri',()=>submit())); }
  /* 채점 */
  function gradeReport(){ const R=E.report.map(r=>r.key); const T={}; for(const k of R) T[k]=F.report[k]||''; const all=Object.values(T).join('\n')+'\n'+Object.values(F.decision).join(' ')+' '+F.dropped;
    const rub={}, fb={}; const miss=missingRows(); const calcOk=E.criteria.filter(c=>F.calc[c.key]&&normNum(F.calc[c.key])===normNum(c.answer)).length; const tableOk=E.table.filter(t=>F.table[t.key]&&normNum(F.table[t.key])===normNum(t.answer)).length;
    const cl=clues(); const clueHits=cl.filter(k=>{ const ns=nums(k.note+' '+(k.value||'')); return ns.some(n=>T.p2.includes(n)); }).length;
    const p1=T.p1; rub.p1=(nums(p1).length>=1&&/상담원|사람|폭언|배제|휴직/.test(p1)&&/반품|비용|회/.test(p1))?2:(nums(p1).length>=1||p1.length>=30)?1:0;
    const p2=T.p2; const calcIn=E.criteria.some(c=>p2.includes(String(c.answer))); rub.p2=(clueHits>=3&&nums(p2).length>=5&&calcIn)?2:(nums(p2).length>=2||clueHits>=1)?1:0; if(miss.length>=2) rub.p2=Math.min(rub.p2,1);
    const p3=T.p3; const hasWhen=/\d+월|\d+일|부터|뒤|이후|주\b/.test(p3); const hasRevert=/되돌|재검토|철회|다시 검토|원래대로|유지,|아니면/.test(p3); const hasCond=/조건|초과|이상|이면|경우|넘기면|넘으면/.test(p3); rub.p3=(p3.length>=20&&hasWhen&&hasRevert)?2:(p3.length>=10&&(hasWhen||hasCond))?1:0;
    const p4=T.p4+' '+F.dropped; const imp=['순마진|마진','여론|확산|문의','상담원|사람','비용|처리비','매출'].filter(re=>new RegExp(re).test(p4)).length; const dropped=/버린|대신|접었|검토했지만|하지 않은 이유|안 한 이유|반대|제한은/.test(p4); rub.p4=(imp>=2&&dropped)?2:(imp>=1||dropped)?1:0;
    const cr=citedRules(T.p5+' '+T.p3); const viol=violations(all,T.p5); rub.p5=viol.length?0:(cr.ids.length>=2&&!cr.unknown.length)?2:cr.ids.length>=1?1:0;
    let total=0; for(const k of R){ total+=rub[k]; fb[k]=(E.feedback[k]&&E.feedback[k][String(rub[k])])||''; if(k==='p5'&&viol.length) fb[k]=fb[k].replace('[위반 항목]',viol.map(v=>v.text).join(' / ')); if(k==='p2'&&rub[k]===1&&miss.length) fb[k]+=' 빈 칸: '+miss.map(m=>`${m.day}일차 ${m.source}`).join(', '); }
    const qs=E.questions.map((q,i)=>{ const j=F.q[i]; const c=q.choices[j]; return {i,j,score:c?c.score:0,react:c?c.react:'(답하지 않음)',label:c?c.label:''}; }); const qAvg=Math.round(qs.reduce((a,b)=>a+b.score,0)/Math.max(1,qs.length));
    if(qs[2]&&qs[2].score===0&&/오늘부터/.test(qs[2].label)) viol.push({text:'사전 고지 없이 오늘부터 적용(발표 답변)',rules:['CS-02']});
    if(qs[0]&&qs[0].score===0) rub.p2=Math.min(rub.p2,1);
    if(rub.p4>0&&qs[1]&&qs[1].score<=10&&/그대로 두/.test(qs[1].label)&&/현상 유지|그대로/.test(F.dropped)) rub.p4-=1;
    total=R.reduce((a,k)=>a+rub[k],0); if(viol.length) rub.p5=0;
    let ending='B'; if(viol.length) ending='C'; else if(total>=8&&rub.p5>=1&&miss.length<2&&rub.p2>=2) ending='A';
    return {rubric:rub,total,feedback:fb,violations:viol,missing:miss,calcOk,tableOk,qs,qAvg,ending}; }
  function violations(all,p5){ const V=E.violations||[]; const out=[]; const lab=(i,def)=>({text:(V[i]&&V[i].text)||def,rules:(V[i]&&V[i].rules)||[]});
    if(/(오늘부터|즉시 적용|바로 적용|지금부터|당장)/.test(all)&&!/고지/.test(all)) out.push(lab(0,'사전 고지 없이 오늘부터 적용'));
    if(/소급/.test(all)&&!/소급하지|소급 없이|소급은 안|소급 않/.test(all)) out.push(lab(1,'이미 접수된 반품에 소급 차감'));
    if(/(녹취|상담 기록|통화 내용).{0,12}(공개|올리|SNS|커뮤니티)/.test(all)) out.push(lab(2,'상담 기록·녹취 외부 공개'));
    if(/접수(를| 자체를)? 거부|민원.{0,6}거부|받지 않는다/.test(all)) out.push(lab(3,'민원 접수 자체 거부'));
    const money=(all.match(/(\d{1,3}(?:,\d{3})+|\d{4,})\s*원/g)||[]).map(x=>+x.replace(/[^\d]/g,'')); if(money.some(m=>m>30000)&&/보상|쿠폰|적립금|위로금/.test(all)&&!/결재|승인/.test(all)) out.push(lab(4,'결재 없이 30,000원 초과 보상'));
    if(/16시/.test(all)&&/약속|까지 답|안에 결정|안에 답/.test(all)) out.push(lab(5,'고객이 정한 시한(16시)을 약속'));
    for(const c of D.cards){ const hint=c.violationHint||''; const ids=hint.match(/[A-Z]{2,4}-\d{2}/g)||[]; if(!ids.length) continue; const pr=preRes[c.id]; if(pr&&pr.act===c.best) continue; if(!ids.some(i=>p5.includes(i))) out.push({text:hint.replace(/^7화 C 위반 후보\s*/,''),rules:ids}); }
    return out; }
  async function submit(){ const empty=E.report.filter(r=>!(F.report[r.key]||'').trim()); if(empty.length&&!confirm(`보고서 ${empty.length}칸이 비어 있어요. 그대로 발표할까요?`)) return; if(Object.keys(F.q).length<E.questions.length&&!confirm('답하지 않은 질문이 있어요. 그대로 발표할까요?')) return;
    const O=office(); const lead=(D.dests.find(x=>x.seat==='lead')||{}).name;
    const g=gradeReport(); result=g;
    const day7ncs={'1':Math.round((g.rubric.p1+g.rubric.p3)/4*100),'2':Math.round(g.calcOk/Math.max(1,E.criteria.length)*100),'3':Math.round(((g.rubric.p3+g.rubric.p4)/4*100+g.qAvg)/2),'7':Math.round((g.rubric.p5/2*100+g.tableOk/Math.max(1,E.table.length)*100)/2),'4':F.reflection.trim()?100:0};
    const res={team:S.team,ep:7,day:7,at:new Date().toISOString(),ending:g.ending,rubric:g.rubric,total:g.total,feedback:g.feedback,violations:g.violations,missingClues:g.missing.map(m=>`${m.day}일차 ${m.source}`),report:F.report,decision:F.decision,dropped:F.dropped,idea:F.idea,table:F.table,calc:F.calc,reflection:F.reflection,questions:g.qs,ncs:day7ncs,cards:preRes,counts:{done:E.report.length-empty.length,all:E.report.length}};
    P.done['7']=res; P.day=8; P.cur=null; for(const [n,v] of Object.entries(S.trust)) P.trust[n]=(P.trust[n]||0)+v; saveProgress(true);
    if(O&&lead){ try{ bubble(lead,g.ending==='A'?'채택.':g.ending==='B'?'다시 정리해 와. 내일 아침.':'이 안은 못 올려.',8); }catch(e){} }
    renderEnding(res); }
  function renderEnding(res){ const body=$('ep7Body'); body.innerHTML=''; document.querySelectorAll('#ep7 .stepb').forEach(b=>b.classList.remove('cur')); const en=E.endings[res.ending]||{}; const lead=(D.dests.find(x=>x.seat==='lead')||{}).name||'팀장';
    body.appendChild(h('h2',null,`엔딩 ${res.ending} — ${en.name||''}`));
    let leadText=en.lead||''; if(res.ending==='B'){ const parts=leadText.split(/\s*\/\s*\[②[^\]]*\]\s*/); leadText=(res.rubric.p2<=1&&parts[1])?parts[1]:parts[0]; leadText=leadText.replace(/\[빈 칸 이름[^\]]*\]/,res.missingClues.length?res.missingClues.join(', '):'근거'); }
    if(res.ending==='C'){ const RB=window.OC&&OC.data&&OC.data.RULEBOOK; const reads=[]; for(const v of res.violations){ for(const id of (v.rules||[]).slice(0,1)){ let art=null; if(RB) for(const b of RB.books) for(const a of b.articles) if(a.id===id) art=a; reads.push(art?`"${art.body.split('. ')[0]}." ${id}.`:id); } if(!v.rules||!v.rules.length) reads.push(v.text); } leadText=leadText.replace(/^\[위반 항목[^\]]*\][^\n]*/,reads.join(' ')); }
    const say=(who,text,cls)=>sayRow(body,who,text,cls);   /* 화자별 색·아바타는 day.js 와 한 벌이다 */
    say(lead,leadText); for(const st of (en.stage||[])) body.appendChild(h('div','stage',`(${st})`)); for(const o of (en.others||[])) say(o.who,o.text);
    const box=h('div','box'); box.style.setProperty('--bc',BOX_HUE.summary); box.appendChild(h('h3',null,`보고서 채점 ${res.total}/10`)); const t=document.createElement('table'); t.className='sheet'; for(const r of E.report){ const tr=t.insertRow(); tr.appendChild(h('td',null,r.title)); tr.appendChild(h('td','v',String(res.rubric[r.key]))); tr.appendChild(h('td',null,res.feedback[r.key]||'')); } box.appendChild(t);
    if(res.violations.length) box.appendChild(h('div','bad','규정 위반: '+res.violations.map(v=>v.text).join(' / '))); if(res.missingClues.length) box.appendChild(h('div','muted','놓친 단서: '+res.missingClues.join(', ')));
    const qs=h('ul'); for(const q of res.questions){ qs.appendChild(h('li',null,`"${E.questions[q.i].q}" → ${q.label||'(답 없음)'} · ${q.score}점 ${q.react?'— '+q.react:''}`)); } box.appendChild(qs); body.appendChild(box);
    say((D.dests.find(x=>x.seat==='senior')||{}).name||'사수',D.dialog.debrief.senior); say(peerName(),D.dialog.debrief.peer,'msg');
    const wk=h('div','box'); wk.style.setProperty('--bc',BOX_HUE.ncs); wk.appendChild(h('h3',null,'7일 역량 막대 (9축 + 자기개발은 참고)')); wk.appendChild(ncsBars(weekNcs())); wk.appendChild(weekTable()); body.appendChild(wk);
    const ft=h('div','foot'); const sel=document.createElement('select'); for(const k of TEAM_ORDER){ if(k===S.team) continue; const o=document.createElement('option'); o.value=k; o.textContent=TEAM_NAMES[k]; sel.appendChild(o); } ft.appendChild(sel); ft.appendChild(mkBtn((E.restart&&E.restart.label)||'다른 직무로 다시 시작','pri',()=>{ const u=new URL(location.href); u.search=`?team=${sel.value}&ep=1&fresh=1${S.code?'&code='+S.code:''}`; location.href=u.toString(); })); ft.appendChild(mkBtn('홈으로','',()=>goHome(false))); body.appendChild(ft); if(E.restart&&E.restart.text) body.appendChild(h('p','muted',E.restart.text.replace(/\*\*/g,''))); }
  function weekNcs(){ const acc={}; for(let d=1; d<=7; d++){ const r=P.done[String(d)]; if(!r||!r.ncs) continue; for(const [a,v] of Object.entries(r.ncs)){ (acc[a]=acc[a]||[]).push(v); } } const out={}; for(const [a,v] of Object.entries(acc)) out[a]=Math.round(v.reduce((x,y)=>x+y,0)/v.length); return out; }
  function weekTable(){ const t=document.createElement('table'); t.className='sheet week'; const hd=t.insertRow(); hd.appendChild(h('th',null,'')); for(const a of AXES) hd.appendChild(h('th',null,CIRC[a])); for(let d=1; d<=7; d++){ const r=P.done[String(d)]; const tr=t.insertRow(); tr.appendChild(h('td',null,`${d}일차`)); for(const a of AXES) tr.appendChild(h('td',null,r&&r.ncs&&r.ncs[a]!=null?String(r.ncs[a]):'·')); } return t; }
  /* 자동 플레이(스모크) */
  async function auto(opts={}){ const fail=opts.path==='fail';
    for(const c of D.cards){ if(preRes[c.id]) continue; const k=c.best; const textual=(k===c.best&&c.compose)||k==='reply'; submitPre(c,k,textual?(c.compose&&c.compose.model)||'확인했습니다. 보고하겠습니다. 죄송합니다.':null); }
    for(const t of E.table) F.table[t.key]=t.answer; for(const c of E.criteria) F.calc[c.key]=c.answer; F.idea=(E.ideaExamples&&E.ideaExamples[0])||'숫자 하나를 바꾸자'; for(const f of E.decisionFields) F.decision[f]=f+': 정함'; F.dropped='버린 안: 이용 제한(약관 14조) — 남용 입증 부담과 분쟁 5개월, 영업본부 반대 때문에 접었다.';
    for(const r of E.report) F.report[r.key]=r.example.replace(/^"|"$/g,''); F.reflection='3일차를 다시 하고 싶다. 표를 먼저 세는 습관을 들이고 싶어서.'; F.key='p3';
    E.questions.forEach((q,i)=>{ let bi=0; q.choices.forEach((c,j)=>{ if(c.score>q.choices[bi].score) bi=j; }); if(fail&&i===2){ const w=q.choices.findIndex(c=>c.score===0); bi=w>=0?w:bi; } F.q[i]=bi; });
    const g=gradeReport(); result=g; const day7ncs={'1':Math.round((g.rubric.p1+g.rubric.p3)/4*100),'2':Math.round(g.calcOk/Math.max(1,E.criteria.length)*100),'3':Math.round(((g.rubric.p3+g.rubric.p4)/4*100+g.qAvg)/2),'7':Math.round((g.rubric.p5/2*100+g.tableOk/Math.max(1,E.table.length)*100)/2),'4':100};
    const res={team:S.team,ep:7,day:7,at:new Date().toISOString(),ending:g.ending,rubric:g.rubric,total:g.total,feedback:g.feedback,violations:g.violations,missingClues:g.missing.map(m=>`${m.day}일차 ${m.source}`),report:F.report,decision:F.decision,dropped:F.dropped,idea:F.idea,table:F.table,calc:F.calc,reflection:F.reflection,questions:g.qs,ncs:day7ncs,cards:preRes,counts:{done:5,all:5}};
    P.done['7']=res; P.day=8; P.cur=null; saveProgress(true); renderEnding(res); return res; }
  return {start,snapshot,auto,grade:()=>gradeReport(),form:F,result:()=>result};
})();
