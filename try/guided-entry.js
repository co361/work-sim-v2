/* Loaded only by try.html. All records remain in the demo3 storage namespace. */
(function(){
 'use strict';
 const R=GuidedDemoRules,{visit:V,mail:M,phone:F}=R.ids,guestKey='guided.guest.v1';
 let actionBusy=false,phoneAt=0,finishing=false,startedAt=0,lastCode='',lastUI='',demoMs=0,lastSyncAt=performance.now();
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const active=()=>D?.guidedDemo===true;
 const state=id=>S.cards[id]||{};
 const done=id=>state(id).status==='done';
 const existingHome=showHome;
 aiOn=()=>false;
 function labels(){
  document.title='WORK SIM · 3단계 체험';
  $('homeCode').hidden=$('homeGo').hidden=$('homeDays').hidden=true;$('homeDays').style.display='none';
  $('homeTeam').replaceChildren();const o=document.createElement('option');o.value='cs';o.textContent='고객상담팀 · 출고 요청 시연';$('homeTeam').append(o);
  $('home').querySelector('.ws-entry-subtitle').textContent='협업부터 결과까지, 3단계 체험';
  $('home').querySelector('.sub').textContent='물류팀을 방문해 자료를 받고, 사규를 확인해 메일과 전화에 대응합니다. 마치면 내 점수와 판단 근거를 바로 확인합니다.';
  $('homeBackend').textContent='약 4~5분 · 로그인 없음 · 강제 시간 제한 없음 · 정식 성적과 분리된 체험 점수';
  $('homeDemo').textContent=localStorage.getItem(guestKey)?'체험 이어 하기':'3단계 체험 시작';$('homeDemo').classList.add('pri');$('homeReset').textContent='처음부터 다시 체험';
  paintHomeAvatar();
 }
 showHome=async function(){await existingHome();labels();};
 async function start(fresh=false){
  if(window.GuidedPlayback?.automatic||window.GuidedPlayback?.state.pending)window.GuidedPlayback.stop();
  const b=$('homeDemo');if(b.disabled)return;b.disabled=true;homeMsg('체험을 준비하고 있어요…');
  try{
   clearTimeout(saveTimer);await __backendReady;let code=fresh?null:localStorage.getItem(guestKey);
   if(code){const r=await Backend.check(code);if(!r.ok||r.day>1)code=null;}
   if(!code){const r=await Backend.createSession('cs');if(!r.ok)throw Error(r.reason);code=r.code;localStorage.setItem(guestKey,code);}
   finishing=false;phoneAt=0;startedAt=Date.now();$('home').classList.remove('open');$('debrief').classList.remove('open');$('loading').classList.remove('off');
   if(!avatarPref())setAvatarPref('f');
   await enterWithCode(code,1);
   if(S.phase==='briefing')endBriefing();sync();
  }catch(e){await showHome();homeMsg(e.message||'체험 준비에 실패했습니다.');}finally{b.disabled=false;}
 }
 $('homeDemo').onclick=()=>start();$('homeReset').onclick=()=>start(true);$('homeTeam').onchange=labels;
 goDay=()=>start(true);
 goHome=async function(){saveProgress(true);await Backend.flush();location.href='try.html?home=1';};
 const oldStart=startDay;startDay=async function(){const r=await oldStart.apply(this,arguments);if(active()&&S.phase==='briefing')endBriefing();sync();return r;};
 const oldAdvance=advance,oldClock=renderClock;
 advance=function(minutes){if(!active())return oldAdvance(minutes);if(S.phase!=='work'||S.ended||!Number.isFinite(minutes)||minutes<=0)return;S.t+=minutes;arrivals();renderClock();};
 renderClock=function(){oldClock();if(active()){$('clock').textContent='3단계 체험';$('clockLeft').textContent='시간 제한 없음';}};
 const oldLate=checkLate;checkLate=function(){if(!active())return oldLate();};
 const panel=document.createElement('section');panel.id='guidedDemo';panel.hidden=true;panel.setAttribute('aria-label','3단계 체험 안내');
 panel.innerHTML='<div class="gd-head"><b>WORK SIM · 짧은 체험</b><span>약 4~5분</span></div><ol><li id="gdStep1">1 자료 받기</li><li id="gdStep2">2 판단·응대</li><li id="gdStep3">3 결과</li></ol><h2 id="gdTitle"></h2><p id="gdText"></p><div id="gdActions"></div><p id="gdStatus" role="status"></p>';
 document.body.append(panel);
 const status=t=>{$('gdStatus').textContent=t||'';};
 function button(label,fn,id){const b=mkBtn(label,'',()=>Promise.resolve(fn()).catch(e=>status(e.message)));if(id)b.id=id;b.disabled=actionBusy;return b;}
 function closePc(){if(Desk.isOpen())$('pcBtn').click();}
 async function seat(){
  const signal=window.GuidedPlayback?.signal;const o=office();if(!o?.ready?.())throw Error('사무실을 불러오는 중입니다. 잠시 뒤 다시 눌러 주세요.');
  if(o.busy||o.walking)throw Error('이동이나 대화가 끝나면 다시 눌러 주세요.');
  if(!Desk.isSeated()){await o.goSeat({demoSignal:signal});if(signal?.aborted)throw new DOMException('자동 시연 중지','AbortError');Desk.setSeated(true);}
  if(!Desk.isOpen())$('pcBtn').click();
 }
 async function mail(){await seat();Desk.openApp(Desk.MAIL);openCard(M);}
 async function rules(){await seat();openCard(M);Desk.openApp(Desk.NOTE);showTab('rule');status('「출고 수량과 후속 안내」 조항을 펼쳐 확인해 주세요.');}
 async function ask(id){
  if(actionBusy)return;const o=office();if(!o?.ready?.())throw Error('3D 사무실이 준비되지 않았습니다. 다시 불러온 뒤 시도해 주세요.');
  if(o.busy||o.walking)throw Error('현재 이동이나 대화가 끝나면 다시 눌러 주세요.');
  actionBusy=true;closePc();status('물류팀 오대리에게 이동합니다. 대화에서 필요한 질문을 선택해 주세요.');sync();
  try{await doAsk(id,D.dests.find(d=>d.name==='오대리'));}finally{actionBusy=false;sync();}
 }
 const oldTravel=travel;travel=async function(mode,opts){
  if(!active()||mode!=='ask'||opts.teamKey!=='logi')return oldTravel(mode,opts);
  const o=office();if(!o?.ready?.()||typeof o.goToTeam!=='function')throw Error('실제 사무실을 불러오지 못해 방문을 완료할 수 없습니다.');
  const r=await o.goToTeam('logi',{...opts,mode,demoSignal:window.GuidedPlayback?.signal});if(!r||r.present===false)throw Error('물류팀 방문이 완료되지 않았습니다. 다시 시도해 주세요.');rbUnlock('logi');return r;
 };
 const oldAsk=doAsk;doAsk=async function(id,d,auto){
  const r=await oldAsk(id,d,auto);if(!active())return r;
  if(id===V&&state(V).ask?.cap>=100){state(V).guidedMaterialReceived=true;record(V,{act:'ask',score:100,comment:'물류팀에서 요청번호 D-1021의 출고 자료를 받았습니다.'});status('자료 수령: 오늘 12개 출고 가능 · 잔여 3개는 추가 확인 필요.');}
  else if(id===V){status('출고 가능 수량과 잔여 수량이 모두 필요합니다. 다시 질문할 수 있어요.');closeComposer();}
  if(id===M&&state(M).ask?.cap>=100){status('물류팀 확인: 확인된 수량만 안내하고, 잔여분은 15시에 다시 연락합니다.');}
  saveProgress(true);sync();return r;
 };
 const oldOpen=openComposer;openComposer=function(id,which,key){
  if(active()&&id===V)return;
  oldOpen(id,which,key);if(!active()||id!==M)return;
  $('composeText').placeholder='한도윤 님에게 확인한 수량과 다음 안내 시점을 적어 주세요.';
  $('composeText').value=state(M).guidedDraft||'';$('composeText').dispatchEvent(new Event('input'));
  let b=$('guidedDraft');if(!b){b=button('메일 초안 자동입력',fillDraft,'guidedDraft');$('composeSend').parentNode.insertBefore(b,$('composeSend'));}
  b.hidden=false;b.disabled=false;$('cpMode').textContent='체험용 기준';
  note('초안 자동입력은 글만 채웁니다. 내용을 확인하고 직접 「보내기」를 눌러 주세요.');
 };
 function fillDraft(replace=false){
  if(!active()||S.composing?.id!==M||done(M))return;
  const ta=$('composeText');if(!(replace===true&&P?.guidedAutomation)&&ta.value.trim()&&ta.value!==state(M).guidedDraftAuto&&!confirm('지금 쓴 초안을 체험용 예시 초안으로 바꿀까요?'))return;
  state(M).guidedDraftUsed=true;state(M).guidedDraftAuto=R.draft;ta.value=R.draft;ta.dispatchEvent(new Event('input'));status('초안만 입력했습니다. 아직 발송하지 않았습니다.');
 }
 $('composeText').addEventListener('input',()=>{if(active()&&S.composing?.id===M){state(M).guidedDraft=$('composeText').value;saveProgress();}});
 const oldSend=sendCompose;sendCompose=async function(id,text,which,key,answer){
  if(!active()||id!==M)return oldSend.apply(this,arguments);
  if(done(M))return;
  if(!done(V)){toast('물류팀 출고 자료를 먼저 받아 주세요.');return;}
  if(String(text).replace(/\s/g,'').length<8){toast('회신 내용을 입력해 주세요.');return;}
  const grade=R.mail(text);state(M).guidedEvidenceAtSend=R.evidence(state(M));state(M).steps={...(state(M).steps||{}),reply:{at:S.t,key:'reply',score:Math.round(grade.points/35*100)}};
  record(M,{act:'reply',score:Math.round(grade.points/35*100),text,comment:grade.overpromise?'확인되지 않은 전량 출고를 확답했습니다.':grade.points===35?'확인한 수량과 후속 안내를 정확하게 전달했습니다.':'결과에서 빠진 안내 항목을 확인해 보세요.'});
  closeComposer();phone();sync();
 };
 const oldActs=renderCardActs;renderCardActs=function(id){
  oldActs(id);if(!active()||done(id))return;
  if(id===V){$('cActs').replaceChildren(button('물류팀 방문 · 출고 자료 받기',()=>ask(V)));note('김민아 팀장: 물류팀 오대리에게 요청번호 D-1021의 오늘 출고 가능 수량과 잔여분 자료를 받아 주세요.');}
  if(id===M){$('cActs').replaceChildren(button('사규집 확인',rules),button('물류팀에 처리 기준 묻기',()=>ask(M)),button('회신 쓰기',()=>openComposer(M)));note('사규집을 확인하거나 물류팀에 문의한 뒤 한도윤 님에게 회신하세요.');}
 };
 const oldRb=rbNote;rbNote=function(x){oldRb(x);if(active()&&x==='DEMO-OPS-01'&&!done(M)){const rb=state(M).rb||(state(M).rb=[]);if(!rb.includes(x))rb.push(x);saveProgress();sync();}};
 function phone(){if(!active()||!done(V)||done(F))return;const st=state(F);if(!st.arrived){st.arrived=true;st.status='new';st.arrivedAt=S.t;S.order.push(F);notifyArrive(CARD(F));saveProgress(true);}else phoneRing(F);}
 const oldRecord=record;record=function(id,value){const r=oldRecord(id,value);if(active())sync();return r;};
 const oldDone=checkAllDone;checkAllDone=function(){if(!active())return oldDone();$('endbar').classList.remove('open');};
 const oldFinish=finish;finish=function(){if(active()&&![V,M,F].every(done)){toast('자료 수령, 메일 발송, 전화 응대를 마치면 결과가 바로 열립니다.');return Promise.resolve(null);}return oldFinish.apply(this,arguments);};
 function sync(){
  const now=performance.now(),dt=Math.min(500,Math.max(0,now-lastSyncAt));lastSyncAt=now;
  if(active()&&S.phase==='work'&&!S.paused&&!document.hidden)demoMs+=dt*(window.GuidedPlayback?.rate||1);
  panel.hidden=!active()||!['work','briefing'].includes(S.phase);if(panel.hidden)return;
  if(lastCode!==S.code){lastCode=S.code;phoneAt=0;finishing=false;startedAt=Date.now();}
  const phase=done(V)?2:1;document.body.classList.toggle('guided-phone-pending',state(F).arrived&&!done(F));
  const signature=[lastCode,phase,actionBusy,done(M),state(F).arrived,done(F)].join('|');
  if(signature!==lastUI){lastUI=signature;
  $('gdStep1').className=done(V)?'done':'current';$('gdStep2').className=phase===2?'current':'';
  $('gdTitle').textContent=phase===1?'물류팀에서 출고 자료를 받아오세요':'근거를 확인하고 한도윤 님에게 답신하세요';
  $('gdText').textContent=phase===1?'김민아 팀장: 교구 15개 출고 요청입니다. 물류팀 오대리에게 오늘 가능한 수량과 잔여분을 확인해 주세요.':'받은 자료: 오늘 12개 출고 가능 · 잔여 3개 추가 확인. 사규집 또는 물류팀 문의를 바탕으로 메일과 전화에 대응하세요.';
  const box=$('gdActions');box.replaceChildren();
  if(phase===1)box.append(button(actionBusy?'이동·대화 중…':'물류팀 방문하기',()=>ask(V),'gdVisit'));
  else{
   box.append(button(done(M)?'보낸 메일 보기':'내 자리로 · 메일 열기',mail,'gdMail'),button('사규집 확인',rules,'gdRules'),button('물류팀 문의',()=>ask(M),'gdAsk'));
   if(state(F).arrived&&!done(F))box.append(button('한도윤 님 전화 받기',()=>answerPhone(F),'gdPhone'));
  }
  }
  if(phase===2){if(!phoneAt)phoneAt=demoMs+7000;if(demoMs>=phoneAt&&!S.paused&&!state(F).arrived&&!actionBusy&&!Talk.isOpen())phone();}
  if(done(V)&&done(M)&&done(F)&&!finishing&&!actionBusy&&!Talk.isOpen()){
   finishing=true;status('체험 결과를 준비합니다.');finish().catch(e=>{finishing=false;status('결과 저장에 실패했습니다: '+e.message);});
  }
 }
 renderProgTab=function(){const b=$('tab_prog');b.replaceChildren(h('h4',null,'3단계 체험 진행'),h('p',null,`1. 자료 수령 ${done(V)?'완료':'진행 전'} · 2. 메일 ${done(M)?'완료':'미완료'} / 전화 ${done(F)?'완료':'미완료'} · 3. 결과 자동 표시`),h('p',null,'체험 기록은 이 브라우저에만 저장됩니다. 정식 참가자 평가에 반영되지 않습니다.'));};
 renderDebrief=function(){
  if(window.GuidedPlayback?.automatic)window.GuidedPlayback.stop('자동 시연 완료');
  const automated=!!P?.guidedAutomation,result={...R.result(S.cards),automated},snapshot=GuidedReportData.actual(S.cards,D,P?.done?.['1']?.at,{automated});
  if(automated)result.score=null;
  GuidedStudentReport.mount($('dbWrap'),snapshot,{restart:()=>start(true),home:()=>{location.href='try-intro.html';}});
  panel.hidden=true;document.body.classList.remove('guided-phone-pending');
  if(P?.done?.['1']){P.done['1'].publicPractice=true;P.done['1'].guidedDemo=result;P.done['1'].guidedReport={version:1,kind:automated?'automated-demo-actions':'actual-demo-actions',officialAssessment:false,automated,draftUsed:result.draftUsed};saveProgress(true);}
 };
 // Correct the old long-day tutorial only in this demonstration entry.
 const tutorial=$('tutCard');if(tutorial)new MutationObserver(()=>{const title=tutorial.querySelector('h3');if(title?.textContent==='하루는 09:00에 시작해 18:00에 끝나요'){title.textContent='협업·판단·결과를 짧게 체험해요';tutorial.querySelector('p').textContent='안내 버튼으로 물류팀을 방문하고, 내 자리에서 메일과 사규집을 확인합니다. 세 업무를 마치면 체험 점수가 바로 나옵니다. 강제 시간 제한은 없습니다.';}}).observe(tutorial,{childList:true,subtree:true});
 setInterval(sync,350);labels();
 window.GuidedDemo=Object.freeze({get state(){return {active:active(),busy:actionBusy,phase:done(V)?done(M)&&done(F)?3:2:1,phoneAt,elapsedMs:Date.now()-startedAt,result:active()?{...R.result(S.cards),automated:!!P?.guidedAutomation,...(P?.guidedAutomation?{score:null}:{})}:null};},visit:()=>ask(V),inquire:()=>ask(M),openMail:mail,openRules:rules,fillDraft,answerPhone:()=>answerPhone(F)});
})();
