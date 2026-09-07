/* ======================================================================
   하루 — 입장(개인 코드·홈) · 화 데이터 적재(전날 결과 반영) · 무대 · 브리핑 · 09:30 · 디브리프 · 저장 · 스모크 API
   ====================================================================== */

/* ---------- 데이터 적재 ---------- */
function loadStory(team,ep){ return new Promise((res,rej)=>{ const key=`${team}-ep${ep}`; if(window.STORY&&window.STORY[key]) return res(window.STORY[key]); const s=document.createElement('script'); s.src=`data/story/${key}.js?v=${Date.now()}`; s.onload=()=>{ const d=(window.STORY||{})[key]; d?res(d):rej(new Error('스토리 데이터가 비어 있어요')); }; s.onerror=()=>rej(new Error(`${ep}일차 데이터가 아직 없어요 (${key}.js)`)); document.head.appendChild(s); }); }
/* 분기 카드 조건: 전날 저장된 카드 결과와 대조. 전날 결과가 없으면 미등장 */
function triggerMet(tr,prev){ if(!tr||!prev) return false; if(tr.anyOf) return tr.anyOf.some(t=>triggerMet(Object.assign({card:tr.card},t),prev)); const pc=prev.cards&&prev.cards[tr.card]; if(!pc) return false;
  if(tr.act!=null&&pc.act!==tr.act) return false; if(tr.choice!=null&&pc.choice!==tr.choice) return false; if(tr.report!=null&&pc.choice!==tr.report) return false;
  if(tr.forbidHit!=null&&!!pc.forbidHit!==!!tr.forbidHit) return false; if(tr.replyBanHit!=null&&!!pc.replyBanHit!==!!tr.replyBanHit) return false; if(tr.delivered!=null&&!!pc.delivered!==!!tr.delivered) return false;
  if(tr.partial!=null&&!!pc.partial!==!!tr.partial) return false; return true; }
function prepareDay(){ const prev=P.done[String(S.ep-1)]||null;
  D.cards=D.cards.filter(c=>!c.trigger||triggerMet(c.trigger,prev));
  for(const c of D.cards){ if(c.chain&&c.step>1&&!c.requires){ const first=D.cards.filter(x=>x.chain===c.chain&&x.step<c.step&&x.deliver).sort((a,b)=>a.step-b.step)[0]; if(first) c.requires={card:first.id,delivered:true}; } if(c.alsoReply===true&&!c.deliver&&!c.alsoReplyTo&&c.compose&&c.compose.model){ const m=c.compose.model.match(/^([가-힣]{2,4}) 님/); if(m) c.alsoReplyTo=m[1]; } }
  D.cards.sort((a,b)=>(a.pre?0:1)-(b.pre?0:1)||a.arrive-b.arrive);
  for(const c of D.cards) S.cards[c.id]={arrived:false,status:'wait'};
  const hasPre=D.cards.some(c=>c.pre); if(hasPre&&D.dialog&&D.dialog.briefing){ const lo=D.cards.find(c=>c.pre&&c.leadOpen); if(lo){ const lead=(D.dests.find(x=>x.seat==='lead')||{}).name||'팀장'; D.dialog.briefing.unshift({who:lead,role:'팀장',text:lo.leadOpen.replace(/^\(.*?\)\s*/,''),view:'lead'}); } } }

/* ---------- 입장 ---------- */
async function boot(){ const code=(Q.get('code')||'').trim(); const team=(Q.get('team')||'').toLowerCase(); const ep=+(Q.get('ep')||0);
  try{ const saved=localStorage.getItem('ws7.code'); if(!code&&saved&&!team) S.code=saved; }catch(e){}
  if(code){ await enterWithCode(code,ep||null); return; }
  if(team&&ep){ S.team=team; S.ep=ep; S.demo=true; S.code=null; P=await loadProgress(); S.name=P.name||''; await startDay(ep); return; }
  showHome(); }
async function enterWithCode(code,ep){ code=code.toUpperCase().replace(/\s/g,''); S.code=code; let info=null;
  if(backendOn()&&typeof window.Backend.check==='function'){ try{ const r=await withTimeout(window.Backend.check(code),9000); if(r&&r.ok){ info=r; } else { homeMsg((r&&r.reason)||'등록되지 않은 코드예요. 다시 확인해 주세요.'); showHome(); return; } }catch(e){ homeMsg('서버에 연결하지 못했어요. 잠시 뒤 다시 시도하거나 데모로 시작하세요.'); showHome(); return; } }
  S.demo=!info; if(info){ S.team=(info.team||'cs').toLowerCase(); S.name=info.name||''; } else { S.team=(Q.get('team')||$('homeTeam').value||'cs').toLowerCase(); }
  try{ localStorage.setItem('ws7.code',code); }catch(e){}
  P=await loadProgress(); if(info&&info.day&&info.day>P.day) P.day=info.day; if(!S.name) S.name=P.name||'';
  const day=ep||P.day||1; if(day>7){ showHome(); return; } await startDay(day); }
function homeMsg(t){ const e=$('homeMsg'); if(e) e.textContent=t||''; }
async function showHome(){ S.phase='home'; $('loading').classList.add('off'); $('home').classList.add('open'); const sel=$('homeTeam'); if(!sel.options.length) for(const k of TEAM_ORDER){ const o=document.createElement('option'); o.value=k; o.textContent=TEAM_NAMES[k]; sel.appendChild(o); }
  $('homeCode').value=S.code||''; $('homeBackend').textContent=hasBackend()?'서버 연결됨 — 코드로 진행이 저장되고, 메일은 AI 첨삭을 받아요':'서버 없음 — 이 기기에만 저장되고, 메일은 규칙 채점으로 봐 드려요';
  if(S.code){ S.team=(Q.get('team')||S.team); P=await loadProgress(); S.team=P.team||S.team; sel.value=S.team; } else { P=null; }
  renderHomeDays(); }
function renderHomeDays(){ const box=$('homeDays'); box.innerHTML=''; const day=P?P.day:1; const team=P?(P.team||S.team):($('homeTeam').value||'cs');
  for(let d=1; d<=7; d++){ const done=P&&P.done&&P.done[String(d)]; const cur=!done&&d===day; const b=document.createElement('button'); b.type='button'; b.className='dayc '+(done?'done':cur?'cur':'lock'); b.innerHTML=`<b>${d}일차</b><span>${escapeHtml(DAY_TITLES[d]||'')}</span><i>${done?'✓ '+(done.ending?('엔딩 '+done.ending):(Object.values(done.ncs||{}).length?Math.round(Object.values(done.ncs).reduce((a,b)=>a+b,0)/Object.values(done.ncs).length)+'점':'끝')):cur?(P&&P.cur&&P.cur.day===d?'이어 하기':'오늘'):'잠김'}</i>`;
    b.onclick=()=>{ if(!done&&!cur&&!Q.get('debug')){ toast(`${d-1}일차를 마치면 열려요.`); return; } goDay(team,d); }; box.appendChild(b); } }
