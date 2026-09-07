/* ======================================================================
   WORK SIM 7일차 1인용 직무 게임 — 엔진 v2 · 공통부 (docs/plan-play-v2.md W1)
   순서: core.js → grade.js → cards.js → day.js → ep7.js → auto.js (모듈 아님, 전역 공유)
   ====================================================================== */
const Q=new URLSearchParams(location.search);
const $=(id)=>document.getElementById(id);
const AXES=['1','2','3','4','5','6','7','8','9','10'];
const CIRC={'1':'①','2':'②','3':'③','4':'④','5':'⑤','6':'⑥','7':'⑦','8':'⑧','9':'⑨','10':'⑩'};
const NCS_NAMES={'1':'의사소통','2':'수리','3':'문제해결','4':'자기개발','5':'자원관리','6':'대인관계','7':'정보','8':'기술','9':'조직이해','10':'직업윤리'};
/* 축마다 고유색 — 「알록달록」의 본체이자 장식이 아닌 정보다(대표 확정 스펙).
   막대·점·띠·칩에만 쓴다. 본문 글자색으로는 절대 쓰지 않는다. */
const NCS_HUE={'1':'#2563a8','2':'#0f7b6c','3':'#b4530a','4':'#7a3fa8','5':'#1b7a3e',
  '6':'#c0396b','7':'#0d6b8f','8':'#5c6b1f','9':'#8a4a1f','10':'#3f4b9a'};
/* 섹션 색 머리 · 화자 색 — 같은 표를 두 곳에 적지 않으려고 여기 모아 둔다 */
const BOX_HUE={summary:'#2563a8',ncs:'#7a3fa8',mistake:'#b3261e',next:'#1b7a3e',gap:'#b4530a'};
const ROLE_HUE={팀장:'#b4530a',사수:'#2563a8',동기:'#0f7b6c'};
const TEAM_NAMES={cs:'고객상담팀',logi:'물류팀',acct:'회계팀',ga:'총무팀',rec:'채용팀',plan:'경영기획팀',qc:'품질관리팀',pr:'홍보팀',edu:'교육팀',buy:'구매팀'};
const TEAM_ORDER=['cs','logi','acct','ga','rec','plan','qc','pr','edu','buy'];
/* 조직도(집필 지침 §5 명부): 팀장·사수·주임 */
const ORG={cs:{lead:'김민아 팀장',senior:'박선임',chief:'이주임'},logi:{lead:'강태호 팀장',senior:'오대리',chief:'장주임'},acct:{lead:'서지현 팀장',senior:'한주임',chief:'문주임'},ga:{lead:'이재훈 팀장',senior:'최주임',chief:'권주임'},rec:{lead:'노윤아 팀장',senior:'김선임',chief:'홍주임'},plan:{lead:'조성민 팀장',senior:'류선임',chief:'신주임'},qc:{lead:'배정훈 팀장',senior:'남선임',chief:'도주임'},pr:{lead:'황서연 팀장',senior:'진선임',chief:'표주임'},edu:{lead:'문경수 팀장',senior:'손선임',chief:'반주임'},buy:{lead:'양지훈 팀장',senior:'구선임',chief:'엄주임'}};
const UNLOCK_LABEL={rulebook:'사규집',approval:'결재 검토',orgchart:'조직도',report:'대면 보고',decide:'결정'};
const UNLOCK_DAY={rulebook:2,approval:3,orgchart:4,report:5,decide:7};
const DAY_TITLES={1:'첫 출근',2:'사규집',3:'숫자',4:'옆 팀',5:'거절',6:'위기',7:'결정'};
const SPEED=Math.max(0.1,+(Q.get('speed')||1));
/* 게임 1분 = 실시간 22초/speed → 하루 30분이 실시간 11분이다.
   38차에 12초(=6분)에서 늦췄다 — 대표 "벌써 끝이야?". `?speed=` 로 조절하는 구조는 그대로다. */
const SEC_PER_MIN=22/SPEED;
const NO_STAGE=Q.get('stage')==='0';             /* 3D 사무실 없이(저사양·검사용) — 이동 연출은 글로 대신한다 */
const ACT_LABELS_DEFAULT={reply:'회신',hold:'보류',delegate:'전달',confirm:'상신',reject:'거절',approve:'승인',verify:'본인 확인',mail:'메일로 안내',tell:'바로 알려 줌',deliver:'직접 전달',ask:'직접 질문',report:'보고',visit:'응대',work:'검산',none:'미처리',pick:'선택',stopShip:'출고 중지',timeout:'무응답',accept:'접수·보고',dismiss:'돌려보냄',refund:'즉시 환불',notify:'접수·회신 시점 안내',promise:'시한 약속',refuse:'규정상 불가'};

