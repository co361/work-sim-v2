/* ======================================================================
   채점 — 규칙 채점(30차 §4 확장: 조항 인용·값·금지어·계산값·지적 항목) + AI 첨삭 훅(Backend.grade)
   ====================================================================== */
const RULE_ID=/\b[A-Z]{2,4}-\d{2}\b/g;
function normNum(s){ return String(s==null?'':s).replace(/[\s,원건일회%]/g,'').replace(/만$/,''); }
function includesAny(text,arr){ return (arr||[]).some(k=>k&&text.includes(k)); }
/* 금지 표현: 바로 뒤에 부정("…이 아니라", "…지 않", "…수 없", "…지 마세요")이 오면 안내문으로 보고 넘어간다 */
function forbidHit(text,k){ let i=text.indexOf(k); while(i>=0){ const tail=text.slice(i+k.length,i+k.length+28); if(!/^(?:[^.。\n]{0,26})?(아니|않|없|마세요|말고|금지|안 |못 )/.test(tail)) return true; i=text.indexOf(k,i+1); } return false; }
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
  spec.forbid=uniq(spec.forbid); return spec; }
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
function countFlags(c,text){ const f=c.mustFlag||(c.compose&&c.compose.mustInclude)||[]; if(!f.length) return {n:0,all:0}; return {n:f.filter(k=>text.includes(k)).length,all:f.length}; }

/* AI 첨삭 훅 — Backend.grade 가 있으면 호출, 실패·미설정이면 규칙 채점 그대로 */
async function gradeWithAI(c,text,spec,rule){ if(!aiOn()) return null;
  try{ const r=await withTimeout(window.Backend.grade({code:S.code,team:S.team,cardId:c.id,subj:c.subj,body:c.body,text,compose:{mustInclude:spec.mustInclude,forbid:spec.forbid,ruleFacts:spec.ruleFacts,model:spec.model},ruleFacts:spec.ruleFacts}),12000);
    if(!r||!r.ok||typeof r.score!=='number') return null; const els={}; const src=r.elements||{}; const alt={'다음 행동':'다음행동'};
    for(const k of ['인사','확인','답','다음 행동','맺음']){ const v=src[k]!=null?src[k]:src[alt[k]]; els[k]=v!=null?!!v:rule.els[k]; } return {score:Math.max(0,Math.min(100,Math.round(r.score))),els,feedback:r.feedback||'',source:'AI 첨삭'}; }
  catch(e){ console.warn('AI 첨삭 실패:',e.message); return null; } }
