/* Separate public practice exercises; official authentication and grading stay unchanged. */
(function(){
 const guestKey='demo.guests.v1',completedKey='demo.completed.v1';
 const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'{}');}catch(_){return {};}};
 const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
 const mark=(team,done)=>{const value=read(completedKey);value[team]=done;write(completedKey,value);};
 aiOn=()=>false;
 function labels(){
  document.title='WORK SIM · 첫날 체험';
  $('homeCode').hidden=true;$('homeGo').hidden=true;$('homeDays').hidden=true;$('homeDays').style.display='none';
  $('home').querySelector('.ws-entry-subtitle').textContent='첫날 체험';
  $('home').querySelector('.sub').textContent='직무와 캐릭터를 고르면 로그인 없이 시작합니다. 공개용 체험 과제 14개를 직접 처리해 보세요.';
  $('homeBackend').textContent='첫날 업무 14개 · 하루 시간 제한 없음 · 이 브라우저에 저장 · 정식 평가와 별도의 체험 평가';
  const team=$('homeTeam').value;
  $('homeDemo').textContent=read(completedKey)[team]?'첫날 다시 체험':read(guestKey)[team]?'체험 이어 하기':'체험 시작';
  $('homeDemo').classList.add('pri');$('homeReset').textContent='이 직무 체험 새로 시작';
 }
 const normalHome=showHome;
 showHome=async function(){await normalHome();labels();};
 async function start(team,fresh=false){
  const button=$('homeDemo');if(button.disabled)return;
  button.disabled=true;homeMsg('체험을 준비하고 있어요…');
  try{
   clearTimeout(saveTimer);await window.__backendReady;
   const guests=read(guestKey);let code=fresh||read(completedKey)[team]?null:guests[team];
   if(code){const checked=await Backend.check(code);if(!checked.ok||Number(checked.day)>1)code=null;}
   if(!code){const result=await Backend.createSession(team);if(!result.ok)throw Error(result.reason);code=result.code;guests[team]=code;write(guestKey,guests);mark(team,false);}
   $('home').classList.remove('open');$('debrief').classList.remove('open');$('loading').classList.remove('off');
   await enterWithCode(code,1);
  }catch(error){await showHome();homeMsg(error.message||'체험 데이터를 불러오지 못했습니다.');}
  finally{button.disabled=false;}
 }
 $('homeTeam').onchange=()=>{S.code=null;P=null;renderHomeDays();paintHomeAvatar();labels();};
 $('homeDemo').onclick=()=>start($('homeTeam').value||'cs');
 $('homeReset').onclick=()=>start($('homeTeam').value||'cs',true);
 goDay=function(team,day){if(Number(day)===1)return start(team,true);location.href='try-intro.html';};
 goHome=async function(ask){if(ask&&S.phase==='work'&&!confirm('진행은 저장됩니다. 직무 선택으로 나갈까요?'))return;saveProgress(true);await Backend.flush();location.href='try.html?home=1';};
 renderProgTab=function(){const box=$('tab_prog');box.innerHTML='';box.appendChild(h('h4',null,'첫날 체험 기록'));const done=D?D.cards.filter(c=>S.cards[c.id]?.status==='done'&&S.cards[c.id]?.act!=='none').length:0;box.appendChild(h('p',null,`업무 ${done}/14개 처리 · 이 브라우저에 저장됩니다.`));box.appendChild(h('p','muted','이 과제와 평가는 공개용 체험입니다. 정식 참가자의 진행 및 평가와 별도로 기록됩니다.'));};
 const normalDebrief=renderDebrief;
 renderDebrief=function(result){
  const done=D.cards.filter(c=>S.cards[c.id]?.status==='done'&&S.cards[c.id]?.act!=='none').length;
  normalDebrief({...result,counts:{...result.counts,done,all:D.cards.length}});
  const wrap=$('dbWrap'),section=wrap.querySelector('.rsSec');
  const scored=D.cards.filter(c=>c.scored!==false),points=scored.map(c=>Number(S.cards[c.id]?.score)||0),mean=Math.round(points.reduce((a,b)=>a+b,0)/points.length);
  section.innerHTML='';section.appendChild(h('h2',null,'체험 평가'));
  section.appendChild(h('p','rsMeta',`공개 체험 과제 기준 · ${mean}점 · ${done}/14개 처리`));
  section.appendChild(h('p',null,'업무 본문에 안내한 확인·전달 절차와 회신 내용을 기준으로 계산했습니다. 정식 NCS 평가 및 참가자 성적과는 별도입니다.'));
  const low=scored.filter(c=>(Number(S.cards[c.id]?.score)||0)<70);
  section.appendChild(h('p',null,low.length?'보완할 업무: '+low.map(c=>c.subj).join(' · '):'평가 대상 업무의 안내 기준을 잘 반영했습니다.'));
  wrap.querySelector('.rsHead .rsMeta').textContent=D.teamName+' · 첫날 체험 결과';
  const foot=wrap.querySelector('.foot');foot.innerHTML='';
  foot.appendChild(mkBtn('제품 소개','pri',()=>{location.href='try-intro.html';}));
  foot.appendChild(mkBtn('다른 직무 체험','',()=>goHome(false)));
  foot.appendChild(mkBtn('첫날 다시 체험','',()=>start(S.team,true)));
  mark(S.team,true);
  if(P?.done?.['1']){P.done['1'].publicPractice=true;P.done['1'].practiceScore=mean;saveProgress(true);}
 };
 // Only the separate practice page removes the end-of-day cutoff.
 const normalAdvance=advance,normalClock=renderClock;
 const practiceDay=()=>D&&Number(S.ep)===1&&!S.ended;
 advance=function(minutes){if(!practiceDay())return normalAdvance(minutes);if(!Number.isFinite(minutes)||minutes<=0)return;S.t+=minutes;arrivals();checkLate();renderClock();};
 renderClock=function(){normalClock();if(practiceDay()){$('clock').textContent=fmtClock(Math.min(S.t,dayEndMin()));$('clockLeft').textContent='시간 제한 없음';}};
 const card=$('tutCard');const explain=()=>{const title=card?.querySelector('h3');if(title?.textContent==='하루는 09:00에 시작해 18:00에 끝나요'){title.textContent='14개 업무를 시간 제한 없이 체험해요';card.querySelector('p').textContent='업무 본문에 안내된 기준을 따라 확인·회신·전달을 해 보세요. 오늘 마무리에서 체험 평가를 확인합니다.';}};
 if(card)new MutationObserver(explain).observe(card,{childList:true,subtree:true});explain();labels();
})();