function goDay(team,d){ const u=new URL(location.href); u.searchParams.set('team',team); u.searchParams.set('ep',String(d)); if(S.code) u.searchParams.set('code',S.code); else u.searchParams.delete('code'); location.href=u.toString(); }
$('homeGo').onclick=async()=>{ const code=$('homeCode').value.trim(); if(code){ $('home').classList.remove('open'); $('loading').classList.remove('off'); await enterWithCode(code,null); } else { const team=$('homeTeam').value||'cs'; S.demo=true; S.code=null; try{ localStorage.removeItem('ws7.code'); }catch(e){} S.team=team; P=await loadProgress(); goDay(team,P.day||1); } };
$('homeDemo').onclick=async()=>{ const team=$('homeTeam').value||'cs'; S.demo=true; S.code=null; try{ localStorage.removeItem('ws7.code'); }catch(e){} S.team=team; P=await loadProgress(); goDay(team,P.day||1); };
$('homeTeam').onchange=()=>{ if(!S.code) renderHomeDays(); };
/* 홈 화면에서도 언제든 바꾼다 — 여기서 고른 값은 하루를 열 때 그대로 쓰인다 */
function paintHomeAvatar(){ const g=avatarPref(); $('homeAvF').setAttribute('aria-pressed',String(g==='f')); $('homeAvM').setAttribute('aria-pressed',String(g==='m'));
  $('homeAvF').classList.toggle('pri',g==='f'); $('homeAvM').classList.toggle('pri',g==='m'); }
$('homeAvF').onclick=()=>{ setAvatarPref('f'); if(P) P.avatar='f'; paintHomeAvatar(); };
$('homeAvM').onclick=()=>{ setAvatarPref('m'); if(P) P.avatar='m'; paintHomeAvatar(); };
paintHomeAvatar();
$('homeReset').onclick=()=>{ if(!confirm('이 기기에 저장된 진행을 지울까요? (서버 저장은 그대로예요)')) return; try{ localStorage.removeItem(LS_KEY()); }catch(e){} P=null; showHome(); };

/* 캐릭터 고르기 — 고를 때까지 기다린다. 얼굴 미리보기는 실제로 배정될 번호로 그린다 */
function askAvatar(again){
  /* 헤드리스 검사·촬영은 ?avatar=f|m 로 고정한다 — 누를 사람이 없어 여기서 멈춘다 */
  const q=(Q.get('avatar')||'').toLowerCase(); if(!again&&(q==='f'||q==='m')) return Promise.resolve(q);
  return new Promise(res=>{
  const put=(id,ch)=>{ const box=$(id); box.innerHTML=''; const src=avatarPic(ch);
    if(src){ const im=document.createElement('img'); im.src=src; im.alt=''; box.appendChild(im); }
    else box.textContent='🙂'; };
  put('avFPic',playerChar('f')); put('avMPic',playerChar('m'));
  if(!again) $('loading').classList.add('off');
  $('avatar').classList.add('open');
  const keep=$('avKeep'); keep.hidden=!again;
  const close=g=>{ $('avatar').classList.remove('open'); if(!again) $('loading').classList.remove('off'); res(g); };
  $('avF').onclick=()=>close('f'); $('avM').onclick=()=>close('m'); keep.onclick=()=>close(null); }); }

/* ---------- 하루 시작 ---------- */
async function startDay(ep){ S.ep=ep; S.phase='loading'; $('home').classList.remove('open'); $('loading').classList.remove('off');
  try{ D=await loadStory(S.team,ep); }catch(e){ $('loadMsg').textContent=e.message; $('loadBack').style.display='inline-block'; return; }
  D=JSON.parse(JSON.stringify(D));            /* 전날 결과에 따라 카드가 빠지므로 사본 */
  /* 소개 페이지에서 바꾼 것이 있으면 그것을 따르고, 아직 고른 적이 없으면 한 번 묻는다 */
  { const pref=avatarPref();
    if(pref&&pref!==P.avatar){ P.avatar=pref; saveProgress(true); }
    if(!P.avatar){ P.avatar=await askAvatar(); setAvatarPref(P.avatar); saveProgress(true); } }
  document.title=`${D.teamName} ${D.ep}화 「${D.title}」`; $('title').innerHTML=''; $('title').appendChild(document.createTextNode(`${D.teamName} ${D.ep}일차`)); const sm=h('small',null,`「${D.title}」 · ${D.date||''}`); $('title').appendChild(sm);
  if(D.kind==='ep7'){ await stageUp(); $('loading').classList.add('off'); window.__playReady=true; return EP7.start(); }
  prepareDay(); renderUnlocks(); initRulebook(); initOrg();
  await stageUp(); $('loading').classList.add('off'); renderClock(); renderCounts(); window.__playReady=true;
  const cur=P.cur; if(cur&&cur.day===ep&&(cur.phase==='work'||cur.phase==='triage')&&Q.get('fresh')!=='1'){ restoreDay(cur); return; }
  P.cur=null; startBriefing(); }
async function stageUp(){ if(NO_STAGE){ $('stage').style.display='none'; return; } const extra=Object.values(D.npcs||{}).filter(n=>n.seat&&!['lead','senior','chief','staff'].includes(n.seat)).map(n=>`${n.seat}:${n.ch}`).join(',');
  const seats=Object.values(D.npcs||{}).filter(n=>n.seat&&['chief','staff'].includes(n.seat)).map(n=>`${n.seat}:${n.ch}`).join(',');
  const me=playerChar(P&&P.avatar);
  /* 고른 성별을 3D 로 넘긴다 — 대표 "여자로 설정해도 남자로 나온다".
     정본은 `?player=`(39차 제공). `&me=` 는 그 전 이름이라 함께 붙여 둔다. */
  $('stage').src=`office.html?embed=1&team=${S.team}${extra?'&extra='+extra:''}${seats?'&seats='+seats:''}&player=${me}&me=${me}`;
  await new Promise(res=>{ const t0=Date.now(); const iv=setInterval(()=>{ let O=null; try{ O=$('stage').contentWindow&&$('stage').contentWindow.__office; }catch(e){} if(O){ /* 3D 쪽 진행 문구(「NPC 불러오는 중…」)는 화면에 옮기지 않는다 — 로딩은 「로딩 중」 한 줄이다 */
        try{ for(const [n,v] of Object.entries(D.npcs||{})) if(v.seat) O.setLabel(v.seat,n); const doc=$('stage').contentDocument; const st=doc&&doc.getElementById('status'); if(st) console.info('[사무실]',st.textContent); }catch(e){} if(O.ready&&O.ready()){ clearInterval(iv); res(); } } if(Date.now()-t0>150000){ clearInterval(iv); toast('사무실을 불러오지 못해 글로 진행해요'); res(); } },250); });
  const O=office(); if(O){ try{ if(typeof O.setPlayerChar==='function') O.setPlayerChar(me); }catch(e){}
    try{ for(const [n,v] of Object.entries(D.npcs||{})) if(v.seat) O.setLabel(v.seat,n); O.camFollow(true); O.view('default'); }catch(e){}
    /* 말을 걸면 대화 모드가 열린다 — 대표 "말을 걸었으면 말을 할 수 있게 해줘, 이야기를." */
    try{ if(typeof O.onTalk==='function') O.onTalk((info)=>{ if(window.Talk) Talk.onNpc(info); }); }catch(e){} } }
