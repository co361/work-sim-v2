/* ======================================================================
   대화 모드 — 「말을 걸면 이야기가 오간다」

   왜 만들었나
     대표 "말을 걸었으면 말을 할 수 있게 해줘, 이야기를." — 지금까지는 NPC 가
     한마디 던지고 대화가 닫혔다. 내가 말할 방법이 없었다.
     대표 "화면 커지면서 채팅할 수 있게 해줘." — 작은 말풍선으로 끝내지 않는다.

   무엇을 하는가
     ① `Talk.npc(name)` — NPC 와 주고받는 대화. 상대 한마디 → 내가 고를 말 2~4개 →
        상대 답 → 다시 선택지. 「이만 가 볼게요」로 닫는다.
     ② `Talk.choose(prompt, items, timeLimit, opts)` — 선택지 하나 고르기.
        전화·방문 응대·이동 대체 연출이 전부 이 창을 쓴다(모양이 하나로 통일된다).
     ③ 화면: 아래에서 넓은 대화창이 올라오고 3D 는 위에 남는다. 카메라를 두 사람 쪽으로
        당기는 것은 3D 쪽 일(`__office.talkView(seat,on)`)이라 **있으면 쓰고 없으면
        화면만 커진다** — docs/office-api-requests.md §5 에 요청해 두었다.

   경계선
     오늘 그 사람에게 할 일이 있으면 그것이 첫 선택지다(전달 · 여쭤보기 · 보고).
     그 밖은 잡담이고 잡담은 채점하지 않는다. 인사를 거듭하면 신뢰가 아주 조금 오르되
     하루 한 사람당 +1 이 상한이다.
   ====================================================================== */
