/* ======================================================================
   7일차 「결정」 — 아침 분기 카드 → 단서 취합표(자동) → 팀장 자료 6조각 → 결정 칸(취합표 12·계산 3·아이디어·결정) → 보고서 5칸 → 발표 → 루브릭 → 엔딩 A/B/C → 7일 역량
   ====================================================================== */
window.EP7=(function(){
  let E=null; const F={table:{},calc:{},idea:'',decision:{},dropped:'',report:{},reflection:'',key:'p3',q:{}}; let preRes={}; let result=null;
  /* 채점·단서표는 js/play/ep7grade.js(순수 공용부)에 있다 — 여기서는 화면 상태를 넘겨 부른다 */
  const G=()=>EP7Grade.make(E,F,{P,clues:S.clues,preRes,cards:D.cards});
  const rename=(s)=>G().rename(s); const dayLabel=(d)=>G().dayLabel(d); const nums=(t)=>(String(t||'').match(/\d[\d,\.]*/g)||[]).filter(x=>x.replace(/[,\.]/g,'').length>0);
  const rowFilled=(row)=>G().rowFilled(row); const missingRows=()=>G().missingRows(); const missName=(r)=>G().missName(r); const gradeReport=()=>G().gradeReport();
  function reportOf(k){ return (E.report||[]).find(r=>r.key===k)||{}; }
  /* 화면에 내부 용어(카드 아이디·행동 키)를 내보내지 않는다 */
  const ACT_WORD=/(^|[^가-힣A-Za-z])(hold|reply|reply2|delegate|confirm|reject|approve|deliver|ask|report|visit|work|pick|none|timeout|verify|notify|promise|refuse|accept|dismiss|refund)(?![가-힣A-Za-z])/g;
  const humanize=(s)=>String(s==null?'':s).replace(ACT_WORD,(m,a,k)=>a+actLabel(k));
  const srcName=(r,k)=>{ const c=k&&CARD(k.card); if(c&&c.subj) return c.subj;
    if(r.label) return rename(r.label);
    if(k&&k.note) return rename(String(k.note).split(/[·\n]/)[0].trim());
    return dayLabel(r.day)+' 업무'; };
  /* 빈 칸 이름 — 화면에 나가므로 카드 아이디(source) 대신 일차 + 단서 첫 조각 */

  /* 45차: 브리핑·마무리도 1~6일차(day.js startBriefing·callWrap)처럼 **부르기**다 — 팀장 머리 위 표시 + 알림 → 가서 T 로 듣기.
     듣기 전에는 결정 화면이 열리지 않는다. ?stage=0(3D 없음)·이어 하기는 예전처럼 곧바로 화면.
     자동 플레이(EP7.auto)·__play.skip·skipBriefing 은 들은 것으로 친다(endBriefing 을 여기서 감싼다). */
  let briefCallE=null, wrapCallE=null;
  const byT=()=>typeof talkByT==='function'&&talkByT();
  const leadName=()=>(D.dests.find(x=>x.seat==='lead')||{}).name||'';
  function openPanel(){ S.phase='ep7'; $('ep7').classList.add('open'); render(); go(D.cards.length&&!Object.keys(preRes).length?'pre':'clue'); saveProgress(); }
  function start(){ E=D.ep7; S.phase='ep7'; S.running=false; ['inbox','card','side','endbar'].forEach(id=>{ const e=$(id); if(e) e.style.display='none'; });
    for(const c of D.cards) S.cards[c.id]=S.cards[c.id]||{arrived:true,arrivedAt:0,status:'new'};
    const cur=P.cur; let resumed=false; if(cur&&cur.day===7&&cur.ep7&&Q.get('fresh')!=='1'){ Object.assign(F,cur.ep7.form||{}); preRes=cur.ep7.pre||{}; resumed=true; toast('이어서 합니다'); }
    const L=(D.dialog&&D.dialog.briefing)||[];
    const gate=(!resumed&&L.length&&byT()&&typeof briefGate==='function')?briefGate(L):null;
    if(gate){ S.phase='briefing'; S.briefT=true;
      /* 45차 후속: 말하는 사람들이 팀장 둘레로 모이고(day.js briefGatherStart), 대화창이 줄마다 그 사람 얼굴을 잡는다 */
      const gathered=(typeof briefGatherStart==='function')?briefGatherStart(L,gate):[];
      briefCallE=Talk.call(gate,L.map(l=>({who:l.who,text:l.text,role:l.role})),{ gathered,
        notice:`${gate}님이 부르세요. 자리로 가서 T 로 이야기를 들어요. (들어야 결정 화면이 열려요)`, remind:30000,
        onHeard:()=>{ briefCallE=null; if(typeof ungatherBrief==='function') ungatherBrief(); if(S.phase==='briefing') openPanel(); } });
      return; }
    openPanel(); }
  function heardBrief(){ if(briefCallE){ briefCallE.cancel(); briefCallE=null; } if(typeof ungatherBrief==='function') ungatherBrief(); if(S.phase==='briefing'&&E) openPanel(); }
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
  async function submitPre(c,k,text){ const st=S.cards[c.id]; if(preRes[c.id]) return; if(text!=null&&text.replace(/\s/g,'').length<8){ toast('내용이 너무 짧아요.'); return; }
    let r; try{ r=await Grader.run('pre7',c,{key:k,text:text!=null?text:null}); }catch(e){ toast('채점 서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.'); return; } if(preRes[c.id]) return;
    if(text!=null) st.text=text; if(r.forbidHit) st.forbidHit=true; const score=r.score, comment=r.comment;
    preRes[c.id]={act:k,score,comment,text:text||null,forbidHit:!!st.forbidHit}; st.status='done'; st.act=k; st.score=score; for(const a of (c.ncs||['3','10'])) if(S.ncs[a]) S.ncs[a].push(score); runBranch(c.id,r.branch); toast(`${actLabel(k)} · ${score}점`); go('pre'); }
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
    for(const t of E.table){ const row=inputRow(`${'①②③④⑤⑥'[t.frag-1]||''} ${t.label}`,t.unit,F.table[t.key],v=>{ F.table[t.key]=v; },''); const mark=h('span','mark'); row.appendChild(mark); const chk=async()=>{ const v=F.table[t.key]; if(!v){ mark.textContent=''; return; } try{ mark.textContent=(await Grader.run('ep7cell',null,{kind:'table',key:t.key,value:v})).ok?'✅':'✗'; }catch(e){ mark.textContent='?'; } }; row.querySelector('input').addEventListener('change',chk); chk(); g.appendChild(row); }
    box.appendChild(g); box.appendChild(h('p','muted','저장(칸 밖 클릭)하면 맞았는지 표시돼요.'));
    box.appendChild(h('h3',null,'② 계산 3칸 — 답은 어디에도 인쇄돼 있지 않아요')); for(const c of E.criteria){ const row=inputRow(c.label,c.unit,F.calc[c.key],v=>{ F.calc[c.key]=v; },c.hint); const mark=h('span','mark'); row.appendChild(mark); const chk=async()=>{ const v=F.calc[c.key]; if(!v){ mark.textContent=''; return; } try{ mark.textContent=(await Grader.run('ep7cell',null,{kind:'calc',key:c.key,value:v})).ok?'✅':'✗'; }catch(e){ mark.textContent='?'; } }; row.querySelector('input').addEventListener('change',chk); chk(); box.appendChild(row); }
    box.appendChild(h('h3',null,'③ 아이디어 1장 — 취합표의 숫자 하나를 이렇게 바꾸자 (얼마에서 얼마로)')); const ta=document.createElement('textarea'); ta.value=F.idea; ta.placeholder=(E.ideaExamples&&E.ideaExamples[0])?'예: '+E.ideaExamples[0]:''; ta.oninput=()=>{ F.idea=ta.value; bump(); }; box.appendChild(ta);
    box.appendChild(h('h3',null,'④ 결정')); for(const f of E.decisionFields){ box.appendChild(inputRow(f,'',F.decision[f],v=>{ F.decision[f]=v; },'')); } const td=document.createElement('textarea'); td.value=F.dropped; td.placeholder='버린 안 1개와 이유'; td.oninput=()=>{ F.dropped=td.value; bump(); }; box.appendChild(h('label','lbl','버린 안과 이유')); box.appendChild(td);
    box.appendChild(mkBtn('보고서로 →','pri',()=>go('report'))); }
  /* 4) 보고서 */
  function renderReport(box){ box.appendChild(h('h3',null,'보고서 1장 — 5칸 (각 0/1/2점)')); for(const r of E.report){ const d=h('div','rfield'); d.appendChild(h('label','lbl',r.title)); d.appendChild(h('div','muted',r.desc)); const ta=document.createElement('textarea'); ta.value=F.report[r.key]||''; ta.placeholder='쓰는 법: '+(r.desc||'')+' — 좋은 예는 발표가 끝나면 채점표에서 보여 줘요'; ta.oninput=()=>{ F.report[r.key]=ta.value; bump(); }; d.appendChild(ta); box.appendChild(d); }
    box.appendChild(h('h3',null,'회고 (참고 · 점수에는 넣지 않습니다)')); const tr=document.createElement('textarea'); tr.value=F.reflection; tr.placeholder=E.reflection; tr.oninput=()=>{ F.reflection=tr.value; bump(); }; box.appendChild(tr);
    box.appendChild(mkBtn('발표로 →','pri',()=>go('present'))); }
  /* 5) 발표 */
  function renderPresent(box){ box.appendChild(h('h3',null,'발표 — 핵심 문장 하나를 골라 읽고, 팀장 질문 3개에 답해요')); const sel=document.createElement('select'); for(const r of E.report){ const o=document.createElement('option'); o.value=r.key; o.textContent=`${r.title}: ${(F.report[r.key]||'(비어 있음)').split('\n')[0].slice(0,50)}`; sel.appendChild(o); } sel.value=F.key; sel.onchange=()=>{ F.key=sel.value; bump(); }; box.appendChild(sel);
    E.questions.forEach((q,i)=>{ const d=h('div','qbox'); d.appendChild(h('div','q',`팀장: "${q.q}"`)); q.choices.forEach((c,j)=>{ const l=document.createElement('label'); l.className='opt'; const r=document.createElement('input'); r.type='radio'; r.name='q'+i; r.checked=F.q[i]===j; r.onchange=()=>{ F.q[i]=j; bump(); }; l.appendChild(r); l.appendChild(document.createTextNode(' '+c.label)); d.appendChild(l); }); box.appendChild(d); });
    box.appendChild(mkBtn('발표 끝 — 팀장 판단 듣기','pri',()=>submit())); }
  /* 채점 — 팀마다 사건이 달라서 낱말·위반 판정은 전부 ep7 데이터에서 읽는다(45차: 고객상담팀 낱말 고정을 걷어냄).
     report[i].keywords  : [[낱말…],[낱말…]] 묶음 목록 — 묶음 안 낱말 하나만 있어도 그 묶음을 채운 것
     report[i].keywordsNeed : 2점에 필요한 묶음 수(기본 ①·③은 전부, ④는 2)
     report[3].dropWords : 「버린 안」으로 볼 낱말을 더한다(기본 낱말은 아래 DROP) */
  /* 최종 채점 — 로컬(정본)은 EP7Grade 를 바로, 배포본(정답 없음)은 서버가 같은 코드로. 서버는 엔딩 대사·칸별 좋은 예도 함께 돌려주므로 E 에 얹는다 */
  async function finalGrade(){ if(Grader.local()){ const g=EP7Grade.grade(E,F,{P,clues:S.clues,preRes,cards:D.cards}); return g; }
    const flushed=window.Backend&&typeof window.Backend.flush==='function'?window.Backend.flush():null; if(flushed) await withTimeout(Promise.resolve(flushed),8000).catch(()=>{});   /* 서버가 저장된 진행(단서·앞 날 결과)으로 채점한다 */
    const g=await Grader.run('ep7',null,{form:JSON.parse(JSON.stringify(F)),pre:preRes,clues:S.clues});
    if(g.endings) E.endings=g.endings; if(g.examples) for(const r of (E.report||[])) if(g.examples[r.key]) r.example=g.examples[r.key]; return g; }
  async function submit(){ const empty=E.report.filter(r=>!(F.report[r.key]||'').trim()); if(empty.length&&!confirm(`보고서 ${empty.length}칸이 비어 있어요. 그대로 발표할까요?`)) return; if(Object.keys(F.q).length<E.questions.length&&!confirm('답하지 않은 질문이 있어요. 그대로 발표할까요?')) return;
    const O=office(); const lead=(D.dests.find(x=>x.seat==='lead')||{}).name;
    let g; try{ g=await finalGrade(); }catch(e){ toast('채점 서버에 연결하지 못했어요. 잠시 뒤 「발표 끝」을 다시 눌러 주세요.'); return; } result=g;
    const day7ncs={'1':Math.round((g.rubric.p1+g.rubric.p3)/4*100),'2':Math.round(g.calcOk/Math.max(1,E.criteria.length)*100),'3':Math.round(((g.rubric.p3+g.rubric.p4)/4*100+g.qAvg)/2),'7':Math.round((g.rubric.p5/2*100+g.tableOk/Math.max(1,E.table.length)*100)/2),'4':F.reflection.trim()?100:0};
    const res={team:S.team,ep:7,day:7,at:new Date().toISOString(),ending:g.ending,rubric:g.rubric,total:g.total,feedback:g.feedback,violations:g.violations,missingClues:g.missingClues,report:F.report,decision:F.decision,dropped:F.dropped,idea:F.idea,table:F.table,calc:F.calc,reflection:F.reflection,questions:g.qs,ncs:day7ncs,cards:preRes,counts:{done:E.report.length-empty.length,all:E.report.length}};
    P.done['7']=res; P.day=8; P.cur=null; for(const [n,v] of Object.entries(S.trust)) P.trust[n]=(P.trust[n]||0)+v; saveProgress(true);
    /* 45차: 3D 가 있으면 결정 화면을 접고 팀장이 부른다 — 가서 T 로 판단을 들은 뒤 엔딩 화면이 열린다(1~6일차 퇴근 마무리와 같은 방식) */
    const ld=leadName(); if(byT()&&ld&&typeof seatByName==='function'&&seatByName(ld)){ callWrap7(res,ld); return; }
    renderEnding(res); }
  function callWrap7(res,lead){ const leadText=endingLeadText(res);
    /* 팀장 말투 — 브리핑·판단 대사에 「~요」가 없으면 반말(day.js callWrap 과 같은 규칙) */
    const leadSays=((D.dialog&&D.dialog.briefing)||[]).filter(l=>l&&l.who&&(l.who===lead||lead.endsWith(l.who)||l.who.endsWith(lead))).map(l=>l.text).join(' ')+' '+leadText;
    const banmal=leadSays.trim()&&!/요[.?!…]|요\s*$/.test(leadSays);
    const lines=[{who:lead,text:banmal?'○○씨, 발표 잘 들었어. 내 판단 말할게.':'○○씨, 발표 잘 들었어요. 제 판단을 말할게요.'}]; if(leadText) lines.push({who:lead,text:leadText});
    $('ep7').classList.remove('open'); S.phase='wrap';
    wrapCallE=Talk.call(lead,lines,{ notice:`${lead}님이 부르세요. 자리로 가서 T 로 발표 결과를 들어요.`, remind:30000,
      onHeard:()=>{ wrapCallE=null; showEnding(res); } });
    $('enTitle').textContent='발표를 마쳤습니다'; $('enSub').textContent=`${lead}님이 부르세요 — 가서 T 로 판단을 들어요.`;
    $('endNotice').classList.add('open'); setTimeout(()=>$('endNotice').classList.remove('open'),2600); }
  function showEnding(res){ if(wrapCallE){ wrapCallE.cancel(); wrapCallE=null; } if(window.Talk&&Talk.isOpen&&Talk.isOpen()) Talk.close(); $('endNotice').classList.remove('open'); S.phase='ep7'; $('ep7').classList.add('open'); renderEnding(res); }
  /* 엔딩 팀장 대사 — B 는 ② 점수에 따라 둘 중 하나, C 는 위반 조항을 읽어 준다 */
  function endingLeadText(res){ const en=E.endings[res.ending]||{};
    let leadText=en.lead||''; if(res.ending==='B'){ const parts=leadText.split(/\s*\/\s*\[②[^\]]*\]\s*/); leadText=(res.rubric.p2<=1&&parts[1])?parts[1]:parts[0]; leadText=leadText.replace(/\[빈 칸 이름[^\]]*\]/,res.missingClues.length?res.missingClues.join(', '):'근거'); }
    if(res.ending==='C'){ const RB=window.OC&&OC.data&&OC.data.RULEBOOK; const reads=[]; for(const v of res.violations){ if(v.say){ reads.push(v.say); continue; } for(const id of (v.rules||[]).slice(0,1)){ let art=null; if(RB) for(const b of RB.books) for(const a of b.articles) if(a.id===id) art=a; reads.push(art?`"${art.body.split('. ')[0]}." ${id}.`:id); } if(!v.rules||!v.rules.length) reads.push(v.text); } leadText=leadText.replace(/^\[위반 항목[^\]]*\][^\n]*/,reads.join(' ')); }
    return leadText; }
  function renderEnding(res){ const body=$('ep7Body'); body.innerHTML=''; document.querySelectorAll('#ep7 .stepb').forEach(b=>b.classList.remove('cur')); const en=E.endings[res.ending]||{}; const lead=(D.dests.find(x=>x.seat==='lead')||{}).name||'팀장';
    body.appendChild(h('h2',null,`엔딩 ${res.ending} — ${en.name||''}`));
    const leadText=endingLeadText(res);
    const say=(who,text,cls)=>sayRow(body,who,text,cls);   /* 화자별 색·아바타는 day.js 와 한 벌이다 */
    say(lead,leadText); for(const st of (en.stage||[])) body.appendChild(h('div','stage',`(${st})`)); for(const o of (en.others||[])) say(o.who,o.text);
    const box=h('div','box'); box.style.setProperty('--bc',BOX_HUE.summary); box.appendChild(h('h3',null,`보고서 채점 ${res.total}/10`)); const t=document.createElement('table'); t.className='sheet'; for(const r of E.report){ const tr=t.insertRow(); tr.appendChild(h('td',null,r.title)); tr.appendChild(h('td','v',String(res.rubric[r.key]))); const fd=h('td',null,res.feedback[r.key]||''); if(r.example){ fd.appendChild(h('div','muted','좋은 예: '+String(r.example).replace(/^"|"$/g,''))); } tr.appendChild(fd); } box.appendChild(t);
    if(res.violations.length) box.appendChild(h('div','bad','규정 위반: '+res.violations.map(v=>v.text).join(' / '))); if(res.missingClues.length) box.appendChild(h('div','muted','놓친 단서: '+res.missingClues.join(', ')));
    const qs=h('ul'); for(const q of res.questions){ qs.appendChild(h('li',null,`"${E.questions[q.i].q}" → ${q.label||'(답 없음)'} · ${q.score}점 ${q.react?'— '+q.react:''}`)); } box.appendChild(qs); body.appendChild(box);
    say((D.dests.find(x=>x.seat==='senior')||{}).name||'사수',D.dialog.debrief.senior); say(peerName(),D.dialog.debrief.peer,'msg');
    const wk=h('div','box'); wk.style.setProperty('--bc',BOX_HUE.ncs); wk.appendChild(h('h3',null,'7일 역량 막대 (9축 + 자기개발은 참고)')); wk.appendChild(ncsBars(weekNcs())); wk.appendChild(weekTable()); body.appendChild(wk);
    const ft=h('div','foot'); const sel=document.createElement('select'); for(const k of TEAM_ORDER){ if(k===S.team) continue; const o=document.createElement('option'); o.value=k; o.textContent=TEAM_NAMES[k]; sel.appendChild(o); } ft.appendChild(sel); ft.appendChild(mkBtn((E.restart&&E.restart.label)||'다른 직무로 다시 시작','pri',()=>{ const u=new URL(location.href); u.search=`?team=${sel.value}&ep=1&fresh=1${S.code?'&code='+S.code:''}`; location.href=u.toString(); })); ft.appendChild(mkBtn('홈으로','',()=>goHome(false))); body.appendChild(ft); if(E.restart&&E.restart.text) body.appendChild(h('p','muted',E.restart.text.replace(/\*\*/g,''))); }
  function weekNcs(){ const acc={}; for(let d=1; d<=7; d++){ const r=P.done[String(d)]; if(!r||!r.ncs) continue; for(const [a,v] of Object.entries(r.ncs)){ (acc[a]=acc[a]||[]).push(v); } } const out={}; for(const [a,v] of Object.entries(acc)) out[a]=Math.round(v.reduce((x,y)=>x+y,0)/v.length); return out; }
  function weekTable(){ const t=document.createElement('table'); t.className='sheet week'; const hd=t.insertRow(); hd.appendChild(h('th',null,'')); for(const a of AXES) hd.appendChild(h('th',null,CIRC[a])); for(let d=1; d<=7; d++){ const r=P.done[String(d)]; const tr=t.insertRow(); tr.appendChild(h('td',null,`${d}일차`)); for(const a of AXES) tr.appendChild(h('td',null,r&&r.ncs&&r.ncs[a]!=null?String(r.ncs[a]):'·')); } return t; }
  /* 자동 플레이(스모크) */
  async function auto(opts={}){ const fail=opts.path==='fail'; heardBrief(); if(wrapCallE){ wrapCallE.cancel(); wrapCallE=null; } if(S.phase==='wrap') S.phase='ep7'; if(!$('ep7').classList.contains('open')){ $('ep7').classList.add('open'); if(!$('ep7Body')) render(); }
    for(const c of D.cards){ if(preRes[c.id]) continue; const k=c.best; const textual=(k===c.best&&c.compose)||k==='reply'; await submitPre(c,k,textual?(c.compose&&c.compose.model)||'확인했습니다. 보고하겠습니다. 죄송합니다.':null); }
    for(const t of E.table) F.table[t.key]=t.answer; for(const c of E.criteria) F.calc[c.key]=c.answer; F.idea=(E.ideaExamples&&E.ideaExamples[0])||'숫자 하나를 바꾸자'; for(const f of E.decisionFields) F.decision[f]=f+': 정함';
    /* 버린 안은 그 팀 ④칸 「좋은 예」에서 가져온다(45차: 고객상담팀 문장 고정을 걷어냄) */
    const ex4=String((reportOf('p4').example)||'').replace(/^"|"$/g,''); const mDrop=ex4.match(/버린 안[\s\S]*$/); F.dropped=mDrop?mDrop[0]:'버린 안: 현재 방식 — 근거가 약해 접었다.';
    for(const r of E.report) F.report[r.key]=r.example.replace(/^"|"$/g,''); F.reflection='3일차를 다시 하고 싶다. 표를 먼저 세는 습관을 들이고 싶어서.'; F.key='p3';
    E.questions.forEach((q,i)=>{ let bi=0; q.choices.forEach((c,j)=>{ if(c.score>q.choices[bi].score) bi=j; }); if(fail&&i===2){ const w=q.choices.findIndex(c=>c.score===0); bi=w>=0?w:bi; } F.q[i]=bi; });
    const g=await finalGrade(); result=g; const day7ncs={'1':Math.round((g.rubric.p1+g.rubric.p3)/4*100),'2':Math.round(g.calcOk/Math.max(1,E.criteria.length)*100),'3':Math.round(((g.rubric.p3+g.rubric.p4)/4*100+g.qAvg)/2),'7':Math.round((g.rubric.p5/2*100+g.tableOk/Math.max(1,E.table.length)*100)/2),'4':100};
    const res={team:S.team,ep:7,day:7,at:new Date().toISOString(),ending:g.ending,rubric:g.rubric,total:g.total,feedback:g.feedback,violations:g.violations,missingClues:g.missingClues,report:F.report,decision:F.decision,dropped:F.dropped,idea:F.idea,table:F.table,calc:F.calc,reflection:F.reflection,questions:g.qs,ncs:day7ncs,cards:preRes,counts:{done:5,all:5}};
    P.done['7']=res; P.day=8; P.cur=null; saveProgress(true); renderEnding(res); return res; }
  /* 검사용(tools/ep7_grade_test.mjs) — 화면 없이 데이터만 얹어 채점한다 */
  function _test(ep7){ E=ep7; preRes={}; for(const k of Object.keys(F)) if(F[k]&&typeof F[k]==='object') F[k]={}; else F[k]=''; F.key='p3'; return {form:F,grade:()=>gradeReport()}; }
  return {start,snapshot,auto,heardBrief,grade:()=>gradeReport(),form:F,result:()=>result,_test};
})();
/* 7일차에 __play.skip·skipBriefing 이 부르는 endBriefing(day.js) 은 카드 하루를 시작한다 — 7일차는 「브리핑을 들은 것으로 치고 결정 화면」으로 돌린다 */
(function(){ const _eb=window.endBriefing; if(typeof _eb!=='function') return;
  window.endBriefing=function(){ if(typeof D!=='undefined'&&D&&D.kind==='ep7'){ return EP7.heardBrief(); } return _eb.apply(this,arguments); }; })();
