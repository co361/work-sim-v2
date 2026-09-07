/* ======================================================================
   카드 — 메일함 · 카드 창 · 카드 종류별 행동(회신·작성·전화·전달·질문·보고·방문·양식·결재·체인·분기·반성) · 분기 · 기록
   ====================================================================== */

/* ---------- 카드 흐름(단계) ---------- */
function hasCompose(c){ return !!(c.compose||c.replyCheck); }
function isTextCard(c){ return c.type==='email'||c.type==='msg'||c.type==='comment'; }
function flowOf(c){ const m=c.mode; const steps=[];
  if(c.followup) return ['confirm'];
  if(m==='phone') return ['phone'];
  if(m==='visit') return ['visit'];
  if(m==='reflect') return ['pick'];
  if(m==='sheet'||c.type==='sheet'||(!c.compose&&Array.isArray(c.workAnswers)&&c.workAnswers.length)){ steps.push('work'); if(c.deliver) steps.push('deliver'); return steps; }
  if(m==='approval'||c.type==='approval') return ['approval'];
  if(m==='report'||c.type==='report'){ steps.push('report'); if(c.alsoReply||hasCompose(c)) steps.push('reply'); return steps; }
  if(c.deliver&&typeof c.deliver==='object'){ steps.push('deliver'); if(c.alsoReply||hasCompose(c)) steps.push('reply'); return steps; }
  if(m==='ask'){ return ['ask','reply']; }
  steps.push('reply'); if(typeof c.alsoReply==='object'||(c.alsoReply===true&&!c.deliver)) steps.push('reply2'); return steps; }
function requiredSteps(c){ return flowOf(c).filter(s=>s!=='ask'); }   /* 질문은 안 하고 답해도 되지만 상한이 걸린다 */
function stepsLeft(id){ const c=CARD(id), st=S.cards[id]; return requiredSteps(c).filter(s=>!(st.steps&&st.steps[s])); }
function markStep(id,name,data){ const st=S.cards[id]; st.steps=st.steps||{}; st.steps[name]=Object.assign({at:S.t},data||{}); st.status='read'; if(!stepsLeft(id).length) finalize(id); else { renderInbox(); renderCounts(); if(S.cur===id) renderCardActs(id); saveProgress(); } }
function rightQ(c){ if(c.rightQ!=null) return c.rightQ; if(c.gotValues&&c.gotValues.length){ let bi=0; c.gotValues.forEach((v,i)=>{ if(v>c.gotValues[bi]) bi=i; }); return bi; } const br=(D.branches&&D.branches[c.id])||{}; if(br.q1&&!br.q2&&!br.q3) return 1; return 0; }
function askAnswers(c){ if(c.answers&&c.answers.length) return c.answers; const r=rightQ(c); const br=(D.branches&&D.branches[c.id])||{}; return (c.question||[]).map((q,i)=>{ if(i===r) return c.answer||'…'; const b=br['q'+(i+1)]; if(b&&b.now&&b.now.text) return b.now.text; return '그건 제가 답할 게 아닌데요. 다른 걸 물으신 거 아니에요?'; }); }
function askCap(c,i){ const r=rightQ(c); if(i===r) return 100; if(c.gotValues){ const v=c.gotValues[i]||0, mx=Math.max.apply(null,c.gotValues)||1; return v<=0?40:Math.max(40,Math.round(100*v/mx)); } const b=(D.branches&&D.branches[c.id]||{})['q'+(i+1)]; if(b&&b.today){ const m=b.today.match(/(\d{2,3})/); if(m) return +m[1]; } return i===r?100:(i<r?60:40); }

/* ---------- 메일함 ----------
   대표 "너무 산만해. 메신저와 이메일은 분리된 창에서 떴으면 좋겠고."
   메일함에는 **메일만** 남긴다. 메신저(💬)는 사내 메신저 창, 전화(☎)는 전화 벨과
   전화 메모 앱으로 간다. 한 창 안에서 종류를 섞지 않는 것이 그 지적의 핵심이다. */
const inMail=(c)=>!!c&&c.type!=='msg'&&c.type!=='phone';
function renderInbox(){ const list=$('list'); if(!list) return; list.innerHTML=''; const ids=S.order.slice().reverse().filter(i=>inMail(CARD(i))); const left=ids.filter(i=>S.cards[i].status!=='done'&&S.cards[i].status!=='skipped').length; $('inboxN').textContent=ids.length?`${left}건 남음`:'';
  if(window.Msg&&window.Msg.refresh) window.Msg.refresh();
  if(window.Tel&&window.Tel.refresh) window.Tel.refresh();
  if(typeof renderPhoneBar==='function') renderPhoneBar();
  if(!ids.length){ list.appendChild(h('div','empty-msg','아직 도착한 메일이 없어요')); return; }
  for(const id of ids){ const c=CARD(id), st=S.cards[id]; if(!c) continue; const b=document.createElement('button'); b.type='button'; b.className='mail '+(st.status==='new'?'new':'')+(st.status==='done'?' done':'')+(S.cur===id?' cur':'')+(c.pre?' pre':''); b.onclick=()=>openCard(id);
    const r1=h('div','r1'); const u=h('span','u u'+Math.min(4,c.urgent||1)); const f=h('span','from',(c.type==='visit'?'🚪 ':c.npcArrives?'👋 ':c.type==='approval'?'📋 ':c.type==='sheet'?'📊 ':c.type==='comment'?'🗨 ':'')+c.from); const at=h('span','at',fmtClock(st.arrivedAt||0)); r1.append(u,f,at);
    const sj=h('div','sj',c.subj); b.append(r1,sj);
    if(st.status==='done'){ const sc=h('div','sc'+(st.score==null?'':st.score>=80?' hi':st.score<50?' lo':'')); sc.textContent=st.score==null?'답장함':`${actLabel(st.act)} · ${st.score}점`; b.appendChild(sc); }
    else if(st.steps&&Object.keys(st.steps).length){ b.appendChild(h('div','sc','진행 중 · '+stepsLeft(id).map(stepLabel).join('·')+' 남음')); }
    else if(st.late){ b.appendChild(h('div','sc lo','마감 지남')); }
    list.appendChild(b); } }
function stepLabel(s){ return {reply:'회신',reply2:'안내 회신',deliver:'전달',ask:'질문',work:'검산',report:'보고',phone:'전화',visit:'응대',approval:'검토',pick:'선택',confirm:'확인'}[s]||s; }
function renderCounts(){ if(!D) return; const main=D.cards.filter(c=>!c.pre); const done=main.filter(c=>S.cards[c.id]&&S.cards[c.id].status==='done'&&S.cards[c.id].act!=='none').length; $('cDone').textContent=done; $('cAll').textContent=main.length; $('cPass').textContent=S.counts.pass; $('cAsk').textContent=S.counts.ask;
  /* 남은 일이 없으면 퇴근 시각 전에도 마무리할 수 있게 한다(day.js) */
  try{ if(typeof checkAllDone==='function') checkAllDone(); }catch(e){}
  /* 머리 위 「E — 서류 전달하기」 안내를 오늘 남은 일에 맞춰 갈아 끼운다 */
  try{ if(typeof refreshTalkHints==='function') refreshTalkHints(); }catch(e){}
  const arrived=(ids)=>(ids||[]).filter(i=>S.cards[i]&&S.cards[i].arrived&&S.cards[i].status!=='done').length; const L=D.todoLabels||['답할 것','넘길 것','물어볼 것']; $('tAnsL').textContent=L[0]; $('tPassL').textContent=L[1]; $('tAskL').textContent=L[2]; $('tAns').textContent=arrived(D.todo.answer); $('tPass').textContent=arrived(D.todo.pass); $('tAsk').textContent=arrived(D.todo.ask); }

