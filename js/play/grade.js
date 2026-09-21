/* ======================================================================
   채점 — 규칙 채점(30차 §4 확장: 조항 인용·값·금지어·계산값·지적 항목) + AI 첨삭 훅(Backend.grade)
   ====================================================================== */
const RULE_ID=/\b[A-Z]{2,4}-\d{2}\b/g;
function normNum(s){ return String(s==null?'':s).replace(/[\s,원건일회%]/g,'').replace(/만$/,''); }
function includesAny(text,arr){ return (arr||[]).some(k=>k&&text.includes(k)); }
/* 금지 표현(45차: 「어렵습니다·불가합니다·곤란합니다」도 부정으로 본다): 바로 뒤에 부정("…이 아니라", "…지 않", "…수 없", "…지 마세요")이 오면 안내문으로 보고 넘어간다 */
function forbidHit(text,k){ let i=text.indexOf(k); while(i>=0){ const tail=text.slice(i+k.length,i+k.length+28); if(!/^(?:[^.。\n]{0,26})?(아니|않|없|마세요|말고|금지|안 |못 |어렵|어려|불가|곤란)/.test(tail)) return true; i=text.indexOf(k,i+1); } return false; }
/* 값 하나가 들어 있나: mustAlt 로 대체 표기 허용 */
function hasValue(text,k,alt){ if(text.includes(k)) return true; const a=(alt&&alt[k])||[]; return a.some(x=>text.includes(x)); }

/* 규칙 채점: 5요소 각 20 · mustInclude 누락 −15 · forbid −20 · replyCheck 미달이면 상한 · 조항 미인용이면 정보 축 상한 60 */
function gradeText(c,text,spec){ spec=spec||composeSpec(c); const isMsg=c.type==='msg'||spec.msg; const t=text||'';
  const must=spec.mustInclude||[]; const missing=must.filter(k=>!hasValue(t,k,spec.mustAlt)); const anyOk=!spec.mustAny||spec.mustAny.length===0||includesAny(t,spec.mustAny);
  const forbid=uniq((spec.forbid||[]).filter(k=>k&&forbidHit(t,k))); const rc=spec.replyCheck; const needOk=rc?rc.need.every(g=>g.some(k=>t.includes(k))):true;
  const rules=spec.ruleFacts||[]; const cited=rules.length?rules.some(id=>t.includes(id)):null;
  const els={ '인사':isMsg||/안녕하세요|안녕하십니까|감사|죄송/.test(t), '확인':/문의|주신|확인|말씀|받았|받으신|주문|요청|접수|건은|건이|건,|말씀하신|보내 주신|주셨/.test(t),
    '답':(must.length?missing.length===0:(rc?needOk:t.replace(/\s/g,'').length>=30))&&anyOk, '다음 행동':/드리겠|하겠|예정|안내|드릴게|할게|해 두|드립니다|주세요|주시면|반영|처리했|접수했|요청했|보고했|진행|회신드리|알려 드리|보내 드리/.test(t), '맺음':isMsg||/감사합니다|감사드립니다|드림|올림|부탁드립니다|양해 부탁|죄송합니다\.?\s*$/.test(t) };
  let score=Object.values(els).filter(Boolean).length*20; score-=missing.length*15; score-=forbid.length*20; if(!anyOk) score-=10;
  if(rc&&!needOk) score=Math.min(score,rc.partialScore||60); if(cited===false) score-=10; score=Math.max(0,Math.min(100,score));
  return {score,els,missing,forbid,partial:rc?!needOk:false,cited,anyOk,source:'규칙 채점'}; }