/* ---------- 상태 ---------- */
let D=null;                                  /* 오늘 화 데이터 */
let P=null;                                  /* 진행(7일) */
const S={ team:'cs', ep:1, code:null, name:'', demo:true, phase:'home', t:0, running:false, paused:false, ended:false,
  cards:{}, order:[], extra:[], ncs:{}, trust:{}, nexts:[], mistakes:[], counts:{done:0,pass:0,ask:0,follow:0,wrongNpc:0,rightNpc:0,promise:0,cite:0,calc:0,calcAll:0,reject:0,rejectAll:0}, cur:null, composing:null, briefI:0, triage:null, clues:[], visitTimer:null };
for(const a of AXES) S.ncs[a]=[];
const CARD=(id)=>(D&&D.cards.find(c=>c.id===id))||S.extra.find(c=>c.id===id);
/* ---------- 표시 시각 ----------
   내부 타임라인은 그대로 0~30분이다(카드 arrive·마감·채점 전부 이 분을 쓴다).
   화면에 적는 시각만 하루 전체로 편다 — 내부 1분 = 표시 18분, 30분 = 540분 = 09:00~18:00.
   대표 "하루가 09시 30분에 끝나는 게 어색해". 데이터·채점 로직은 손대지 않는다. */
const DISP_MUL=18;
const dispMin=(m)=>Math.round((+m||0)*DISP_MUL);
const fmtClock=(m)=>{ const t=9*60+dispMin(m); return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0'); };
/* 점심(표시상 12:00~13:00) — 데이터는 그대로 흐르고 상단에 표시만 잠깐 붙는다 */
const isLunch=(m)=>{ const t=9*60+dispMin(m); return t>=12*60&&t<13*60; };
const escapeHtml=(s)=>String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const actLabel=(k)=>(D&&D.actLabels&&D.actLabels[k])||ACT_LABELS_DEFAULT[k]||k;
const h=(tag,cls,text)=>{ const e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; };
const mkBtn=(label,cls,fn)=>{ const b=document.createElement('button'); b.type='button'; b.className='btn '+(cls||''); b.textContent=label; b.onclick=fn; return b; };
const npcInfo=(name)=>(D&&D.npcs&&D.npcs[name])||null;
const seatByName=(name)=>{ const v=npcInfo(name); return v?v.seat:null; };
const npcBySeat=(seat)=>{ if(!D) return null; for(const [n,v] of Object.entries(D.npcs)) if(v.seat===seat) return n; return null; };
const npcByTeam=(key)=>{ if(!D) return null; for(const [n,v] of Object.entries(D.npcs)) if(v.teamKey===key) return n; return null; };
const trustOf=(name)=>((P&&P.trust&&P.trust[name])||0)+((S.trust&&S.trust[name])||0);
const uniq=(a)=>Array.from(new Set(a));
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const withTimeout=(p,ms)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('시간 초과')),ms))]);

/* ---------- 알림 · 말풍선 ---------- */
function toast(text,who,ms=4200,cls=''){ const box=$('toasts'); if(!box) return; while(box.children.length>=3) box.firstChild.remove(); const el=h('div','toast '+cls); if(who){ el.appendChild(h('b',null,who)); } el.appendChild(document.createTextNode(text)); box.appendChild(el); setTimeout(()=>el.remove(),ms); }
const stage=()=>$('stage');
function office(){ if(NO_STAGE) return null; try{ const w=stage().contentWindow; return w&&w.__office&&w.__office.ready&&w.__office.ready()?w.__office:null; }catch(e){ return null; } }
function bubble(who,text,ttl=4){ const seat=seatByName(who); const O=office(); if(seat&&O){ try{ const c=O.npcAt(seat); if(c){ O.say(c,text,{ttl}); return true; } }catch(e){} } return false; }
function sayNpc(who,text,ttl=4){ const shown=bubble(who,text,ttl);
  /* 이 방에 자리가 있는 사람은 3D 말풍선(대면), 자리가 없는 사람은 사내 메신저(전자) */
  if(seatByName(who)) toast(text,who,4200,''); else msgLine(who,text);
  return shown; }
