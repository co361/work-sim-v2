/* ======================================================================
   대화 모드 — 「말을 걸면 이야기가 오간다」

   왜 만들었나
     대표 "말을 걸었으면 말을 할 수 있게 해줘, 이야기를." — 지금까지는 NPC 가
     한마디 던지고 대화가 닫혔다. 내가 말할 방법이 없었다.
     대표 "화면 커지면서 채팅할 수 있게 해줘." — 작은 말풍선으로 끝내지 않는다.
     45차 대표 "T를 누르면 상대 캐릭터 얼굴이 보이는 게 아니라 그냥 대화창만 보여.
     그리고 말풍선 없애고 직접 가서 대화로 모든 것들을 듣게 해."

   무엇을 하는가
     ① `Talk.npc(name)` — T 로 말을 건 대화 한 판. 먼저 **그 사람이 할 말**(쌓여 있던 것)을 듣고,
        오늘 그 사람에게 할 일(전달·질문·보고·검산 결과) → 잡담 → 「이만 가 볼게요」.
        할 일을 고르면 **걸어가는 연출 없이 그 자리에서 대화로** 이어진다(이미 마주 서 있으므로).
     ② `Talk.choose(prompt, items, timeLimit, opts)` — 선택지 하나 고르기(전화·목적지 고르기).
     ③ `Talk.hear(who, text)` — NPC 가 **먼저** 할 말이 생겼을 때. 말풍선·알림으로 흘리지 않고
        그 사람 앞으로 쌓아 둔다 → 머리 위 표시(setTalkHint) → 가서 T 를 누르면 대화창에서 듣는다.
        이 방에 자리가 없는 사람(고객·다른 층)은 예전대로 사내 메신저(전자)로 간다.
     ④ `Talk.reply(who, text)` — 방금 한 일(전달·질문·보고)에 대한 상대의 반응. 대화창에 곧바로 잇는다.
     ⑤ 3D 연출(`__office.interact`) 속 대사 — 3D 가 `onSay(fn)` 으로 넘겨 주면 대화창에 띄운다.
        3D 선택 패널(iframe #choice)은 대화창에 가려지므로, 3D 가 `onChoose` 를 주기 전까지는
        그 패널을 읽어 대화창에 옮기고 고른 번호를 `__office.choose(i)` 로 돌려준다.

   화면 — 동물의 숲처럼 **아래 35% 안**. 위 65% 는 3D(얼굴 카메라)가 보이게 딤을 깔지 않는다.
     카메라: 열 때 `talkView(seat,true)`, 닫을 때 `endTalk()`(없으면 `talkView(seat,false)`).

   경계선
     오늘 그 사람에게 할 일이 있으면 그것이 첫 선택지다(전달 · 여쭤보기 · 보고).
     그 밖은 잡담이고 잡담은 채점하지 않는다. 인사를 거듭하면 신뢰가 아주 조금 오르되
     하루 한 사람당 +1 이 상한이다.

   창에 뜨는 것은 **줄 서서 하나씩** 나온다(chain). 대사는 클릭·Enter·Space 로 넘기고,
   선택지는 클릭·숫자키, Esc 는 대화를 닫는다(js/play/pc.js 가 Esc 를 넘겨준다).
   ====================================================================== */