(function (global) {
  'use strict';

  let cur = null;               /* {resolve, timer, mode} — 열려 있는 대화 하나 */
  let seatShown = null;         /* talkView 를 켜 둔 자리 — 닫을 때 되돌린다 */
  const greeted = {};           /* 오늘 인사한 횟수 — 신뢰 상한을 이것으로 잡는다 */
  const trusted = {};           /* 신뢰를 이미 올린 사람 */

  const T = {
    box: () => $('talk'),
    face: () => $('tkFace'),
    name: () => $('tkName'),
    role: () => $('tkRole'),
    text: () => $('tkTx'),
    opts: () => $('tkOpts')
  };

  /* ---------- 3D 쪽 연출(있으면 쓴다) ---------- */
  function camIn(seat) {
    const O = office(); if (!O || !seat) return;
    try { if (typeof O.talkView === 'function') { O.talkView(seat, true); seatShown = seat; } } catch (e) {}
  }
  function camOut() {
    const O = office(); const s = seatShown; seatShown = null;
    if (!O || !s) return;
    try { if (typeof O.talkView === 'function') O.talkView(s, false); } catch (e) {}
  }

  /* ---------- 얼굴 ---------- */
  function faceOf(name) {
    const box = T.face(); box.innerHTML = '';
    const info = npcInfo(name);
    const src = info && info.ch ? avatarPic(info.ch) : '';
    if (src) { const im = document.createElement('img'); im.src = src; im.alt = ''; box.appendChild(im); return; }
    box.textContent = emojiFor(name, info);
  }
  function emojiFor(name, info) {
    const r = (info && info.role) || '';
    if (/팀장|부장|대표/.test(name + r)) return '🧑‍💼';
    if (/고객|님$/.test(name)) return '🙋';
    if (/사수|선임|대리|주임|과장/.test(name + r)) return '🧑‍💻';
    return '💬';
  }

  /* ---------- 창 열고 닫기 ---------- */
  function paint(who, roleText, line, options, timeLimit) {
    faceOf(who);
    T.name().textContent = who || '';
    T.role().textContent = roleText || '';
    T.text().textContent = (line || '').replace(/○○씨/g, (S.name || '○○') + '씨');
    const box = T.opts(); box.innerHTML = '';
    options.forEach((o) => {
      const b = mkBtn(o.label, o.cls || '', () => { if (!cur) return; clearTimer(); o.run(); });
      box.appendChild(b);
    });
    if (timeLimit) {
      const bar = h('div', 'tkBar'); const iv = h('i'); bar.appendChild(iv); box.appendChild(bar);
      requestAnimationFrame(() => { iv.style.transition = `width ${timeLimit}s linear`; iv.style.width = '0%'; });
    }
  }
  function show() {
    T.box().classList.add('open');
    document.body.classList.add('talk-on');
    if (global.__pcTalk) { try { global.__pcTalk(true); } catch (e) {} }
  }
  function hide() {
    T.box().classList.remove('open');
    document.body.classList.remove('talk-on');
    camOut();
    if (global.__pcTalk) { try { global.__pcTalk(false); } catch (e) {} }
  }
  function clearTimer() { if (cur && cur.timer) { clearTimeout(cur.timer); cur.timer = null; } }
  function finish(v) { const c = cur; cur = null; clearTimeout(c && c.timer); hide(); if (c && c.resolve) c.resolve(v); }

  /* ======================================================================
     ① 선택지 하나 고르기 — 옛 `#choice` 패널을 대신한다
     ====================================================================== */
  function choose(prompt, items, timeLimit, opts) {
    opts = opts || {};
    if (cur) finish(-1);                       /* 겹쳐 열지 않는다 */
    return new Promise((res) => {
      cur = { resolve: res, timer: null, mode: 'choose' };
      const options = (items || []).map((t, i) => ({ label: t, run: () => finish(i) }));
      camIn(opts.seat);
      paint(opts.who || '', opts.role || '', prompt || '', options, timeLimit);
      show();
      if (timeLimit) cur.timer = setTimeout(() => finish(-1), timeLimit * 1000);
    });
  }

  /* ======================================================================
     ② NPC 와 주고받는 대화
     ====================================================================== */

  /* 오늘 그 사람에게 남은 일 — 있으면 그것이 첫 선택지가 된다 */
  function tasksFor(name) {
    const out = [];
    if (!D || S.phase !== 'work') return out;
    const leadName = (D.dests.find((x) => x.seat === 'lead') || {}).name || '';
    for (const id of S.order) {
      const c = CARD(id), st = S.cards[id];
      if (!c || !st || !st.arrived || st.status === 'done' || st.status === 'skipped') continue;
      const steps = st.steps || {}, flow = flowOf(c);
      const dl = c.deliver || null;
      if (flow.includes('work') && steps.work && !steps.deliver && dl && dl.npc === name) {
        out.push({ id: id, kind: 'sheet', label: `「${cut(c.subj)}」 검산 결과 가져가기`, hint: 'E — 검산 결과 가져가기' }); continue;
      }
      if (flow.includes('deliver') && !steps.deliver && dl && dl.npc === name) {
        out.push({ id: id, kind: 'deliver', label: `「${cut(c.subj)}」 전달하기`, hint: 'E — 서류 전달하기' }); continue;
      }
      if (flow.includes('ask') && !st.ask && c.npc === name) {
        out.push({ id: id, kind: 'ask', label: `「${cut(c.subj)}」 여쭤보기`, hint: 'E — 여쭤보기' }); continue;
      }
      if (flow.includes('report') && !steps.report) {
        const to = c.npc || (c.report && c.report.npc) || leadName;
        if (to === name) { out.push({ id: id, kind: 'report', label: `「${cut(c.subj)}」 보고드리기`, hint: 'E — 보고드리기' }); continue; }
      }
    }
    return out;
  }
  function cut(s, n) { s = String(s || ''); n = n || 15; return s.length > n ? s.slice(0, n) + '…' : s; }

  /* 잡담 — 데이터에 있으면 그것을, 없으면 역할별 기본 문구를 돌려 쓴다.
     사람마다 다르게 들려야 하므로 이름으로 자리를 정해 같은 사람은 같은 결을 유지한다. */
  const SMALL = {
    사수: {
      hi: ['어, 왔어요. 잘 하고 있죠?', '○○씨. 막히는 거 있으면 바로 물어봐요.', '오, 얼굴 좋네. 오늘 할 만해요?'],
      how: ['오늘은 좀 낫네요. 어제가 고비였지.', '늘 이래요. 첫 주가 제일 길어요.', '나야 뭐. ○○씨가 더 바쁠걸요.'],
      bye: ['네, 가 봐요. 필요하면 부르고.', '그래요. 막히면 언제든.']
    },
    팀장: {
      hi: ['○○씨, 적응은 좀 됐어요?', '어, 그래요. 무슨 일이에요?', '왔어요? 급한 거 아니면 나중에 봐도 돼요.'],
      how: ['괜찮아요. 오늘 건은 오늘 안에만 끝내면 돼요.', '바쁘죠 뭐. 그래도 순서만 지키면 돼요.', '숫자만 맞으면 돼요. 그게 제일이에요.'],
      bye: ['네, 가 봐요.', '그래요. 보고할 거 생기면 바로 와요.']
    },
    동기: {
      hi: ['어 왔어? 나 지금 정신없어 ㅋㅋ', '왔네. 살아 있어?', '야, 너도 메일 쌓였지?'],
      how: ['말도 마. 아침부터 세 건 터졌어.', '그럭저럭? 점심은 먹고 하자.', '나 지금 이거 하나만 끝내면 돼. 너는?'],
      bye: ['어 가, 이따 봐.', 'ㅇㅇ 이따 점심때.']
    },
    조력자: {
      hi: ['네, 말씀하세요.', '아, 고객상담팀이시죠. 무슨 건이세요?', '네 안녕하세요. 어떤 거 때문에 오셨어요?'],
      how: ['저희도 오늘 물량이 많아요. 그래도 돌아는 갑니다.', '늘 비슷해요. 요청은 메일로 주시면 빠릅니다.', '오전은 좀 몰리고 오후엔 괜찮아요.'],
      bye: ['네, 필요하면 또 오세요.', '네 들어가세요.']
    },
    기본: {
      hi: ['네, 안녕하세요.', '아, 네. 무슨 일이세요?'],
      how: ['그럭저럭이에요.', '늘 하던 대로죠 뭐.'],
      bye: ['네, 수고하세요.', '네 들어가세요.']
    }
  };
  function kindOf(name) {
    const info = npcInfo(name) || {};
    const r = info.role || '';
    if (r === '사수' || /사수/.test(r)) return '사수';
    if (r === '팀장' || /팀장/.test(name + r)) return '팀장';
    if (r === '동기' || name === (typeof peerName === 'function' ? peerName() : '')) return '동기';
    if (r === '조력자' || (info.teamKey && info.teamKey !== S.team)) return '조력자';
    return '기본';
  }
  function seedOf(name) { let n = 0; for (let i = 0; i < name.length; i++) n = (n * 31 + name.charCodeAt(i)) % 9973; return n; }
  function line(name, key, turn) {
    const data = (D && D.dialog && D.dialog.smalltalk && D.dialog.smalltalk[name]) || null;
    const pool = (data && data[key]) || SMALL[kindOf(name)][key] || SMALL['기본'][key];
    return pool[(seedOf(name) + (turn || 0)) % pool.length];
  }

  /* 대화 한 판. 자리에 가는 연출은 3D 가 하고(엔진은 travel 로 이미 그렇게 한다),
     이 창은 「무슨 말을 할까」만 맡는다. */
  async function npc(name, seat) {
    if (!name) return;
    if (cur) finish(-1);
    const info = npcInfo(name) || {};
    seat = seat || info.seat || seatByName(name);
    const roleText = [info.team, info.role].filter(Boolean).join(' · ');
    let turn = 0;
    let say = line(name, 'hi', 0);
    camIn(seat);
    show();
    /* 대화가 끝날 때까지 도는 고리 — 고를 때마다 다음 화면을 그린다 */
    for (;;) {
      const pick = await new Promise((res) => {
        cur = { resolve: res, timer: null, mode: 'npc' };
        const opts = [];
        for (const t of tasksFor(name)) opts.push({ label: t.label, cls: 'pri', run: () => finish({ task: t }) });
        opts.push({ label: '그냥 인사', run: () => finish({ say: 'hi' }) });
        opts.push({ label: '요즘 어떠세요', run: () => finish({ say: 'how' }) });
        opts.push({ label: '이만 가 볼게요', run: () => finish({ bye: true }) });
        paint(name, roleText, say, opts);
      });
      if (!pick || pick.bye || pick === -1) {
        /* 닫기 전에 인사 한 줄 */
        cur = { resolve: () => {}, timer: null, mode: 'npc' };
        paint(name, roleText, line(name, 'bye', turn), []);
        setTimeout(() => { if (cur && cur.mode === 'npc') finish(null); }, 1100);
        return;
      }
      if (pick.task) { hide(); cur = null; await runTask(name, pick.task); return; }
      turn++;
      if (pick.say === 'hi') {
        greeted[name] = (greeted[name] || 0) + 1;
        /* 인사를 세 번 나누면 신뢰가 아주 조금. 하루 한 사람당 한 번뿐이다 */
        if (greeted[name] >= 3 && !trusted[name] && npcInfo(name)) {
          trusted[name] = true; S.trust[name] = (S.trust[name] || 0) + 1;
        }
      }
      say = line(name, pick.say, turn);
    }
  }

  /* 고른 일을 실제로 한다 — 채점 경로는 기존 함수 그대로다(새로 만들지 않는다) */
  async function runTask(name, t) {
    const info = npcInfo(name) || {};
    const d = (D.dests || []).find((x) => x.name === name) ||
      { seat: info.seat || seatByName(name), name: name, team: info.team || '', key: info.teamKey || '' };
    try {
      if (t.kind === 'deliver') await doDeliver(t.id, d);
      else if (t.kind === 'ask') await doAsk(t.id, d);
      else if (t.kind === 'report') await doReport(t.id);
      else if (t.kind === 'sheet') await doSheetDeliver(t.id);
    } catch (e) { console.warn('대화에서 시작한 일 처리 오류', e); }
    /* 남은 단계(회신 쓰기 등)는 컴퓨터에서 한다 — 카드를 띄워 준다 */
    const st = S.cards[t.id];
    if (st && st.status !== 'done' && typeof global.openCard === 'function') {
      try { global.openCard(t.id); } catch (e) {}
    }
  }

  global.Talk = {
    choose: choose,
    npc: npc,
    tasks: tasksFor,
    isOpen: () => !!cur,
    close: () => { if (cur) finish(-1); },
    /* 3D 가 「말을 걸었다」고 알려 올 때 붙이는 자리 */
    onNpc: (info) => { if (!info) return; npc(info.name || npcBySeat(info.seat), info.seat); }
  };
})(window);
