/* ==========================================================================
   사내 메신저 — PC 바탕화면 안의 앱 하나.

   대표 지적 두 번
     ① "컴퓨터에서 볼 수 있게 해줘. 그냥 이렇게 뜨는 거 어색하잖아"
        → 전자 메시지는 3D 위에 띄우지 않고 전부 이 창으로 모은다.
     ② "너무 산만해. 메신저와 이메일은 분리된 창에서 떴으면 좋겠고."
        "메신저는 카톡처럼 그냥 화면 채워지는 막대로 있고, 누르면 창 바로 뜨면 될 것
         같아. 「열어 보기」 이런 건 의미 없을 듯."
        → 대화 목록은 창을 가득 채우는 가로 막대, 줄을 누르면 곧바로 대화가 열린다.
          말풍선이 위아래로 쌓이고(상대 왼쪽 · 나 오른쪽), 답할 것이 있으면 창 아래에
          선택지나 짧은 입력칸이 붙는다. 말풍선 안의 「열어 보기」 단추는 없앴다.

   경계선 하나만 지킨다
     전자 메시지(메신저 카드·자리에 없는 사람의 한 줄) → **여기, 컴퓨터 안**
     대면 대화(브리핑·디브리프·걸어가서 하는 이야기)  → **3D 대화 모드**
     전화                                              → 전화 벨 · 전화 메모 앱

   채점은 하지 않는다. 창 아래 행동은 `window.msgActions(cardId, footEl)`(js/play/cards.js)가
   그리고, 실제 채점은 엔진의 기존 함수(sendCompose · doButton · doAsk)가 그대로 한다.

   바깥에 내는 것
     Msg.push(who, text, {team, mine, note, cls})   대화에 한 줄 넣기
     Msg.card(card)                                  메신저 카드 도착(본문이 그대로 쌓인다)
     Msg.mine(who, text)                             내가 보낸 말
     Msg.open(who) · Msg.unread() · Msg.reset() · Msg.refresh()
     Msg.onOpen(fn)  창을 앞으로 가져와야 할 때
     Msg.onChange(fn) 안 읽은 개수가 바뀔 때(독 배지 · PC 단추 점)
   ========================================================================== */