(function (global) {
  'use strict';

  const BOT = !!navigator.webdriver;      /* 자동화(스모크·촬영)는 누를 사람이 없다 — 대사를 기다리지 않는다 */

  let sess = null;              /* 지금 대화 한 판 {id,name,seat,cam,hold,human,closed} */
  let showing = null;           /* 창에 떠 있는 것 {end,item,timer} */
  let chain = Promise.resolve(); let jobs = 0; let seq = 0; let flushTo = 0; let sessSeq = 0;
  let boxOpen = false; let camSeat = null;
  let lastLine = null;          /* 방금 들은 상대의 말 — 분기 반응이 같은 말을 한 번 더 할 때 거른다 */
  const pending = {};           /* NPC 가 먼저 할 말 — {이름:[문장…]} */
  const noticed = {};           /* 「할 말이 있대요」 알림을 이미 한 사람 — 듣고 나면 지운다 */
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

  /* ---------- 3D ---------- */
  function O3() { return (typeof office === 'function') ? office() : null; }
  function camIn(seat) {
    const O = O3(); if (!O || !seat) return;
    try { if (typeof O.talkView === 'function' && O.talkView(seat, true) !== false) camSeat = seat; } catch (e) {}
  }
  function camOut() {
    const O = O3(); const s = camSeat; camSeat = null;
    if (!O || !s) return;
    try {
      if (typeof O.endTalk === 'function') O.endTalk();
      else if (typeof O.talkView === 'function') O.talkView(s, false);
    } catch (e) {}
  }

  /* ---------- 이름 ---------- */
  /* 데이터마다 「총무팀 최주임」·「최주임」처럼 부르는 이름이 달라 자리 찾기가 빗나간다 — 등장인물 키로 맞춘다 */
  function normName(who) {
    who = String(who || '').replace(/\s*\(.*?\)\s*/g, '').trim(); if (!who || !D || !D.npcs) return who;
    if (D.npcs[who]) return who;
    for (const k of Object.keys(D.npcs)) { if (k.length >= 2 && (who.endsWith(k) || k.endsWith(who) && who.length >= 2)) return k; }
    return who;
  }
  function roleOf(name) { const info = npcInfo(name) || {}; return [info.team, info.role].filter(Boolean).join(' · '); }
  const meName = () => (S && S.name) || '나';
  /* 이름 자리(「○○씨」 등) — day.js fillName 이 하루 데이터에 이미 적용하지만, 여기서 만드는 잡담·마무리 문장도 같은 규칙으로 */
  const fill = (t) => { t = String(t || ''); return (typeof global.fillName === 'function') ? global.fillName(t) : t; };

  /* ---------- 얼굴 ----------
     사진 경로는 core.js avatarPic(av_cNN.png · 17~AVATAR_HAVE_MAX). 파일이 지워졌으면 onerror 로 이모지에 물러선다. */
  function faceOf(name) {
    const box = T.face(); box.innerHTML = '';
    const info = npcInfo(name);
    const src = info && info.ch ? avatarPic(info.ch) : '';
    if (src) { const im = document.createElement('img'); im.alt = ''; im.onerror = () => { if (im.parentNode === box) box.textContent = emojiFor(name, info); }; im.src = src; box.appendChild(im); return; }
    box.textContent = emojiFor(name, info);
  }
  /* 내 줄에는 내가 고른 캐릭터 사진 */
  function faceOfMe() {
    const box = T.face(); box.innerHTML = '';
    let src = ''; try { src = (typeof playerChar === 'function') ? avatarPic(playerChar(P && P.avatar)) : ''; } catch (e) {}
    if (src) { const im = document.createElement('img'); im.alt = ''; im.onerror = () => { if (im.parentNode === box) box.textContent = '🙂'; }; im.src = src; box.appendChild(im); return; }
    box.textContent = '🙂';
  }
  function emojiFor(name, info) {
    const r = (info && info.role) || '';
    if (/팀장|부장|대표/.test(name + r)) return '🧑‍💼';
    if (/고객|님$/.test(name)) return '🙋';
    if (/사수|선임|대리|주임|과장/.test(name + r)) return '🧑‍💻';
    return '💬';
  }

  /* ---------- 창 열고 닫기 ---------- */
  function openBox() {
    if (boxOpen) return; boxOpen = true;
    T.box().classList.add('open');
    document.body.classList.add('talk-on');
    if (global.__pcTalk) { try { global.__pcTalk(true); } catch (e) {} }
  }
  function closeBox() {
    if (!boxOpen) return; boxOpen = false;
    const box = T.box(); box.classList.remove('open', 'cam', 'me', 'choosing');
    T.opts().innerHTML = '';                              /* 닫힌 창에 지난 선택지 단추를 남기지 않는다 */
    document.body.classList.remove('talk-on');
    if (global.__pcTalk) { try { global.__pcTalk(false); } catch (e) {} }
    /* 3D 창으로 키보드를 돌려준다 — 안 돌리면 닫은 뒤 WASD 가 먹지 않는다 */
    try { const a = document.activeElement; if (!a || a === document.body || box.contains(a)) { if (a && a.blur) a.blur(); const f = $('stage'); if (f && f.contentWindow && !NO_STAGE) f.contentWindow.focus(); } } catch (e) {}
  }
  function maybeClose() { setTimeout(() => { if (!jobs && !showing && !(sess && sess.hold)) closeBox(); }, 0); }

  /* 한 장 그리기 — item {who, role, text, options[], timeLimit, me, keep} */
  function paint(item) {
    const box = T.box();
    const hasOpts = !!(item.options && item.options.length);
    box.classList.toggle('choosing', hasOpts);
    box.classList.toggle('me', !!item.me);
    /* 얼굴 카메라가 잡은 사람이 말할 때는 작은 사진을 숨긴다(얼굴은 위에 있다). 다른 사람의 줄(브리핑의 사수 등)이면 사진으로 누구인지 보인다 */
    box.classList.toggle('cam', !!camSeat && (!!item.me || !sess || normName(item.who) === sess.name));
    if (!item.keep) {
      if (item.me) faceOfMe(); else if (/^전화/.test(item.role || '') && !npcInfo(item.who)) T.face().textContent = '☎'; else faceOf(item.who);
      T.name().textContent = item.who || '';
      T.role().textContent = item.role || '';
      T.text().textContent = fill(item.text);
      T.text().scrollTop = 0;
    }
    const ob = T.opts(); ob.innerHTML = '';
    if (hasOpts) {
      item.options.forEach((o, i) => {
        const b = mkBtn(o.label, o.cls || '', () => { if (showing && showing.item === item) showing.end(i); });
        b.dataset.n = String(i + 1);
        ob.appendChild(b);
      });
      if (item.timeLimit) {
        const bar = h('div', 'tkBar'); const iv = h('i'); bar.appendChild(iv); ob.appendChild(bar);
        requestAnimationFrame(() => { iv.style.transition = `width ${item.timeLimit}s linear`; iv.style.width = '0%'; });
      }
      /* 키보드가 3D 창에 머물러 있으면 숫자·Enter 가 대화창에 오지 않는다 — 첫 선택지로 옮긴다 */
      setTimeout(() => { try { if (showing && showing.item === item && !BOT) { const f = ob.querySelector('button'); if (f) f.focus({ preventScroll: true }); } } catch (e) {} }, 90);
    } else {
      setTimeout(() => { try { if (showing && showing.item === item && !BOT) T.box().querySelector('.tkBox').focus({ preventScroll: true }); } catch (e) {} }, 90);
    }
  }

  /* 창에 하나 올린다 — 앞의 것이 끝나야 다음 것이 뜬다. 선택지면 번호(-1=무응답), 대사면 undefined 로 풀린다 */
  function display(item) {
    item.seq = ++seq;
    const hasOpts = !!(item.options && item.options.length);
    jobs++;
    const run = () => new Promise((done) => {
      if (item.seq <= flushTo || (item.sess && item.sess.closed)) { done(hasOpts ? -1 : undefined); return; }
      openBox(); paint(item);
      if (!item.me && item.text && !(item.options && item.options.length)) lastLine = { name: item.who, text: String(item.text), at: Date.now() };
      let fin = false;
      const end = (v) => {
        if (fin) return; fin = true;
        if (showing && showing.timer) clearTimeout(showing.timer);
        if (showing && showing.item === item) showing = null;
        T.opts().querySelectorAll('button').forEach((b) => { b.disabled = true; });
        if (item.onEnd) { try { item.onEnd(v); } catch (e) {} }
        done(hasOpts ? (v == null ? -1 : v) : undefined);
      };
      showing = { end, item, timer: null };
      if (hasOpts) { if (item.timeLimit) showing.timer = setTimeout(() => end(-1), item.timeLimit * 1000); }
      else if (item.ms) showing.timer = setTimeout(() => end(), item.ms);
      if (item.onShow) { try { item.onShow(end); } catch (e) {} }
    });
    const p = chain.then(run, run);
    chain = p.then(() => {}, () => {});
    return p.then((v) => { jobs--; maybeClose(); return v; }, () => { jobs--; maybeClose(); return hasOpts ? -1 : undefined; });
  }
  async function idle() { while (jobs > 0) { await chain; await new Promise((r) => setTimeout(r, 0)); } }

  /* 읽는 데 드는 시간 — 글자 수로 잡되 너무 짧거나 길지 않게 */
  const readMs = (t, k) => Math.round(Math.max(2400, Math.min(9000, 1300 + 60 * String(t || '').length)) * (k || 1));

  /* 대사 한 줄. opt: {me, role, auto, soft, sess, ms}
       · auto(자동 플레이)면 띄우지 않는다.
       · 사람이 대화 중(human)이면 상대 대사는 누를 때까지, 내 대사는 잠깐 뒤 저절로 넘어간다.
       · 대화 밖에서 튀어나온 줄(soft)은 읽을 만큼 머물다 저절로 닫힌다 — 줄을 막아 세우지 않게. */
  function sayLine(who, text, opt) {
    opt = opt || {}; if (opt.auto || !text) return Promise.resolve();
    const s = ('sess' in opt) ? opt.sess : sess;
    const human = !!(s && s.human);
    let ms = opt.ms || 0;
    if (!ms) { if (opt.me) ms = human ? readMs(text, 0.55) : readMs(text, 0.8); else if (!human) ms = readMs(text); }
    return display({ who: opt.me ? meName() : who, role: opt.me ? '' : (opt.role != null ? opt.role : roleOf(who)), text, me: !!opt.me, sess: s, ms, live: !!opt.live });
  }

  /* ---------- 대화 한 판의 틀 ---------- */
  function begin(o) {
    o = o || {};
    const s = { id: ++sessSeq, name: normName(o.name || ''), role: o.role || '', seat: o.seat || null, cam: !!o.cam, hold: !!o.hold, human: o.human != null ? !!o.human : !BOT, closed: false };
    sess = s;
    if (s.cam && s.seat) {
      camIn(s.seat);
      /* 3D 는 talkView 를 켠 뒤 25초가 지나면 카메라를 스스로 푼다(갇히지 않게). 대화가 길어지면 다시 붙잡는다 */
      s.camKeep = setInterval(() => { if (sess === s && !s.closed && camSeat) camIn(camSeat); }, 12000);
    }
    if (s.hold) openBox();
    return s;
  }
  async function end(s) {
    if (!s) return;
    await idle();
    if (s.camKeep) { clearInterval(s.camKeep); s.camKeep = null; }
    if (sess !== s) return;
    sess = null;
    if (s.cam || camSeat) camOut();
    maybeClose();
  }

  /* ======================================================================
     ① 선택지 하나 고르기
     ====================================================================== */
  function choose(prompt, items, timeLimit, opts) {
    opts = opts || {};
    const options = (items || []).map((t) => ({ label: t }));
    if (!options.length) return Promise.resolve(-1);
    return display({ who: opts.who || '', role: opts.role || '', text: prompt || '', options, timeLimit, sess: opts.sess || sess });
  }

  /* ======================================================================
     ② NPC 와 주고받는 대화 (T)
     ====================================================================== */

  /* 오늘 그 사람에게 남은 일 — 있으면 그것이 첫 선택지가 된다.
     45차(대표 「말·질문·서류 제출은 T로만」): 컴퓨터 카드의 「가서 전달하기」 단추가 없어지고 사람을 직접 찾아간다.
     그런데 **맞는 상대를 고르는 것**이 이 카드들의 학습 목표(조직이해 ⑨ · 맞는 상대 n/m)다. 그래서
       · 전달·질문 — 누구에게 T 를 눌러도 선택지에 뜬다(팀장은 그 건의 상대일 때만 — 예전 목적지 목록과 같은 규칙).
         틀린 사람에게 내밀면 예전과 똑같이 「그건 ○○팀이요」로 돌아오고 셈에 들어간다.
       · 보고·검산 결과 — 상대가 정해져 있으니 그 사람에게만 뜬다.
     opt.mark(머리 위 표시용)면 정답을 드러내는 전달·질문은 뺀다(MARK_TARGETS 로 되돌릴 수 있다). */
  const MARK_TARGETS = false;
  function tasksFor(name, opt) {
    opt = opt || {};
    const out = [];
    if (!D || S.phase !== 'work' || !name) return out;
    const leadName = (D.dests.find((x) => x.seat === 'lead') || {}).name || '';
    const isLead = name === leadName;
    const mark = !!opt.mark;
    for (const id of S.order) {
      const c = CARD(id), st = S.cards[id];
      if (!c || !st || !st.arrived || st.status === 'done' || st.status === 'skipped') continue;
      const steps = st.steps || {}, flow = flowOf(c);
      const dl = c.deliver || null;
      if (flow.includes('visit')) {
        if (st.visitorHere && normName(c.visitorName || c.from) === name) out.push({ id: id, kind: 'visit', label: `「${cut(c.subj)}」 응대하기`, hint: 'T — 응대하기' });
        continue;
      }
      if (flow.includes('work') && steps.work && !steps.deliver && dl && dl.npc === name) {
        out.push({ id: id, kind: 'sheet', label: `「${cut(c.subj)}」 검산 결과 가져가기`, hint: 'T — 검산 결과 가져가기' }); continue;
      }
      if (flow.includes('work')) continue;
      if (flow.includes('deliver') && !steps.deliver && dl) {
        const right = dl.npc === name;
        if ((mark ? (MARK_TARGETS && right) : (!isLead || right))) out.push({ id: id, kind: 'deliver', label: `「${cut(c.subj)}」 전달하기`, hint: 'T — 서류 전달하기' });
        continue;
      }
      if (flow.includes('ask') && !st.ask && !steps.reply) {
        const right = c.npc === name;
        if ((mark ? (MARK_TARGETS && right) : (!isLead || right))) out.push({ id: id, kind: 'ask', label: `「${cut(c.subj)}」 여쭤보기`, hint: 'T — 여쭤보기' });
        continue;
      }
      if (flow.includes('report') && !steps.report) {
        const to = c.npc || (c.report && c.report.npc) || leadName;
        if (to === name) { out.push({ id: id, kind: 'report', label: `「${cut(c.subj)}」 보고드리기`, hint: 'T — 보고드리기' }); continue; }
      }
    }
    /* 할 일이 여럿이면 상대가 정해진 것(보고·검산·응대)을 앞에 */
    const rank = { visit: 0, report: 1, sheet: 1, deliver: 2, ask: 2 };
    return out.sort((a, b) => rank[a.kind] - rank[b.kind]);
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

  /* 대화 한 판. T 를 누른 순간 3D 가 얼굴 카메라를 켜고 여기로 온다 */
  async function npc(name, seat, team) {
    name = normName(name);
    if (!name) return;
    if (sess && sess.hold) { if (sess.name === name && !sess.closed) return; close(); await idle(); }
    const info = npcInfo(name) || {};
    seat = seat || info.seat || seatByName(name);
    const roleText = seat === 'visitor' ? '방문' : roleOf(name);
    const s = begin({ name, seat, cam: true, hold: true });
    s.team = team || null;
    const after = [];                                     /* 대화가 끝난 뒤 컴퓨터에 띄울 카드 */
    const post = [];                                      /* 대화가 닫힌 뒤 부를 것(부르기의 onHeard) */
    try {
      /* ① 그 사람이 먼저 할 말 — 머리 위 표시가 떠 있던 까닭 */
      const heard = (pending[name] || []).splice(0); delete pending[name]; delete noticed[name]; refresh();
      /* 부르기(브리핑·마무리) — 한 줄씩 다 듣고 대화를 닫은 뒤 onHeard(시계 시작·결과 화면). Esc 로 끊으면 못 들은 줄은 다시 쌓는다 */
      if (heard.some((x) => x.call)) {
        for (let i = 0; i < heard.length; i++) {
          const it = heard[i];
          if (s.closed) { const back = heard.slice(i); pending[name] = back.concat(pending[name] || []); noticed[name] = true; refresh(); break; }
          await sayLine(it.who || name, it.text, { sess: s, role: it.who && it.who !== name && !npcInfo(it.who) ? (it.role || '') : undefined });
          if (it.onHeard) { if (it.token) { it.token.done = true; clearInterval(it.token.remind); } post.push(it.onHeard); }
        }
        throw { done: true };
      }
      for (let i = 0; i < heard.length - 1 && !s.closed; i++) await sayLine(heard[i].who || name, heard[i].text, { sess: s });
      /* 방문객 — 잡담 없이 곧바로 응대로 들어간다 */
      if (seat === 'visitor' && !s.closed) {
        const vt = tasksFor(name).find((x) => x.kind === 'visit');
        if (vt) { await runTask(name, vt); await idle(); throw { done: true }; }
      }
      let say = heard.length ? heard[heard.length - 1].text : line(name, 'hi', 0);
      let keep = false;
      let turn = 0;
      /* ② 고를 때마다 다음 화면을 그린다 */
      while (!s.closed) {
        const opts = [];
        for (const t of tasksFor(name)) opts.push({ label: t.label, cls: 'pri', v: { task: t } });
        opts.push({ label: '그냥 인사', v: { say: 'hi' } });
        opts.push({ label: '요즘 어떠세요', v: { say: 'how' } });
        opts.push({ label: '이만 가 볼게요', v: { bye: true } });
        const i = await display({ who: name, role: roleText, text: say, keep, options: opts, sess: s });
        const pick = i >= 0 ? opts[i].v : null;
        if (s.closed) break;
        if (!pick || pick.bye) {
          await sayLine(name, line(name, 'bye', turn), { sess: s, ms: 1300 });
          break;
        }
        if (pick.task) {
          await runTask(name, pick.task);
          await idle();
          after.push(pick.task.id);
          keep = true; say = '';                          /* 상대의 마지막 말을 그대로 둔 채 선택지만 새로 */
          continue;
        }
        turn++; keep = false;
        if (pick.say === 'hi') {
          greeted[name] = (greeted[name] || 0) + 1;
          /* 인사를 세 번 나누면 신뢰가 아주 조금. 하루 한 사람당 한 번뿐이다 */
          if (greeted[name] >= 3 && !trusted[name] && npcInfo(name)) {
            trusted[name] = true; S.trust[name] = (S.trust[name] || 0) + 1;
          }
        }
        say = line(name, pick.say, turn);
      }
    } catch (e) {
      if (!(e && e.done)) console.warn('대화 오류', e);
    } finally {
      s.closed = true;
      await end(s);
    }
    for (const f of post) { try { f(); } catch (e) { console.warn('부르기 뒤 처리 오류', e); } }
    /* 남은 단계(회신 쓰기 등)는 컴퓨터에서 한다 — 카드를 메일 창에 올려 둔다 */
    for (const id of after) {
      const st = S.cards[id];
      /* 쓰던 회신이 있으면 건드리지 않는다 — 작성 칸은 하나라 다른 카드를 열면 쓰던 글이 사라진다 */
      if (st && st.status !== 'done' && !S.composing && typeof global.openCard === 'function') { try { global.openCard(id); } catch (e) {} break; }
    }
  }

  /* 고른 일을 실제로 한다 — 채점 경로는 기존 함수 그대로다(새로 만들지 않는다) */
  async function runTask(name, t) {
    const info = npcInfo(name) || {};
    /* 오늘 데이터에 없는 사람(다른 팀 사무실의 팀장 등)도 받을 수 있게 — 팀은 3D 가 알려 준 지금 방으로 */
    const room = (sess && sess.team) || info.teamKey || S.team;
    const d = (D.dests || []).find((x) => x.name === name) ||
      { seat: info.seat || (sess && sess.seat) || seatByName(name), name: name, team: info.team || TEAM_NAMES[room] || '', key: info.teamKey || room };
    try {
      if (t.kind === 'visit') await doVisit(t.id);
      else if (t.kind === 'deliver') await doDeliver(t.id, d);
      else if (t.kind === 'ask') await doAsk(t.id, d);
      else if (t.kind === 'report') await doReport(t.id);
      else if (t.kind === 'sheet') await doSheetDeliver(t.id);
    } catch (e) { console.warn('대화에서 시작한 일 처리 오류', e); }
  }

  /* ======================================================================
     ③ 그 자리에서 대화로 — 전달·질문·보고를 걷는 연출 없이
     `travel()`(core.js) 을 감싼다. T 로 마주 선 상대에게 하는 일이면 이 창에서 주고받고,
     3D 가 없거나 연출을 못 하는 경우(예전의 「알림 한 줄」 대체)도 이 창에서 한다.
     그 밖(컴퓨터 카드의 「가서 전달하기」)은 예전대로 3D 가 걸어가 연출하고, 대사는 onSay 로 이 창에 온다.
     돌려주는 값은 3D interact 와 같다: deliver {ok,present,line} · ask {choice,answer,present} · report {choice,line,present} · visit {choice,present}
     ====================================================================== */
  async function talkFlow(mode, opts, s) {
    const who = opts.who || (s && s.name) || '';
    const A = opts.auto != null && opts.auto !== false;
    const autoI = (n) => Math.max(0, Math.min(n - 1, +opts.auto || 0));
    const me = (t) => sayLine(who, t, { me: true, auto: A, sess: s });
    const them = (t, name) => sayLine(name || who, t, { auto: A, sess: s, role: name && name !== who ? (opts.role || '') : undefined });
    if (mode === 'deliver') {
      await me(opts.text || '이거 전달드리러 왔어요.');
      const ln = opts.npcLine || (opts.ok === false ? '그건 다른 팀인데요.' : '네, 처리할게요.');
      await them(ln);
      return { ok: opts.ok !== false, present: true, line: ln };
    }
    if (mode === 'ask') {
      const qs = opts.questions || [];
      const i = A ? autoI(qs.length) : await choose(`${who}에게 무엇을 물어볼까요?`, qs, null, { who, role: roleOf(who), sess: s });
      if (i == null || i < 0) return { choice: -1, answer: null, present: true };
      await me(qs[i]);
      const ans = (opts.answers && opts.answers[i]) || opts.answer || '그건 저도 잘 모르겠는데요.';
      await them(ans);
      return { choice: i, answer: ans, present: true };
    }
    if (mode === 'report') {
      const ch = opts.choices || [];
      if (opts.text) await me(opts.text);
      if (!A) await them(opts.ask || '근거가 뭐야?');
      const i = A ? autoI(ch.length) : await display({ who, role: roleOf(who), text: opts.ask || '근거가 뭐야?', keep: true, options: ch.map((t) => ({ label: t })), sess: s });
      if (i == null || i < 0) return { choice: -1, present: true };
      await me(ch[i]);
      const ln = (opts.lines && opts.lines[i]) || '';
      if (ln) await them(ln);
      return { choice: i, line: ln, present: true };
    }
    if (mode === 'visit') {
      const name = opts.name || who || '방문객';
      const ch = opts.choices || [];
      const open = opts.lines && opts.lines.open;
      if (open && !A) await sayLine(name, open, { sess: s, role: '방문' });
      const i = A ? autoI(ch.length) : await display({ who: name, role: '방문', text: open || opts.prompt || '어떻게 응대할까요?', keep: !!open, options: ch.map((t) => ({ label: t })), timeLimit: opts.timeLimit || null, sess: s });
      if (i == null || i < 0) return { choice: -1, present: true };
      await me(ch[i]);
      const re = (opts.reacts && opts.reacts[i]) || '';
      if (re) await sayLine(name, re, { auto: A, sess: s, role: '방문' });
      return { choice: i, present: true };
    }
    return { ok: true, present: true };
  }
  /* 3D 가 이 연출을 할 수 있는가 — core.js travel() 의 분기와 같은 조건 */
  function stageCan(opts) {
    const O = O3(); if (!O || O.busy) return false;
    if (typeof O.goToTeam === 'function' && opts.teamKey && opts.teamKey !== S.team) return true;
    return !!(opts.seat && O.npcAt && O.npcAt(opts.seat));
  }
  /* 3D 연출 한 판을 대화의 틀로 감싼다. 연출이 끝난 직후 오는 반응(Talk.reply)도 같은 판에 이어 붙도록 한 틱 뒤에 닫는다 */
  async function stage(opts, fn) {
    opts = opts || {};
    const s = begin({ name: normName(opts.who || opts.name || ''), seat: opts.seat || null, hold: false, human: opts.auto == null && !BOT });
    s.stage = true; s.auto = opts.auto != null; s.timeLimit = opts.timeLimit || null;
    if (!s.auto) watchChoice(s);
    try { return await fn(); }
    finally { s.stageDone = true; setTimeout(() => end(s), 0); }
  }
  function wrapTravel() {
    const orig = global.travel; if (typeof orig !== 'function' || orig.__talk) return;
    const wrapped = async function (mode, opts) {
      opts = opts || {};
      /* T 로 마주 선 사람에게 하는 일 — 그 자리에서 대화로 */
      if (sess && !sess.closed && sess.hold && (opts.who === sess.name || (opts.seat && opts.seat === sess.seat))) {
        return talkFlow(mode, opts, sess);
      }
      const human = opts.auto == null && !BOT;
      if (!stageCan(opts)) {
        /* 예전의 「알림 한 줄」 대체 연출 — 이제 대화창에서 한다 */
        const s = begin({ name: opts.who || opts.name || '', seat: null, hold: false, human });
        try { if (!NO_STAGE && opts.auto == null) await sleep(400); return await talkFlow(mode, opts, s); }
        finally { setTimeout(() => end(s), 0); }
      }
      /* 3D 가 걸어가 연출한다 — 대사는 onSay 로, 선택지는 onChoose/패널 옮기기로 이 창에 온다.
         상대가 **지금 이 방 자리에 앉아 있으면**(45차 데이터: 조력자도 우리 방 staff2~4 에 앉는다) 다른 팀 방으로 돌아가지 않고
         이 방에서 연출한다 — core.js travel() 은 팀이 다르면 무조건 복도로 나가 그 팀 방에서 사람을 찾다가 못 찾고 돌아왔다. */
      const O = O3();
      const occ = O && !O.busy && opts.seat && O.npcAt ? O.npcAt(opts.seat) : null;
      const inRoom = occ && (typeof O.roomOf !== 'function' || O.roomOf() === S.team) && (!occ.label || normName(occ.label) === normName(opts.who));
      if (inRoom && opts.teamKey && opts.teamKey !== S.team && typeof O.interact === 'function') {
        return stage(opts, async () => { const r = await O.interact(mode, Object.assign({}, opts, { to: opts.seat })); return r || { present: false }; });
      }
      const self = this, args = arguments;
      return stage(opts, () => orig.apply(self, args));
    };
    wrapped.__talk = true;
    global.travel = wrapped;
  }

  /* ---------- 3D 선택 패널 옮기기 ----------
     3D 연출(interact)은 선택지를 iframe 안 #choice 에 띄운다. 대화창이 화면 아래를 덮으므로 그대로 두면
     가려진다. 3D 가 onChoose 를 내주기 전까지는 그 패널을 읽어 이 창에 옮기고, 고르면 __office.choose(i). */
  let choiceHooked = false;
  function watchChoice(s) {
    if (choiceHooked) return;
    const iv = setInterval(() => {
      if (s.stageDone || s.closed) { clearInterval(iv); return; }
      let doc = null; try { doc = $('stage').contentDocument; } catch (e) {}
      const el = doc && doc.getElementById('choice');
      if (!el || el.style.display !== 'block' || el.__talkMirrored) return;
      el.__talkMirrored = true;
      const q = (el.querySelector('.q') || {}).textContent || '';
      const labels = Array.from(el.querySelectorAll('button')).map((b) => b.textContent.replace(/^\d+\.\s*/, ''));
      el.style.visibility = 'hidden';
      const item = {
        who: s.name || '', role: roleOf(s.name), text: q, options: labels.map((t) => ({ label: t })), timeLimit: s.timeLimit, sess: s, mirror: true,
        onShow: (endIt) => {
          /* 3D 쪽에서 먼저 닫히면(시간 초과 choose(-1) 등) 이 창도 닫는다 */
          const w = setInterval(() => { if (el.style.display !== 'block' || s.closed) { clearInterval(w); endIt(); return; } el.style.visibility = 'hidden'; }, 150);
          item._w = w;
        },
        onEnd: (v) => { clearInterval(item._w); el.style.visibility = ''; el.__talkMirrored = false; if (v != null && v >= 0) { const O = O3(); try { if (O && typeof O.choose === 'function') O.choose(v); } catch (e) {} } }
      };
      display(item);
    }, 120);
  }
  /* 3D 가 선택지를 넘겨주는 계약(요청 중) — fn({q, options, mode, name, seat, team, timeLimit}) → Promise<번호> */
  function onChoose(p) {
    choiceHooked = true;
    p = p || {};
    const s = sess && !sess.closed ? sess : null;
    if ((s && s.auto) || (!s && BOT)) return Promise.resolve(-1);
    return display({ who: p.name || (s && s.name) || '', role: roleOf(p.name || (s && s.name)), text: p.q || '', options: (p.options || []).map((t) => ({ label: t })), timeLimit: p.timeLimit || (s && s.timeLimit) || null, sess: s });
  }
  /* 3D 연출 대사 — fn({name, text, ttl, who:'npc'|'player', seat, team}).
     3D 는 ttl 초 기다리고 다음 대사로 넘어간다. 3D 가 이 약속의 Promise 를 기다려 주면(sayWaits) 상대 대사는 누를 때까지 둔다. */
  function onSay(p) {
    p = p || {};
    const s = sess && !sess.closed ? sess : null;
    if (s && s.auto) return undefined;
    /* 기다려 달라고 하는 것은 사람이 보고 있는 연출 판뿐이다 — 판 밖(퇴근 연출 등)·자동화에서 기다리면 3D 가 180초씩 멈춘다 */
    const O = O3(); const waits = !!(O && O.sayWaits) && !!(s && s.human);
    const isMe = p.who === 'player';
    const name = isMe ? meName() : normName(p.name || (s && s.name) || '');
    /* 앞 대사가 아직 떠 있으면(3D 는 이미 다음으로 넘어갔다) 걷어내고 새 대사를 띄운다 */
    if (!waits && showing && showing.item.live) showing.end();
    /* 3D 가 기다려 주지 않으면 ttl 보다 조금 더 머문다 — 다음 대사가 오면 곧바로 갈아 끼우므로 창이 깜빡이지 않는다 */
    const ms = waits ? (isMe ? readMs(p.text, 0.55) : 0) : Math.max(1200, (+p.ttl || 2.5) * 1000 + 700);
    const pr = display({ who: name, role: isMe ? '' : (roleOf(name) || (p.seat ? '' : '방문')), text: p.text, me: isMe, sess: s, ms, live: !waits });
    return waits ? pr : undefined;
  }

  /* ======================================================================
     ④ NPC 가 먼저 할 말 · 방금 한 일의 반응
     ====================================================================== */
  function refresh() { try { if (typeof global.refreshTalkHints === 'function') global.refreshTalkHints(); } catch (e) {} }
  /* 먼저 할 말 — 자리가 있으면 쌓아 두고(머리 위 표시), 없으면 사내 메신저 */
  function hear(who, text) {
    const name = normName(who); text = String(text || '').trim();
    if (!name || !text) return false;
    /* 하루가 닫히는 중(결과 계산 · 팀장 마무리 대기)에 미처리 카드 분기가 쏟아내는 말은 흘려보낸다 — 마무리 대화 앞에 끼어들지 않게 */
    if (S.phase === 'debrief' || S.phase === 'wrap') return true;
    if (!seatByName(name)) { if (typeof msgLine === 'function') msgLine(name, fill(text)); return true; }
    if (sess && !sess.closed && sess.name === name) { sayLine(name, text, { sess }); return true; }
    const q = (pending[name] = pending[name] || []);
    if (!q.some((x) => x.text === text)) q.push({ text, who: name });
    while (q.length > 6) { const i = q.findIndex((x) => !x.call); if (i < 0) break; q.splice(i, 1); }
    refresh();
    /* 내용은 알리지 않는다 — 누가 부르는지만. 같은 사람은 한 번 알리고 들을 때까지 다시 알리지 않는다 */
    if (!noticed[name] && S.phase === 'work') { noticed[name] = true; toast('할 말이 있대요. 가서 T 로 들어 보세요.', name, 3800, 'cust'); }
    return true;
  }
  /* 방금 한 일의 반응 — 대화 중이면 그 판에, 아니면 잠깐 창을 띄워 읽힌다 */
  function reply(who, text) {
    const name = normName(who); text = String(text || '').trim();
    if (!name || !text) return;
    /* 데이터에 연출 대사(wrongNpcLine 등)와 분기 반응(now.text)이 거의 같은 말로 두 번 적힌 경우가 있다 — 방금 한 말에 담기면 넘긴다 */
    const same = (a, b) => { const n = (x) => String(x || '').replace(/[\s.,!?…~"'「」]/g, ''); a = n(a); b = n(b); return !!a && !!b && (a.includes(b) || b.includes(a)); };
    if (lastLine && lastLine.name === name && Date.now() - lastLine.at < 60000 && same(lastLine.text, fill(text))) return;
    const seat = seatByName(name);
    if (sess && !sess.closed && (sess.name === name || !seat)) { sayLine(name, text, { sess, role: (sess.name === name && !npcInfo(name) && sess.role) || undefined }); return; }
    if (!seat) { if (typeof msgLine === 'function') msgLine(name, fill(text)); return; }
    sayLine(name, text, { sess: null });
  }
  function hasPending(name) { const q = pending[normName(name)]; return !!(q && q.length); }

  /* 부르기 — 그 사람에게 가서 T 로 **들어야 하는** 말 묶음(45차: 아침 브리핑 · 퇴근 마무리).
     lines [{who,text,role}] 는 그 사람과의 대화 한 판에 차례로 나오고(말한 사람 이름표로), 다 들으면 onHeard.
     머리 위 표시는 쌓인 말이 있으니 저절로 뜬다. notice 알림을 띄우고 remind 마다(대화창이 닫혀 있을 때) 다시 알린다.
     돌려주는 cancel() — 자동 플레이처럼 듣지 않고 넘어갈 때 쌓인 말과 알림을 걷는다. */
  function call(name, lines, opts) {
    name = normName(name); opts = opts || {};
    const token = { name, done: false, remind: null };
    const items = (lines || []).filter((l) => l && l.text).map((l) => ({ text: String(l.text), who: normName(l.who || name), role: l.role, call: true, token }));
    if (!name || !items.length) { token.done = true; if (opts.onHeard) { try { opts.onHeard(); } catch (e) { console.warn(e); } } return { cancel() {}, heard: () => true }; }
    items[items.length - 1].onHeard = opts.onHeard || null;
    (pending[name] = pending[name] || []).push(...items);
    noticed[name] = true;
    refresh();
    const say = () => { if (!token.done && opts.notice && typeof toast === 'function') toast(opts.notice, null, 5200, 'cust'); };
    say();
    if (opts.remind) token.remind = setInterval(() => { if (token.done) { clearInterval(token.remind); return; } if (!boxOpen) say(); }, opts.remind);
    return {
      heard: () => token.done,
      cancel() { token.done = true; clearInterval(token.remind);
        const q = pending[name]; if (q) { pending[name] = q.filter((x) => x.token !== token); if (!pending[name].length) delete pending[name]; }
        refresh(); }
    };
  }

  /* 대화를 닫는다(Esc) — 떠 있는 것과 줄 선 것을 모두 걷는다 */
  function close() {
    /* 3D 연출이 선택을 기다리는 중이면 닫지 않는다 — 닫으면 3D 가 영영 기다린다 */
    if (showing && showing.item.mirror) return;
    flushTo = seq;
    if (sess) sess.closed = true;
    if (showing) showing.end();
    const s = sess; if (s) end(s);
    maybeClose();
  }

  /* ---------- 말풍선·알림 경로를 대화로 돌린다 ----------
     core.js 의 bubble()·sayNpc() 는 3D 말풍선 + 알림으로 흘려보냈다(대표 「말풍선 없애고」).
     core.js 는 다른 담당 파일이라 여기서 전역 이름을 갈아 끼운다(pc.js 가 travel 을 감싸는 방식과 같다). */
  global.sayNpc = function (who, text) { hear(who, text); return true; };
  global.bubble = function (who, text) { const n = normName(who); if (!seatByName(n)) return false; hear(n, text); return true; };
  wrapTravel();

  /* ---------- 키보드 ----------
     대사: 클릭·Enter·Space 로 넘긴다 / 선택지: 숫자키 / Esc 는 pc.js 가 Talk.close() 로 넘긴다.
     3D 창(iframe)에 포커스가 남아 있어도 받도록 그 창에도 붙인다(같은 출처). */
  function onKey(ev) {
    if (!boxOpen || !showing) return false;
    const t = ev.target; const tag = (t && t.tagName || '').toUpperCase();
    /* 글을 쓰는 중이면 가로채지 않는다. 다만 컴퓨터가 꺼져 안 보이는 작성 칸에 포커스만 남은 경우는 대화창 차례다 */
    if ((tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') && t.offsetParent !== null) return false;
    const it = showing.item; const hasOpts = !!(it.options && it.options.length);
    if (!hasOpts && (ev.code === 'Enter' || ev.code === 'NumpadEnter' || ev.code === 'Space')) { ev.preventDefault(); showing.end(); return true; }
    if (hasOpts && /^(Digit|Numpad)[1-9]$/.test(ev.code)) { const n = +ev.code.slice(-1) - 1; if (n < it.options.length) { ev.preventDefault(); showing.end(n); return true; } }
    return false;
  }
  document.addEventListener('keydown', (ev) => { if (ev.repeat) return; onKey(ev); }, true);
  setInterval(() => {
    if (NO_STAGE) return; let w = null; try { w = $('stage').contentWindow; } catch (e) {}
    if (!w || !w.document || w.__talkKeys) return;
    try {
      w.__talkKeys = true;
      w.addEventListener('keydown', (ev) => {
        if (!boxOpen) return;
        if (ev.code === 'Escape') { ev.preventDefault(); ev.stopImmediatePropagation(); close(); return; }
        if (onKey(ev)) { ev.stopImmediatePropagation(); return; }
        /* 대화 중에는 3D 의 E·T·Space 가 새 행동을 시작하지 않게 막는다 */
        if (/^(KeyE|KeyT|Space|Enter)$/.test(ev.code)) { ev.preventDefault(); ev.stopImmediatePropagation(); }
      }, true);
    } catch (e) {}
  }, 1000);
  /* 대사 칸을 누르면 넘어간다(선택지 단추 누름은 단추가 처리) */
  { const bx = T.box(); if (bx) bx.addEventListener('click', (ev) => {
    if (!showing || (showing.item.options && showing.item.options.length)) return;
    if (ev.target && ev.target.closest && ev.target.closest('button')) return;
    showing.end(); }); }

  global.Talk = {
    choose: choose,
    npc: npc,
    tasks: tasksFor,
    hear: hear,
    reply: reply,
    hasPending: hasPending,
    anyPending: () => Object.keys(pending).some((k) => pending[k] && pending[k].length),
    pending: () => Object.fromEntries(Object.entries(pending).map(([k, q]) => [k, q.map((x) => x.text)])),
    call: call,
    norm: normName,
    say: (who, text, opt) => sayLine(normName(who), text, Object.assign({ sess: sess }, opt || {})),
    begin: begin,
    end: end,
    stage: stage,
    idle: idle,
    isOpen: () => boxOpen || !!showing,
    close: close,
    onSay: onSay,
    onChoose: onChoose,
    /* 3D 가 「말을 걸었다」고 알려 올 때 붙이는 자리 */
    onNpc: (info) => { if (!info) return; npc(info.name || npcBySeat(info.seat), info.seat, info.team); },
    /* 지금 T 로 마주 선 사람인가 — cards.js doVisit 가 3D 연출 대신 대화로 갈지 정한다 */
    here: (who, seat) => !!(sess && !sess.closed && sess.hold && ((who && normName(who) === sess.name) || (seat && seat === sess.seat))),
    /* 검사용 */
    state: () => ({ open: boxOpen, showing: showing ? { who: showing.item.who, text: showing.item.text, options: (showing.item.options || []).map((o) => o.label) } : null, sess: sess ? { name: sess.name, seat: sess.seat, hold: sess.hold, cam: sess.cam } : null, jobs, pending: Object.keys(pending) })
  };
})(window);