/* ---------- 카드 창 ---------- */
function openCard(id){ const c=CARD(id), st=S.cards[id]; if(!c||!st.arrived) return; if(S.composing&&S.composing.id!==id) closeComposer(); S.cur=id; if(st.status==='new') st.status='read';
  $('card').classList.add('open'); $('card').classList.remove('min'); const kind=c.type==='phone'?'전화':c.type==='msg'?'메신저':c.type==='visit'?'방문':c.type==='approval'?'결재 검토':c.type==='sheet'?'양식':c.type==='report'?'대면 보고':c.type==='comment'?'댓글':c.npcArrives?'대면':'메일'; $('cFrom').textContent=kind+' · '+c.from+(c.role?` (${c.role})`:''); $('cSubj').textContent=c.subj;
  renderBody(c); $('hintTx').textContent=c.hint||'이건 힌트 없이 해 봐요.'; renderCardActs(id); renderInbox(); if(window.innerWidth<=760) $('inbox').classList.remove('up'); showTab('hint'); }
function renderBody(c){ const bd=$('cBody'); bd.className='bd'+(c.type==='phone'?' phone':c.type==='sheet'||c.type==='approval'?' doc':''); bd.innerHTML='';
  const body=c.body||''; if(c.type==='sheet'&&/\n.*\|.*\|/.test(body)){ /* 파이프 표를 HTML 표로 */ const lines=body.split('\n'); let tbl=null; for(const ln of lines){ if(ln.includes('|')){ if(!tbl){ tbl=document.createElement('table'); tbl.className='sheet'; bd.appendChild(tbl); } const tr=document.createElement('tr'); ln.split('|').forEach(x=>{ const td=document.createElement(tbl.rows.length===0?'th':'td'); td.textContent=x.trim(); tr.appendChild(td); }); tbl.appendChild(tr); } else { tbl=null; const p=h('div',null,ln); bd.appendChild(p); } } }
  else bd.textContent=body; }
function closeCard(){ $('card').classList.remove('open'); S.cur=null; closeComposer(); renderInbox(); }
function note(html){ const n=$('cNote'); if(!html){ n.style.display='none'; n.textContent=''; return; } n.style.display='block'; n.innerHTML=html; }
function lockBtn(acts){ if(!D) return; for(const k of ['approval','report']){ if((D.unlock||[]).includes(k)) continue; acts.appendChild(mkBtn('🔒 '+UNLOCK_LABEL[k],'lock',()=>toast(`${UNLOCK_DAY[k]}일차에 열립니다.`))); } }
function composerLabel(c,k){ if(k==='reject') return '거절 회신 쓰기'; if(k==='confirm') return c.alsoReply||hasCompose(c)?'상신하고 고객 안내 쓰기':'상신 사유 쓰기'; return c.type==='msg'?'답장 쓰기':'회신 쓰기'; }
function renderCardActs(id){ const c=CARD(id), st=S.cards[id]; const acts=$('cActs'); acts.innerHTML=''; $('composer').style.display='none'; note('');
  if(st.status==='done'){ showResult(id); return; } $('cResult').style.display='none';
  const steps=st.steps||{}; const flow=flowOf(c); const notes=[];
  if(c.recordLookup){ const rl=c.recordLookup; if(st.lookup) notes.push(`<b>상담 기록:</b> ${escapeHtml(rl.result)}`); else acts.appendChild(mkBtn(rl.label||'상담 기록 조회','',()=>{ st.lookup=true; S.ncs['7'].push(100); renderCardActs(id); })); }
  if(c.actions&&c.actions.stopShip){ const a=c.actions.stopShip; const b=mkBtn((st.stopShip?'✓ ':'')+a.label,st.stopShip?'on':'',()=>{ st.stopShip=!st.stopShip; toast(st.stopShip?'물류팀에 출고 중지를 요청했어요.':'출고 중지 요청을 취소했어요.'); renderCardActs(id); }); acts.appendChild(b); }
  if(c.followup){ notes.push('재문의예요. 읽고 확인을 누르면 됩니다. (채점 없음)'); acts.appendChild(mkBtn('확인했어요','pri',()=>record(id,{act:'confirm',score:null,comment:''}))); note(notes.join('<br>')); return; }
  if(c.mode==='phone'){ notes.push('전화입니다. 어떻게 응대할까요?'); for(const k of (c.choiceOrder||Object.keys(c.choices||{}))) acts.appendChild(mkBtn(c.choices[k],'wide',()=>doPhone(id,k))); note(notes.join('<br>')); return; }
  if(c.mode==='visit'){ notes.push('방문객이 와 있어요. 응대하러 갑니다.'+(c.timeLimit?` (${c.timeLimit}초 안에 답해야 해요)`:'')); acts.appendChild(mkBtn('응대하러 가기','pri',()=>doVisit(id))); note(notes.join('<br>')); return; }
  if(c.mode==='reflect'){ notes.push('오늘 처리한 카드 중 하나를 골라 답장합니다.'); acts.appendChild(mkBtn('답장할 카드 고르기','pri',()=>renderPick(id))); note(notes.join('<br>')); return; }
  if(flow.includes('work')&&!steps.work){ notes.push(workCells(c)?`답 칸 ${workCells(c).length}개를 채워 제출하세요.`:('답 칸에 검산 결과를 적어 제출하세요.'+(c.workAnswer&&/원|건|일|%/.test(c.workAnswer)?' 단위까지 적어요.':''))); renderWorkInput(id,acts); if(st.workTries) notes.push(`<b>다시 세어 보세요.</b> (${st.workTries}번째)`); note(notes.join('<br>')); return; }
  if(flow.includes('work')&&steps.work&&!steps.deliver){ notes.push(`<b>검산 결과 ${escapeHtml(steps.work.answer)}.</b> 이제 ${escapeHtml(c.deliver.npc||'팀장')}에게 직접 가져가세요.`); acts.appendChild(mkBtn(`${c.deliver.npc||'팀장'}에게 가져가기`,'pri',()=>doSheetDeliver(id))); note(notes.join('<br>')); return; }
  if(flow.includes('approval')){ notes.push('결재 문서예요. 숫자와 규정이 맞으면 승인, 어긋나면 반려하면서 의견을 적어요.'); acts.appendChild(mkBtn('반려 의견 쓰기','pri',()=>openComposer(id,'approval'))); acts.appendChild(mkBtn('이상 없음(승인)','',()=>doApprove(id))); for(const k of Object.keys(c.act||{})){ if(['reply','reject','approve'].includes(k)) continue; acts.appendChild(mkBtn(actLabel(k),'',()=>doButton(id,k))); } lockBtn(acts); note(notes.join('<br>')); return; }
  if(flow.includes('report')&&!steps.report){ const who=c.npc||(c.report&&c.report.npc)||D.dests.find(d=>d.seat==='lead').name; notes.push(`팀장에게 직접 보고하는 건이에요. 근거를 들고 가세요.`); acts.appendChild(mkBtn(`${who}에게 보고하러 가기`,'pri',()=>doReport(id))); if(c.mode!=='report'||c.type!=='report'){ for(const k of Object.keys(c.act||{})){ if(k==='confirm'||k==='reply') continue; acts.appendChild(mkBtn(actLabel(k),'',()=>doButton(id,k))); } if(c.act&&c.act.confirm) acts.appendChild(mkBtn('메일로 상신','',()=>doButton(id,'confirm','mailConfirm'))); } lockBtn(acts); note(notes.join('<br>')); return; }
  if(flow.includes('report')&&steps.report&&!steps.reply){ notes.push(`<b>보고 끝.</b> ${escapeHtml(steps.report.line||'')}<br>이제 고객에게 회신하세요 — 결론은 아직 쓰지 않아요.`); acts.appendChild(mkBtn('고객에게 회신','pri',()=>openComposer(id,'reply'))); note(notes.join('<br>')); return; }
  /* 전달 · 질문 */
  if(flow.includes('deliver')||flow.includes('ask')){ const isAsk=flow.includes('ask'); const d=c.deliver||{}; const who=isAsk?c.npc:d.npc;
    if(st.ask){ notes.push(`<b>${escapeHtml(who)} 답:</b> "${escapeHtml(st.ask.answer)}"<br>받은 답을 회신에 옮겨 적으세요.`); }
    else if(isAsk&&!steps.reply){ if(st.wrong) notes.push(`<b>다시 가 볼 수 있어요.</b> ${escapeHtml(st.wrong)}`); acts.appendChild(mkBtn('가서 물어보기','pri',()=>renderDest(id,'ask'))); }
    if(!isAsk){ if(steps.deliver){ notes.push(`<b>${escapeHtml(who)}에게 전달 완료.</b> ${escapeHtml(steps.deliver.line||'')}`+(flow.includes('reply')&&!steps.reply?`<br>이제 ${c.alsoReply===true&&c.alsoReplyTo?escapeHtml(c.alsoReplyTo):'고객'}에게 어디로 넘어갔는지 안내 회신을 보내세요.`:'')); }
      else { if(st.wrong) notes.push(`<b>다시 가 볼 수 있어요.</b> ${escapeHtml(st.wrong)}`); acts.appendChild(mkBtn('가서 전달하기','pri',()=>renderDest(id,'deliver'))); } }
    if(flow.includes('reply')&&!steps.reply){ acts.appendChild(mkBtn(st.ask||steps.deliver?'회신 쓰기':(isAsk?'묻지 않고 회신 쓰기':'회신 쓰기'),st.ask||steps.deliver?'pri':'',()=>openComposer(id,'reply'))); }
    for(const k of Object.keys(c.act||{})){ if(k==='delegate'||k==='reply'||(c.best===k&&k!=='hold')) continue; acts.appendChild(mkBtn(actLabel(k),'',()=>doButton(id,k))); }
    if(c.act&&c.act.hold&&c.best!=='hold'&&!acts.querySelector('[data-k=hold]')){ } lockBtn(acts); note(notes.join('<br>')); return; }
  /* 회신형 · 작성형 · 메신저 · 거절 · 상신 · 기록 */
  if(c.unscored||c.axis==='self') notes.push('기록용이에요. 점수에는 넣지 않습니다.');
  if(typeof c.alsoReply==='object'&&steps.reply&&!steps.reply2) notes.push(`<b>${escapeHtml(c.from)}에게 답장 완료.</b> 이제 ${escapeHtml(c.alsoReply.to)}에게 정정 안내를 보내세요.`);
  else if(c.alsoReply===true&&steps.reply&&!steps.reply2) notes.push(`<b>답장 완료.</b> 이제 ${escapeHtml(c.alsoReplyTo||'고객')}에게 안내 회신을 보내세요.`);
  if(steps.reply&&flow.includes('reply2')&&!steps.reply2){ acts.appendChild(mkBtn(`${c.alsoReplyTo||(typeof c.alsoReply==='object'?c.alsoReply.to:'고객')}에게 안내 회신`,'pri',()=>openComposer(id,'reply2'))); note(notes.join('<br>')); return; }
  const keys=Object.keys(c.act||{}); if(!keys.includes('reply')&&c.scored!==false&&isTextCard(c)) keys.unshift('reply');
  for(const k of keys){ const textual=(k==='reply')||(k===c.best&&(hasCompose(c)||c.alsoReply)&&['reject','confirm'].includes(k)); if(textual) acts.appendChild(mkBtn(composerLabel(c,k),k===c.best||c.scored===false?'pri':'',()=>openComposer(id,'reply',k))); else acts.appendChild(mkBtn(actLabel(k),'',()=>doButton(id,k))); }
  if(c.scored!==false) lockBtn(acts); note(notes.join('<br>')); }
