/* ======================================================================
   자동 플레이(스모크 검사·시연) — 정답 행동·모범 답안·선택지 best 로 하루를 끝까지. __play.auto({path:'best'|'fail'})
   ====================================================================== */
(function(){
  const tick=()=>new Promise(r=>setTimeout(r,4));
  /* 앞 카드의 복귀 걸음이 끝날 때까지 기다린다 — busy 중에 다음 이동을 걸면 사무실이 「지금은 이동할 수 없어요」로 되돌린다 */
  async function idle(){ const O=office(); if(!O) return; let n=0; try{ O.freeze(true); }catch(e){}
    while(O.busy&&n<3000){ try{ O.step(0.5); }catch(e){} await tick(); n++; } try{ O.freeze(false); }catch(e){} }
  /* fn 은 이동을 시작하는 함수 — 사무실이 한가해진 뒤에 부른다 */
  async function pump(fn){ await idle(); const p=(typeof fn==='function')?fn():fn; let done=false, val; p.then(v=>{ done=true; val=v; },e=>{ done=true; console.error('자동 플레이 오류',e); }); const O=office(); if(O){ try{ O.freeze(true); }catch(e){} } let n=0;
    while(!done&&n<6000){ const O2=office(); if(O2&&O2.busy){ try{ O2.step(0.5); }catch(e){} } await tick(); n++; } if(O){ try{ O.freeze(false); }catch(e){} } return val; }
  function modelFor(c,which){ const spec=composeSpec(c,which==='reply2'?'second':null); if(spec.model&&!(which==='reply2'&&typeof c.alsoReply==='object'&&!c.compose)) return spec.model;
    if((c.scored===false&&c.mode==='story')||c.unscored||c.axis==='self') return c.axis==='self'||c.unscored?'① 오늘 반품 접수 건 — 이어받기 어려운 것은 회수 일정 조율\n② 물류 담당자와 말로 맞춘 부분이 있어서\n③ 먼저 볼 것: 오늘 접수 목록과 물류 회신 메일':'ㅋㅋ 나도 정신없어. 점심 같이 먹자, 12시 1층!';
    const who=(which==='reply2'?(typeof c.alsoReply==='object'?c.alsoReply.to:(c.alsoReplyTo||'고객')):(c.from||'').replace(/\s*\(.*?\)/,'')); const vals=spec.mustInclude.join(', '); const rules=spec.ruleFacts.length?`(${spec.ruleFacts.join(', ')})`:'';
    /* 제목에 금지 표현이 섞여 있으면 제목을 빼고 쓴다(모범 답안은 금지 표현을 밟지 않아야 한다) */
    const banned=(spec.forbid||[]).some(k=>k&&(c.subj||'').includes(k)); const about=banned?'보내 주신 내용':`문의 주신 ${c.subj} 건`;
    /* 참조가 정답인 카드: 원인 확인을 맡을 팀을 본문에 적는다 */
    const cc=(c.ccTeams||[]).map(k=>TEAM_NAMES[k]||k); const ccLine=cc.length?` 원인 확인은 ${cc.join(' · ')}에 함께 요청드리며 참조로 넣었습니다.`:'';
    if(c.type==='msg') return `${who}님, ${D.teamName} ○○○입니다. 말씀하신 건 확인했습니다. ${vals}${rules} 기준으로 안내드리며, 오늘 중 처리해 두겠습니다.${ccLine}`;
    return `${who} 님, 안녕하세요. ${D.teamName} ○○○입니다.\n${about} 확인했습니다.\n${vals}${rules} 기준으로 안내드립니다. 접수했고, 처리 결과는 오늘 중 다시 회신드리겠습니다.${ccLine}\n감사합니다.`; }
  function bestIndex(keys,scores,best){ if(best&&keys.includes(best)) return keys.indexOf(best); let bi=0; keys.forEach((k,i)=>{ if((scores[k]||0)>(scores[keys[bi]]||0)) bi=i; }); return bi; }
  async function playCard(c,opt){ const id=c.id; const st=S.cards[id]; const flow=flowOf(c); openCard(id); const fail=opt.fail&&!opt.failed;
    if(c.followup){ doButton(id,'confirm'); return; }
    if(c.recordLookup&&!st.lookup){ st.lookup=true; }
    if(c.actions&&c.actions.stopShip) st.stopShip=true;
    if(c.mode==='phone'){ const keys=c.choiceOrder||Object.keys(c.choices); let k=c.best; if(fail){ k=keys.find(x=>x!==c.best&&c.act[x]&&c.act[x][0]<=20)||keys.find(x=>x!==c.best); opt.failed=id; } doPhone(id,k); return; }
    if(c.mode==='visit'){ const keys=c.choiceOrder||Object.keys(c.choices); await pump(()=>doVisit(id,keys.indexOf(c.best))); return; }
    if(c.mode==='reflect'){ doPick(id,(c.answerAny||[])[0]||S.order[0]); return; }
    if(flow.includes('work')){ const cells=workCells(c); doWork(id,cells?Object.fromEntries(cells.map(x=>[x.key,String(x.answer)])):c.workAnswer); if(c.deliver&&S.cards[id].status!=='done'){ const keys=Object.keys(c.deliver.choices||{}); const bi=bestIndex(keys,c.deliver.score||{},null); await pump(()=>doSheetDeliver(id,bi)); } return; }
    if(flow.includes('approval')){ let text=modelFor(c); if(!c.compose) text='반려합니다. '+(c.mustFlag||[]).join(' · ')+' 기준이 규정과 다릅니다. 맞는 합계는 '+(c.workAnswer||'')+'입니다.'; await sendCompose(id,text,'approval','reject',c.workAnswer||null); return; }
    if(flow.includes('report')){ const rp=c.report||c; const keys=Object.keys(rp.choices||{}); const bi=bestIndex(keys,rp.score||{},c.best); await pump(()=>doReport(id,bi)); if(flow.includes('reply')&&S.cards[id].status!=='done') await sendCompose(id,modelFor(c),'reply','reply',null); return; }
    if(flow.includes('deliver')){ const d=D.dests.find(x=>x.name===c.deliver.npc)||{name:c.deliver.npc,seat:seatByName(c.deliver.npc),key:c.deliver.to,team:TEAM_NAMES[c.deliver.to]||''}; await pump(()=>doDeliver(id,d,true)); if(flow.includes('reply')&&S.cards[id].status!=='done') await sendCompose(id,modelFor(c),'reply','reply',c.workAnswer&&!flow.includes('work')?c.workAnswer:null); return; }
    if(flow.includes('ask')){ const d=D.dests.find(x=>x.name===c.npc)||{name:c.npc,seat:seatByName(c.npc),key:c.to,team:TEAM_NAMES[c.to]||''}; await pump(()=>doAsk(id,d,rightQ(c))); await sendCompose(id,modelFor(c),'reply','reply',c.workAnswer||null); return; }
    /* 회신형 */
    /* 최선이 단추 행동(넘기기·보류 등)이면 그 단추를 누른다. 여기서 `hasCompose` 를 보면 안 된다 —
       모범 답안을 붙였다는 이유만으로 자동 플레이가 회신을 쓰러 가서 `act.reply` 상한에 걸렸다(qc37 100→30).
       학생 화면은 `cards.js:91` 이 단추 행동에 `hasCompose` 를 보지 않아 처음부터 영향이 없었다.
       `alsoReply` 도 조건에서 뺐다 — `doButton` → `record` 가 카드를 즉시 완료 처리하므로 단추를 누르면
       뒤따르는 회신 단계가 애초에 발동하지 않는다. 학생이 얻을 수 있는 최고점이 곧 그 단추다(ac32 73→100). */
    let key='reply'; if(c.best&&['reject','confirm'].includes(c.best)&&(hasCompose(c)||c.alsoReply)) key=c.best; else if(c.best&&c.act&&c.act[c.best]&&!['reply','reject','confirm'].includes(c.best)){ doButton(id,c.best); return; }
    if(c.best==='confirm'&&!hasCompose(c)&&!c.alsoReply){ doButton(id,'confirm'); return; }
    if(c.best==='reject'&&!hasCompose(c)){ doButton(id,'reject'); return; }
    let text=modelFor(c); if(fail&&c.compose&&c.compose.forbid&&c.compose.forbid[0]){ text=text+' '+c.compose.forbid[0]; opt.failed=id; }
    await sendCompose(id,text,'reply',key,c.workAnswer||null);
    if(flow.includes('reply2')&&S.cards[id].status!=='done') await sendCompose(id,modelFor(c,'reply2'),'reply2','reply',null); }
  async function autoDay(opt){ if(S.phase==='briefing') endBriefing();
    if(S.phase==='triage'&&S.triage){ const T=D.triage; for(const id of S.triage.ids){ S.triage.assign[id]=(T.now||[]).includes(id)||!(T.cards||[]).includes(id)?'now':(T.morning||[]).includes(id)?'morning':'today'; } finishTriage(); }
    let guard=0;
    while(guard++<200){ const all=D.cards.concat(S.extra); const pending=all.filter(c=>S.cards[c.id]&&S.cards[c.id].arrived&&S.cards[c.id].status!=='done').sort((a,b)=>S.cards[a.id].arrivedAt-S.cards[b.id].arrivedAt);
      if(pending.length){ let moved=false;
        for(const c of pending){ if(S.cards[c.id].status==='done') continue;
          opt.tries=opt.tries||{}; opt.tries[c.id]=(opt.tries[c.id]||0)+1;
          if(opt.tries[c.id]>6) throw new Error(`자동 플레이가 카드를 끝내지 못했습니다: ${c.id} (${opt.tries[c.id]}회 시도)`);
          await playCard(c,opt); opt.n=(opt.n||0)+1; moved=true; await tick();
          if(opt.limit&&opt.n>=opt.limit){ saveProgress(true); return {stopped:true,played:opt.n}; } }
        if(moved) continue; }
      const waiting=all.filter(c=>S.cards[c.id]&&!S.cards[c.id].arrived&&(!c.requires||(S.cards[c.requires.card]&&S.cards[c.requires.card].delivered))); if(!waiting.length) break;
      const next=Math.min.apply(null,waiting.map(c=>S.cards[c.id].readyAt!=null?S.cards[c.id].readyAt:c.arrive)); if(next>=D.minutes){ break; } advance(next-S.t+0.05); }
    if(!S.ended) advance(D.minutes-S.t+0.1); finish(); return P.done[String(S.ep)]; }
  /* opts.limit 을 주면 그만큼만 처리하고 멈춘다(이어 하기 검사용) */
  window.__play.auto=async function(opts={}){ const opt={fail:opts.path==='fail',limit:opts.limit||0,n:0}; if(D&&D.kind==='ep7') return EP7.auto(opts); return autoDay(opt); };
})();