/* 전자 메시지 한 줄 — 컴퓨터 안 메신저로 간다. 메신저가 아직 없으면 알림으로 떨어진다.
   대표 지적 "컴퓨터에서 볼 수 있게 해줘. 그냥 이렇게 뜨는 거 어색하잖아". */
function msgLine(who,text,opts){ opts=opts||{};
  if(window.Msg&&window.Msg.push){ window.Msg.push(who,text,opts); return true; }
  toast(text,who,4600,'cust'); return false; }
function npcLabel(who){ return who==='@npc'?'상대':who; }

/* ---------- 진행 저장 ---------- */
const LS_KEY=()=>`ws7.progress.${(S.code||('demo-'+S.team)).toLowerCase()}`;
function emptyProgress(){ return {code:S.code,team:S.team,name:S.name||'',day:1,avatar:null,done:{},clues:{},trust:{},unlocked:[],cur:null,updatedAt:null}; }

/* ---------- 플레이어 캐릭터(여성·남성) ----------
   남성은 3D 의 기본값(acnh_25) 그대로다. 여성은 **그날 화면에 서는 NPC 와 겹치지
   않는** 번호를 고른다 — 같은 얼굴이 둘이면 누가 나인지 알 수 없다.
   🔴 아래 OFFICE_CAST 는 office.html 의 CAST 를 옮겨 적은 것이다. 3D 파일은 이 작업에서
      건드리지 않기로 되어 있어 읽어 올 길이 없다. office.html 의 배역이 바뀌면 여기도 고친다.
   3D 에 번호를 넘기는 길(`?me=`)은 docs/office-api-requests.md 에 요청해 두었다.
   아직 안 붙었으면 3D 는 기본 얼굴로 뜨고 나머지는 그대로 돈다. */
const OFFICE_CAST={ cs:['acnh_30','acnh_31','acnh_19','acnh_33'], logi:['acnh_45','acnh_23','acnh_18'],
  acct:['acnh_34','acnh_39','acnh_20'], ga:['acnh_24','acnh_19','acnh_22'], rec:['acnh_35','acnh_26','acnh_17'],
  plan:['acnh_41','acnh_42','acnh_38'], qc:['acnh_27','acnh_28','acnh_32'], pr:['acnh_40','acnh_44','acnh_33'],
  edu:['acnh_43','acnh_46','acnh_29'], buy:['acnh_37','acnh_36','acnh_21'] };
/* 얼굴 그림이 있는 여성부터 — 미리보기에 실제 얼굴을 보여 줄 수 있어야 고르는 뜻이 있다 */
const FEMALE_PICK=['acnh_17','acnh_33','acnh_19','acnh_31','acnh_30',
  'acnh_44','acnh_46','acnh_40','acnh_38','acnh_35','acnh_34','acnh_22','acnh_20','acnh_42','acnh_32','acnh_21'];
const AVATAR_PIC={acnh_17:'av_c17.png',acnh_19:'av_c19.png',acnh_25:'av_c25.png',
  acnh_30:'av_c30.png',acnh_31:'av_c31.png',acnh_33:'av_c33.png',acnh_39:'av_c39.png'};
function usedChars(){ const u=new Set(OFFICE_CAST[S.team]||[]);
  for(const v of Object.values((D&&D.npcs)||{})) if(v.ch) u.add(v.ch);
  return u; }
function playerChar(g){ if(g!=='f') return 'acnh_25'; const u=usedChars(); return FEMALE_PICK.find(c=>!u.has(c))||'acnh_44'; }
function avatarPic(ch){ const f=AVATAR_PIC[ch]; return f?('assets/home/w/'+f):''; }
/* 이 기기에 남는 선호값 — 소개 페이지에서 바꾼 것을 게임이 따라간다 */
function avatarPref(){ try{ return localStorage.getItem('ws7.avatar')||''; }catch(e){ return ''; } }
function setAvatarPref(g){ try{ localStorage.setItem('ws7.avatar',g); }catch(e){} }
/* 백엔드는 js/backend.js 가 실려 있고 configure(url) 로 주소가 잡힌 뒤에만 쓴다.
   configure 안 된 상태는 「서버 없음」과 같게 취급한다 — 저장은 localStorage, 채점은 규칙 채점. */