/* 카드에서 작성 규격을 모은다: compose > 낱개 필드(mustInclude/replyBan/ruleFacts) > 분기 표에서 온 금지 표현(forbid:…) */
function composeSpec(c,which){ const cp=(which==='second'?(typeof c.alsoReply==='object'?c.alsoReply:null):null)||c.compose||{}; const spec={mustInclude:cp.mustInclude||[],mustAny:cp.mustAny||c.mustAny||[],mustAlt:cp.mustAlt||c.mustAlt||null,forbid:(cp.forbid||[]).slice(),ruleFacts:cp.ruleFacts||[],replyCheck:c.replyCheck||null,model:cp.model||(c.replyCheck&&c.replyCheck.model)||''};
  if(which!=='second'){ if(!c.compose&&c.mustInclude&&c.mode!=='ask') spec.mustInclude=c.mustInclude; if(c.replyBan) spec.forbid=spec.forbid.concat(c.replyBan); if(!cp.ruleFacts&&c.ruleFacts&&Array.isArray(c.ruleFacts)&&c.ruleFacts.some(x=>/^[A-Z]{2,4}-\d{2}$/.test(x))) spec.ruleFacts=c.ruleFacts; }
  else { if(cp.replyBan) spec.forbid=spec.forbid.concat(cp.replyBan); }
  /* ask 카드: 받은 답 값(mustInclude)은 회신에 들어가야 한다 */
  if(c.mode==='ask'&&which!=='second'&&c.mustInclude&&!spec.mustInclude.length) spec.mustInclude=c.mustInclude;
  const br=(D&&D.branches&&D.branches[c.id])||{}; for(const k of Object.keys(br)){ if(k.startsWith('forbid:')){ const p=k.slice(7); if(p&&!spec.forbid.includes(p)) spec.forbid.push(p); } }
  spec.forbid=uniq(spec.forbid); spec.which=which==='second'?'reply2':'reply'; return spec; }
/* 조항 인용 검사(사규집 실재 여부 포함) */
function citedRules(text){ const ids=uniq((text.match(RULE_ID)||[])); const RB=(window.OC&&OC.data&&OC.data.RULEBOOK)||null; if(!RB) return {ids,unknown:[]}; const all=new Set(); for(const b of RB.books) for(const a of b.articles) all.add(a.id); return {ids,unknown:ids.filter(i=>!all.has(i))}; }
/* 계산값·결과값 대조 */
function checkWork(c,ans){ if(workCells(c)) return checkWorkCells(c,ans); const a=normNum(ans); if(!a) return {ok:false,trap:false}; const right=[c.workAnswer].concat(c.workAlt||[]).filter(Boolean).map(normNum); const trap=(c.workTrap||[]).map(normNum); if(right.includes(a)) return {ok:true,trap:false}; return {ok:false,trap:trap.includes(a)}; }
/* 답 칸이 여러 개인 표·양식: workAnswers:[{key,label,unit?,answer,alt?,trap?,hint?}] */
function workCells(c){ return Array.isArray(c.workAnswers)&&c.workAnswers.length?c.workAnswers:null; }
function checkWorkCells(c,ans){ const cells=workCells(c); const got=(typeof ans==='string')?(()=>{ try{ return JSON.parse(ans); }catch(e){ return {}; } })():(ans||{});
  const wrong=[]; let trap=false;
  for(const cell of cells){ const v=normNum(got[cell.key]); const right=[cell.answer].concat(cell.alt||[]).filter(x=>x!=null).map(normNum);
    if(v&&right.includes(v)) continue; wrong.push(cell.label||cell.key); if(v&&(cell.trap||[]).map(normNum).includes(v)) trap=true; }
  return {ok:wrong.length===0,trap,wrong,cells:cells.length,right:cells.length-wrong.length}; }
/* 여러 칸 답을 화면·저장에 쓰는 한 줄로 */
function workText(c,ans){ const cells=workCells(c); if(!cells) return String(ans==null?'':ans); const got=(typeof ans==='string')?(()=>{ try{ return JSON.parse(ans); }catch(e){ return {}; } })():(ans||{});
  return cells.map(x=>{ const v=String(got[x.key]==null||got[x.key]===''?'-':got[x.key]); const u=x.unit||''; return `${x.label||x.key} ${v}${(!u||v==='-'||v.endsWith(u))?'':u}`; }).join(' · '); }
/* 결재 검토: 지적 항목 개수 */
function countFlags(c,text){ const f=c.mustFlag||(c.compose&&c.compose.mustInclude)||[]; if(!f.length) return {n:0,all:0}; return {n:f.filter(k=>[].concat(k).some(x=>x&&text.includes(x))).length,all:f.length}; }   /* 45차: 지적 항목 하나를 [동의어…] 배열로도 받는다 */