function renderWorkInput(id,acts){ const c=CARD(id); const cells=workCells(c); const wrap=h('div','work'+(cells?' multi':''));
  if(cells){ const box=h('div','wcells'); const ins={};
    for(const cell of cells){ const row=h('div','wrow'); row.appendChild(h('label',null,cell.label||cell.key)); const inp=document.createElement('input'); inp.type='text'; inp.autocomplete='off'; inp.placeholder=cell.hint||''; ins[cell.key]=inp; row.appendChild(inp); if(cell.unit) row.appendChild(h('span','unit',cell.unit)); box.appendChild(row); }
    wrap.appendChild(box); wrap.appendChild(mkBtn('검산 제출','pri',()=>{ const got={}; for(const k of Object.keys(ins)) got[k]=ins[k].value.trim(); doWork(id,got); }));
    acts.appendChild(wrap); setTimeout(()=>{ const f=ins[cells[0].key]; if(f) f.focus(); },50); return; }
  const inp=document.createElement('input'); inp.type='text'; inp.id='workAns'; inp.placeholder=c.workHint||'답 (예: 6건, 62,000원)'; inp.autocomplete='off'; wrap.appendChild(inp); wrap.appendChild(mkBtn('검산 제출','pri',()=>doWork(id,inp.value))); acts.appendChild(wrap); setTimeout(()=>inp.focus(),50); }
function renderDest(id,kind){ const c=CARD(id); const acts=$('cActs'); acts.innerHTML=''; note(kind==='ask'?'누구에게 물어볼까요? 조직도를 떠올려 보세요.':'누구에게 전달할까요? 카드 내용을 보고 맞는 팀을 고르세요.');
  const dests=D.dests.filter(d=>d.seat!=='lead'||(c.deliver&&c.deliver.npc===d.name)); const target=kind==='ask'?c.npc:(c.deliver&&c.deliver.npc);
  const list=dests.slice(); if(target&&!list.some(d=>d.name===target)){ const info=npcInfo(target); list.push({seat:info&&info.seat,name:target,team:info?info.team:'',key:info?info.teamKey:''}); }
  for(const d of list){ acts.appendChild(mkBtn(`${d.name} · ${d.team}`,'wide',()=>kind==='ask'?doAsk(id,d):doDeliver(id,d))); } acts.appendChild(mkBtn('돌아가기','',()=>renderCardActs(id))); }
function renderPick(id){ const c=CARD(id); const acts=$('cActs'); acts.innerHTML=''; note('규정에 근거가 있을 것 같은 건 어느 것이었나요?');
  const cands=S.order.filter(i=>i!==id&&CARD(i)&&!CARD(i).followup&&CARD(i).scored!==false); for(const i of cands){ acts.appendChild(mkBtn(CARD(i).subj,'wide',()=>doPick(id,i))); } acts.appendChild(mkBtn('돌아가기','',()=>renderCardActs(id))); }
function showResult(id){ const c=CARD(id), st=S.cards[id]; const r=$('cResult'); r.style.display='block'; r.innerHTML=''; $('cActs').innerHTML='';
  const sc=h('div','score',st.score==null?(st.act==='none'?'미처리':'답장함'):String(st.score)); if(st.score!=null){ sc.appendChild(h('small',null,`${actLabel(st.act)}${st.late?' · 마감 지남':' · 제때'}`)); } if(st.source) sc.appendChild(h('span','src '+(st.source==='AI 첨삭'?'ai':''),st.source)); r.appendChild(sc);
  if(st.comment) r.appendChild(h('div','cm',st.comment));
  for(const d of [st.detail,st.detail2]){ if(!d||!d.els) continue; const els=h('div','els'); for(const [k,v] of Object.entries(d.els)) els.appendChild(h('span','el '+(v?'on':''),k)); if(d.cited===false) els.appendChild(h('span','el bad','조항 인용 없음')); for(const m of (d.missing||[])) els.appendChild(h('span','el bad','빠짐: '+m)); for(const f of (d.forbid||[])) els.appendChild(h('span','el bad','금지 표현: '+f)); if(d.partial) els.appendChild(h('span','el bad','답이 절반')); r.appendChild(els); }
  if(st.feedback){ r.appendChild(h('div','fb',st.feedback)); }
  for(const [label,txt] of [['내가 쓴 답장',st.text],['내가 쓴 안내 회신',st.text2]]){ if(!txt) continue; const d=document.createElement('details'); d.appendChild(h('summary',null,label)); d.appendChild(h('pre',null,txt)); r.appendChild(d); }
  const model=composeSpec(c).model; if(model&&(st.text!=null||st.text2!=null)){ const d=document.createElement('details'); d.appendChild(h('summary',null,'모범 답안 보기')); d.appendChild(h('pre',null,model)); r.appendChild(d); }
  const m2=typeof c.alsoReply==='object'&&c.compose?null:null; if(m2){} }