function backendOn(){ const B=window.Backend; if(!B) return false; if(typeof B.isOn==='function') return !!B.isOn(); return typeof B.save==='function'; }
function hasBackend(){ return backendOn()&&typeof window.Backend.save==='function'; }
/* AI 첨삭을 쓸 수 있는 상태인가 — 데모(코드 없이 들어온 경우)는 ?ai=1 일 때만 */
function aiOn(){ return backendOn()&&typeof window.Backend.grade==='function'&&(!S.demo||!!Q.get('ai')); }
async function loadProgress(){ let p=null;
  try{ const raw=localStorage.getItem(LS_KEY()); if(raw) p=JSON.parse(raw); }catch(e){}
  if(hasBackend()&&S.code&&!S.demo){ try{ const r=await withTimeout(window.Backend.load(S.code),9000); if(r&&r.ok&&r.progress){ const rp=(typeof r.progress==='string')?JSON.parse(r.progress):r.progress; if(!p||(rp.updatedAt||'')>=(p.updatedAt||'')) p=rp; } }catch(e){ console.warn('진행 불러오기 실패(서버):',e.message); } }
  if(!p) p=emptyProgress(); p.code=S.code; p.team=p.team||S.team; p.done=p.done||{}; p.clues=p.clues||{}; p.trust=p.trust||{}; p.unlocked=p.unlocked||[]; p.day=p.day||1; return p; }
let saveTimer=null, saveSeq=0;
function saveProgress(now){ if(!P) return; P.updatedAt=new Date().toISOString(); P.team=S.team; P.name=S.name||P.name||'';
  if(S.phase==='work'||S.phase==='triage'||S.phase==='ep7'){ P.cur={day:S.ep,phase:S.phase,t:S.t,cards:S.cards,order:S.order,extra:S.extra,ncs:S.ncs,trust:S.trust,counts:S.counts,nexts:S.nexts,mistakes:S.mistakes,triage:S.triage,clues:S.clues,ep7:(window.EP7&&window.EP7.snapshot)?window.EP7.snapshot():null}; }
  try{ localStorage.setItem(LS_KEY(),JSON.stringify(P)); }catch(e){}
  if(hasBackend()&&S.code&&!S.demo){ const seq=++saveSeq; const go=()=>{ if(seq!==saveSeq&&!now) return; window.Backend.save(P).then(r=>{ if(!r||!r.ok) setStatus('서버 저장 실패 — 이 기기에는 저장됨'); else setStatus('저장됨'); }).catch(()=>setStatus('서버 저장 실패 — 이 기기에는 저장됨')); }; clearTimeout(saveTimer); if(now) go(); else saveTimer=setTimeout(go,1500); }
  else setStatus('이 기기에 저장됨'); }
function setStatus(t){ const e=$('saveStat'); if(e){ e.textContent=t; clearTimeout(e._tm); e._tm=setTimeout(()=>{ e.textContent=''; },3000); } }

/* ---------- 시계 ---------- */
let lastTick=0;
function clockTick(){ const now=performance.now(); const dt=lastTick?(now-lastTick)/1000:0; lastTick=now; if(!S.running||S.paused||S.phase!=='work') return; const slow=S.composing?1/3:1; advance(dt/SEC_PER_MIN*slow); }
/* 하루가 끝나는 시각. 마지막 카드가 도착하기도 전에 하루가 닫히면 학생은 손도
   못 댄 건으로 점수를 잃는다 — 마지막 도착 + 3분까지는 하루를 끝내지 않는다. */
function dayEndMin(){ if(!D) return 0; let last=0;
  for(const c of D.cards.concat(S.extra)){ const a=+c.arrive; if(isFinite(a)&&a>last) last=a; }
  return Math.max(D.minutes||0,last+3); }
function advance(min){ if(min<=0||!D) return; S.t+=min; const end=dayEndMin(); if(S.t>=end&&!S.ended){ S.t=end; S.ended=true; onDayEnd(); } arrivals(); checkLate(); renderClock(); }
function renderClock(){ const el=$('clock'); if(!el) return; el.textContent=fmtClock(S.t); el.classList.toggle('late',!!S.ended);
  const lu=$('lunch'); if(lu) lu.hidden=!(D&&!S.ended&&isLunch(S.t));
  const lf=$('clockLeft'); if(!lf) return;
  if(!D){ lf.textContent=''; return; }
  /* 남은 것은 **실제 시간**으로 적는다 — 표시 시각(하루)과 남은 시간(세션)은 단위가 다르다.
     게임 1분 = 실시간 SEC_PER_MIN 초이므로 하루 30분은 speed 1 에서 11분이다. */
  const sec=Math.max(0,Math.ceil((dayEndMin()-S.t)*SEC_PER_MIN));
  lf.textContent=S.ended?'퇴근 시간':(sec>=60?`남은 ${Math.ceil(sec/60)}분`:`남은 ${sec}초`);
  lf.classList.toggle('over',!!S.ended); }