/* 머리 위 안내 문구 — 오늘 그 사람에게 할 일이 있으면 그것을 적는다(없으면 기본 문구) */
function refreshTalkHints(){ const O=office(); if(!O||typeof O.setTalkHint!=='function'||!D) return;
  for(const d of (D.dests||[])){ if(!d.seat) continue; let tx='';
    try{ const t=(window.Talk&&Talk.tasks)?Talk.tasks(d.name):[]; if(t.length) tx=t[0].hint||''; }catch(e){}
    try{ O.setTalkHint(d.seat,tx); }catch(e){} } }
function restoreDay(cur){ Object.assign(S,{t:cur.t,cards:cur.cards,order:cur.order,extra:cur.extra||[],ncs:cur.ncs,trust:cur.trust||{},counts:Object.assign(S.counts,cur.counts||{}),nexts:cur.nexts||[],mistakes:cur.mistakes||[],triage:cur.triage||null,clues:cur.clues||[]}); for(const a of AXES) if(!S.ncs[a]) S.ncs[a]=[];
  for(const c of D.cards) if(!S.cards[c.id]) S.cards[c.id]={arrived:false,status:'wait'};
  S.phase=cur.phase==='triage'?'triage':'work'; S.running=S.phase==='work'; lastTick=0; renderClock(); rehydrateBoxes(); renderInbox(); renderCounts(); toast(`이어서 합니다 — ${fmtClock(S.t)}부터`); if(S.phase==='triage'){ $('triage').classList.add('open'); renderTriage(); } }

/* ---------- 권한 · 사규집 · 조직도 ---------- */
function renderUnlocks(){ const box=$('unlocks'); box.innerHTML=''; for(const k of ['rulebook','approval','orgchart','report','decide']){ const on=(D.unlock||[]).includes(k); const s=h('span','chip '+(on?'on':''),(on?'':'🔒 ')+UNLOCK_LABEL[k]); s.title=on?'열림':`${UNLOCK_DAY[k]}일차에 열립니다`; box.appendChild(s); }
  $('tabRule').classList.toggle('lock',!(D.unlock||[]).includes('rulebook')); $('tabOrg').classList.toggle('lock',!(D.unlock||[]).includes('orgchart')); }
function showTab(name){ for(const t of ['hint','rule','org','prog']){ $('tab_'+t).style.display=t===name?'block':'none'; $('tab'+t.charAt(0).toUpperCase()+t.slice(1)).classList.toggle('cur',t===name); } if(name==='prog') renderProgTab(); if(name==='rule') renderRulebook(); }
$('tabHint').onclick=()=>showTab('hint'); $('tabProg').onclick=()=>showTab('prog');
$('tabRule').onclick=()=>{ if(!(D&&(D.unlock||[]).includes('rulebook'))){ toast('사규집은 2일차에 받아요.'); return; } showTab('rule'); };
$('tabOrg').onclick=()=>{ if(!(D&&(D.unlock||[]).includes('orgchart'))){ toast('조직도는 4일차에 열려요.'); return; } showTab('org'); };
let RB_BOOK=null;
function initRulebook(){ const RB=window.OC&&OC.data&&OC.data.RULEBOOK; const sel=$('rbBook'); sel.innerHTML=''; if(!RB){ $('rbList').textContent='사규집 데이터가 없어요.'; return; } const books=RB.books.slice().sort((a,b)=>(a.key===S.team?-1:b.key===S.team?1:0)); for(const b of books){ const o=document.createElement('option'); o.value=b.key; o.textContent=b.title; sel.appendChild(o); } RB_BOOK=books[0].key; sel.value=RB_BOOK; renderRulebook(); }
/* 조문 한 덩이를 문장 단위로 끊는다. 마침표 뒤에서 자르되 「3.5」 같은 소수는 붙여 둔다 */
function ruleLines(body){ const out=[]; let cur=''; const s=String(body||'');
  for(let i=0;i<s.length;i++){ const ch=s[i]; cur+=ch;
    if((ch==='.'||ch==='。')&&!/\d/.test(s[i+1]||'')){ const t=cur.trim(); if(t) out.push(t); cur=''; } }
  const t=cur.trim(); if(t) out.push(t); return out; }
/* 숫자·기한·금액은 굵게 — 조문에서 학생이 실제로 옮겨 적는 것이 그것이다 */
const RULE_NUM=/\d[\d,.]*\s*(?:원|일|시간|분|개월|년|주|%|퍼센트|영업일|건|회|배|명)?/g;
function ruleLine(text){ const p=h('p'); let last=0; let m;
  RULE_NUM.lastIndex=0;
  while((m=RULE_NUM.exec(text))){ if(m.index>last) p.appendChild(document.createTextNode(text.slice(last,m.index)));
    p.appendChild(h('em',null,m[0])); last=m.index+m[0].length; }
  if(last<text.length) p.appendChild(document.createTextNode(text.slice(last)));
  return p; }
/* 지금 쓰고 있는 카드가 근거로 삼는 조항 번호 — 있으면 목록 맨 위로 끌어 올린다 */
function relatedRuleIds(){ try{ if(!S.composing) return []; const c=CARD(S.composing.id||S.composing); if(!c) return [];
    return (composeSpec(c).ruleFacts||[]).filter(x=>/^[A-Z]{2,4}-\d{2}$/.test(x)); }catch(e){ return []; } }
function ruleItem(a,hit){ const it=document.createElement('details'); it.className='art'+(hit?' hit':'');
  const sm=document.createElement('summary'); sm.appendChild(h('b',null,a.id)); sm.appendChild(h('span','t',a.title));
  const ins=mkBtn('번호 넣기','mini',()=>insertText(a.id));
  /* 요약줄 안의 단추다 — 누르면 접혔다 펴지는 것부터 막는다 */
  ins.addEventListener('click',ev=>{ ev.preventDefault(); ev.stopPropagation(); });
  sm.appendChild(ins); it.appendChild(sm);
  const bd=h('div','abody'); for(const ln of ruleLines(a.body)) bd.appendChild(ruleLine(ln)); it.appendChild(bd);
  if(hit) it.open=true;
  return it; }