/* ---------- 작성기 ---------- */
function openComposer(id,which,key){ const c=CARD(id); which=which||'reply'; S.composing={id,which,key:key||'reply'}; const box=$('composer'); box.style.display='block';
  const to=which==='reply2'?(typeof c.alsoReply==='object'?c.alsoReply.to:(c.alsoReplyTo||'고객')):(which==='approval'?c.from:(c.from||'')); $('cpTo').textContent=to; $('cpSubj').textContent=(which==='approval'?'[반려] ':'RE: ')+c.subj;
  const ta=$('composeText'); ta.value=''; $('cpLen').textContent='0자'; ta.placeholder=which==='approval'?'반려 사유와 맞는 값을 적어 주세요.':c.type==='msg'?'메신저는 짧게, 용건과 다음 행동만.':(key==='reject'?'안 되는 이유(조항)와 대안을 함께 적어요.':'고객이 무엇을 원하는지 한 줄로 먼저 적고, 답장을 써 보세요.');
  const needWork=!!c.workAnswer&&!(flowOf(c).includes('work')); const wa=$('cpWork'); wa.style.display=needWork?'flex':'none'; $('cpWorkIn').value=''; if(needWork) $('cpWorkIn').placeholder=c.workHint||'결과값 (예: 39일, 62,000원)';
  const spec=composeSpec(c,which==='reply2'?'second':null); $('cActs').innerHTML='';
  const tips=[]; if(spec.mustInclude.length) tips.push(`반드시 들어갈 값 ${spec.mustInclude.length}가지`); if(spec.ruleFacts.length&&(D.unlock||[]).includes('rulebook')) tips.push('근거 조항 번호를 붙여요(오른쪽 사규집)'); if(!tips.length) tips.push('인사 · 확인 · 답 · 다음 행동 · 맺음, 다섯 가지를 담아 보세요.');
  note(escapeHtml(tips.join(' · ')));
  const md=aiOn()?'AI 첨삭':'규칙 채점'; $('cpMode').textContent=md; $('cpMode').className='mode'+(aiOn()?' ai':''); setTimeout(()=>ta.focus(),50); }
function closeComposer(){ S.composing=null; $('composer').style.display='none'; }
$('composeText').addEventListener('input',e=>{ $('cpLen').textContent=e.target.value.length+'자'; });
$('composeCancel').onclick=()=>{ const cp=S.composing; closeComposer(); if(cp) renderCardActs(cp.id); };
$('composeSend').onclick=()=>{ const cp=S.composing; if(!cp) return; const text=$('composeText').value.trim(); if(text.replace(/\s/g,'').length<8){ toast('내용이 너무 짧아요. 한 줄이라도 용건을 적어 주세요.'); return; } const ans=$('cpWork').style.display!=='none'?$('cpWorkIn').value.trim():null; sendCompose(cp.id,text,cp.which,cp.key,ans); };

/* 작성 제출: 규칙 채점 → (있으면) AI 첨삭 → 단계 기록 */
async function sendCompose(id,text,which,key,ans){ const c=CARD(id), st=S.cards[id]; which=which||'reply'; key=key||'reply'; closeComposer(); $('composeSend').disabled=true;
  try{
    if(which==='approval') return await sendApproval(id,text,ans);
    const isSecond=which==='reply2'; if(isSecond) st.text2=text; else st.text=text;
    /* 무채점(동기 메신저·기록용) */
    if((c.scored===false&&c.mode==='story')||c.unscored||c.axis==='self'){ st.source=null; if(c.clue&&c.clue.requiresReply) captureClue(c,st,true); markStep(id,which,{text}); if(!stepsLeft(id).length){} runBranch(id,'reply'); return; }
    const spec=composeSpec(c,isSecond?'second':null); const g=gradeText(c,text,spec); let score=g.score, comment=(c.act&&c.act[key]&&c.act[key][1])||''; let source='규칙 채점'; let feedback='';
    const ai=await gradeWithAI(c,text,spec,g); if(ai){ score=ai.score; g.els=ai.els; source=ai.source; feedback=ai.feedback; }
    /* 계산값 */
    if(ans!=null&&c.workAnswer){ const w=checkWork(c,ans); st.answer=ans; st.workOk=w.ok; S.counts.calcAll++; if(w.ok){ S.counts.calc++; } else { st.workTries=(st.workTries||0)+1; if(!w.trap&&st.workTries<2){ toast('결과값이 맞지 않아요. 다시 세어 보고 보내 주세요.'); $('composeSend').disabled=false; openComposer(id,which,key); $('composeText').value=text; $('cpWorkIn').value=ans; return; } score=Math.min(score,w.trap?20:0); comment='결과값이 틀렸어요. '+comment; runBranch(id,w.trap?'trap':'wrong'); } }
    /* 금지 표현 → 분기 */
    if(g.forbid.length){ st.forbidHit=true; st.replyBanHit=true; const p=g.forbid[0]; comment='금지 표현이 들어갔어요: '+g.forbid.join(', ')+'. '+comment; runBranch(id,'forbid:'+p)||runBranch(id,(c.id==='cs22'&&p.includes('계좌'))?'forbidAccount':'forbid'); }
    else if(g.partial){ comment='답이 절반이에요. 빠진 값을 채워야 고객이 다시 묻지 않아요. '+comment; st.partial=true; runBranch(id,'partial'); }
    else if(g.missing.length&&!ai){ st.partial=true; runBranch(id,'partial'); }
    if(g.cited===false){ st.citeMiss=true; comment=(comment?comment+' ':'')+'근거 조항 번호가 없어요.'; } else if(g.cited===true) S.counts.cite++;
    if(c.ccTeams&&!isSecond){ const names=c.ccTeams.map(k=>TEAM_NAMES[k]||k); const ok=names.some(n=>text.includes(n.replace('팀',''))); if(!ok){ score=Math.min(score,60); comment='원인 확인을 맡을 팀을 참조에 넣지 않았어요. '+comment; st.noCc=true; runBranch(id,'noCc'); } }
    /* 최선이 아닌 글 행동(예: 상신해야 할 건에 회신) */
    /* 앞 단계(보고·전달·질문)에서 이미 행동을 골랐으면 그 뒤의 안내 회신에는 상한을 걸지 않는다 */
    if(key!==c.best&&c.best&&!isSecond&&c.act&&c.act[key]&&flowOf(c)[0]==='reply'){ score=Math.min(score,c.act[key][0]); comment=c.act[key][1]||comment; runBranch(id,key)||runBranch(id,'other'); }
    /* 거절·상신이 정답인 카드를 작성기로 처리했을 때도 「거절·상신」 셈에 넣는다(버튼으로 처리하면 doButton 이 센다) */
    if(!isSecond&&c.best&&['reject','confirm'].includes(c.best)&&flowOf(c)[0]==='reply'){ S.counts.rejectAll++; if(key===c.best) S.counts.reject++; }
    if(c.mode==='ask'&&!isSecond){ if(st.ask) score=Math.min(score,st.ask.cap); else { score=Math.min(score,g.missing.length?40:60); comment='먼저 물어보지 않고 답했어요. '+comment; } }
    const d={els:g.els,missing:g.missing,forbid:g.forbid,partial:g.partial,cited:g.cited}; if(isSecond) st.detail2=d; else st.detail=d; st.source=source; if(feedback) st.feedback=feedback;
    markStep(id,which,{text,score,comment,key}); }
  finally{ $('composeSend').disabled=false; } }