function arrivals(){ if(!D) return; const fresh=[]; const all=D.cards.concat(S.extra);
  for(const c of all){ const st=S.cards[c.id]; if(!st||st.arrived) continue; if(c.requires&&!requireMet(c)) continue; const at=(c.requires&&st.readyAt!=null)?st.readyAt:c.arrive; if(at<=S.t){ st.arrived=true; st.arrivedAt=Math.max(at,0); st.status='new'; S.order.push(c.id); fresh.push(c); if(c.trustDelta){ for(const [n,d] of Object.entries(c.trustDelta)) S.trust[n]=(S.trust[n]||0)+d; } } }
  if(fresh.length){
    /* 메신저·전화는 **한꺼번에 와도 반드시** 제 창으로 보낸다 — 앞서는 동시 도착일 때
       「N건이 동시에 도착했어요」만 띄우고 넘어가 메신저가 텅 비어 있었다. */
    const mails=[]; for(const c of fresh){ if(c.type==='msg'||c.type==='phone') notifyArrive(c); else mails.push(c); }
    if(mails.length===1) notifyArrive(mails[0]);
    else if(mails.length&&S.phase==='work') toast(`${mails.length}건이 동시에 도착했어요`,'메일함',3000,'cust');
    for(const c of fresh){ if(c.npcArrives) npcArrive(c); } renderInbox(); renderCounts(); } }
function requireMet(c){ const r=c.requires; const st=S.cards[r.card]; if(!st) return false; if(r.delivered&&!st.delivered) return false; if(r.done&&st.status!=='done') return false; return true; }
function notifyArrive(c){
  /* 종류마다 가는 곳이 다르다 — 한 창에 섞지 않는다(대표 "너무 산만해").
       메신저 → 컴퓨터 안 사내 메신저 대화에 본문이 그대로 쌓인다
       전화   → 그 자리에서 울리는 전화 띠(안 받으면 「전화 메모」 앱)
       그 밖   → 메일함 + 알림 한 줄 */
  if(c.type==='msg'){ if(window.Msg&&window.Msg.card) window.Msg.card(c); else msgLine(c.from,c.subj,{team:c.teamName||TEAM_NAMES[c.to]||''}); return; }
  if(c.type==='phone'){ if(typeof phoneRing==='function'){ phoneRing(c.id); return; } }
  if(S.phase!=='work') return;
  const kind=c.type==='visit'?'방문':c.npcArrives?'대면':'메일';
  toast(`${kind} 도착: ${c.subj}`,c.from,3000,'cust'); }
/* 이어 하기·되돌리기 뒤에 메신저와 전화 목록을 다시 채운다 — 저장된 것은 카드 상태뿐이라
   대화와 전화 벨은 이 함수가 없으면 빈 채로 남는다. */
function rehydrateBoxes(){ if(!D) return;
  if(window.Msg&&window.Msg.reset) Msg.reset();
  for(const id of S.order){ const c=CARD(id), st=S.cards[id]; if(!c||!st) continue;
    if(c.type==='msg'&&window.Msg&&window.Msg.card){ Msg.card(c);
      if(st.status==='done'&&typeof msgResultNote==='function') msgResultNote(id); }
    else if(c.type==='phone'&&st.status!=='done'&&typeof phoneRing==='function') phoneRing(id); }
  if(window.Tel&&window.Tel.refresh) Tel.refresh(); }
function checkLate(){ for(const id of S.order){ const c=CARD(id), st=S.cards[id]; if(!c||st.status==='done'||st.late) continue; const dl=(c.deadline!=null?c.deadline:10); if(S.t>st.arrivedAt+dl) st.late=true; } }
setInterval(clockTick,200);

/* ---------- 조력자가 찾아오는 카드(체인 후속 스텝) ---------- */
function npcArrive(c){ const who=(c.from||'').replace(/\s*\(.*?\)\s*/g,'').trim(); const line=(c.npcLine||'').replace(/○○씨/g,(S.name||'○○')+'씨'); setTimeout(()=>{ if(!sayNpc(who,line,6)) toast(line,who,5000,'cust'); },300); }

