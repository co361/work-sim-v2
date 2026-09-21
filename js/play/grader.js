/* ======================================================================
   채점 창구(Grader) — 로컬(정본 데이터)은 그 자리에서 Score.* 를 돌리고, 배포본(정답이 빠진 공개 데이터 · D.stripped)은
   같은 함수를 서버(GAS ws7score)에서 돌린다. 화면 코드는 이 창구만 부른다 — 정답이 어디 있는지 몰라도 되게.
   · 로컬 판정 = 데이터에 정답이 있느냐(D.stripped 가 아니냐)다. 호스트 이름을 보지 않는다 — 브라우저에서 바꿀 수 있는 값으로 보안을 가르지 않는다.
   · 서버가 죽으면 채점을 못 한다(점수를 지어내지 않는다). 부르는 쪽은 gradeFail 로 안내하고 카드를 되돌린다.
   ====================================================================== */
const Grader={
  local:()=>!(D&&D.stripped),
  timeout:(kind)=>(kind==='text'||kind==='approval')?20000:12000,
  async run(kind,c,input){ input=input||{};
    if(Grader.local()){ if(typeof Score[kind]!=='function') throw new Error('모르는 채점 종류: '+kind); return Score[kind](c,input); }
    const B=window.Backend; if(!backendOn()||typeof B.score!=='function') throw new Error('채점 서버가 설정되지 않았어요');
    if(!S.code) throw new Error('개인 토큰이 있어야 채점할 수 있어요');
    const r=await withTimeout(B.score({code:S.code,team:S.team,ep:S.ep,cardId:c?c.id:null,kind,input}),Grader.timeout(kind));
    if(!r||!r.ok) throw new Error((r&&r.reason)||'채점 서버가 응답하지 않았어요'); return r.result; },
  /* 작성 채점 — 로컬은 규칙 채점 뒤 (있으면) AI 첨삭을 붙이고, 배포본은 서버가 둘 다 한다 */
  async text(c,input){ if(!Grader.local()) return Grader.run('text',c,input);
    const g=Score.text(c,input); if(g.unscored||g.retry||!aiOn()) return g;
    const spec=composeSpec(c,input.which==='reply2'?'second':null); const ai=await gradeWithAI(c,input.text,spec,g.rule);
    return ai?Score.text(c,Object.assign({},input,{ai})):g; },
  async approval(c,input){ if(!Grader.local()) return Grader.run('approval',c,input);
    const g=Score.approval(c,input); if(!aiOn()) return g;
    const spec=composeSpec(c); const ai=await gradeWithAI(c,input.text,spec,g.rule);
    return ai?Score.approval(c,Object.assign({},input,{ai})):g; }
};
/* 채점 결과의 셈·상태 표시를 카드 상태에 얹는다 */
function applyCounts(counts){ for(const [k,v] of Object.entries(counts||{})) S.counts[k]=(S.counts[k]||0)+v; }
function applyFlags(st,flags){ for(const [k,v] of Object.entries(flags||{})) st[k]=v; }
/* 서버 채점 실패 — 점수를 지어내지 않고 카드를 되돌린다 */
function gradeFail(id,e){ console.warn('채점 실패:',e&&e.message); toast('채점 서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.','',5000,'cust'); try{ if(S.cur===id) renderCardActs(id); }catch(x){} return null; }