/* ======================================================================
   ▼ 순수 채점 공용부 — 서버(backend/ws7_grade.gs 번들)와 클라이언트(js/play/grader.js)가 **같은 코드**를 돈다.
   규칙: DOM·S·P·window 를 만지지 않는다. 입력은 카드(정답이 든 정본)·학생 입력·카드 상태의 일부이고,
   출력은 점수·코멘트·부를 분기 키·셈 증분(counts)·상태 표시(flags)다. 부작용(runBranch·record·toast)은 부르는 쪽이 한다.
   전역 D 는 「지금 화의 이야기 데이터」다(서버는 요청마다 D 를 그 화로 바꿔 끼운다). tools/build_secure.py 가 이 파일을 번들에 넣는다.
   ====================================================================== */
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
/* 질문 카드 — 맞는 질문 번호 · 답 3개 · 질문별 상한 */
function rightQ(c){ if(c.rightQ!=null) return c.rightQ; if(c.gotValues&&c.gotValues.length){ let bi=0; c.gotValues.forEach((v,i)=>{ if(v>c.gotValues[bi]) bi=i; }); return bi; } const br=(D.branches&&D.branches[c.id])||{}; if(br.q1&&!br.q2&&!br.q3) return 1; return 0; }
function askAnswers(c){ if(c.answers&&c.answers.length) return c.answers; const r=rightQ(c); const br=(D.branches&&D.branches[c.id])||{}; return (c.question||[]).map((q,i)=>{ if(i===r) return c.answer||'…'; const b=br['q'+(i+1)]; if(b&&b.now&&b.now.text) return b.now.text; return '그건 제가 답할 게 아닌데요. 다른 걸 물으신 거 아니에요?'; }); }
function askCap(c,i){ const r=rightQ(c); if(i===r) return 100; if(c.gotValues){ const v=c.gotValues[i]||0, mx=Math.max.apply(null,c.gotValues)||1; return v<=0?40:Math.max(40,Math.round(100*v/mx)); } const b=(D.branches&&D.branches[c.id]||{})['q'+(i+1)]; if(b&&b.today){ const m=b.today.match(/(\d{2,3})/); if(m) return +m[1]; } return i===r?100:(i<r?60:40); }
/* 메일·메신저로 온 보고 카드의 「메일로 상신」 분기 */
function mailConfirmBranch(c){ return (c&&c.mode==='report'&&c.type!=='report'&&((D.branches||{})[c.id]||{}).mailConfirm)||null; }
/* 분기 존재 여부 — runBranch 와 같은 규칙(forbid:… 가 없으면 forbid 로) · 목록에서 처음 있는 것 */
function branchExists(c,key){ if(!key) return false; const all=(D.branches||{})[c.id]||{}; if(all[key]) return true; return !!(key.startsWith('forbid:')&&all.forbid); }
function firstBranch(c,keys){ for(const k of keys) if(branchExists(c,k)) return k; return null; }
const bestComment=(c)=>(c.act&&c.best&&c.act[c.best]&&c.act[c.best][1])||'';
const bestRC=(c)=>!!(c.best&&['reject','confirm'].includes(c.best));
/* 작성 안내에 쓰는 개수만 — 정답 없이도 「반드시 들어갈 값 N가지」를 적을 수 있게(공개본은 composeMeta 로 온다) */
function specMeta(c,which){ const m=c.composeMeta; if(m&&!hasFullData(c)) return (which==='second'?m.second:m.first)||{must:0,rules:false};
  const sp=composeSpec(c,which); return {must:sp.mustInclude.length,rules:sp.ruleFacts.length>0}; }
function hasFullData(c){ return !(D&&D.stripped); }