function renderRulebook(){ const RB=window.OC&&OC.data&&OC.data.RULEBOOK; if(!RB) return; const q=($('rbSearch').value||'').trim().toLowerCase(); const list=$('rbList'); list.innerHTML='';
  const rel=q?[]:relatedRuleIds(); const shown=new Set(); let n=0;
  if(rel.length){ const box=h('div'); let m=0;
    for(const b of RB.books) for(const a of b.articles){ if(!rel.includes(a.id)||shown.has(a.id)) continue; shown.add(a.id); box.appendChild(ruleItem(a,true)); m++; }
    if(m){ list.appendChild(h('div','rbCap','지금 쓰는 건과 관련된 조항')); list.appendChild(box); list.appendChild(h('div','rbCap sub','이 편의 조항 전체')); } }
  for(const b of RB.books){ if(!q&&b.key!==RB_BOOK) continue;
    for(const a of b.articles){ if(shown.has(a.id)) continue;
      if(q&&!(a.id.toLowerCase().includes(q)||a.title.includes(q)||a.body.includes(q))) continue;
      list.appendChild(ruleItem(a,false)); n++; if(n>=60) break; }
    if(n>=60) break; }
  if(!n&&!shown.size) list.appendChild(h('div','empty-msg',q?'찾는 조항이 없어요':'')); }