async function sendApproval(id,text,ans){ const c=CARD(id), st=S.cards[id]; st.text=text; const spec=composeSpec(c); const g=gradeText(c,text,spec); let source='규칙 채점', feedback='';
  const ai=await gradeWithAI(c,text,spec,g); if(ai){ source=ai.source; feedback=ai.feedback; }
  if(/이상 없음|그대로 적용/.test(text)&&!/반려/.test(text)){ return doApprove(id); }
  const f=countFlags(c,text); let score=100, comment=(c.act.reject&&c.act.reject[1])||'';
  if(f.all){ score=f.n>=f.all?100:f.n===f.all-1?70:f.n>=1?40:20; if(f.n<f.all){ comment=`지적 항목 ${f.n}/${f.all}. `+comment; runBranch(id,f.n===f.all-1?'flag2':'flag1'); } }
  if(c.workAnswer){ const w=checkWork(c,ans||text); st.answer=ans; st.workOk=w.ok; S.counts.calcAll++; if(w.ok) S.counts.calc++; else { score=Math.min(score,w.trap?30:35); comment='맞는 합계가 없어요. '+comment; runBranch(id,w.trap?'trap':'wrong'); } }
  if(g.forbid.length){ st.forbidHit=true; score=Math.min(score,20); runBranch(id,'forbid:'+g.forbid[0])||runBranch(id,'forbid'); }
  if(g.cited===true) S.counts.cite++; S.counts.rejectAll++; if(c.best==='reject') S.counts.reject++;
  st.detail={els:g.els,missing:g.missing,forbid:g.forbid,cited:g.cited}; st.source=source; if(feedback) st.feedback=feedback; markStep(id,'approval',{text,score,comment,key:'reject'}); }
function doApprove(id){ const c=CARD(id); const a=c.act.approve||c.act.reply||[35,'"확인했습니다"로 넘기면 그 숫자 그대로 나가요.']; S.counts.rejectAll++; markStep(id,'approval',{score:a[0],comment:a[1],key:'approve'}); runBranch(id,'forbid:이상 없음')||runBranch(id,'forbid:확인했습니다')||runBranch(id,'reply')||runBranch(id,'approve'); }

/* ---------- 버튼 · 전화 · 반성 · 검산 ---------- */
function doButton(id,k,branchKey){ const c=CARD(id); const a=c.act&&c.act[k]; if(!a) return; if(k==='delegate') S.counts.pass++; if(k==='confirm') S.counts.ask++; if(c.best&&['reject','confirm'].includes(c.best)){ S.counts.rejectAll++; if(k===c.best) S.counts.reject++; }
  const st=S.cards[id]; st.choice=k; record(id,{act:k,score:a[0],comment:a[1]}); if(k!==c.best){ runBranch(id,branchKey||k)||runBranch(id,'other'); } else runBranch(id,branchKey||'ok'); }
function doPhone(id,k){ const c=CARD(id); const a=c.act[k]; if(!a) return; const st=S.cards[id]; st.choice=k; if(k==='promise') S.counts.promise++; record(id,{act:k,score:a[0],comment:a[1]}); runBranch(id,k===c.best?'ok':k)||runBranch(id,k); const br=(D.branches[id]||{})[k]||(k===c.best?(D.branches[id]||{}).ok:null); const after=(br&&br.after)||(k!==c.best&&c.after);
  /* 전화를 끊은 뒤 오는 한 줄은 **알림**으로 낸다 — 자리가 없는 사람이라고 메신저 대화를
     새로 파면 「고객」이라는 대화방이 생겨 목록이 지저분해진다(대표 "너무 산만해"). */
  if(after) setTimeout(()=>{ if(!bubble(after.who,after.text,5)) toast(after.text,after.who,5000,'cust'); },1800); }
function doPick(id,pick){ const c=CARD(id); const ok=(c.answerAny||[]).includes(pick); const pc=CARD(pick); S.cards[id].text=`"${pc.subj}" 건이요.`; record(id,{act:'reply',score:ok?100:60,comment:ok?(c.act.reply&&c.act.reply[1])||'':(c.fallback||''),text:S.cards[id].text}); runBranch(id,ok?'ok':'fallback'); }
function doWork(id,ans){ const c=CARD(id), st=S.cards[id]; const w=checkWork(c,ans); const shown=workText(c,ans); st.answer=shown; S.counts.calcAll++;
  if(w.ok){ S.counts.calc++; st.workOk=true; toast('검산 결과가 맞아요.'); markStep(id,'work',{answer:shown,score:100}); return; }
  st.workTries=(st.workTries||0)+1; if(w.trap){ st.workOk=false; runBranch(id,'trap'); markStep(id,'work',{answer:shown,score:20,comment:'표의 숫자를 그대로 믿었어요.'}); if(c.deliver){ /* 전달 단계는 열리지 않는다 */ st.steps.deliver={at:S.t,score:0,skipped:true}; finalize(id); } return; }
  if(st.workTries>=3){ st.workOk=false; runBranch(id,'wrong'); markStep(id,'work',{answer:shown,score:0,comment:'세 번 틀렸어요.'}); if(c.deliver){ st.steps.deliver={at:S.t,score:0,skipped:true}; finalize(id); } return; }
  toast(w.wrong&&w.wrong.length?`아직 맞지 않은 칸: ${w.wrong.join(', ')}`:'답이 맞지 않아요. 사유별로 다시 세어 보세요.'); renderCardActs(id); }

/* ---------- 전달 · 질문 · 보고 · 방문 ---------- */
function destOk(c,d,kind){ const target=kind==='ask'?{npc:c.npc,to:c.to}:{npc:c.deliver.npc,to:c.deliver.to}; if(target.npc&&d.name===target.npc) return true; if(target.to&&d.key&&d.key===target.to&&(!target.npc||!npcInfo(target.npc))) return true; return false; }
function wrongLine(c,d,kind){ const w=kind==='ask'?c.wrongNpcLine:(c.deliver&&c.deliver.wrongNpcLine); if(typeof w==='string') return w; if(w&&d.key&&w[d.key]) return w[d.key]; const target=kind==='ask'?c.to:(c.deliver&&c.deliver.to); const tn=TEAM_NAMES[target]||'다른 팀'; return `그건 ${tn}이요.`; }
async function doDeliver(id,d,auto){ const c=CARD(id), st=S.cards[id]; const O=office(); if(O&&O.busy){ toast('지금은 이동할 수 없어요'); return; } const dl=c.deliver||{}; const ok=destOk(c,d,'deliver'); const who=d.name; const trust=trustOf(dl.npc);
  const line=ok?((dl.npcLineTrust&&(trust>=2?dl.npcLineTrust.high:dl.npcLineTrust.low))||dl.okLine||'네, 처리할게요.').replace(/○○씨/g,(S.name||'○○')+'씨'):wrongLine(c,d,'deliver');
  const text=dl.text||dl.deliverText||(dl.handoff?`${c.subj} 건이에요. ${dl.handoff.join(', ')} 전달드려요.`:'이거 전달드리러 왔어요.');
  $('card').classList.add('min'); $('cActs').innerHTML=''; note(`${escapeHtml(who)} 자리로 가는 중…`);
  const r=await travel('deliver',{seat:d.seat,who,teamKey:d.key,teamName:d.team,text,npcLine:line,ok,auto});
  $('card').classList.remove('min'); setStatusLine('');
  if(!r||!r.present){ toast('자리에 안 계셔서 돌아왔어요'); renderCardActs(id); return; }
  st.lastSeat=d.seat; st.lastNpc=who;
  if(ok){ st.delivered=true; st.deliveredAt=S.t; S.counts.pass++; S.counts.rightNpc++; S.ncs['9'].push(100); const okBr=(D.branches[id]||{}).ok; if(dl.npc&&!c.pre&&!(okBr&&okBr.trust)) S.trust[dl.npc]=(S.trust[dl.npc]||0)+1; runBranch(id,'ok',{toastOnly:true}); scheduleChain(c); markStep(id,'deliver',{seat:d.seat,line:r.line||line,score:100}); if(stepsLeft(id).length) toast('전달했어요. 고객에게도 안내 회신을 보내야 완료예요.'); }
  else { st.wrong=line; st.tries=(st.tries||0)+1; S.counts.wrongNpc++; S.ncs['9'].push(0); runBranch(id,'wrongNpc',{toastOnly:true}); renderCardActs(id); } }