/* ---------- 이동(전달·질문·보고): 사무실이 있으면 연출, 없으면 글 ---------- */
async function travel(mode,opts){ const O=office(); const who=opts.who||''; const seat=opts.seat||null;
  /* 다른 팀 상대는 복도 경로가 우선. 사무실이 아직 복도를 모르면(goToTeam 없음·null) 같은 방 임시 좌석으로 떨어진다 */
  if(O&&!O.busy&&typeof O.goToTeam==='function'&&opts.teamKey&&opts.teamKey!==S.team){ try{ const r=await O.goToTeam(opts.teamKey,Object.assign({mode},opts)); if(r) return r; }catch(e){ console.warn('복도 이동 오류',e); } }
  if(O&&!O.busy&&seat&&O.npcAt&&O.npcAt(seat)){ try{ const r=await O.interact(mode,Object.assign({},opts,{to:seat})); return r||{present:false}; }catch(e){ console.warn('연출 오류',e); } }
  /* 대체 연출: 화면 안내 + 짧은 대기 */
  const label=opts.teamName?`${opts.teamName} ${who}`:who; setStatusLine(`${label} 자리로 가는 중…`); await sleep(NO_STAGE?300:1200);
  if(mode==='ask'){ const qs=opts.questions||[]; let i=opts.auto!=null?opts.auto:await choosePanel(`${who}에게 무엇을 물어볼까요?`,qs,null,{who,seat,role:opts.teamName||''}); const ans=(opts.answers&&opts.answers[i])||opts.answer||'그건 저도 잘 모르겠는데요.'; toast(ans,who,5000,'cust'); await sleep(NO_STAGE?100:900); setStatusLine(''); return {choice:i,answer:ans,present:true}; }
  if(mode==='report'){ const ch=opts.choices||[]; toast(opts.ask||'근거가 뭐야?',who,3000,'cust'); let i=opts.auto!=null?opts.auto:await choosePanel(opts.prompt||'어떻게 보고할까요?',ch,null,{who,seat,role:opts.teamName||''}); const line=(opts.lines&&opts.lines[i])||''; if(line) toast(line,who,5000,'cust'); await sleep(NO_STAGE?100:900); setStatusLine(''); return {choice:i,present:true}; }
  if(mode==='visit'){ const ch=opts.choices||[]; toast(opts.lines&&opts.lines.open||'',opts.name||'방문객',5000,'cust'); let i=opts.auto!=null?opts.auto:await choosePanel(opts.prompt||'어떻게 응대할까요?',ch,opts.timeLimit,{who:opts.name||who,role:'방문'}); const re=(opts.reacts&&opts.reacts[i])||''; if(re) toast(re,opts.name||'방문객',4000,'cust'); await sleep(NO_STAGE?100:600); setStatusLine(''); return {choice:i,present:true}; }
  const line=opts.npcLine||(opts.ok===false?'그건 다른 팀인데요.':'네, 처리할게요.'); toast(line,who,4500,'cust'); await sleep(NO_STAGE?100:800); setStatusLine(''); return {ok:opts.ok!==false,present:true,line}; }
function setStatusLine(t){ const e=$('stat'); if(e) e.textContent=t||''; }
/* 화면 선택지 — 대화 모드(js/play/talk.js)의 대화창에서 고른다. timeLimit(초) 지나면 -1.
   전화·방문 응대·NPC 대화가 **한 부품**을 쓰게 하려고 옛 `#choice` 패널을 걷어냈다. */
function choosePanel(title,items,timeLimit,opts){
  if(window.Talk&&window.Talk.choose) return window.Talk.choose(title,items,timeLimit,opts||{});
  console.error('대화 모드(js/play/talk.js)가 실리지 않았습니다'); return Promise.resolve(-1); }

/* ---------- js/desk/* 로 내어 주는 것 ----------
   `js/desk/` 넷은 우리 스크립트와 별개의 파일이고 `global.X` 로 값을 찾는다. 그런데
   classic script 의 최상위 `const` 는 **window 에 얹히지 않는다**(전역 렉시컬 환경에만 산다).
   그래서 `function` 으로 선언한 것(office·toast·renderInbox…)은 저절로 보이는데
   `const` 로 선언한 것(S·CARD·fmtClock…)은 조용히 undefined 였다 — 얼굴도 시각도 비었다.
   필요한 것만 이름 그대로 내어 준다. 같은 객체라 두 벌이 되지 않는다. */
Object.assign(window,{S,CARD,fmtClock,dispMin,isLunch,npcInfo,seatByName,npcBySeat,
  avatarPic,playerChar,actLabel,escapeHtml,uniq,h,mkBtn,NCS_NAMES,NCS_HUE,CIRC,TEAM_NAMES,AXES});