const Score={};
/* 단추 행동 · 전화 · 방문 — act 표에서 점수·코멘트. after 는 전화를 끊은 뒤 한마디(분기 after > 정답이 아닐 때 카드 after) */
Score.act=(c,inp)=>{ const key=inp.key; const a=c.act&&c.act[key]; if(!a) return {ok:false,key};
  const isBest=key===c.best; const all=(D.branches||{})[c.id]||{}; const br=all[key]||(isBest?all.ok:null);
  return {ok:true,key,score:a[0],comment:a[1]||'',isBest,bestRC:bestRC(c),bestComment:bestComment(c),branch:isBest?'ok':key,after:(br&&br.after)||(!isBest&&c.after)||null}; };
/* 팀장 대면 보고의 선택 */
Score.report=(c,inp)=>{ const key=inp.key; const rp=c.report||c; const score=(rp.score&&rp.score[key])!=null?rp.score[key]:(key===c.best?100:30); const isBest=(key===c.best)||(score>=100);
  return {key,score,isBest,bestRC:bestRC(c),bestComment:bestComment(c)}; };
/* 검산 결과를 팀장에게 가져갔을 때의 선택 */
Score.sheetDeliver=(c,inp)=>{ const key=inp.key; const d=c.deliver||{}; const bestK=Object.entries(d.score||{}).sort((a,b)=>b[1]-a[1])[0]; const score=(d.score&&d.score[key])!=null?d.score[key]:30;
  return {key,score,isBest:!!(bestK&&key===bestK[0]),bestKey:bestK?bestK[0]:null,bestComment:bestComment(c)}; };
/* 계산값·표 답 대조 */
Score.work=(c,inp)=>{ const w=checkWork(c,inp.ans); return {ok:w.ok,trap:!!w.trap,wrong:w.wrong||[],bestComment:bestComment(c)}; };
/* 반성 카드 — 고른 카드가 답 후보에 있나 */
Score.pick=(c,inp)=>{ const ok=(c.answerAny||[]).includes(inp.pick); return {ok,comment:ok?(c.act&&c.act.reply&&c.act.reply[1])||'':(c.fallback||'')}; };
/* 질문 카드 — 맞는 사람 앞에서 고를 질문 3개의 답(내용) · 고른 질문의 상한 */
Score.askAnswers=(c)=>({answers:askAnswers(c)});
Score.ask=(c,inp)=>({choice:inp.choice,cap:askCap(c,inp.choice),answer:askAnswers(c)[inp.choice]||''});
/* ---------- 직접 묻기(askOpen · docs/plan-interaction-design.md §3-A) ----------
   준비된 질문 3개 대신 학생이 **한 줄로 직접 묻는다.** 담당자는 질문이 건드린 조각(facts[].topic)만 답하고,
   못 알아들으면 되묻는다(unknown). 끝났을 때의 상한(cap)은 옛 askCap 과 같은 자리 — 회신 점수의 상한.
   대조는 공백·문장부호를 지운 부분 문자열이다(「입구가 어디예요」→ 입구·어디). AI 를 쓰지 않는다 — 주제가 좁아 규칙으로 충분하고, 오탐은 되묻기로 회복된다. */
function askOpenSpec(c){ const a=c.askOpen; if(!a||!Array.isArray(a.facts)||!a.facts.length) return null;
  const facts=a.facts.filter(f=>f&&f.key&&Array.isArray(f.topic)&&f.topic.length&&f.say);
  const keys=facts.map(f=>f.key); const need=(Array.isArray(a.need)&&a.need.length?a.need:keys).filter(k=>keys.includes(k));
  return {facts,need,tries:Math.max(1,+a.tries||3),unknown:[].concat(a.unknown||['음, 뭘 물으시는 거예요?','좀 더 구체적으로 물어봐 주세요.']),nudge:a.nudge||'',greet:a.greet||'네, 말씀하세요.',model:a.model||''}; }