async function doAsk(id,d,auto){ const c=CARD(id), st=S.cards[id]; const O=office(); if(O&&O.busy){ toast('지금은 이동할 수 없어요'); return; } const who=d.name; const senior=D.dests.find(x=>x.seat==='senior'); const isSenior=senior&&d.name===senior.name; const ok=destOk(c,d,'ask');
  $('card').classList.add('min'); $('cActs').innerHTML=''; note(`${escapeHtml(who)} 자리로 가는 중…`);
  if(ok){ const answers=askAnswers(c); const r=await travel('ask',{seat:d.seat,who,teamKey:d.key,teamName:d.team,questions:c.question,answers,answer:c.answer,auto}); $('card').classList.remove('min'); setStatusLine('');
    if(!r||!r.present||r.choice==null||r.choice<0){ toast('답을 못 듣고 돌아왔어요'); renderCardActs(id); return; }
    const cap=askCap(c,r.choice); st.ask={choice:r.choice,answer:r.answer,cap}; S.counts.ask++; st.lastSeat=d.seat; S.ncs['9'].push(cap>=100?100:cap>=60?60:40); if(cap>=100){ S.counts.rightNpc++; const okBr=(D.branches[id]||{}).ok; if(c.npc&&!c.pre&&!(okBr&&okBr.trust)) S.trust[c.npc]=(S.trust[c.npc]||0)+1; }
    runBranch(id,cap>=100?'ok':('q'+(r.choice+1)),{toastOnly:true}); st.steps=st.steps||{}; st.steps.ask={at:S.t,choice:r.choice};
    /* 메신저 카드는 별도 작성 창을 띄우지 않는다 — 대화창 아래에서 짧게 답한다(대표 지시) */
    if(c.type==='msg'){ if(window.Msg) Msg.refresh(); return; }
    renderCardActs(id); openComposer(id,'reply'); return; }
  const line=isSenior?(c.sasuLine||c.wrongNpcLine&&typeof c.wrongNpcLine==='string'&&c.wrongNpcLine||`그건 ${TEAM_NAMES[c.to]||'다른 팀'}에 물어봐요.`):wrongLine(c,d,'ask');
  const r=await travel('deliver',{seat:d.seat,who,teamKey:d.key,teamName:d.team,text:(c.question&&c.question[0])||'여쭤볼 게 있는데요.',npcLine:line,ok:false,auto}); $('card').classList.remove('min'); setStatusLine('');
  st.wrong=line; st.lastSeat=d.seat; if(isSenior){ S.counts.sasu=(S.counts.sasu||0)+1; runBranch(id,'senior',{toastOnly:true}); } else { S.counts.wrongNpc++; S.ncs['9'].push(0); runBranch(id,'wrongNpc',{toastOnly:true}); } renderCardActs(id); }
async function doReport(id,auto){ const c=CARD(id), st=S.cards[id]; const O=office(); if(O&&O.busy){ toast('지금은 이동할 수 없어요'); return; } const rp=c.report||c; const keys=Object.keys(rp.choices||{}); const labels=keys.map(k=>rp.choices[k]); const best=keys.indexOf(c.best in (rp.score||{})?c.best:(rp.best||keys[0]));
  const lead=D.dests.find(x=>x.seat==='lead'); const who=c.npc||rp.npc||(lead&&lead.name); const lines=keys.map(k=>(rp.leadAfter&&rp.leadAfter[k])||((D.branches[id]||{})[k]&&(D.branches[id][k].now||{}).text)||'');
  $('card').classList.add('min'); $('cActs').innerHTML=''; note(`${escapeHtml(who)} 자리로 가는 중…`);
  const r=await travel('report',{seat:'lead',who,text:`${who.replace(' 팀장','')} 팀장님, ${c.subj.replace(/^\(대면\)\s*/,'')} 건 보고드립니다.`,ask:rp.leadAsk||'근거가 뭐야?',choices:labels,lines,best:best<0?0:best,auto:auto!=null?auto:undefined});
  $('card').classList.remove('min'); setStatusLine(''); if(!r||r.choice==null||r.choice<0){ toast('보고를 못 하고 돌아왔어요'); renderCardActs(id); return; }
  const k=keys[r.choice]; const score=(rp.score&&rp.score[k])!=null?rp.score[k]:(k===c.best?100:30); st.choice=k; st.reportChoice=k; const isBest=(k===c.best)||(score>=100);
  st.reportBest=isBest; if(c.best&&['reject','confirm'].includes(c.best)){ S.counts.rejectAll++; if(isBest) S.counts.reject++; }
  if(isBest){ S.trust[who]=(S.trust[who]||0)+1; S.counts.rightNpc++; } runBranch(id,k,{toastOnly:true}); if(isBest) runBranch(id,'ok',{toastOnly:true});
  const after=lines[r.choice]; if(after) setTimeout(()=>sayNpc(who,after,7),300);
  markStep(id,'report',{choice:k,score,line:after,comment:isBest?'':'근거가 약했어요.'}); }
async function doVisit(id,auto){ const c=CARD(id), st=S.cards[id]; const keys=c.choiceOrder||Object.keys(c.choices||{}); const labels=keys.map(k=>c.choices[k]); const best=keys.indexOf(c.best); const open=(c.body.match(/"([^"]+)"/)||[])[1]||c.subj;
  const reacts=keys.map(k=>(c.reacts&&c.reacts[k])||((D.branches[id]||{})[k]&&(D.branches[id][k].now||{}).text)||'…알겠어요.'); const name=c.visitorName||c.from;
  $('card').classList.add('min'); $('cActs').innerHTML=''; note('방문객을 응대하러 갑니다…');
  let r=null; const O=office();
  if(O&&!O.busy&&!NO_STAGE){ let timer=null; if(c.timeLimit&&auto==null){ timer=setTimeout(()=>{ try{ if(O.busy) O.choose(-1); }catch(e){} },c.timeLimit*1000); } try{ r=await O.interact('visit',{visitor:c.visitor||'acnh_29',name,lines:{open},choices:labels,reacts,best:best<0?0:best,auto}); }catch(e){} clearTimeout(timer); if(r&&r.choice==null) r=null; }
  if(!r){ r=await travel('visit',{who:name,name,lines:{open},choices:labels,reacts,timeLimit:auto==null?c.timeLimit:null,auto}); }
  $('card').classList.remove('min'); setStatusLine('');
  let k=(r&&r.choice!=null&&r.choice>=0)?keys[r.choice]:null; if(!k){ st.choice='timeout'; record(id,{act:'timeout',score:10,comment:'말없이 시간을 넘겼어요. 접수·회신 시점·보고, 셋 중 하나라도 말해야 해요.'}); runBranch(id,'timeout'); return; }
  const a=c.act[k]||[30,'']; st.choice=k; if(k==='refund') S.counts.promise++; record(id,{act:k,score:a[0],comment:a[1]}); runBranch(id,k===c.best?'ok':k)||runBranch(id,k); }
async function doSheetDeliver(id,auto){ const c=CARD(id), st=S.cards[id]; const d=c.deliver; const keys=Object.keys(d.choices||{}); const labels=keys.map(k=>d.choices[k]); const bestK=Object.entries(d.score||{}).sort((a,b)=>b[1]-a[1])[0]; const best=bestK?keys.indexOf(bestK[0]):0; const who=d.npc||'팀장';
  const lines=keys.map(k=>((D.branches[id]||{})[k]&&(D.branches[id][k].now||{}).text)||(k===(bestK&&bestK[0])?((D.branches[id]||{}).ok&&(D.branches[id].ok.now||{}).text)||'…괜찮네.':''));
  $('card').classList.add('min'); $('cActs').innerHTML=''; note(`${escapeHtml(who)} 자리로 가는 중…`);
  const seat=seatByName(who)||'lead'; const r=await travel('report',{seat,who,text:`${c.subj.replace(/^\[.*?\]\s*/,'')} 검산 결과 가져왔습니다. ${st.answer}입니다.`,ask:d.leadLine||'근거는?',choices:labels,lines,best,auto});
  $('card').classList.remove('min'); setStatusLine(''); if(!r||r.choice==null||r.choice<0){ toast('전달을 못 하고 돌아왔어요'); renderCardActs(id); return; }
  const k=keys[r.choice]; const score=(d.score&&d.score[k])!=null?d.score[k]:30; st.choice=k; const isBest=bestK&&k===bestK[0]; if(isBest){ S.trust[who]=(S.trust[who]||0)+1; S.counts.rightNpc++; } runBranch(id,isBest?'ok':k,{toastOnly:true});
  markStep(id,'deliver',{choice:k,score,line:lines[r.choice]}); }