(function (global) {
  'use strict';

  var THREADS = {};       /* who -> {who, team, items:[], pending:cardId|null} */
  var ORDER = [];         /* 최근 온 사람이 앞 */
  var cur = null;         /* 지금 열어 둔 대화(없으면 목록 화면) */
  var root = null;        /* 창 안에 그려 둔 판(창을 닫아도 살아 있다) */
  var changed = [];
  var wantOpen = null;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  /* 게임 시각(분)을 시계로. play.html 의 fmtClock 이 있으면 그것을 쓴다 */
  function clock() {
    try { if (typeof global.fmtClock === 'function' && global.S) return global.fmtClock(global.S.t); }
    catch (e) {}
    return '';
  }
  /* 「윤하린 (물류팀)」 처럼 팀이 괄호 안에 붙어 오는 이름을 나눈다 */
  function split(from) {
    var m = String(from || '').match(/^\s*(.+?)\s*\(([^)]+)\)\s*$/);
    return m ? { who: m[1], team: m[2] } : { who: String(from || '동료').trim(), team: '' };
  }
  function info(who) {
    try { return (typeof global.npcInfo === 'function' && global.npcInfo(who)) || null; } catch (e) { return null; }
  }
  function faceEl(who) {
    var box = el('span', 'fa');
    var v = info(who);
    var src = '';
    try { if (v && v.ch && typeof global.avatarPic === 'function') src = global.avatarPic(v.ch); } catch (e) {}
    if (src) { var im = document.createElement('img'); im.src = src; im.alt = ''; box.appendChild(im); return box; }
    box.textContent = emoji(who, v);
    return box;
  }
  function emoji(who, v) {
    var r = (v && v.role) || '';
    if (/팀장|부장|대표/.test(who + r)) return '🧑‍💼';
    if (/고객|님$/.test(who)) return '🙋';
    if (/사수|선임|대리|주임|과장|사원/.test(who + r)) return '🧑‍💻';
    return '💬';
  }

  function thread(who, team) {
    var t = THREADS[who];
    if (!t) { t = THREADS[who] = { who: who, team: team || '', items: [], pending: null }; }
    if (team && !t.team) t.team = team;
    return t;
  }
  function unreadOf(t) {
    var n = 0;
    for (var i = 0; i < t.items.length; i++) if (!t.items[i].read && !t.items[i].mine && !t.items[i].note) n++;
    return n;
  }
  function unread() {
    var n = 0;
    for (var k in THREADS) if (Object.prototype.hasOwnProperty.call(THREADS, k)) n += unreadOf(THREADS[k]);
    return n;
  }
  function fire() { for (var i = 0; i < changed.length; i++) { try { changed[i](unread()); } catch (e) {} } }
  function bump(who) {
    var i = ORDER.indexOf(who);
    if (i >= 0) ORDER.splice(i, 1);
    ORDER.unshift(who);
  }

  /* ---------- 넣기 ---------- */
  function add(who, item, team) {
    var t = thread(who, team);
    item.at = item.at || clock();
    item.read = !!(item.mine || item.note);
    t.items.push(item);
    bump(who);
    if (cur === who && visible()) markRead(who);
    render(); fire();
    return t;
  }
  function push(who, text, opts) {
    opts = opts || {};
    var s = split(who);
    return add(s.who, { text: String(text == null ? '' : text), mine: !!opts.mine, note: !!opts.note, cls: opts.cls || '' },
      opts.team || s.team);
  }
  function mine(who, text) { var s = split(who); return add(s.who, { text: String(text || ''), mine: true }, s.team); }
  function note(who, text, cls) { var s = split(who); return add(s.who, { text: String(text || ''), note: true, cls: cls || '' }, s.team); }

  /* 메신저 카드가 도착했다 — 제목이 아니라 **본문이 그대로** 대화에 쌓인다 */
  function card(c) {
    if (!c) return;
    var s = split(c.from);
    var t = thread(s.who, s.team || c.teamName || '');
    t.pending = c.id;
    var body = String(c.body || '').trim();
    if (c.subj && body.indexOf(c.subj) < 0) add(s.who, { text: c.subj, card: c.id }, t.team);
    if (body) add(s.who, { text: body, card: c.id }, t.team);
    else if (!c.subj) add(s.who, { text: '(내용 없음)', card: c.id }, t.team);
    return t;
  }

  function markRead(who) {
    var t = THREADS[who];
    if (!t) return;
    for (var i = 0; i < t.items.length; i++) t.items[i].read = true;
  }
  /* 창이 화면에 실제로 보이는가 — 창을 닫아 두면 읽은 것으로 치면 안 된다 */
  function visible() {
    if (!root) return false;
    var n = root;
    while (n) { if (n === document.body) return !!root.offsetParent; n = n.parentNode; }
    return false;
  }

  /* ---------- 화면 ---------- */
  function mount(container) {
    container.classList.add('msgApp');
    root = container;
    render();
    return root;
  }
  /* 대화창 아래 입력칸은 창을 다시 그릴 때마다 새로 만들어진다. 쓰던 글과 커서 자리를
     지키지 않으면 상대가 한 줄 보낼 때마다 내가 쓰던 답장이 사라진다 — 실제로 그랬다. */
  function render() {
    if (!root) return;
    var a = document.activeElement;
    var keep = (a && a.tagName === 'TEXTAREA' && root.contains(a))
      ? { s: a.selectionStart, e: a.selectionEnd } : null;
    root.innerHTML = '';
    root.appendChild(el('div', 'msgHd', '대화'));
    var list = el('div', 'msgList');
    root.appendChild(list);
    if (!ORDER.length) {
      list.appendChild(el('div', 'msgEmpty', '아직 온 메시지가 없어요.\n동료가 보내면 여기에 쌓입니다.'));
    }
    ORDER.forEach(function (who) {
      var t = THREADS[who];
      var last = t.items[t.items.length - 1] || { text: '' };
      var n = unreadOf(t);
      var b = el('button', 'msgBar' + (n ? ' un' : ''));
      b.type = 'button';
      b.appendChild(faceEl(who));
      var mid = el('span', 'mid');
      var nm = el('span', 'nm');
      nm.appendChild(el('b', null, who));
      if (t.team) nm.appendChild(el('small', null, t.team));
      mid.appendChild(nm);
      mid.appendChild(el('span', 'ls', (last.mine ? '나: ' : '') + last.text));
      b.appendChild(mid);
      var rt = el('span', 'rt');
      rt.appendChild(el('span', 'tm', last.at || ''));
      if (n) rt.appendChild(el('span', 'nb', String(n)));
      b.appendChild(rt);
      b.onclick = function () { open(who); };
      list.appendChild(b);
    });
    if (cur && THREADS[cur]) root.appendChild(conv(cur));
    if (keep) {
      var ta = root.querySelector('.msgFoot textarea');
      if (ta) { try { ta.focus(); ta.setSelectionRange(keep.s, keep.e); } catch (e) {} }
    }
  }
  function conv(who) {
    var t = THREADS[who];
    var box = el('div', 'msgConv');
    var top = el('div', 'msgTop');
    var back = el('button', 'back', '‹ 목록');
    back.type = 'button';
    back.onclick = function () { cur = null; render(); };
    top.appendChild(back);
    top.appendChild(faceEl(who));
    var nm = el('span');
    nm.appendChild(el('b', null, who));
    if (t.team) nm.appendChild(el('small', null, t.team));
    top.appendChild(nm);
    box.appendChild(top);

    var body = el('div', 'msgBody');
    t.items.forEach(function (it) {
      if (it.note) { body.appendChild(el('div', 'msgNote ' + (it.cls || ''), it.text)); return; }
      var row = el('div', 'msgRow' + (it.mine ? ' me' : ''));
      row.appendChild(el('div', 'bub', it.text));
      if (it.at) row.appendChild(el('span', 'at', it.at));
      body.appendChild(row);
    });
    box.appendChild(body);

    var foot = el('div', 'msgFoot');
    var drew = false;
    if (t.pending && typeof global.msgActions === 'function') {
      try { drew = !!global.msgActions(t.pending, foot); } catch (e) { console.warn('메신저 행동 그리기 오류', e); }
    }
    if (!drew) { t.pending = null; foot.appendChild(el('div', 'tip', '답할 것은 없어요.')); }
    box.appendChild(foot);
    setTimeout(function () { body.scrollTop = body.scrollHeight; }, 0);
    return box;
  }

  function open(who) {
    if (who && THREADS[who]) cur = who;
    else if (!cur && ORDER.length) cur = ORDER[0];
    if (cur) markRead(cur);
    render(); fire();
    if (wantOpen) { try { wantOpen(cur); } catch (e) {} }
  }
  /* 목록 화면으로 — 앱을 열면 카톡처럼 대화 목록부터 보인다 */
  function list() { cur = null; render(); }
  /* 카드 상태가 바뀌면 대화창 아래를 다시 그린다 */
  function refresh() { if (root) render(); }
  function reset() { THREADS = {}; ORDER = []; cur = null; render(); fire(); }
  /* 쓰던 답장은 대화에 보관한다(창을 다시 그려도, 목록으로 나갔다 와도 남는다) */
  function draft(who, v) {
    var t = THREADS[who];
    if (!t) return '';
    if (v === undefined) return t.draft || '';
    t.draft = v; return v;
  }
  /* 어느 사람의 대화에 이 카드가 걸려 있나 */
  function whoOf(cardId) {
    for (var k in THREADS) if (THREADS[k].pending === cardId) return k;
    return null;
  }

  global.Msg = {
    mount: mount,
    push: push,
    mine: mine,
    note: note,
    card: card,
    open: open,
    list: list,
    refresh: refresh,
    reset: reset,
    unread: unread,
    draft: draft,
    whoOf: whoOf,
    cur: function () { return cur; },
    threads: function () {
      return ORDER.map(function (w) { return { who: w, n: THREADS[w].items.length, unread: unreadOf(THREADS[w]), pending: THREADS[w].pending }; });
    },
    onOpen: function (fn) { wantOpen = fn; },
    onChange: function (fn) { changed.push(fn); }
  };
})(window);
