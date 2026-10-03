/* Shared instructor auth, separate named app. No admin action or credential storage. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id), teams={cs:'고객상담',logi:'물류',acct:'회계',ga:'총무',rec:'인사',plan:'기획',qc:'품질관리',pr:'홍보',edu:'교육',buy:'구매'};
  let auth=null, user=null, capable=false, approved=false, busy=false, pending=null;
  const notice=(text,error=false)=>{$('notice').textContent=text;$('notice').className='notice'+(error?' error':'');};
  const credits=value=>Number.isFinite(Number(value))?Number(value).toLocaleString('ko-KR')+'크레딧':'확인 필요';
  const storageKey=uid=>'ws7-teacher-pending:'+uid;
  function validPending(p){return p&&typeof p.requestId==='string'&&/^[a-f0-9-]{36}$/.test(p.requestId)&&teams[p.team]&&Number.isInteger(p.count)&&p.count>=1&&p.count<=300&&['standard','local-ai'].includes(p.gradingMode)&&Object.keys(p).length===4;}
  function readPending(uid){try{const p=JSON.parse(sessionStorage.getItem(storageKey(uid)));return validPending(p)?p:null;}catch{return null;}}
  function savePending(uid,value){if(value)sessionStorage.setItem(storageKey(uid),JSON.stringify(value));else sessionStorage.removeItem(storageKey(uid));}
  function controls(){ $('issueFields').disabled=busy||!!pending;$('issueButton').disabled=busy||!!pending||!capable||!approved;$('retryButton').hidden=!pending;$('retryButton').disabled=busy||!capable||!approved;$('refreshButton').disabled=busy;$('logout').disabled=busy; }
  function chosen(){return {team:$('team').value,count:Number($('count').value),gradingMode:document.querySelector('input[name=gradingMode]:checked').value};}
  function total(){const value=pending||chosen(),cost=value.gradingMode==='local-ai'?1.5:1;$('issueTotal').textContent=(Number.isInteger(value.count)?value.count:0)+'명 · 총 '+credits(value.count*cost)+' 예약';}
  async function api(action,body={},authenticated=false){
    if(!window.BACKEND_URL)throw new Error('UNAVAILABLE');
    const actor=user,payload={action,...body};
    if(authenticated){if(!actor)throw new Error('AUTH_REQUIRED');payload.idToken=await actor.getIdToken();}
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
    try{const response=await fetch(window.BACKEND_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),signal:controller.signal});if(!response.ok)throw new Error('UNAVAILABLE');const data=await response.json();if(!data||typeof data!=='object')throw new Error('UNAVAILABLE');return data;}finally{clearTimeout(timer);}
  }
  function showCodes(rows){
    $('codesBody').replaceChildren();const codes=Array.isArray(rows)?rows:[];
    $('codesEmpty').hidden=!!codes.length;$('codesEmpty').textContent='아직 발급한 입장권이 없습니다.';$('codesTable').hidden=!codes.length;
    for(const code of codes){const tr=document.createElement('tr'),values=[code.code,teams[code.team]||'확인 필요',code.gradingMode==='local-ai'?'AI · 1.5크레딧':'일반 · 1크레딧',({unused:'미사용',active:'사용 중',revoked:'회수됨',recovering:'복구 중'})[code.status]||'확인 필요'];values.forEach((value,i)=>{const td=document.createElement('td');td.textContent=String(value||'');if(i===0)td.className='code';tr.appendChild(td);});$('codesBody').appendChild(tr);}
  }
  function wallet(w){for(const id of ['balance','reserved','spent'])$(id).textContent=Number.isFinite(Number(w&&w[id]))?Number(w[id]).toLocaleString('ko-KR'):'확인 필요';}
  async function refresh({quiet=false}={}){
    if(!user)return;const uid=user.uid;approved=false;controls();
    try{const r=await api('ws7TeacherStatus',{},true);if(user?.uid!==uid)return;if(!r.ok){notice('강사 이용 권한을 확인하지 못했습니다. 관리자에게 Work Sim v2 승인을 확인해 주세요.',true);return;}approved=true;wallet(r.wallet);showCodes(r.codes);if(!quiet)notice(pending?'발급 결과 확인이 남아 있습니다. 같은 요청을 다시 확인해 주세요.':'잔액과 발급 내역을 확인했습니다.');}
    catch{if(user?.uid===uid)notice('잔액과 발급 내역을 불러오지 못했습니다. 연결을 확인하고 새로고침해 주세요.',true);}finally{controls();}
  }
  async function issue(){
    if(busy||!user||!approved||!capable)return;const uid=user.uid;
    if(!pending){const body=chosen();if(!Number.isInteger(body.count)||body.count<1||body.count>300){notice('참여 인원은 1~300명으로 입력해 주세요.',true);return;}
      if(typeof crypto.randomUUID!=='function'){notice('안전한 요청 번호를 만들 수 없습니다. HTTPS 주소에서 다시 열어 주세요.',true);return;}
      const next={...body,requestId:crypto.randomUUID()};try{savePending(uid,next);}catch{notice('중복 발급 방지를 위한 임시 기록을 저장할 수 없습니다. 브라우저 저장 설정을 확인해 주세요.',true);return;}pending=next;
    }
    busy=true;controls();total();notice('입장권 발급 결과를 확인하고 있습니다.');
    try{const response=await api('ws7TeacherIssue',pending,true);if(user?.uid!==uid)return;
      if(response.ok){savePending(uid,null);pending=null;wallet(response.wallet);notice(response.already?'같은 요청의 발급 결과를 확인했습니다. 입장권이 추가로 발급되지 않았습니다.':'입장권을 발급했습니다. 아래 내역에서 개인 토큰을 확인하세요.');await refresh({quiet:true});}
      else if(response.reason==='INSUFFICIENT_CREDITS'){savePending(uid,null);pending=null;notice('필요한 크레딧이 부족합니다. 사용 가능 잔액과 참여 인원을 확인해 주세요.',true);}
      else notice('발급 결과를 확인하지 못했습니다. 입력을 바꾸지 말고 같은 요청 다시 확인을 눌러 주세요.',true);
    }catch{if(user?.uid===uid)notice('발급 응답이 도착하지 않았습니다. 같은 요청 다시 확인으로 중복 없이 결과를 확인하세요.',true);}
    finally{busy=false;controls();total();}
  }
  $('issueForm').addEventListener('submit',event=>{event.preventDefault();issue();});$('retryButton').addEventListener('click',issue);$('refreshButton').addEventListener('click',()=>refresh());$('issueForm').addEventListener('input',total);
  const loginError=()=>notice('로그인하지 못했습니다. 계정 정보를 확인하고 다시 시도해 주세요.',true);
  $('loginForm').addEventListener('submit',async event=>{event.preventDefault();if(!auth)return;const button=$('emailLogin');button.disabled=true;try{await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);await auth.signInWithEmailAndPassword($('email').value.trim(),$('password').value);$('password').value='';}catch{loginError();}finally{button.disabled=false;}});
  $('googleLogin').addEventListener('click',async()=>{if(!auth)return;const button=$('googleLogin');button.disabled=true;try{await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());}catch{loginError();}finally{button.disabled=false;}});
  $('logout').addEventListener('click',async()=>{try{await auth.signOut();notice('로그아웃했습니다.');}catch{notice('로그아웃하지 못했습니다. 다시 시도해 주세요.',true);}});
  async function boot(){
    if(typeof firebase==='undefined'){notice('로그인 화면을 불러오지 못했습니다. 연결을 확인하고 다시 열어 주세요.',true);return;}
    try{const config={apiKey:'AIzaSyAvar2Tt5tQaZH4nTP-oLso9yKGXM0Jx5U',authDomain:'team-work-sim.firebaseapp.com',projectId:'team-work-sim',appId:'1:960526002083:web:6bc8ed577abbcd55f95c16'};const app=firebase.apps.find(a=>a.name==='ws7-teacher')||firebase.initializeApp(config,'ws7-teacher');auth=app.auth();}
    catch{notice('강사 로그인을 준비하지 못했습니다. 다시 열어 주세요.',true);return;}
    auth.onAuthStateChanged(next=>{user=next;approved=false;pending=next?readPending(next.uid):null;$('loginPanel').hidden=!!next;$('teacherPanel').hidden=!next;$('password').value='';if(next){$('accountName').textContent=next.email||'로그인한 강사';if(pending){$('team').value=pending.team;$('count').value=pending.count;document.querySelector('input[name=gradingMode][value="'+pending.gradingMode+'"]').checked=true;}refresh();}controls();total();});
    try{const r=await api('ws7caps');capable=!!(r.ok&&r.aiVersion==='ws7-ai-v2'&&Array.isArray(r.actions)&&r.actions.includes('ws7TeacherIssue')&&r.actions.includes('ws7TeacherStatus'));if(!capable)notice('강사 발급 서비스가 아직 준비되지 않았습니다. 관리자에게 배포 상태를 확인해 주세요.',true);else if(!user)notice('강사 계정으로 로그인해 주세요.');}
    catch{notice('발급 서비스 연결을 확인하지 못했습니다. 연결을 확인하고 다시 열어 주세요.',true);}finally{controls();}
  }
  boot();
})();
