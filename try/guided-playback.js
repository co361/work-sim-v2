/* Public three-step demo only. Drive the existing UI/actions; never grade a
   participant or change browser/network clocks. Automatic runs fork storage. */
(function(){
 'use strict';
 const G=window.GuidedDemo;if(!G||!window.WS7_PUBLIC_PRACTICE)return;
 const {visit:V,mail:M,phone:F}=GuidedDemoRules.ids;
 const clone=x=>JSON.parse(JSON.stringify(x));
 let controller=null;
 let rate=1,enabled=false,pending=false,generation=0,inflight=false,nextAt=0,talkKey='',talkAt=0,runCode='',message='이동·동작·진행 속도만 바뀝니다. 글은 직접 읽을 수 있어요.';
 // Every new/reloaded manual session starts at 1x with autoplay OFF.
 const controls=document.createElement('div');controls.id='gdPlayback';controls.hidden=true;
 controls.setAttribute('aria-label','데모 속도와 자동 시연');
 controls.innerHTML='<span>속도</span><button id="gdRate1" type="button" aria-pressed="true">1배 수동</button><button id="gdRate25" type="button" aria-pressed="false">2.5배 자동</button><button id="gdAuto" type="button" aria-pressed="false">2.5배 자동재생 OFF</button>';
 $('top').insertBefore(controls,$('seatBtn'));
 const notice=document.createElement('p');notice.id='gdPlaybackStatus';notice.hidden=true;notice.setAttribute('role','status');document.body.append(notice);
 const st=id=>S.cards[id]||{},done=id=>st(id).status==='done';
 const visible=e=>!!e&&!!e.getClientRects().length&&!e.disabled&&getComputedStyle(e).visibility!=='hidden';
 const buttons=(sel)=>Array.from(document.querySelectorAll(sel)).filter(visible);
 function paint(){
  const on=G.state.active&&S.phase==='work';controls.hidden=notice.hidden=!on;document.body.classList.toggle('guided-playback-active',on);
  $('gdRate1').setAttribute('aria-pressed',String(rate===1));$('gdRate25').setAttribute('aria-pressed',String(rate===2.5));
  $('gdAuto').textContent=enabled||pending?'2.5배 자동재생 ON · 끄기':'2.5배 자동재생 OFF · 켜기';
  $('gdAuto').setAttribute('aria-pressed',String(enabled||pending));
  notice.textContent=(P?.guidedAutomation?'자동 시연 기록 · 직접 수행 평가 제외 · ':'')+message;
 }
 function setRate(value){rate=Number(value)===2.5?2.5:1;try{localStorage.setItem('guided.rate.v1',String(rate));}catch(_){}office()?.setDemoRate?.(rate);paint();return rate;}
 function stop(reason='자동 시연을 멈췄습니다. 현재 대화는 직접 선택할 수 있어요.'){
  enabled=false;pending=false;generation++;talkKey='';rate=1;office()?.setDemoRate?.(1);
  if(controller&&!Talk.state().showing){controller.abort();Talk.close();}
  message=reason;paint();
 }
 function audit(label){
  const a=P?.guidedAutomation;if(!a)return;
  a.actions.push({action:label,at:new Date().toISOString()});if(a.actions.length>60)a.actions.shift();saveProgress(true);
 }
 async function start(){
  if(enabled||pending){stop();return;}
  if(!G.state.active||S.phase!=='work')return;
  const token=++generation;pending=true;message='수동 기록을 보존하고 별도 시연을 준비합니다…';paint();
  try{
   if(!P.guidedAutomation){
    // Save the manual branch before selecting the new browser-only backend session.
    // Keep guided.guest.v1 and ws7.code pointing to the manual branch, including reload.
    saveProgress(true);await Backend.flush();const source=S.code;
    const created=await Backend.createSession(S.team);if(!created.ok)throw Error(created.reason);
    if(token!==generation)return;
    const fork=clone(P);fork.code=created.code;fork.guidedAutomation={version:1,kind:'automated-demo-actions',sourceCode:source,startedAt:new Date().toISOString(),actions:[],organizationViewed:false};
    const saved=await Backend.save(created.code,fork);if(!saved.ok)throw Error(saved.reason);
    if(token!==generation)return;
    const selected=await Backend.check(created.code);if(!selected.ok)throw Error(selected.reason);
    // These backend calls resolve locally, without external service traffic.
    P=fork;S.code=created.code;localStorage.setItem('guided.auto.v1',created.code);saveProgress(true);
   }
   if(token!==generation)return;
   runCode=S.code;enabled=true;pending=false;setRate(2.5);nextAt=performance.now()+1200;talkKey='';
   message='자동 시연 중 · 언제든 중지하고 직접 조작할 수 있어요.';audit('자동 시연 시작');paint();
  }catch(e){stop('자동 시연을 시작하지 못했습니다: '+e.message);}
 }
 function act(label,fn){
  if(!enabled||inflight)return;inflight=true;const own=new AbortController();controller=own;nextAt=performance.now()+1800;message=label;paint();audit(label);
  Promise.resolve().then(()=>{if(enabled)return fn();}).catch(e=>{if(e.name!=='AbortError')stop('자동 시연 중지: '+e.message);}).finally(()=>{if(controller===own){controller=null;inflight=false;}});
 }
 function click(label,el){if(visible(el))act(label,()=>el.click());else stop('화면 준비를 확인한 뒤 자동 시연을 재개해 주세요.');}
 function talkStep(now){
  const t=Talk.state().showing;if(!t)return;
  const key=JSON.stringify(t);if(key!==talkKey){talkKey=key;talkAt=now+Math.min(7000,Math.max(1800,String(t.text||'').length*40));return;}
  if(now<talkAt)return;
  const opts=buttons('#tkOpts button');let chosen;
  if(t.options.length){
   chosen=opts.find(b=>b.textContent.includes('오늘 출고 가능 수량과 잔여 수량')||b.textContent.includes('오늘 확인된 수량은 12개'));
   if(!chosen){stop('대표 시연 밖의 대화입니다. 직접 선택한 뒤 자동 시연을 재개해 주세요.');return;}
  }else chosen=opts.find(b=>/^(다음|확인|계속|대화 끝|닫기)/.test(b.textContent.trim()))||$('tkTx');
  // A travel/phone action stays in flight until its dialogue resolves. Its UI
  // must still be operable; no second mission/action is started here.
  if(visible(chosen)){audit(t.options.length?'대화 선택':'대화 확인');chosen.click();talkKey='';nextAt=now+800;}
 }
 function tick(){
  const on=G.state.active&&S.phase==='work';
  if(!on){if(enabled||pending)stop(S.phase==='debrief'?'자동 시연 완료':'자동 시연을 멈췄습니다.');paint();return;}
  office()?.setDemoRate?.(rate);paint();
  if(!enabled)return;
  if(S.code!==runCode){stop();return;}
  const now=performance.now();if(S.paused||document.hidden){nextAt=now+500;talkKey='';return;}
  if(visible($('tutSkip'))&&!$('tut').hidden){click('시연 안내 닫기',$('tutSkip'));return;}
  if(Talk.isOpen()){talkStep(now);return;}
  talkKey='';
  if(inflight||G.state.busy||office()?.busy||office()?.walking||now<nextAt)return;
  if(!done(V)){act('물류팀 방문 · 출고 자료 수령',G.visit);return;}
  if(!st(M).rb?.includes('DEMO-OPS-01')){
   const rule=buttons('#rbList summary').find(e=>e.textContent.includes('DEMO-OPS-01'));
   if(rule)click('출고 수량과 후속 안내 사규 확인',rule);else act('사규집 열기',G.openRules);return;
  }
  if(!P.guidedAutomation.organizationViewed){
   act('조직도에서 물류팀 확인',()=>{Desk.openApp(Desk.NOTE);showTab('org');if(!$('orgList').textContent.includes('물류팀'))throw Error('조직도 준비를 기다려 주세요.');P.guidedAutomation.organizationViewed=true;saveProgress(true);});return;
  }
  if(!done(M)){
   if(S.composing?.id===M&&visible($('composeSend'))){
    if(!st(M).guidedDraftUsed||$('composeText').value!==GuidedDemoRules.draft)act('시연용 메일 초안 입력',()=>G.fillDraft(true));
    else click('게임 안에서 한도윤 님께 답신 보내기',$('composeSend'));
   }else{const compose=buttons('#cActs button').find(b=>b.textContent==='회신 쓰기');if(compose&&S.cur===M)click('메일 회신 작성',compose);else act('내 자리로 · 메일 열기',G.openMail);}
   return;
  }
  if(!done(F)&&st(F).arrived){act('한도윤 님 전화 응대',G.answerPhone);return;}
 }
 // Preserve the existing browser save format, but exclude all automatic or
 // mixed-session records from student score/evidence, including interim saves.
 const oldFill=fillCur;
 fillCur=function(){const r=oldFill();if(P?.guidedAutomation){for(const day of [P.cur,...Object.values(P.done||{})]){if(!day)continue;day.guidedAutomated=true;day.level=null;day.ncs2={v:1,day:''};for(const c of Object.values(day.cards||{})){c.score=null;c.ev='';for(const step of Object.values(c.steps||{}))step.score=null;}}}return r;};
 $('gdRate1').onclick=()=>stop();$('gdRate25').onclick=()=>{if(!enabled&&!pending)start();};$('gdAuto').onclick=start;
 // Do not let the dialogue's Enter/Space shortcut consume playback button keys.
 controls.addEventListener('keydown',e=>{if(['Enter','Space'].includes(e.code)){e.stopPropagation();}});
 addEventListener('pagehide',()=>{enabled=false;generation++;});
 window.GuidedPlayback=Object.freeze({get rate(){return rate;},get signal(){return controller?.signal;},get automatic(){return enabled;},get state(){return {rate,automatic:enabled,pending,inflight,sessionKind:P?.guidedAutomation?'automated-demo-actions':'actual-demo-actions',message};},setRate,start,stop});
 setInterval(tick,200);paint();
})();