const askOpenNorm=(s)=>String(s==null?'':s).toLowerCase().replace(/[\s.,!?…~"'「」()\-·]/g,'');
/* 한 질문 — inp {text, got:[이미 얻은 키], n:이번이 몇 번째 질문(1부터)}. 돌려주는 것: hits(이번에 새로 건드린 키) · say(담당자 대사) · got(누적) · done · cap */
Score.askOpen=(c,inp)=>{ const sp=askOpenSpec(c); if(!sp) return {ok:false};
  const q=askOpenNorm(inp.text); const got=uniq([].concat(inp.got||[])); const n=Math.max(1,+inp.n||1);
  const hitAll=q?sp.facts.filter(f=>f.topic.some(t=>{ const k=askOpenNorm(t); return k&&q.includes(k); })).map(f=>f.key):[];
  const hits=hitAll.filter(k=>!got.includes(k)); const after=uniq(got.concat(hits));
  const left=sp.need.filter(k=>!after.includes(k)); const done=left.length===0||n>=sp.tries;
  let say='';
  if(hitAll.length){ say=sp.facts.filter(f=>hitAll.includes(f.key)).map(f=>f.say).join(' '); if(hits.length===0) say=(sp.repeat||'아까 말씀드린 대로예요. ')+say; }
  else { const miss=Math.max(0,n-1-got.length); say=sp.unknown[Math.min(miss,sp.unknown.length-1)]||sp.unknown[0]; if(sp.nudge&&n>=2) say+=' '+sp.nudge; }
  const cap=after.length>=sp.need.length?100:after.length?60:40;
  return {ok:true,hits,hitAll,say,got:after,left,done,cap,n,tries:sp.tries,need:sp.need.length}; };
/* 자동 플레이용 한 줄 — 조각의 첫 topic 을 이어 붙여 한 번에 전부 묻는다(정본 데이터에서만 만든다) */
Score.askOpenModel=(c)=>{ const sp=askOpenSpec(c); if(!sp) return {q:''}; if(sp.model) return {q:sp.model}; return {q:sp.need.map(k=>(sp.facts.find(f=>f.key===k)||{}).topic[0]).filter(Boolean).join('이랑 ')+' 어떻게 돼요?'}; };
/* 다 물은 뒤 회신에 넘길 답(얻은 조각의 대사만) */
Score.askOpenAnswer=(c,inp)=>{ const sp=askOpenSpec(c); if(!sp) return {answer:''}; const got=[].concat(inp.got||[]); return {answer:sp.facts.filter(f=>got.includes(f.key)).map(f=>f.say).join(' '),greet:sp.greet,tries:sp.tries}; };
/* 메일로 상신 — 분기 표에 점수(today)가 있으면 그 점수로 끝, 점수가 없으면 팀장 한마디만 듣고 대면으로 */
Score.mailConfirm=(c)=>{ const br=mailConfirmBranch(c); if(!br){ const a=Score.act(c,{key:'confirm'}); return Object.assign({mode:'act'},a); }
  const m=String(br.today||'').match(/(\d{2,3})/); return {mode:m?'score':'line',score:m?+m[1]:null,bestRC:bestRC(c),bestComment:bestComment(c)}; };
/* 결재 「이상 없음(승인)」 */
Score.approve=(c)=>{ const a=(c.act&&(c.act.approve||c.act.reply))||[35,'"확인했습니다"로 넘기면 그 숫자 그대로 나가요.'];
  return {score:a[0],comment:a[1]||'',branch:firstBranch(c,['forbid:이상 없음','forbid:확인했습니다','reply','approve']),bestComment:bestComment(c)}; };
/* 6화 분류 — 「지금」 칸 적중 */
Score.triage=(_,inp)=>{ const T=D.triage||{}; const ids=inp.ids||[], A=inp.assign||{}; const nowSet=new Set(T.now||[]); for(const i of ids) if(!(T.cards||[]).includes(i)) nowSet.add(i);
  const hit=ids.filter(i=>nowSet.has(i)&&A[i]==='now').length; const total=ids.filter(i=>nowSet.has(i)).length; const key=String(Math.min(hit,3)); const score=(T.score&&T.score[key]!=null)?T.score[key]:Math.round(100*hit/Math.max(1,total));
  return {hit,total,score}; };
/* 7일차 아침 분기 카드 */
Score.pre7=(c,inp)=>{ const k=inp.key, text=inp.text; let score, comment, detail=null, forbidHit=false;
  if(text!=null){ const g=gradeText(c,text); score=g.score; comment=(c.act[k]&&c.act[k][1])||''; if(g.forbid.length){ score=Math.min(score,20); comment='금지 표현: '+g.forbid.join(', ')+'. '+comment; forbidHit=true; } if(k!==c.best&&c.act[k]) score=Math.min(score,c.act[k][0]); detail={els:g.els,missing:g.missing,forbid:g.forbid}; }
  else { score=c.act[k][0]; comment=c.act[k][1]; }
  return {key:k,score,comment,detail,forbidHit,branch:k===c.best?'ok':k}; };
/* 7일차 취합표·계산 칸 — 맞았는지만 */
Score.ep7cell=(_,inp)=>{ const E=D.ep7||{}; const list=inp.kind==='calc'?(E.criteria||[]):(E.table||[]); const t=list.find(x=>x.key===inp.key); if(!t) return {ok:false};
  return {ok:normNum(inp.value)===normNum(t.answer)}; };

/* 회신·안내 회신 작성 — sendCompose 의 채점 부분. st = {workTries, ask:{cap}} 만 본다. ai = 이미 받은 AI 첨삭({score,els,feedback,source}) 또는 null.
   retry:true 면 「결과값이 틀렸어요, 다시」 — 점수를 내지 않고 작성기로 돌려보낸다(flags·counts 는 그래도 적용). */
Score.text=(c,inp)=>{ const text=inp.text||'', which=inp.which||'reply', key=inp.key||'reply', ans=inp.ans, st=inp.st||{}, ai=inp.ai||null; const isSecond=which==='reply2';
  const out={which,key,score:0,comment:'',source:'규칙 채점',feedback:'',detail:null,branches:[],counts:{},flags:{},retry:false,rule:null,unscored:false,model:'',bestComment:bestComment(c),bestRC:bestRC(c)};
  if((c.scored===false&&c.mode==='story')||c.unscored||c.axis==='self'){ out.unscored=true; out.branches.push('reply'); return out; }
  const spec=composeSpec(c,isSecond?'second':null); const g=gradeText(c,text,spec); out.rule=g; out.model=spec.model||''; let score=g.score, comment=(c.act&&c.act[key]&&c.act[key][1])||'';
  if(ai){ score=ai.score; g.els=ai.els; out.source=ai.source; out.feedback=ai.feedback||''; }
  let neg=false; const br=(k)=>{ if(k) out.branches.push(k); };
  if(ans!=null&&c.workAnswer){ const w=checkWork(c,ans); out.flags.answer=ans; out.flags.workOk=w.ok; out.counts.calcAll=1; if(w.ok){ out.counts.calc=1; } else { const tries=(st.workTries||0)+1; out.flags.workTries=tries; if(!w.trap&&tries<2){ out.retry=true; return out; } score=Math.min(score,w.trap?20:0); comment='결과값이 틀렸어요. '+comment; neg=true; br(w.trap?'trap':'wrong'); } }
  if(g.forbid.length){ neg=true; out.flags.forbidHit=true; out.flags.replyBanHit=true; const p=g.forbid[0]; comment='금지 표현이 들어갔어요: '+g.forbid.join(', ')+'. '+comment; br(firstBranch(c,['forbid:'+p,(c.id==='cs22'&&p.includes('계좌'))?'forbidAccount':'forbid'])); }
  else if(g.partial){ neg=true; comment='답이 절반이에요. 빠진 값을 채워야 고객이 다시 묻지 않아요. '+comment; out.flags.partial=true; br('partial'); }
  else if(g.missing.length&&!ai){ neg=true; out.flags.partial=true; br('partial'); }
  else if(g.missing.length) neg=true;
  if(g.cited===false){ out.flags.citeMiss=true; comment=(comment?comment+' ':'')+'근거 조항 번호가 없어요.'; } else if(g.cited===true) out.counts.cite=1;
  if(c.ccTeams&&!isSecond){ const names=c.ccTeams.map(k=>TEAM_NAMES[k]||k); const ok=names.some(n=>text.includes(n.replace('팀',''))); if(!ok){ score=Math.min(score,60); comment='원인 확인을 맡을 팀을 참조에 넣지 않았어요. '+comment; out.flags.noCc=true; neg=true; br('noCc'); } }
  if(key!==c.best&&c.best&&!isSecond&&c.act&&c.act[key]&&flowOf(c)[0]==='reply'){ score=Math.min(score,c.act[key][0]); comment=c.act[key][1]||comment; neg=true; br(firstBranch(c,[key,'other'])); }
  if(!isSecond&&c.best&&['reject','confirm'].includes(c.best)&&flowOf(c)[0]==='reply'){ out.counts.rejectAll=1; if(key===c.best) out.counts.reject=1; }
  if(c.mode==='ask'&&!isSecond){ if(st.ask) score=Math.min(score,st.ask.cap); else { score=Math.min(score,g.missing.length?40:60); comment='먼저 물어보지 않고 답했어요. '+comment; } }
  out.detail={els:g.els,missing:g.missing,forbid:g.forbid,partial:g.partial,cited:g.cited};
  if(!isSecond&&!neg&&flowOf(c)[0]==='reply'&&(!c.best||key===c.best)&&score>=60) br('ok');
  out.score=score; out.comment=comment; return out; };
/* 결재 검토(반려 의견) — sendApproval 의 채점 부분. approve:true 면 「이상 없음」으로 쓴 것 → 승인 경로 */
Score.approval=(c,inp)=>{ const text=inp.text||'', ans=inp.ans, ai=inp.ai||null; const spec=composeSpec(c); const g=gradeText(c,text,spec);
  const out={score:0,comment:'',rule:g,source:'규칙 채점',feedback:'',detail:null,branches:[],counts:{},flags:{},approve:false,model:spec.model||'',bestRC:bestRC(c),bestComment:bestComment(c)};
  if(ai){ out.source=ai.source; out.feedback=ai.feedback||''; }
  if(/이상 없음|그대로 적용/.test(text)&&!/반려/.test(text)){ out.approve=true; return out; }
  const f=countFlags(c,text); let score=100, comment=(c.act&&c.act.reject&&c.act.reject[1])||'';
  if(f.all){ score=f.n>=f.all?100:f.n===f.all-1?70:f.n>=1?40:20; if(f.n<f.all){ comment=`지적 항목 ${f.n}/${f.all}. `+comment; out.branches.push(f.n===f.all-1?'flag2':'flag1'); } }
  if(c.workAnswer){ const w=checkWork(c,ans||text); out.flags.answer=ans; out.flags.workOk=w.ok; out.counts.calcAll=1; if(w.ok) out.counts.calc=1; else { score=Math.min(score,w.trap?30:35); comment='맞는 합계가 없어요. '+comment; out.branches.push(w.trap?'trap':'wrong'); } }
  if(g.forbid.length){ out.flags.forbidHit=true; score=Math.min(score,20); const k=firstBranch(c,['forbid:'+g.forbid[0],'forbid']); if(k) out.branches.push(k); }
  if(g.cited===true) out.counts.cite=1; out.counts.rejectAll=1; if(c.best==='reject') out.counts.reject=1;
  out.detail={els:g.els,missing:g.missing,forbid:g.forbid,cited:g.cited}; out.score=score; out.comment=comment; return out; };
/* ▲ 순수 채점 공용부 끝 */

/* AI 첨삭 훅 — Backend.grade 가 있으면 호출, 실패·미설정이면 규칙 채점 그대로 */
async function gradeWithAI(c,text,spec,rule){ if(!aiOn()) return null;
  try{ const r=await withTimeout(window.Backend.grade({code:S.code,team:S.team,ep:S.ep,cardId:c.id,subj:c.subj,body:c.body,text,channel:c.type,which:(spec&&spec.which)||'reply'}),12000);
    if(!r||!r.ok||typeof r.score!=='number') return null; const els={}; const src=r.elements||{}; const alt={'다음 행동':'다음행동'};
    for(const k of ['인사','확인','답','다음 행동','맺음']){ const v=src[k]!=null?src[k]:src[alt[k]]; els[k]=v!=null?!!v:rule.els[k]; } return {score:Math.max(0,Math.min(100,Math.round(r.score))),els,feedback:r.feedback||'',source:'AI 첨삭'}; }
  catch(e){ console.warn('AI 첨삭 실패:',e.message); return null; } }