$('rbBook').onchange=()=>{ RB_BOOK=$('rbBook').value; $('rbSearch').value=''; renderRulebook(); }; $('rbSearch').addEventListener('input',renderRulebook);
function insertText(t){ const ta=$('composeText'); if(!S.composing||$('composer').style.display==='none'){ toast('작성기를 연 뒤 넣을 수 있어요'); return; } const s=ta.selectionStart||ta.value.length; ta.value=ta.value.slice(0,s)+(s&&!/\s|\(/.test(ta.value[s-1])?' ':'')+`(${t})`+ta.value.slice(s); ta.dispatchEvent(new Event('input')); ta.focus(); }
function initOrg(){ const box=$('orgList'); box.innerHTML=''; for(const k of TEAM_ORDER){ const o=ORG[k]; const row=h('div','orgrow'+(k===S.team?' me':'')); row.appendChild(h('b',null,TEAM_NAMES[k])); const here=Object.entries(D.npcs||{}).filter(([n,v])=>v.teamKey===k||(k===S.team&&!v.teamKey)).map(([n])=>n); row.appendChild(h('span',null,`${o.lead} · ${o.senior} · ${o.chief}`+(here.length?` — 지금 이 방: ${uniq(here).join(', ')}`:''))); box.appendChild(row); } }
function renderProgTab(){ const box=$('tab_prog'); box.innerHTML=''; box.appendChild(h('h4',null,`${S.name?S.name+' · ':''}${S.code||'데모'}`)); const ul=h('div','progdays'); for(let d=1; d<=7; d++){ const done=P&&P.done[String(d)]; const cur=d===S.ep; const e=h('div','pd '+(done?'done':cur?'cur':'lock'),`${d}일차 ${DAY_TITLES[d]||''} ${done?'✓':cur?'(오늘)':''}`); ul.appendChild(e); } box.appendChild(ul);
  const tr=Object.entries(Object.assign({},P&&P.trust||{})); for(const [n,v] of Object.entries(S.trust||{})){ const i=tr.findIndex(x=>x[0]===n); if(i>=0) tr[i][1]+=v; else tr.push([n,v]); } if(tr.length) box.appendChild(h('div','muted','신뢰: '+tr.map(([n,v])=>`${n} ${v>0?'+':''}${v}`).join(', ')));
  const cl=S.clues.length+((P&&P.clues&&Object.values(P.clues).reduce((a,b)=>a+b.length,0))||0); box.appendChild(h('div','muted',`모은 단서 ${cl}개`)); const ft=h('div','paneFoot'); box.appendChild(ft); ft.appendChild(mkBtn('홈으로','',()=>goHome(true))); }

/* ---------- 브리핑 ---------- */
function startBriefing(){ S.phase='briefing'; S.briefI=0; $('dialog').classList.add('open'); showBrief(); }
function showBrief(){ const L=D.dialog.briefing||[]; const l=L[S.briefI]; if(!l){ endBriefing(); return; } $('dWho').textContent=`${l.who}${l.role?' ('+l.role+')':''}`; $('dTx').textContent=(l.text||'').replace(/○○씨/g,(S.name||'○○')+'씨'); $('dNext').textContent=S.briefI===L.length-1?'업무 시작':'다음';
  const O=office(); if(O){ try{ if(l.view) O.view(l.view); bubble(l.who,l.text,9); }catch(e){} } }
$('dNext').onclick=()=>{ if(S.phase!=='briefing') return; S.briefI++; showBrief(); }; $('dSkip').onclick=()=>{ if(S.phase==='briefing') endBriefing(); };
function endBriefing(){ $('dialog').classList.remove('open'); const O=office(); if(O){ try{ O.hush(); O.view('default'); }catch(e){} } S.phase='work'; S.running=true; lastTick=0; arrivals();
  if(D.triage&&!(S.triage&&S.triage.done)){ startTriage(); return; }
  const L=D.todoLabels||['답할 것','넘길 것','물어볼 것']; toast(`메일함이 열렸어요. ${L.join(' / ')}을 나눠 보세요.`); saveProgress(); }
$('triageGo').onclick=()=>finishTriage();

/* ---------- 09:30 · 마무리 · 디브리프 ---------- */
/* 퇴근 시각. 상시 배너를 세워 두고 학생이 아무 때나 누르게 하지 않는다 —
   팀장이 자리로 와서 하루가 닫힌다(「일어나는 일」). 3D 쪽 연출 훅이 붙으면
   그것을 기다리고, 아직 없으면 안내를 2초 띄우고 그대로 디브리프로 넘어간다.
   필요한 API 는 docs/office-api-requests.md 「leadVisit」에 적어 두었다. */
async function onDayEnd(){ S.running=false; closeComposer(); $('endbar').classList.remove('open');
  const lead=(D.dests.find(x=>x.seat==='lead')||{}).name||'팀장';
  toast('퇴근 시간입니다. 팀장이 결과를 보러 옵니다.',lead,4500,'cust');
  try{ bubble(lead,'30분 지났어요. 결과 볼까요?',6); }catch(e){}
  $('enTitle').textContent='퇴근 시간입니다'; $('enSub').textContent=`${lead}이 결과를 보러 옵니다.`;
  $('endNotice').classList.add('open');
  const O=office(); if(O&&typeof O.leadVisit==='function'){ try{ await O.leadVisit(); }catch(e){} }
  await sleep(NO_STAGE?300:2000);
  $('endNotice').classList.remove('open'); finish(); }
/* 하루가 끝나기 전에 남은 일이 없으면 그때는 끝낼 자격이 생긴 것이라 버튼을 보인다 */
function checkAllDone(){ if(!D||S.phase!=='work'||S.ended) return;
  const main=D.cards.filter(c=>!c.pre);
  if(!main.length||main.some(c=>{ const st=S.cards[c.id]; return !st||st.status!=='done'; })) { $('endbar').classList.remove('open'); return; }
  const un=D.cards.concat(S.extra).filter(c=>{ const st=S.cards[c.id]; return st&&st.arrived&&st.status!=='done'; });
  if(un.length){ $('endbar').classList.remove('open'); return; }
  $('endbarTx').textContent='오늘 할 일을 다 했습니다.'; $('endbar').classList.add('open'); }
$('finishBtn').onclick=()=>finish(); $('moreBtn').onclick=()=>{ $('endbar').classList.remove('open'); toast('더 보고 있어도 됩니다. 다 봤으면 일시정지 메뉴에서 「오늘 그만하기」를 누르세요.'); };
function finish(){ if(S.phase==='debrief') return; S.phase='debrief'; S.running=false; closeComposer(); $('endbar').classList.remove('open');
  for(const c of D.cards.concat(S.extra)){ const st=S.cards[c.id]; if(!st||st.status==='done') continue;
    if(!st.arrived){ st.status='skipped'; st.act='none'; st.score=null; continue; }
    const steps=st.steps||{};
    if(c.followup){ st.status='done'; st.act='none'; st.score=null; continue; }
    if(c.scored===false&&c.mode==='story'&&!c.alsoReply){ runBranch(c.id,'none'); st.status='done'; st.score=null; st.act='none'; continue; }
    if(c.unscored||c.axis==='self'){ runBranch(c.id,'blank'); st.status='done'; st.score=null; st.act='none'; S.ncs['4'].push(0); continue; }
    if(steps.deliver&&!steps.reply&&flowOf(c).includes('reply')){ st.late=true; record(c.id,{act:'deliver',score:50,comment:'전달은 했지만 고객에게 어디로 넘어갔는지 알리지 않았어요.'}); runBranch(c.id,'noReply'); continue; }
    if(steps.report&&!steps.reply){ record(c.id,{act:'report',score:Math.round((steps.report.score||0)/2),comment:'보고는 했지만 고객 회신이 없었어요.'}); continue; }
    if(steps.reply&&flowOf(c).includes('reply2')&&!steps.reply2){ record(c.id,{act:'reply',score:Math.round((steps.reply.score||0)/2),comment:'안내 회신이 빠졌어요.'}); continue; }
    if(steps.work&&!steps.deliver){ record(c.id,{act:'work',score:50,comment:'검산은 맞았지만 팀장에게 가져가지 않았어요.'}); continue; }
    st.status='done'; st.act='none'; st.score=0; st.comment='처리하지 못했어요.'; st.late=true; if(c.scored!==false){ for(const a of (c.ncs||[])) if(a!=='5'&&a!=='9') S.ncs[a].push(0); S.ncs['5'].push(0); } if(c.clue&&(D.branches[c.id]||{}).other&&D.branches[c.id].other.clueGap) st.clueGap=true; }
  /* 디브리프 추가 대사(예: 조력자가 먼저 연락 — 신뢰 조건)와 그 단서 */
  for(const ex of ((D.dialog.debrief||{}).extra||[])){ if(!extraCondMet(ex)) continue; if(ex.clue&&!S.clues.some(k=>k.card===(ex.clue.card||'extra'))) S.clues.push({caseId:ex.clue.caseId,day:S.ep,card:ex.clue.card||'extra',note:ex.clue.note,value:ex.clue.value||null,label:ex.clue.day||null}); }
  const res=buildResult(); P.done[String(S.ep)]=res; P.day=Math.max(P.day||1,S.ep+1); P.cur=null; for(const [n,v] of Object.entries(S.trust)) P.trust[n]=(P.trust[n]||0)+v; for(const k of S.clues){ (P.clues[k.caseId]=P.clues[k.caseId]||[]); if(!P.clues[k.caseId].some(x=>x.card===k.card&&x.day===k.day)) P.clues[k.caseId].push(k); } P.unlocked=uniq((P.unlocked||[]).concat(D.unlock||[]));
  saveProgress(true); renderDebrief(res); $('debrief').classList.add('open'); }
function extraCondMet(ex){ if(!ex.cond) return true; const who=ex.cond.npc||ex.who; if(ex.cond.trustMin!=null&&trustOf(who)<ex.cond.trustMin) return false; return true; }
function ncsAvg(){ const out={}; for(const a of AXES){ const v=S.ncs[a]; if(v&&v.length) out[a]=Math.round(v.reduce((x,y)=>x+y,0)/v.length); } return out; }
function metricValue(rule){ const m=(rule&&rule.metric)||'done'; const c=S.counts; if(m==='cite') return c.cite; if(m==='calc') return c.calc; if(m==='rightNpc') return c.rightNpc; if(m==='rejectRight') return c.reject; if(m==='deadline') return c.promise; return c.done; }
function leadLevel(rule){ const v=metricValue(rule); const hi=(rule&&rule.hi)!=null?rule.hi:11, mid=(rule&&rule.mid)!=null?rule.mid:8; if(rule&&rule.metric==='deadline'){ if(v===0&&S.counts.done>=Math.max(1,Math.min(8,Math.round(D.cards.filter(c=>!c.pre&&c.scored!==false).length*0.7)))) return 'hi'; if(v>=1) return 'mid'; return 'low'; } if(rule&&rule.metric==='rightNpc'){ return v>=hi?'hi':v>=mid?'mid':'low'; } return v>=hi?'hi':v>=mid?'mid':'low'; }
function buildResult(){ const cards={}; const scoredIds=[]; for(const c of D.cards.concat(S.extra)){ const s=S.cards[c.id]; if(!s) continue; cards[c.id]={act:s.act,score:s.score,at:s.doneAt!=null?s.doneAt:null,late:!!s.late,branch:s.branch||null,choice:s.choice||null,forbidHit:!!s.forbidHit,replyBanHit:!!s.replyBanHit,partial:!!s.partial,delivered:!!s.delivered,workOk:s.workOk==null?null:!!s.workOk,text:s.text||null,text2:s.text2||null,answer:s.answer||null,status:s.status,source:s.source||null}; if(c.scored!==false&&!c.followup&&s.arrived&&!c.unscored&&c.axis!=='self') scoredIds.push(c.id); }
  const mainIds=scoredIds.filter(id=>!(CARD(id)||{}).pre);   /* 전날 분기로 끼어든 카드는 「처리 n/전체」 셈에서 뺀다 */
  const done=mainIds.filter(id=>S.cards[id].status==='done'&&S.cards[id].act!=='none').length; S.counts.done=done;
  let mistake=null; const pri=scoredIds.filter(id=>S.mistakes.includes(id)); const pool=(pri.length?pri:scoredIds).slice().sort((a,b)=>(S.cards[a].score??0)-(S.cards[b].score??0)); if(pool.length&&(S.cards[pool[0]].score??0)<100) mistake=pool[0];
  const deb=D.dialog.debrief||{}; const level=leadLevel(deb.leadRule); const lead=(deb.lead&&deb.lead[level])||'';
  let mline=''; if(mistake){ const s=S.cards[mistake]; const ml=deb.mistakeLines&&deb.mistakeLines[mistake]; if(ml&&(typeof ml==='string')) mline=ml; else if(ml&&ml.text&&(!s.branch||!ml.when||true)) mline=ml.text; else { const c=CARD(mistake); mline=s.comment||(c.act&&c.act[s.act]?c.act[s.act][1]:''); } }
  const skipped=D.cards.filter(c=>S.cards[c.id]&&S.cards[c.id].status==='skipped').map(c=>c.subj);
  return {team:S.team,ep:S.ep,day:D.day,at:new Date().toISOString(),cards,ncs:ncsAvg(),trust:Object.assign({},S.trust),clues:S.clues.slice(),mistake,mistakeLine:mline,leadLine:lead,level,counts:Object.assign({},S.counts,{done,all:mainIds.length}),nexts:S.nexts.slice(),triage:S.triage?{score:S.triage.score,hit:S.triage.hit,total:S.triage.total}:null,skipped,clueGaps:D.cards.filter(c=>S.cards[c.id]&&S.cards[c.id].clueGap).map(c=>c.subj)}; }
/* 누가 한 말인지 색으로 가른다 — 흰 상자만 늘어놓으면 벽으로 읽힌다(대표 확정 스펙 §4) */
function roleHue(who){ const v=npcInfo(who); const r=(v&&v.role)||'';
  if(/팀장/.test(who+r)) return ROLE_HUE['팀장'];
  if(/사수|선임/.test(r)) return ROLE_HUE['사수'];
  if(r==='동기'||who===peerName()) return ROLE_HUE['동기'];
  return '#5b6675'; }
function sayRow(host,who,text,cls){ if(!text) return; const d=h('div','say'); d.style.setProperty('--rc',roleHue(who));
  const w2=h('div','who'); const av=h('span','av',(who||'?').trim().charAt(0)); w2.appendChild(av); w2.appendChild(h('span',null,who));
  d.appendChild(w2); d.appendChild(h('div','tx '+(cls||''),text.replace(/○○씨/g,(S.name||'○○')+'씨'))); host.appendChild(d); }
function renderDebrief(r){ const w=$('dbWrap'); w.innerHTML=''; const say=(who,text,cls)=>sayRow(w,who,text,cls);
  w.appendChild(h('h1',null,`${D.teamName} ${D.ep}일차 「${D.title}」 끝`)); w.appendChild(h('div','sub',`${fmtClock(D.minutes)} 퇴근 준비. 팀장이 다가옵니다.`));
  const grid=h('div','grid'); w.appendChild(grid);
  const box1=h('div','box'); box1.style.setProperty('--bc',BOX_HUE.summary); box1.appendChild(h('h3',null,'오늘 요약')); const kpi=h('div','kpi'); const items=[['처리',`${r.counts.done}/${r.counts.all}`],['넘김',r.counts.pass],['물어봄',r.counts.ask]]; if(r.counts.cite) items.push(['조항 인용',r.counts.cite]); if(r.counts.calcAll) items.push(['계산 정확',`${r.counts.calc}/${r.counts.calcAll}`]); if(r.counts.rightNpc||r.counts.wrongNpc) items.push(['맞는 상대',`${r.counts.rightNpc}/${r.counts.rightNpc+r.counts.wrongNpc}`]); if(r.counts.rejectAll) items.push(['거절·상신',`${r.counts.reject}/${r.counts.rejectAll}`]); if(r.triage) items.push(['"지금" 칸',`${r.triage.hit}/${r.triage.total}`]); if(r.counts.follow) items.push(['재문의',r.counts.follow]);
  /* 라벨을 숫자 위에 둔다 — 아래에 두면 「13/13 2 1」이 무엇을 센 것인지 읽히지 않는다 */
  for(const [n,v] of items){ const d=h('div'); d.appendChild(h('small',null,n)); d.appendChild(h('b',null,String(v))); kpi.appendChild(d); } box1.appendChild(kpi);
  /* 제목 · 행동 · 점수 세 열. 점수만 따로 떼어야 오른쪽에서 자릿수가 맞는다 */
  const tbl=h('div','ctbl'); for(const c of D.cards){ const s=S.cards[c.id]; if(!s||c.scored===false&&c.mode==='story'||s.status==='skipped') continue;
    tbl.appendChild(h('span','n',c.subj));
    const scored=s.score!=null;
    /* 상태는 칩으로 — 회색 글자 「미처리」는 화면에서 사라진다(대표 확정 스펙 §3) */
    let label=scored?actLabel(s.act):(c.unscored||c.axis==='self'?(s.text?'기록함':'기록 없음'):'—');
    /* 칩 색과 글자가 어긋나면 안 된다 — 늦게 낸 건은 색만 바꾸지 말고 그렇게 적는다 */
    if(scored&&s.late&&s.act!=='none') label+=' · 늦음';
    const chip=h('span','a '+chipKind(s,label),label); if(!scored&&!(c.unscored||c.axis==='self')) chip.classList.add('plain');
    tbl.appendChild(chip);
    const v=h('span','v',scored?String(s.score):'');
    if(scored) v.classList.add(s.score===0?'zero':s.score>=80?'hi':s.score<60?'lo':'mid'); tbl.appendChild(v); }
  box1.appendChild(tbl); if(r.skipped.length) box1.appendChild(bnote('끝나지 않은 건',r.skipped.join(', '))); grid.appendChild(box1);
  const box2=h('div','box'); box2.style.setProperty('--bc',BOX_HUE.ncs); box2.appendChild(h('h3',null,'오늘 켜진 역량 (NCS)')); box2.appendChild(ncsBars(r.ncs)); const tr=Object.entries(r.trust);
  if(tr.length) box2.appendChild(bnote('신뢰',tr.map(([n,v])=>`${n} ${v>0?'+':''}${v}`).join(', ')));
  if(r.clues.length) box2.appendChild(bnote('오늘 모은 단서',r.clues.map(k=>k.note).join(' / ')));
  if(r.clueGaps.length) box2.appendChild(bnote('빈 단서',r.clueGaps.join(', ')+' — 7일차 취합표가 빕니다',true)); grid.appendChild(box2);
  const lead=(D.dests.find(x=>x.seat==='lead')||{}).name||'팀장'; say(lead,r.leadLine);
  const mbox=h('div','box'); mbox.style.setProperty('--bc',BOX_HUE.mistake); mbox.appendChild(h('h3',null,'오늘의 실수 1')); if(r.mistake){ const c=CARD(r.mistake); mbox.appendChild(h('div',null,c.subj)); const ml=(D.dialog.debrief.mistakeLines||{})[r.mistake]; const who=(ml&&ml.who)||(D.dests.find(x=>x.seat==='senior')||{}).name||'사수'; const l=h('div','muted',`${who}: ${r.mistakeLine}`); mbox.appendChild(l); } else mbox.appendChild(h('div',null,'눈에 띄는 실수가 없었어요. 드문 일이에요.')); w.appendChild(mbox);
  const senior=(D.dests.find(x=>x.seat==='senior')||{}).name||'사수'; say(senior,D.dialog.debrief.senior);
  for(const ex of (D.dialog.debrief.extra||[])){ if(extraCondMet(ex)) say(ex.who,ex.text,ex.msg?'msg':''); }
  const peer=Object.entries(D.npcs).find(([n,v])=>v.role==='동기'); say(peerName(),D.dialog.debrief.peer,'msg');
  if(r.nexts.length){ const box=h('div','box'); box.style.setProperty('--bc',BOX_HUE.next); box.appendChild(h('h3',null,'내일로 이어지는 것')); const ul=h('ul');
    /* 겹치는 예고를 걷어낸다. 글자가 똑같은 것만 걸러서는 부족했다 — 「물류팀 오대리가 이름을 기억한다 · 다시 가면 "또 오셨네요"」와
       「그 자리에 다시 가면 "또 오셨네요"」처럼 한쪽이 다른 쪽에 통째로 담긴 경우가 남아 같은 말이 두 번 떴다. 짧은 쪽을 버리고 긴 쪽만 남긴다. */
    const norm=(s)=>String(s||'').replace(/[\s"'"「」·—-]/g,'');
    const named=(s)=>/(팀|님|과장|차장|부장|대리|주임|선임)/.test(s);   /* 사람·팀을 짚었으면 구체적인 줄이다 */
    const tail=(a,b)=>{ let i=0; while(i<a.length&&i<b.length&&a[a.length-1-i]===b[b.length-1-i]) i++; return i; };
    const items=[]; for(const n of r.nexts){ const k=norm(n.text); if(!k) continue;
      /* ① 한쪽이 다른 쪽에 통째로 담겼거나 ② 결과 문구를 12자 넘게 공유하는데 한쪽만 사람·팀을 짚었으면 같은 예고로 본다 */
      const dup=items.findIndex(x=> x.k.includes(k)||k.includes(x.k)
        || (tail(x.k,k)>=12 && named(x.text)!==named(n.text)) );
      if(dup<0){ items.push({k,text:n.text}); continue; }
      if(named(n.text)&&!named(items[dup].text)) items[dup]={k,text:n.text};
      else if(named(n.text)===named(items[dup].text)&&k.length>items[dup].k.length) items[dup]={k,text:n.text}; }
    for(const it of items) ul.appendChild(h('li',null,it.text));
    box.appendChild(ul); w.appendChild(box); }
  if(D.dialog.debrief.nextEp) w.appendChild(h('div','sub next',D.dialog.debrief.nextEp));
  const ft=h('div','foot'); if(S.ep<7) ft.appendChild(mkBtn(`${S.ep+1}일차로`,'pri',()=>goDay(S.team,S.ep+1))); ft.appendChild(mkBtn('홈으로','',()=>goHome(false))); ft.appendChild(mkBtn('오늘 다시','',()=>{ delete P.done[String(S.ep)]; P.cur=null; saveProgress(true); goDay(S.team,S.ep); })); ft.appendChild(mkBtn('사무실 보기','',()=>$('debrief').classList.remove('open'))); w.appendChild(ft); }
function peerName(){ const m=(D.dialog.briefing||[]).find(l=>l.role==='동기'); if(m) return m.who; const org=ORG[S.team]; return org?({cs:'윤하린',logi:'정수빈',acct:'임도윤',ga:'백하은',rec:'송민재',plan:'안예린',qc:'유하늘',pr:'곽민서',edu:'차은우',buy:'하지원'}[S.team]||'동기'):'동기'; }
/* 「무엇을 했나」를 한 낱말로 갈라 칩 색을 정한다 */
function chipKind(st,label){ if(st.act==='none'||label==='미처리'||label==='기록 없음') return 'k-none';
  if(st.late) return 'k-late';
  if(['delegate','deliver','hold'].includes(st.act)) return 'k-pass';
  if(['ask','confirm'].includes(st.act)) return 'k-ask';
  return 'k-done'; }
/* 막대·목록 아래에 붙는 딸림 줄. 이름표를 굵게 앞세우고 위에 선을 그어 본문과 끊는다 */
function bnote(label,text,bad){ const d=h('div','bnote'+(bad?' bad':'')); d.appendChild(h('b',null,label)); d.appendChild(document.createTextNode(text)); return d; }
/* 축마다 고유색. 0점 축은 채움이 없어 색이 안 보이므로 트랙 왼쪽 3px 마커를 늘 남기고
   행 바탕을 옅게 깐다 — 0 이 열 줄이어도 화면이 비어 보이지 않게(대표 확정 스펙 §1). */
function ncsBars(ncs){ const box=h('div','ncs'); const fills=[];
  for(const a of AXES){ if(ncs[a]==null) continue; const v=ncs[a]; const col=NCS_HUE[a]||'#1f4e8c';
    const row=h('div','ncsRow'+(v<=0?' zero':'')); row.style.setProperty('--c',col);
    const ax=h('span','ax'); const dot=h('i'); dot.style.background=col; ax.appendChild(dot);
    ax.appendChild(document.createTextNode(`${CIRC[a]} ${NCS_NAMES[a]}`)); row.appendChild(ax);
    const b=h('div','b'); b.style.background=col+'1f'; const i=h('i'); b.appendChild(i); row.appendChild(b); fills.push([i,v]);
    row.appendChild(h('span','v',String(v))); box.appendChild(row); }
  requestAnimationFrame(()=>{ for(const [i,v] of fills) i.style.width=v+'%'; });
  return box; }

/* ---------- 일시정지 · 모바일 ---------- */
/* 일시정지는 메뉴다 — 「오늘 그만하기」를 이 안에 넣어 눈에 띄지 않게 둔다 */
function setPaused(on){ S.paused=!!on; $('pause').classList.toggle('on',S.paused); $('pause').textContent=S.paused?'계속하기':'일시정지';
  const O=office(); if(O){ try{ O.freeze(S.paused); }catch(e){} } }
function pauseMenu(on){ $('pauseMenu').hidden=!on; $('pause').setAttribute('aria-expanded',String(!!on)); }
$('pause').onclick=(ev)=>{ ev.stopPropagation(); if($('pauseMenu').hidden){ setPaused(true); pauseMenu(true); toast('일시정지. 시계와 사무실이 멈췄어요.'); } else { pauseMenu(false); setPaused(false); } };
$('pmResume').onclick=()=>{ pauseMenu(false); setPaused(false); };
/* 대표 "성별 어떻게 골라?" — 홈 화면과 이 메뉴에서 언제든 바꾼다 */
$('pmAvatar').onclick=async()=>{ pauseMenu(false); const g=await askAvatar(true); setPaused(false); if(g) await changeAvatar(g); };
/* 고른 성별을 지금 화면에 반영한다. 3D 가 갈아 끼우기를 지원하면 그것으로, 아니면 무대를 다시 세운다. */
async function changeAvatar(g){ if(!P||P.avatar===g) return; P.avatar=g; setAvatarPref(g); saveProgress(true);
  const me=playerChar(g); const O=office();
  if(O&&typeof O.setPlayerChar==='function'){ try{ O.setPlayerChar(me); toast('캐릭터를 바꿨어요.'); return; }catch(e){} }
  if(NO_STAGE){ toast('캐릭터를 바꿨어요.'); return; }
  $('loading').classList.remove('off'); await stageUp(); $('loading').classList.add('off'); toast('캐릭터를 바꿨어요.'); }
$('pmQuit').onclick=()=>{ const left=D?D.cards.concat(S.extra).filter(c=>{ const st=S.cards[c.id]; return st&&st.status!=='done'; }).length:0;
  if(!confirm(`남은 업무 ${left}건은 미처리로 기록됩니다. 그만할까요?`)) return;
  pauseMenu(false); setPaused(false); finish(); };
document.addEventListener('click',(ev)=>{ if($('pauseMenu').hidden) return; if($('pauseWrap').contains(ev.target)) return; pauseMenu(false); setPaused(false); });
$('inboxHd').onclick=()=>{ if(window.innerWidth<=760) $('inbox').classList.toggle('up'); };
/* 홈(소개 페이지)으로 나가는 길은 한 곳에서만 만든다 — 화면마다 문구와 동작이
   달라지지 않게. 하루 도중이면 물어보고, 저장이 실제로 끝난 뒤에 옮긴다. */
async function goHome(ask){
  const mid=(S.phase==='work'||S.phase==='triage'||S.phase==='ep7');
  if(ask&&mid&&!confirm('진행은 저장됩니다. 홈으로 나갈까요?')) return;
  if(mid){ try{ saveProgress(true); }catch(e){}
    setStatus('저장하는 중…');
    const B=window.Backend;
    if(B&&typeof B.flush==='function'){ try{ await withTimeout(Promise.resolve(B.flush()),6000); }catch(e){} }
    else await sleep(250); }
  location.href='home.html';
}
$('homeBtn').onclick=()=>goHome(true);
const pcHomeBtn=$('pcHome'); if(pcHomeBtn) pcHomeBtn.onclick=()=>goHome(true);
$('loadBack').onclick=()=>goHome(false);
$('cClose').onclick=closeCard;
(async()=>{ try{ await (window.__backendReady||Promise.resolve()); }catch(e){} if(window.Backend&&typeof window.Backend.configure==='function'&&Q.get('api')){ try{ window.Backend.configure(Q.get('api')); }catch(e){} }
  if(Q.get('home')==='1'){ const c=(Q.get('code')||'').trim(); if(c){ S.code=c.toUpperCase(); try{ localStorage.setItem('ws7.code',S.code); }catch(e){} } showHome(); } else boot(); })();

/* ---------- 스모크·자동 플레이용 ---------- */
window.__play={ get ready(){ return !!window.__playReady; }, state:()=>({t:S.t,clock:fmtClock(S.t),phase:S.phase,ended:S.ended,paused:S.paused,ep:S.ep,team:S.team,cards:JSON.parse(JSON.stringify(S.cards)),ncs:ncsAvg(),trust:S.trust,counts:S.counts,nexts:S.nexts,mistakes:S.mistakes,order:S.order,clues:S.clues,triage:S.triage}),
  skip:(min)=>{ if(S.phase==='briefing') endBriefing(); advance(+min||0); return fmtClock(S.t); }, skipBriefing:()=>{ if(S.phase==='briefing') endBriefing(); }, open:(id)=>openCard(id), office, finish, data:()=>D, progress:()=>P, save:()=>P&&P.done[String(S.ep)], triage:(assign)=>{ if(!S.triage) return null; Object.assign(S.triage.assign,assign); finishTriage(); return S.triage; },
  async act(id,key,p={}){ const c=CARD(id); if(!c) throw new Error('없는 카드: '+id); if(!S.cards[id].arrived) throw new Error('아직 도착 안 함: '+id); openCard(id);
    if(key==='reply'||key==='reply2'||key==='reject'||key==='confirm'){ if(c.mode==='reflect'){ doPick(id,p.id); return S.cards[id]; } openComposer(id,key==='reply2'?'reply2':'reply',key==='reply2'?'reply':key); $('composeText').value=p.text||''; $('composeText').dispatchEvent(new Event('input')); await sendCompose(id,p.text||'',key==='reply2'?'reply2':'reply',key==='reply2'?'reply':key,p.answer!=null?String(p.answer):null); return S.cards[id]; }
    if(key==='approval'){ openComposer(id,'approval'); await sendCompose(id,p.text||'',"approval",'reject',p.answer!=null?String(p.answer):null); return S.cards[id]; }
    if(key==='approve'){ doApprove(id); return S.cards[id]; }
    if(key==='work'){ doWork(id,(p.answer&&typeof p.answer==='object')?p.answer:String(p.answer)); return S.cards[id]; }
    if(key==='sheetDeliver'){ await doSheetDeliver(id,p.auto); return S.cards[id]; }
    if(c.mode==='phone'&&c.act[key]){ doPhone(id,key); return S.cards[id]; }
    if(key==='deliver'){ const d=D.dests.find(x=>x.name===p.to||x.seat===p.to||x.key===p.to)||{name:p.to,seat:seatByName(p.to),key:(npcInfo(p.to)||{}).teamKey,team:(npcInfo(p.to)||{}).team}; await doDeliver(id,d,p.auto); return S.cards[id]; }
    if(key==='ask'){ const d=D.dests.find(x=>x.name===p.to||x.seat===p.to||x.key===p.to)||{name:p.to,seat:seatByName(p.to),key:(npcInfo(p.to)||{}).teamKey,team:(npcInfo(p.to)||{}).team}; await doAsk(id,d,p.q==null?0:p.q); return S.cards[id]; }
    if(key==='report'){ await doReport(id,p.auto); return S.cards[id]; }
    if(key==='visit'){ await doVisit(id,p.auto); return S.cards[id]; }
    if(key==='pick'){ doPick(id,p.id); return S.cards[id]; }
    if(key==='stopShip'){ S.cards[id].stopShip=true; renderCardActs(id); return S.cards[id]; }
    if(key==='lookup'){ S.cards[id].lookup=true; renderCardActs(id); return S.cards[id]; }
    doButton(id,key); return S.cards[id]; } };
