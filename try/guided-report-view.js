/* Demo shell around the exact formal student-result renderer. The builder
   extracts renderWeek from the reviewed public ep7.js; shared files stay intact. */
(function(){
 'use strict';
 function mount(wrap,own,actions){
  let sample=null;
  function render(mode){
   const snap=mode==='example'?(sample||(sample=GuidedReportData.example())):own;
   // Lexical values used by the unchanged renderer. Global game P/S/D are never replaced.
   const P=snap.progress,S={team:'cs'},D={teamName:'고객상담팀'},m=GuidedReportData.model(snap),isExample=snap.synthetic,isAuto=!!snap.automated;
   const titleOf=(d,id)=>snap.stories['cs-ep'+d]?.cards.find(c=>c.id===id)?.subj||'';
   const cut=(t,n)=>t.length>n?t.slice(0,n-1)+'…':t;
   function renderWeek(body,m,sec){ sec=sec||((t)=>rsSec(body,t)); const s0=sec('NCS 직업공통능력');
    if(typeof ncsReady!=='function'||!ncsReady()){ s0.appendChild(h('p','rsNote','역량 표를 불러오지 못했어요.')); return; }
    const R=NcsEval.report(P,{team:S.team}); body._R=R;
    if(R.legacy.length&&!Object.values(R.days).some(v=>v==='ok'||v==='part'||v==='quit')){ s0.appendChild(h('p','rsNote','이전 방식으로만 기록된 7일이라 역량 표를 낼 수 없어요.')); return; }
    const lv=(NCS.levels||[]).map(L=>L.name); s0.appendChild(h('p','rsMeta',`${String(NCS.std||'').replace('직업공통능력 ','')} 기준, 점수 0~100${lv.length?`, 수준은 ${lv.join(' < ')}`:''}`));
    const strongA=new Set(R.strengths.map(x=>NCS.subs[x.sub]&&NCS.subs[x.sub].area));
    /* 수준이 난 영역만 막대로 — 점수 없는 영역은 아래 하위능력 표에만 */
    const lvA=R.areas.filter(a=>a.status==='level');
    if(lvA.length){ const bars=rsBars(rsRank(lvA.map(a=>({name:a.name,S:a.S,level:a.levelName||'',mark:strongA.has(a.id)?'강점':''})))); bars.style.marginTop='20px'; s0.appendChild(bars); }
    /* 강점 · 보완점 — 결과 PDF 자료(m.sw)가 있으면 그것(근거 업무 = 실제 카드), 없으면 NcsEval 판정 + 대표 카드 */
    const areaOf=(c)=>{ const a=NCS.areas.find(A=>A.subs.includes(c)); return a?a.name:''; };
    const evFb=(d,card,ov)=>{ const t=card?titleOf(d,card):''; return {d,title:t?`「${cut(t,40)}」`:(ov&&NCS.ov[ov]?NCS.ov[ov].label:'업무'),act:'',score:null}; };
    const strengths=m&&m.sw?m.sw.strengths:R.strengths.map(x=>({name:x.name,area:areaOf(x.sub),levelName:R.subs[x.sub].levelName||'',S:x.S,see:NCS.subs[x.sub].see||'',say:'',ev:x.d?[evFb(x.d,x.card,(R.subs[x.sub].best||{}).ov)]:[]}));
    const gaps=m&&m.sw?m.sw.gaps:R.gaps.filter(x=>x.S!=null).map(x=>({name:x.name,area:areaOf(x.sub),levelName:R.subs[x.sub].levelName||'',S:x.S,see:NCS.subs[x.sub].see||'',say:'',ev:x.d?[evFb(x.d,x.card,(R.subs[x.sub].worst||{}).ov)]:[]}));
    /* 요약 블록에 강점·보완점 이름(머리 아래 숫자 줄 다음) */
    const sumL=(L)=>{ const f=document.createDocumentFragment(); L.forEach(x=>{ const p=h('span','ln'); p.appendChild(h('b',null,x.name)); p.appendChild(document.createTextNode(` ${x.levelName} ${x.S}`)); f.appendChild(p); }); return f; };
    const sumIt=[]; if(strengths.length) sumIt.push(['강점',sumL(strengths)]); if(gaps.length) sumIt.push(['보완점',sumL(gaps)]);
    if(sumIt.length){ const dl=rsDl(sumIt); dl.classList.add('rsSumDl'); body.insertBefore(dl,s0); }
    const item=(x)=>rsItem({name:x.name,area:x.area,pre:'점수',S:x.S,level:x.levelName,say:x.say,see:x.see,ev:(x.ev||[]).slice(0,2)});
    if(strengths.length){ const s=sec('강점'); for(const x of strengths) s.appendChild(item(x)); }
    if(gaps.length){ const s=sec('보완점'); for(const x of gaps) s.appendChild(item(x)); }
    /* 하위능력 21 — 영역별로 묶는다. 관찰이 있는 것은 줄마다(점수 · 수준 · 관찰 · 잘함), 관찰이 없는 것(다루지 않는 것 포함)은 맨 아래 한 줄로 묶어 「-」 */
    const s21=sec('하위능력 21개','하위능력'); const rows=[]; const none=[];
    for(const a of R.areas){ const on=a.subs.filter(c=>{ const X=R.subs[c]; return X.status==='level'||(X.status!=='x'&&X.n); }); none.push(...a.subs.filter(c=>!on.includes(c)));
      if(!on.length) continue; rows.push({cls:'grp',cells:[{t:a.name,span:5}]});
      for(const c of on){ const X=R.subs[c]; const lvl=X.status==='level'; rows.push({cls:lvl?'':'off',cells:[X.name,lvl?String(X.S):'-',lvl?X.levelName:'-',String(X.n),String(X.ok)]}); } }
    if(none.length) rows.push({cls:'off none',cells:[none.map(c=>R.subs[c].name).join(', '),'-','-','-','-']});
    s21.appendChild(rsTable([{t:'하위능력',w:'46%'},{t:'점수',num:true,w:'12%'},{t:'수준',w:'16%'},{t:'관찰',num:true,w:'13%'},{t:'잘함',num:true,w:'13%'}],rows));
    if(!m) return;
    /* 직무 경험 요약 — 업무 종류별 · 내 처리별 건수와 평균 점수 */
    if(m.exp&&m.exp.total){ const s=sec('직무 경험 요약','직무 경험'); s.appendChild(h('p','rsMeta',`${D.teamName} 7일 동안 받은 업무 ${m.exp.total}건, 평균 점수는 0~100`));
      const g=h('div','rsTwo'); const tb=(k,L)=>rsTable([{t:k,w:'56%'},{t:'건수',num:true,w:'20%'},{t:'평균 점수',num:true,w:'24%'}],L.map(x=>[x.label,String(x.n),x.avg==null?'-':String(x.avg)]));
      g.appendChild(tb('업무 종류',m.exp.byType)); g.appendChild(tb('내 처리',m.exp.byAct)); s.appendChild(g); }
    /* 일차별 업무 기록 — 날마다 소제목 · 팀장 한마디 · 표(업무 · 요청자 · 내 처리 · 하위능력 · 점수) */
    if(m.days.some(d=>d.cards.length)){ const s=sec('일차별 업무 기록','일차별 기록'); if(m.work&&m.work.avg!=null) s.appendChild(h('p','rsMeta',`업무 점수 평균 ${m.work.avg}, 업무마다 점수 0~100`));
      for(const d of m.days){ if(!d.cards.length) continue; const dh=h('h3','rsDay',`${d.d}일차 「${d.title}」`); const sm=[d.work!=null?`업무 점수 ${d.work}`:'',d.stateLabel||''].filter(Boolean).join(', '); if(sm){ dh.appendChild(document.createTextNode(' ')); dh.appendChild(h('small',null,sm)); } s.appendChild(dh);
        if(d.lead) s.appendChild(h('p','rsNote',`${d.leadName}: ${d.lead}`));
        s.appendChild(rsTable([{t:'업무',w:'33%'},{t:'요청자',w:'15%'},{t:'내 처리',w:'19%'},{t:'하위능력',w:'23%'},{t:'점수',num:true,w:'10%'}],
          d.cards.map(c=>{ const sc=c.score; return [c.title+(c.branch?' (후속)':''),c.from||'-',{t:c.act+(c.choice?`: ${c.choice}`:'')+(c.late?' (늦음)':''),cls:'st'+(c.act==='처리 못 함'?' bad':'')},{t:(c.subs||[]).join(', ')||'-',cls:'st'},{t:sc==null?'-':String(sc),cls:sc===0?'bad':sc!=null&&sc<60?'warn':''}]; }))); } }
    /* 7일차 보고 — 결과 · 보고서 칸별 점수 · 발표 질문 · (접기) 결정 · 보고서 원문 · 회고 */
    const e7=m.ep7; if(e7){ const s=sec('7일차 보고'); const kv=[];
      if(e7.ending) kv.push(['결과',`엔딩 ${e7.ending}${e7.endingName?' '+e7.endingName:''}`]); kv.push(['보고서',`${e7.total!=null?e7.total:'-'}/${e7.of}`]);
      if(e7.tableOk!=null) kv.push(['취합표',`${e7.tableOk}${e7.tableAll?'/'+e7.tableAll:''}칸 맞음`]); if(e7.calcOk!=null) kv.push(['계산',`${e7.calcOk}${e7.calcAll?'/'+e7.calcAll:''}칸 맞음`]);
      if(e7.violations.length) kv.push(['규정 위반',e7.violations.join(' / '),'bad']); s.appendChild(rsDl(kv));
      if(e7.report.some(f=>f.score!=null)) s.appendChild(rsTable([{t:'보고서 칸',w:'80%'},{t:'점수',num:true,w:'20%'}],e7.report.map(f=>[f.title,f.score!=null?`${f.score}/2`:'-'])));
      const qs=e7.questions.filter(q=>q.q); if(qs.length){ const t=h('h3','rsDay','발표 질문과 내 답'); s.appendChild(t); s.appendChild(rsTable([{t:'질문',w:'40%'},{t:'내 답',w:'48%'},{t:'점수',num:true,w:'12%'}],qs.map(q=>[q.q,q.answer||'-',q.score==null?'-':String(q.score)]))); }
      const dk=e7.decision.filter(f=>f.text).map(f=>[f.field,f.text]); if(e7.dropped) dk.push(['버린 안',e7.dropped]); if(e7.idea) dk.push(['아이디어',e7.idea]);
      const txt=e7.report.filter(f=>f.text);
      if(dk.length||txt.length||e7.reflection){ const inn=rsFold(s,'결정과 보고서 원문'); if(dk.length) inn.appendChild(rsDl(dk));
        for(const f of txt) inn.appendChild(rsText(`${f.title}${f.score!=null?` (${f.score}/2)`:''}`,f.text)); if(e7.reflection) inn.appendChild(rsText('회고',e7.reflection)); } }
    /* 내가 쓴 글(접기) */
    const wrote=[]; m.days.forEach(d=>d.cards.forEach(c=>c.texts.forEach(t=>wrote.push({d:d.d,title:c.title,label:t.label,text:t.text}))));
    if(wrote.length){ const s=sec('내가 쓴 글'); const inn=rsFold(s,`쓴 글 ${wrote.length}편 보기`); for(const x of wrote) inn.appendChild(rsText(`${x.d}일차 「${x.title}」 · ${x.label}`,x.text)); } }
   // Keep the existing report CSS font fallback; demo CSP excludes the optional CDN font.
   wrap.replaceChildren();wrap.className='wrap rs rsWide';wrap.dataset.reportMode=isExample?'example':'actual';$('debrief').classList.add('rsPage');
   const nav=h('nav','rsNav'),body=h('div','rsBody'),sections=[];nav.setAttribute('aria-label','결과 목차');wrap.append(nav,body);
   const sec=(title,label)=>{const e=rsSec(body,title);sections.push([e,label||title]);return e;};
   const notice=h('div','gd-report-mode');notice.id='guidedReportNotice';notice.setAttribute('role','note');
   notice.append(h('b',null,isExample?'가상 7일 결과 예시 · 내 체험 점수가 아닙니다':isAuto?'3 / 3 자동 시연 완료 · 학생 직접 수행 평가가 아닙니다':'3 / 3 체험 완료 · 내 실제 체험 기록'));
   notice.append(h('p',null,isExample?'정식 학생 결과지와 같은 구성입니다. 이름·기록·점수는 화면을 보여 주기 위한 가상 데이터입니다. 내 체험 결과와 정식 성적에는 반영되지 않습니다.':isAuto?'자동 시연 또는 자동 시연 후 직접 조작한 별도 기록입니다. 원래 수동 체험은 보존되며, 이 시연의 행동·점수는 학생 평가 근거로 사용하지 않습니다.':'정식 학생 결과지와 같은 구성입니다. 세 업무의 실제 기록만 반영하며, 관찰이 부족한 역량은 미평가입니다. 그래프를 포함한 전체 구성은 가상 7일 예시에서 볼 수 있습니다.'));
   const switcher=h('div','foot');const toggle=(id,label,mode)=>{const b=mkBtn(label,'',()=>{render(mode);$(id).focus({preventScroll:true});});b.id=id;b.setAttribute('aria-pressed',String((mode==='example')===isExample));return b;};
   switcher.append(toggle('guidedReportActual',own.automated?'자동 시연 기록':'내 체험 결과','actual'),toggle('guidedReportExample','정식 7일 결과 예시 보기','example'));notice.append(switcher);body.append(notice);
   const hd=h('header','rsHead');hd.append(Object.assign(h('img','ws-brand-logo ws-result-logo'),{src:'assets/brand/worksim-logo-45436337f281.png',alt:'WORKSIM'}),h('h1',null,isExample?'가상 학생의 7일 결과':isAuto?'자동 시연 기록':'내 체험 결과'));
   hd.append(h('p','rsMeta',isExample?`${D.teamName} · 가상 기록 7일 · 전체 결과 구성 예시`:`${D.teamName} · ${isAuto?'자동 시연':'실제 체험'} 업무 ${m.exp.total}건 · 정식 성적과 별도`));body.append(hd);sections.push([hd,'요약']);
   const st=h('div','rsStats');const stat=(k,v)=>{const e=h('div');e.append(h('span',null,k),h('b',null,v));st.append(e);};
   stat('엔딩',m.ep7?.ending||'미실시');stat('7일차 보고서',m.ep7?`${m.ep7.total}/${m.ep7.of}`:'미실시');stat('업무 점수 평균',isAuto?'평가 제외':m.work.avg==null?'-':String(m.work.avg));body.append(st);
   if(isAuto){body.append(h('p','gd-assistance','자동 시연 행동은 업무 점수와 NCS 관찰 근거에서 제외합니다. 자동 중지 후 직접 조작한 부분도 원래 수동 기록과 섞지 않습니다.'));}
   if(!isExample&&!isAuto){body.append(h('p','rsNote',`이번 체험 처리 점수 ${own.result.score}점 / 100점 · 자료 수령, 근거 확인, 메일·전화 대응을 종합한 체험용 점수입니다.`));
    if(own.result.draftUsed)body.append(h('p','gd-assistance','초안 자동입력을 사용했습니다. 발송은 직접 실행했습니다. 메일 품질은 업무 점수에 반영하며, 독립적인 문서 작성 능력과 AI활용능력의 근거로 계산하지 않습니다.'));
   }
   renderWeek(body,m,sec);
   if(!isExample){
    const ncs=sections.find(x=>x[1]==='NCS 직업공통능력')?.[0];ncs?.append(h('p','rsNote','미평가 · 2일 이상·2과제 이상·관찰 가중치 3 이상의 근거가 필요합니다. 미평가를 0점으로 표시하지 않습니다. 안내에 따른 이동은 독립적인 담당자 탐색으로, 선택형 전화는 실제 발화 능력으로 평가하지 않습니다.'));
    const target=sections.find(x=>x[1]==='하위능력')?.[0];
    for(const title of ['강점','보완점'])if(!sections.some(x=>x[1]===title)){const s=sec(title);s.append(h('p','rsNote','미평가 · 이번의 짧은 체험만으로 정식 역량 수준을 판정하지 않습니다.'));body.insertBefore(s,target||null);}
    const exp=sections.find(x=>x[1]==='직무 경험')?.[0]?.querySelector('.rsMeta');if(exp)exp.textContent=exp.textContent.replace('7일 동안','이번 체험에서');
    const s=sec('7일차 보고');s.append(h('p','rsNote','미실시 · 체험에서는 7일차 보고서·발표를 진행하지 않았습니다. 가상 7일 결과 예시에서 정식 결과의 해당 구성을 확인할 수 있습니다.'));body.insertBefore(s,sections.find(x=>x[1]==='내가 쓴 글')?.[0]||null);
   }
   const ft=h('div','foot'),print=mkBtn('결과 인쇄 · PDF 저장','pri',()=>{const root=printView();root.classList.add('rp-print');const clear=()=>root.remove();addEventListener('afterprint',clear,{once:true});window.print();});print.id='guidedReportPrint';ft.append(print,mkBtn('처음부터 다시 체험','',actions.restart),mkBtn('제품 소개 보기','',actions.home));body.append(ft);
   const fine=h('div','rsFine');fine.append(h('p',null,NcsEval.STATEMENT),h('p',null,'이 결과는 브라우저 안에서만 표시되며 정식 참가자 성적에 저장되지 않습니다.'));body.append(fine);
   const ul=h('ul');sections.sort((a,b)=>a[0].compareDocumentPosition(b[0])&Node.DOCUMENT_POSITION_FOLLOWING?-1:1);for(const [s,label] of sections){const li=h('li'),b=mkBtn(label,'',()=>s.scrollIntoView({block:'start',behavior:'smooth'}));li.append(b);ul.append(li);}nav.append(ul);
   function printView(){
    const root=ResultPdf._html(m),title=root.querySelector('h1');
    title.textContent=isExample?'WORKSIM · 가상 7일 결과 예시':isAuto?'WORKSIM · 자동 시연 기록':'WORKSIM · 내 체험 결과';
    root.insertBefore(h('p','note',notice.querySelector('b').textContent+' · '+notice.querySelector('p').textContent),title.nextSibling);
    if(!isExample){for(const note of root.querySelectorAll('.note'))note.textContent=note.textContent.replace('7일 동안 받은 업무','이번 체험에서 받은 업무');
     if(!isAuto&&own.result.draftUsed)root.insertBefore(h('p','note','초안 자동입력 사용 · 독립 작성 능력은 미평가'),title.nextSibling);
    }
    return root;
   }

   window.GuidedStudentReport.current=Object.freeze({mode:isExample?'example':'actual',kind:snap.kind,automated:isAuto,model:m,printView});$('debrief').scrollTop=0;
  }
  render('actual');
 }
 window.GuidedStudentReport={mount,current:null};
})();