/* ======================================================================
   사내 메신저 — 대화창 아래에 붙는 행동
   대표 "답장이 필요한 메시지(채점 대상)는 대화창 아래에 선택지 또는 짧은 입력칸으로
   처리한다. 메일처럼 별도 작성 창을 띄우지 마라 — 메신저는 짧게 주고받는 자리다."
   채점은 메일과 **같은 함수**(sendCompose · doButton · doAsk)를 그대로 쓴다.
   js/desk/msgapp.js 가 이 함수를 부른다(그 파일은 채점을 모른다).
   ====================================================================== */
function msgWho(c){ return (c.from||'').replace(/\s*\(.*?\)\s*/g,'').trim(); }
function msgResultNote(id){ const st=S.cards[id]; const c=CARD(id); if(!window.Msg||!st||!c) return;
  const who=Msg.whoOf(id)||msgWho(c);
  if(st.status==='done'){ const cls=st.score==null?'':st.score>=80?'hi':st.score<50?'lo':'';
    const head=st.score==null?actLabel(st.act):`${actLabel(st.act)} · ${st.score}점`;
    Msg.note(who,head+(st.comment?' — '+st.comment:''),cls); }
  Msg.refresh(); }
/* 누구에게 갈지 고르고 실제로 걸어간다 — 상대를 잘못 고르면 조직이해가 깎이는 것은 메일과 같다 */
async function msgGo(id,kind){ const c=CARD(id);
  const list=(D.dests||[]).filter(d=>d.seat!=='lead'||(c.deliver&&c.deliver.npc===d.name)).slice();
  const target=kind==='ask'?c.npc:(c.deliver&&c.deliver.npc);
  if(target&&!list.some(d=>d.name===target)){ const v=npcInfo(target); list.push({seat:v&&v.seat,name:target,team:v?v.team:'',key:v?v.teamKey:''}); }
  const i=await choosePanel(kind==='ask'?'누구에게 물어볼까요?':'누구에게 전달할까요?',list.map(d=>`${d.name} · ${d.team}`));
  if(i==null||i<0) return;
  if(kind==='ask') await doAsk(id,list[i]); else await doDeliver(id,list[i]);
  msgResultNote(id); }
function msgActions(id,foot){ const c=CARD(id), st=S.cards[id];
  if(!c||!st||!st.arrived||st.status==='done'||st.status==='skipped') return false;
  const flow=flowOf(c), steps=st.steps||{}; const who=msgWho(c);
  const btns=h('div','btns'); const tip=(t)=>{ if(t) foot.appendChild(h('div','tip',t)); };
  let drew=false;
  if(flow.includes('ask')&&!st.ask&&!steps.reply){
    tip(`${c.npc||'담당자'}에게 먼저 물어보고 답해야 만점이 나와요.`);
    btns.appendChild(mkBtn('자리로 가서 물어보기','pri',()=>msgGo(id,'ask'))); drew=true; }
  else if(st.ask){ tip(`${c.npc} 답: “${st.ask.answer}”`); }
  if(flow.includes('deliver')&&!steps.deliver){
    tip('직접 전달해야 하는 건이에요.');
    btns.appendChild(mkBtn('자리로 가서 전달하기','pri',()=>msgGo(id,'deliver'))); drew=true; }
  const which=(steps.reply&&flow.includes('reply2')&&!steps.reply2)?'reply2':'reply';
  if(flow.includes(which)&&!steps[which]&&isTextCard(c)&&!(flow.includes('deliver')&&!steps.deliver)){
    const key=(c.best&&['reject','confirm'].includes(c.best)&&(hasCompose(c)||c.alsoReply))?c.best:'reply';
    const spec=composeSpec(c,which==='reply2'?'second':null); const t=[];
    if(spec.mustInclude.length) t.push(`반드시 들어갈 값 ${spec.mustInclude.length}가지`);
    if(spec.ruleFacts.length&&(D.unlock||[]).includes('rulebook')) t.push('근거 조항 번호를 붙여요');
    t.push(aiOn()?'AI 첨삭':'규칙 채점'); tip(t.join(' · '));
    const len=h('span','len','0자');
    const ta=document.createElement('textarea');
    ta.placeholder='메신저는 짧게 — 용건과 다음 행동만.';
    ta.value=(window.Msg&&Msg.draft(who))||'';
    ta.addEventListener('input',()=>{ if(window.Msg) Msg.draft(who,ta.value); len.textContent=ta.value.length+'자'; });
    ta.addEventListener('focus',()=>{ S.composing={id,which,key}; });
    len.textContent=ta.value.length+'자'; foot.appendChild(ta);
    const send=mkBtn(which==='reply2'?'안내 답장 보내기':key==='reject'?'거절 답장 보내기':key==='confirm'?'상신하고 답장 보내기':'답장 보내기','pri',async()=>{
      const text=ta.value.trim();
      if(text.replace(/\s/g,'').length<8){ toast('내용이 너무 짧아요. 한 줄이라도 용건을 적어 주세요.'); return; }
      send.disabled=true;
      if(window.Msg){ Msg.draft(who,''); Msg.mine(who,text); }
      try{ await sendCompose(id,text,which,key,null); } finally{ send.disabled=false; }
      msgResultNote(id); });
    btns.appendChild(send);
    for(const k of Object.keys(c.act||{})){ if(k===key||k==='reply') continue;
      btns.appendChild(mkBtn(actLabel(k),'',()=>{ doButton(id,k); msgResultNote(id); })); }
    btns.appendChild(len); drew=true; }
  if(btns.childElementCount){ foot.appendChild(btns); drew=true; }
  return drew; }

/* ======================================================================
   전화 — 메일함에도 메신저에도 넣지 않는다
   대표 "전화는 메일함·메신저 어디에도 넣지 말고, 전화가 오면 그 자리에서 받는
   화면으로 처리한다. 놓친 전화는 「전화 메모」 앱이나 알림으로."
   ====================================================================== */
let phoneQ=[];
function phoneRing(id){ if(!CARD(id)) return; if(phoneQ.indexOf(id)<0) phoneQ.push(id); renderPhoneBar(); }
function phoneMissed(){ return S.order.filter(i=>{ const c=CARD(i); return c&&c.type==='phone'&&S.cards[i]&&S.cards[i].arrived; }); }
function renderPhoneBar(){ const bar=$('phoneBar'); if(!bar) return;
  phoneQ=phoneQ.filter(i=>S.cards[i]&&S.cards[i].status!=='done');
  const id=phoneQ[0];
  if(!id||S.phase!=='work'||S.paused){ bar.classList.remove('open'); document.body.classList.remove('phone-on'); return; }
  const c=CARD(id); $('phoneTx').textContent=`${c.from} 님에게서 전화`+(phoneQ.length>1?` (외 ${phoneQ.length-1}통)`:'');
  bar.classList.add('open'); document.body.classList.add('phone-on'); }
async function answerPhone(id){ const c=CARD(id), st=S.cards[id];
  if(!c||!st||!st.arrived||st.status==='done') return;
  $('phoneBar').classList.remove('open'); document.body.classList.remove('phone-on');
  const keys=c.choiceOrder||Object.keys(c.choices||{});
  const i=await choosePanel(c.body||c.subj,keys.map(k=>c.choices[k]),c.timeLimit||null,{who:c.from,role:'전화 · '+(c.role||'')});
  phoneQ=phoneQ.filter(x=>x!==id);
  if(i==null||i<0){ if(c.timeLimit){ st.choice='timeout'; record(id,{act:'timeout',score:10,comment:'말없이 시간을 넘겼어요.'}); runBranch(id,'timeout'); } }
  else doPhone(id,keys[i]);
  renderPhoneBar(); if(window.Tel) Tel.refresh(); }
{ const tk=$('phoneTake'); if(tk) tk.onclick=()=>{ const id=phoneQ[0]; if(id) answerPhone(id); };
  const lt=$('phoneLater'); if(lt) lt.onclick=()=>{ const id=phoneQ.shift(); renderPhoneBar();
    if(id){ toast('전화 메모에 남겼어요. 컴퓨터에서 다시 걸 수 있어요.','☎',3800,'cust'); if(window.Tel) Tel.refresh(); } }; }

/* 체인: 우리 스텝을 전달하면 후속 스텝(조력자가 찾아오는 카드)이 게임시간 몇 분 뒤 도착한다 */
function scheduleChain(c){ if(!c.chain) return; for(const n of D.cards.concat(S.extra)){ if(n.chain===c.chain&&n.step>c.step&&n.requires&&n.requires.card===c.id){ const st=S.cards[n.id]; st.readyAt=Math.max(n.arrive,S.t+(n.delayMin!=null?n.delayMin:5)); } } }

/* ---------- 마무리 · 기록 · NCS · 단서 ---------- */
function finalize(id){ const c=CARD(id), st=S.cards[id]; const steps=st.steps||{}; const parts=[]; let comment=[]; let act='reply';
  for(const [k,v] of Object.entries(steps)){ if(v.skipped||k==='ask') continue; if(typeof v.score==='number') parts.push(v.score); if(v.comment) comment.push(v.comment); }
  if(steps.deliver) act=steps.work?'work':'deliver'; else if(steps.report) act='report'; else if(steps.approval) act=steps.approval.key||'reject'; else if(steps.reply) act=steps.reply.key||'reply';
  let score=parts.length?Math.round(parts.reduce((a,b)=>a+b,0)/parts.length):null;
  if(c.actions&&c.actions.stopShip&&!st.stopShip&&score!=null){ score=Math.max(0,score+(c.actions.stopShip.scoreIfMissing||-30)); comment.push('출고 중지 요청을 빠뜨렸어요.'); runBranch(id,'noStop'); }
  if(!comment.length&&score!=null&&c.act&&c.act[c.best]&&(score>=80)) comment.push(c.act[c.best][1]||'');
  if((c.scored===false&&c.mode==='story')||c.unscored||c.axis==='self') score=null;
  record(id,{act,score,comment:uniq(comment.filter(Boolean)).join(' '),text:st.text,text2:st.text2}); }
function record(id,{act,score,comment,text,text2,detail}){ const c=CARD(id), st=S.cards[id]; st.status='done'; st.act=act; st.score=score; st.comment=comment||''; if(text!==undefined) st.text=text; if(text2!==undefined) st.text2=text2; if(detail) st.detail=detail; st.doneAt=S.t; st.onTime=!st.late;
  if(c.followup){ S.counts.follow++; }
  else if(score!=null){ for(const a of (c.ncs||[])){ if(a==='5'||a==='9') continue; if(a==='7'&&st.citeMiss){ S.ncs['7'].push(Math.min(score,60)); continue; } if(a==='6'&&st.noCc){ S.ncs['6'].push(0); continue; } S.ncs[a].push(score); } S.ncs['5'].push(st.onTime&&act!=='hold'?100:0); }
  else if(c.axis==='self'||c.unscored){ S.ncs['4'].push(text?100:0); }
  captureClue(c,st); renderInbox(); renderCounts(); if(S.cur===id) renderCardActs(id); saveProgress(); }
function captureClue(c,st,force){ if(!c.clue) return; const cl=c.clue; let ok=force||false; let extra='';
  if(!ok){ if(cl.requiresReply) ok=!!(st.text||st.act==='reply'); else if(c.mode==='phone'){ ok=!!st.choice; if(st.choice==='promise') extra=' · 시한 약속함'; } else if(c.mode==='report'||c.type==='report') ok=st.reportBest!=null?!!st.reportBest:st.choice===c.best; else if(c.type==='sheet'||c.mode==='sheet') ok=!!st.workOk; else ok=st.act!=='none'&&st.act!=='hold'&&st.act!=='delegate'&&st.act!=='reject'&&st.act!=='timeout'&&(st.score==null||st.score>=45); }
  if(!ok) return; if(S.clues.some(k=>k.card===c.id)) return; S.clues.push({caseId:cl.caseId,day:S.ep,card:c.id,note:cl.note+extra,value:cl.value||null,at:S.t}); }
function runBranch(id,key,opt={}){ const all=(D.branches||{})[id]||{}; let br=all[key]; if(!br&&key&&key.startsWith('forbid:')) br=all.forbid; if(!br) return false; const c=CARD(id); const st=S.cards[id];
  if(br.now&&br.now.text){ const who=br.now.who==='@npc'?(st.lastNpc||npcBySeat(st.lastSeat)||'상대'):br.now.who==='팀장'?(D.dests.find(x=>x.seat==='lead')||{}).name||'팀장':br.now.who==='고객'?(c.from||'고객'):br.now.who; if(opt.toastOnly) { if(seatByName(who)) toast(br.now.text,who,4200,''); else msgLine(who,br.now.text); } else setTimeout(()=>sayNpc(who,br.now.text,4.5),400); }
  if(br.trust) for(const [n,d] of Object.entries(br.trust)){ const nm=n==='팀장'?(D.dests.find(x=>x.seat==='lead')||{}).name||n:n; S.trust[nm]=(S.trust[nm]||0)+d; }
  if(br.followup&&br.now&&br.now.text){ const fid=`fu_${id}_${S.extra.length}`; const fc={id:fid,type:c.type==='msg'?'msg':'email',from:br.now.who==='고객'?c.from:br.now.who,role:'재문의',subj:'RE: '+c.subj,body:br.now.text,arrive:S.t+1,followup:true,scored:false,act:{confirm:[0,'']},urgent:c.urgent||2,hint:'재문의는 1분 손실이에요. 처음 답장에 값을 다 넣으면 안 와요.'}; S.extra.push(fc); S.cards[fid]={arrived:false,status:'wait'}; }
  if(br.next&&br.next!=='없음'&&!/^없음/.test(br.next)) S.nexts.push({card:c.subj,text:br.next}); if(br.mistake) S.mistakes.push(id); if(br.clueGap) st.clueGap=true; st.branch=key; return true; }

/* ---------- 분류(6화 triage) ---------- */
function startTriage(){ const T=D.triage; const ids=uniq((T.cards||[]).concat(S.order.filter(i=>S.cards[i].arrivedAt<=T.at+0.01&&!CARD(i).followup))).filter(i=>S.cards[i]&&S.cards[i].arrived); S.triage={ids,assign:{},done:false}; S.phase='triage'; S.running=false; renderTriage(); $('triage').classList.add('open'); }
function renderTriage(){ const box=$('triageList'); box.innerHTML=''; const B=[['now','지금'],['morning','오전 중'],['today','오늘 중']];
  for(const id of S.triage.ids){ const c=CARD(id); const row=h('div','trow'); row.appendChild(h('div','tsj',(c.type==='phone'?'☎ ':'')+c.from+' — '+c.subj)); const g=h('div','tbtns'); for(const [k,l] of B){ const b=mkBtn(l,S.triage.assign[id]===k?'on':'',()=>{ S.triage.assign[id]=k; renderTriage(); }); g.appendChild(b); } row.appendChild(g); box.appendChild(row); }
  $('triageGo').disabled=Object.keys(S.triage.assign).length<S.triage.ids.length; }
function finishTriage(){ const T=D.triage; const A=S.triage.assign; const nowSet=new Set(T.now||[]); const extraNow=S.triage.ids.filter(i=>!T.cards.includes(i)); for(const i of extraNow) nowSet.add(i);
  const hit=S.triage.ids.filter(i=>nowSet.has(i)&&A[i]==='now').length; const total=S.triage.ids.filter(i=>nowSet.has(i)).length; const key=String(Math.min(hit,3)); const sc=(T.score&&T.score[key]!=null)?T.score[key]:Math.round(100*hit/Math.max(1,total));
  S.triage.done=true; S.triage.score=sc; S.triage.hit=hit; S.triage.total=total; S.ncs['5'].push(sc); if(hit<total) runBranch('triage','partial'); $('triage').classList.remove('open'); S.phase='work'; S.running=true; lastTick=0; toast(hit>=total?`순서를 잘 잡았어요. "지금" ${hit}/${total}.`:`"지금" 칸 ${hit}/${total}. 시한이 있는 것부터예요.`); renderInbox(); saveProgress(); }
