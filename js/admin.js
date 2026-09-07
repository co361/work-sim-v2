/* ==========================================================================
   WORK SIM v2 — 관리자 콘솔 (docs/plan-portal.md 「W8」)
   --------------------------------------------------------------------------
   담당 파일은 admin.html 과 이 파일 둘뿐이다. play.html · office.html · home.html
   은 다른 담당이 편집 중이므로 건드리지 않는다.

   데이터가 사는 곳 (2026-09-07 프로젝트 분리 — co-work-sim 의 team-work-sim 이 아니다)
     - Firebase Auth        : 관리자 로그인. 프로젝트 **work-sim-7day**, 초기화는 js/firebase-config.js 하나만
     - 관리자 판정          : 대표 계정(co@edmakers.kr) 이거나 RTDB ws7/admins/{uid} 등록
     - RTDB ws7/tokens/{code} = {team,status,issuedAt,memo,usedBy,name}
     - RTDB ws7/users/{uid}   = {name,org,email,code,team,day,lastSeen}
     - RTDB ws7/admins/{uid}  = {by,at,memo}   (규칙상 쓰기는 대표 계정만)
     - GAS  ws7issue / ws7load / ws7save (docs/backend-7day.md 가 계약의 정본)

   비밀 취급
     ADMIN_SECRET 은 이 파일에 없다. 관리자가 화면에서 입력하고 sessionStorage
     에만 둔다(탭을 닫으면 사라진다). 공개 파일에 비밀을 넣지 않는다.

   부작용 주의
     ws7check 는 코드 상태를 unused → active 로 **바꾼다**. 관리자 화면은 목록을
     새로 그릴 때마다 그 짓을 하면 안 되므로 조회에는 ws7load 만 쓴다.
   ========================================================================== */
(function () {
  'use strict';

  /* ── 상수 ───────────────────────────────────────────────────────────── */

  var TEAMS = [
    ['cs', '고객상담팀'], ['logi', '물류팀'], ['acct', '회계팀'], ['ga', '총무팀'], ['rec', '채용팀'],
    ['plan', '경영기획팀'], ['qc', '품질관리팀'], ['pr', '홍보팀'], ['edu', '교육팀'], ['buy', '구매팀']
  ];
  var TEAM_NAME = {};
  TEAMS.forEach(function (t) { TEAM_NAME[t[0]] = t[1]; });

  var AXES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  var NCS_NAMES = {
    '1': '의사소통', '2': '수리', '3': '문제해결', '4': '자기개발', '5': '자원관리',
    '6': '대인관계', '7': '정보', '8': '기술', '9': '조직이해', '10': '직업윤리'
  };
  var CIRC = { '1': '①', '2': '②', '3': '③', '4': '④', '5': '⑤', '6': '⑥', '7': '⑦', '8': '⑧', '9': '⑨', '10': '⑩' };

  /* 일차 색 — 순서가 있는 값이므로 한 계열의 농도 변화로 준다 */
  /* 완료 일차 1~7 = 남색 한 색의 명도 눈금(옅음 → 진함). 38차에 금색 일곱 색을 걷었다 */
  var DAY_COLOR = ['#dce8fa', '#bdd4f3', '#9cbcea', '#7aa4de', '#5484c8', '#2f60ab', '#17427e'];
  var NONE_COLOR = '#eef0f4';

  var STATUS_LABEL = { unused: '미사용', active: '사용중', revoked: '정지' };
  var STATUS_CLASS = { unused: 'p-unused', active: 'p-active', revoked: 'p-revoked' };

  var LEDGER_KEY = 'ws7.admin.tokens';
  var SECRET_KEY = 'ws7.admin.secret';

  /* 규칙(v2/firebase/database.rules.json)이 무조건 통과시키는 계정. 등록 없이 첫 관리자가 된다 */
  var OWNER_EMAIL = 'co@edmakers.kr';

  /* ── 유틸 ───────────────────────────────────────────────────────────── */

  var $ = function (id) { return document.getElementById(id); };

  /* 사용자 입력(이름·소속·메모)이 표에 들어가므로 저장형 XSS 를 막는다 */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function normCode(s) { return String(s == null ? '' : s).trim().toUpperCase(); }

  /* RTDB 키로도 쓰이므로 형식을 확인한다 — `.` `$` `#` `[` `]` `/` 가 섞이면 엉뚱한 경로에 쓰게 된다 */
  var CODE_RE = /^[A-Z0-9]{2,6}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  function validCode(c) { return CODE_RE.test(c); }

  function fmtWhen(v) {
    if (!v) return '—';
    var d = (typeof v === 'number') ? new Date(v) : new Date(String(v));
    if (isNaN(d.getTime())) return String(v);
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function csvCell(v) {
    v = String(v == null ? '' : v);
    return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }

  function download(name, text, mime) {
    var a = document.createElement('a');
    var blob = new Blob(['﻿' + text], { type: mime || 'text/csv;charset=utf-8' });
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function say(el, text, kind) {
    var e = (typeof el === 'string') ? $(el) : el;
    if (!e) return;
    e.textContent = text || '';
    e.className = 'msg' + (kind ? ' ' + kind : '');
  }

  /* GAS 동시 왕복 수. ws7check/save/load/issue 는 서버에서 전역 잠금 안에 있어 어차피 줄을 선다.
     4로 두면 뒤에 선 요청이 대기 중에 타임아웃으로 떨어져 「진행 없음」처럼 보였다(2026-09-07 실측). */
  var GAS_PAR = 2;

  /* 동시 실행 상한을 둔 병렬 실행 — GAS 왕복이라 한꺼번에 던지면 줄줄이 시간 초과가 난다 */
  function pool(items, limit, fn) {
    return new Promise(function (resolve) {
      var out = new Array(items.length);
      var i = 0, done = 0;
      if (!items.length) return resolve(out);
      var run = function () {
        if (i >= items.length) return;
        var my = i++;
        Promise.resolve(fn(items[my], my)).then(function (r) { out[my] = r; }, function () { out[my] = null; })
          .then(function () {
            done++;
            if (done === items.length) resolve(out); else run();
          });
      };
      for (var k = 0; k < Math.min(limit, items.length); k++) run();
    });
  }

  /* ── 상태 ───────────────────────────────────────────────────────────── */

  var LOCAL = false;          /* 로컬 검사 모드(127.0.0.1 + ?local=1) */
  var auth = null, db = null;
  var rtdbBlocked = false;    /* RTDB ws7/ 를 읽지도 쓰지도 못하는 상태 */
  var isOwner = false;        /* 대표 계정(co@edmakers.kr) 으로 로그인했는가 — 관리자 추가 권한 */
  var ADMINS = [];            /* ws7/admins 목록 */
  var TOK = {};               /* code → {team,status,issuedAt,memo,usedBy,name,local} */
  var USERS = [];             /* [{uid,...}] */
  var PROG = {};              /* code → {progress|null, err} */
  var lastIssued = [];
  var curTab = 'issue';
  var stuCur = null;          /* 상세 대화상자가 보고 있는 학생 */

  /* ── 로컬 원장(RTDB 가 막혔거나 로컬 검사 모드일 때의 목록) ──────────── */

  function ledgerRead() {
    try { return JSON.parse(localStorage.getItem(LEDGER_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function ledgerWrite(map) {
    try { localStorage.setItem(LEDGER_KEY, JSON.stringify(map)); } catch (e) { /* 저장이 막힌 브라우저 */ }
  }
  function ledgerPut(code, rec) {
    var m = ledgerRead();
    m[code] = Object.assign({}, m[code] || {}, rec);
    ledgerWrite(m);
  }

  /* ── 비밀(ADMIN_SECRET) ─────────────────────────────────────────────── */

  function secretGet() {
    try { return sessionStorage.getItem(SECRET_KEY) || ''; } catch (e) { return ''; }
  }
  function secretSet(v) {
    try { if (v) sessionStorage.setItem(SECRET_KEY, v); else sessionStorage.removeItem(SECRET_KEY); } catch (e) { /* 무시 */ }
    renderSecret();
  }
  function renderSecret() {
    var on = !!secretGet();
    $('secState').textContent = on ? '이 탭에 기억됨' : '미입력';
    $('secState').style.color = on ? 'var(--ok)' : 'var(--mute)';
    $('btnIssue').disabled = !on;
  }

  /* ── 탭 ─────────────────────────────────────────────────────────────── */

  var PANELS = { issue: ['pIssue', 'pIssue2'], tokens: ['pTokens'], users: ['pUsers', 'pAdmins'], prog: ['pProg', 'pProg2'] };

  function showTab(name) {
    if (!PANELS[name]) name = 'issue';
    curTab = name;
    Object.keys(PANELS).forEach(function (k) {
      PANELS[k].forEach(function (id) { $(id).classList.toggle('hide', k !== name); });
      var btn = $('tab' + k.charAt(0).toUpperCase() + k.slice(1));
      if (btn) btn.setAttribute('aria-selected', k === name ? 'true' : 'false');
    });
  }

  function bindTabs() {
    var btns = Array.prototype.slice.call(document.querySelectorAll('.tab'));
    btns.forEach(function (b, i) {
      b.onclick = function () { showTab(b.dataset.tab); };
      b.onkeydown = function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        var n = btns[(i + d + btns.length) % btns.length];
        n.focus(); showTab(n.dataset.tab);
      };
    });
  }

  /* ── 팀 select 채우기 ───────────────────────────────────────────────── */

  function fillTeamSelects() {
    var a = $('isTeam'), b = $('fTeam');
    a.innerHTML = TEAMS.map(function (t) { return '<option value="' + t[0] + '">' + esc(t[1]) + ' (' + t[0] + ')</option>'; }).join('');
    b.innerHTML = '<option value="">전체</option>' +
      TEAMS.map(function (t) { return '<option value="' + t[0] + '">' + esc(t[1]) + '</option>'; }).join('');
  }

  /* ══════════════════════════════════════════════════════════════════════
     1. 로그인 — Firebase Auth + RTDB admins/{uid}
     ══════════════════════════════════════════════════════════════════════ */

  /* 초기화는 js/firebase-config.js 가 이미 했다. 여기서 initializeApp 을 다시 부르지 않는다 —
     두 번 부르면 앱이 갈라져 로그인한 세션과 DB 를 보는 세션이 서로 다른 것을 본다. */
  function initFirebase() {
    var fb = window.WS && window.WS.fb;
    if (!fb || !fb.auth || !fb.db) return false;
    auth = fb.auth;
    db = fb.db;
    return true;
  }

  /* 로그인 기능이 콘솔에서 아직 켜지지 않은 상태인가 (무료 플랜은 API 로 못 켜 대표가 클릭해야 한다) */
  function authNotEnabled(code) {
    return /configuration-not-found|operation-not-allowed/.test(String(code || ''));
  }

  function showLogin(msg) {
    $('cardLogin').classList.remove('hide');
    $('cardNoPerm').classList.add('hide');
    $('console').classList.add('hide');
    $('tabs').classList.add('hide');
    $('sess').classList.add('hide');
    if (msg) say('loginMsg', msg, 'err');
  }

  /* 콘솔에서 이메일/비밀번호 로그인을 아직 켜지 않았을 때. 화면을 죽이지 않고 갈 곳을 알려 준다 */
  function showAuthPending() {
    var box = $('loginMsg');
    box.className = 'msg err';
    box.innerHTML = '<b>관리자가 로그인 기능을 켜는 중입니다.</b><br>' +
      'Firebase 콘솔 → Authentication → Sign-in method 에서 <b>이메일/비밀번호</b>를 사용 설정하면 바로 됩니다' +
      '(무료 플랜은 API 로 못 켜서 대표가 한 번 눌러야 합니다).<br>' +
      '그 전에도 화면 구성은 <span class="code">127.0.0.1</span> 에서 ' +
      '<a href="?local=1">로컬 검사 모드</a> 로 볼 수 있습니다(서버 데이터에는 접근하지 않습니다).';
  }

  function showNoPerm(uid, why) {
    $('cardLogin').classList.add('hide');
    $('cardNoPerm').classList.remove('hide');
    $('console').classList.add('hide');
    $('tabs').classList.add('hide');
    $('sess').classList.add('hide');
    $('npUid').textContent = uid || '…';
    if (why) { $('npWhy').textContent = why; $('npWhy').classList.remove('hide'); }
    else $('npWhy').classList.add('hide');
  }

  function showConsole(label) {
    $('cardLogin').classList.add('hide');
    $('cardNoPerm').classList.add('hide');
    $('console').classList.remove('hide');
    $('tabs').classList.remove('hide');
    $('sess').classList.remove('hide');
    $('who').textContent = label || '';
    showTab(curTab);
    refreshAll();
  }

  function gate() {
    /* 로컬 검사 모드 — 127.0.0.1 에서 ?local=1 일 때만. 서버 데이터(RTDB)에는 접근하지 않고
       GAS 만 쓴다. 실제 보호는 화면이 아니라 Firebase 규칙과 GAS 의 ADMIN_SECRET 이 한다. */
    var q = new URLSearchParams(location.search);
    var isLocalHost = /^(127\.0\.0\.1|localhost|0\.0\.0\.0)$/.test(location.hostname);
    if (isLocalHost && q.get('local') === '1') {
      LOCAL = true;
      $('banLocal').innerHTML =
        '<b>로컬 검사 모드</b> — Firebase 로그인을 건너뛰고 <b>서버 데이터(RTDB)에 접근하지 않습니다</b>. ' +
        '토큰 목록은 이 브라우저에 쌓인 것만 보이고, 진행은 GAS 에서 직접 읽습니다. ' +
        '<span class="code">127.0.0.1</span> 에서 <span class="code">?local=1</span> 일 때만 열립니다.';
      $('banLocal').classList.remove('hide');
      rtdbBlocked = true;
      showConsole('로컬 검사 모드');
      return;
    }

    if (!initFirebase()) {
      showLogin('Firebase SDK 를 불러오지 못했습니다. 네트워크를 확인하세요.');
      return;
    }

    auth.onAuthStateChanged(function (user) {
      if (!user) { showLogin(''); return; }
      isOwner = (user.email || '').toLowerCase() === OWNER_EMAIL;
      /* 대표 계정은 규칙이 무조건 통과시킨다 — RTDB 를 읽어 볼 것도 없다 */
      if (isOwner) { showConsole(user.email + ' · 대표'); return; }
      db.ref('ws7/admins/' + user.uid).once('value').then(function (snap) {
        if (snap.exists() && snap.val() !== false) showConsole(user.email || user.uid);
        else showNoPerm(user.uid, '');
      }).catch(function (e) {
        /* 권한 문제와 연결 문제는 할 일이 전혀 다르다 — 구분해서 알린다 */
        var m = (e && e.message) || '';
        showNoPerm(user.uid, /permission|PERMISSION/.test(m)
          ? '관리자 확인을 읽지 못했습니다(권한 거부).'
          : '관리자 확인 중 오류: ' + m);
      });
    });
  }

  function bindAuth() {
    var go = function () {
      var em = $('inEmail').value.trim(), pw = $('inPw').value;
      if (!em || !pw) { say('loginMsg', '이메일과 비밀번호를 입력하세요.', 'err'); return; }
      say('loginMsg', '로그인 중…', '');
      $('btnLogin').disabled = true;
      auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
        .then(function () { return auth.signInWithEmailAndPassword(em, pw); })
        .then(function () { say('loginMsg', '', ''); })
        .catch(function (e) {
          var c = (e && e.code) || '';
          if (authNotEnabled(c)) { showAuthPending(); return; }
          say('loginMsg', /wrong-password|invalid-credential|user-not-found/.test(c)
            ? '이메일 또는 비밀번호가 맞지 않습니다.'
            : /too-many-requests/.test(c) ? '시도가 너무 잦습니다. 잠시 뒤 다시 해 주세요.'
              : '로그인 실패: ' + ((e && e.message) || c), 'err');
        })
        .then(function () { $('btnLogin').disabled = false; });
    };
    $('btnLogin').onclick = go;
    $('inPw').onkeydown = function (e) { if (e.key === 'Enter') go(); };
    $('inEmail').onkeydown = function (e) { if (e.key === 'Enter') $('inPw').focus(); };
    var out = function () { if (auth) auth.signOut(); secretSet(''); };
    $('btnLogout').onclick = out;
    $('btnNoPermOut').onclick = out;
    $('btnReload').onclick = function () { refreshAll(); };
  }

  /* ══════════════════════════════════════════════════════════════════════
     2. 토큰 — 발급 · 목록 · 상태
     ══════════════════════════════════════════════════════════════════════ */

  function rtdbUsable() { return !!db && !LOCAL && !rtdbBlocked; }

  function markRtdbBlocked(where, e) {
    if (rtdbBlocked) return;
    rtdbBlocked = true;
    var m = (e && e.message) || '';
    $('banRtdb').innerHTML =
      '<b>RTDB <span class="code">ws7/</span> 에 접근하지 못했습니다</b>(' + esc(where) + '). ' +
      '지금은 <b>이 브라우저에 쌓인 목록</b>만 보이고, 발급·상태 변경도 서버에 미러되지 않습니다. ' +
      '프로젝트 <span class="code">work-sim-7day</span> 의 규칙은 배포되어 있으니, ' +
      '보통은 <b>관리자가 아닌 계정으로 로그인</b>했거나 네트워크가 끊긴 경우입니다. ' +
      (m ? '<br><span class="muted">' + esc(m) + '</span>' : '');
    $('banRtdb').classList.remove('hide');
  }

  /* 목록 불러오기 — RTDB 가 정본, 실패하면 로컬 원장 */
  function loadTokens() {
    var merged = {};
    var local = ledgerRead();

    var finish = function () {
      Object.keys(local).forEach(function (c) {
        if (!merged[c]) { merged[c] = Object.assign({ local: true }, local[c]); }
      });
      TOK = merged;
      renderTokens();
    };

    if (!rtdbUsable()) { finish(); return Promise.resolve(); }

    return db.ref('ws7/tokens').once('value').then(function (snap) {
      var v = snap.val() || {};
      Object.keys(v).forEach(function (c) { merged[normCode(c)] = Object.assign({}, v[c]); });
      finish();
    }).catch(function (e) {
      markRtdbBlocked('토큰 목록 읽기', e);
      finish();
    });
  }

  function tokenRows() {
    var fT = $('fTeam').value, fS = $('fStatus').value, q = $('fQuery').value.trim().toLowerCase();
    return Object.keys(TOK).map(function (c) {
      var t = TOK[c] || {};
      var p = PROG[c];
      var day = (p && p.progress && p.progress.day) || t.day || null;
      var st = t.status || 'unused';
      if (st !== 'revoked' && p && p.progress) st = 'active';
      return {
        code: c, team: t.team || (p && p.progress && p.progress.team) || '',
        status: st, memo: t.memo || '', issuedAt: t.issuedAt || '',
        user: t.usedBy || t.name || (p && p.progress && p.progress.name) || '',
        day: day, err: (p && p.err) || '', local: !!t.local
      };
    }).filter(function (r) {
      if (fT && r.team !== fT) return false;
      if (fS && r.status !== fS) return false;
      if (q) {
        var hay = (r.code + ' ' + r.user + ' ' + r.memo + ' ' + (TEAM_NAME[r.team] || '')).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    }).sort(function (a, b) {
      return String(b.issuedAt || '').localeCompare(String(a.issuedAt || '')) || a.code.localeCompare(b.code);
    });
  }

  function renderTokens() {
    var rows = tokenRows();
    var body = $('tokBody');
    var all = Object.keys(TOK).length;
    var byS = { unused: 0, active: 0, revoked: 0 };
    Object.keys(TOK).forEach(function (c) {
      var t = TOK[c] || {}; var st = t.status || 'unused';
      if (st !== 'revoked' && PROG[c] && PROG[c].progress) st = 'active';
      byS[st] = (byS[st] || 0) + 1;
    });
    $('tokSum').textContent = all
      ? '전체 ' + all + '개 · 미사용 ' + byS.unused + ' · 사용중 ' + byS.active + ' · 정지 ' + byS.revoked
      : '';
    $('nTokens').textContent = all ? String(all) : '';

    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="8" class="empty">' +
        (all ? '조건에 맞는 토큰이 없습니다.' : '아직 발급된 토큰이 없습니다. 「토큰 발급」 탭에서 만드세요.') +
        '</td></tr>';
      return;
    }

    body.innerHTML = rows.map(function (r) {
      var next = r.status === 'revoked' ? 'unused' : 'revoked';
      return '<tr>' +
        '<td class="mono">' + esc(r.code) + (r.local ? ' <span class="muted">·로컬</span>' : '') + '</td>' +
        '<td>' + esc(TEAM_NAME[r.team] || r.team || '—') + '</td>' +
        '<td><span class="pill ' + STATUS_CLASS[r.status] + '">' + STATUS_LABEL[r.status] + '</span></td>' +
        '<td>' + esc(r.user || '—') + '</td>' +
        '<td class="num">' + (r.day ? r.day + '일차' : (r.err ? '<span class="pill p-revoked" title="' + esc(r.err) + '">조회 실패</span>' : '—')) + '</td>' +
        '<td>' + esc(r.memo || '—') + '</td>' +
        '<td class="muted">' + esc(fmtWhen(r.issuedAt)) + '</td>' +
        '<td><button class="gh sm" data-act="status" data-code="' + esc(r.code) + '" data-next="' + next + '">' +
        (r.status === 'revoked' ? '해제' : '정지') + '</button></td>' +
        '</tr>';
    }).join('');

    Array.prototype.forEach.call(body.querySelectorAll('button[data-act="status"]'), function (b) {
      b.onclick = function () { setStatus(b.dataset.code, b.dataset.next); };
    });
  }

  function setStatus(code, next) {
    var apply = function () {
      TOK[code] = Object.assign({}, TOK[code], { status: next });
      ledgerPut(code, { status: next });
      renderTokens();
      say('tokMsg', code + ' → ' + STATUS_LABEL[next] + (rtdbUsable() ? '' : ' (이 브라우저에만 반영됨)'), 'ok');
    };
    if (!rtdbUsable()) { apply(); return; }
    db.ref('ws7/tokens/' + code + '/status').set(next)
      .then(apply)
      .catch(function (e) { markRtdbBlocked('상태 변경', e); apply(); });
  }

  /* 발급 — GAS ws7issue → RTDB 미러 */
  function bindIssue() {
    $('inSecret').value = secretGet();
    $('btnSecret').onclick = function () {
      var v = $('inSecret').value.trim();
      if (!v) { say('issueMsg', '비밀번호를 입력하세요.', 'err'); return; }
      secretSet(v);
      say('issueMsg', '이 탭에 기억했습니다. 탭을 닫으면 사라집니다.', 'ok');
    };
    $('btnSecretClear').onclick = function () {
      $('inSecret').value = ''; secretSet('');
      say('issueMsg', '지웠습니다.', '');
    };
    $('inSecret').onkeydown = function (e) { if (e.key === 'Enter') $('btnSecret').click(); };

    $('btnIssue').onclick = function () {
      var key = secretGet();
      if (!key) { say('issueMsg', '먼저 백엔드 관리자 비밀번호를 입력하고 「기억하기」를 누르세요.', 'err'); return; }
      var team = $('isTeam').value;
      var count = Math.max(1, Math.min(300, parseInt($('isCount').value, 10) || 1));
      var memo = $('isMemo').value.trim();
      if (!window.Backend || !window.Backend.isOn()) {
        say('issueMsg', '백엔드 주소가 설정되지 않았습니다(js/backend-url.js).', 'err'); return;
      }
      $('btnIssue').disabled = true;
      say('issueMsg', count + '개 발급 중… (GAS 왕복이라 몇 초 걸립니다)', '');

      window.Backend.issue({ adminKey: key, team: team, count: count }).then(function (r) {
        $('btnIssue').disabled = false;
        if (!r || !r.ok) {
          say('issueMsg', '발급 실패: ' + ((r && r.reason) || '알 수 없는 오류'), 'err');
          return;
        }
        lastIssued = r.codes || [];
        var at = new Date().toISOString();
        var rec = {};
        lastIssued.forEach(function (c) {
          var one = { team: team, status: 'unused', issuedAt: at, memo: memo };
          rec['ws7/tokens/' + normCode(c)] = one;
          TOK[normCode(c)] = Object.assign({ local: !rtdbUsable() }, one);
          ledgerPut(normCode(c), one);
        });
        $('issueOut').classList.remove('hide');
        $('issueKeys').textContent = lastIssued.join('\n');
        renderTokens();

        var done = function (extra) {
          say('issueMsg', (TEAM_NAME[team] || team) + ' ' + lastIssued.length + '개 발급 완료.' + (extra || ''), 'ok');
        };
        if (!rtdbUsable()) { done(' RTDB 미러는 건너뛰었습니다(이 브라우저에만 기록).'); return; }
        db.ref().update(rec)
          .then(function () { done(' RTDB ws7/tokens 에 미러했습니다.'); })
          .catch(function (e) { markRtdbBlocked('토큰 미러 쓰기', e); done(' RTDB 미러 실패 — 코드는 서버에 발급되었습니다.'); });
      });
    };

    $('btnCopy').onclick = function () {
      var t = lastIssued.join('\n');
      if (navigator.clipboard) navigator.clipboard.writeText(t);
      $('btnCopy').textContent = '복사됨';
      setTimeout(function () { $('btnCopy').textContent = '전체 복사'; }, 1400);
    };
    $('btnCsvNew').onclick = function () {
      var team = $('isTeam').value, memo = $('isMemo').value.trim();
      var head = '코드,팀코드,팀이름,메모\n';
      var body = lastIssued.map(function (c) {
        return [c, team, TEAM_NAME[team] || team, memo].map(csvCell).join(',');
      }).join('\n');
      download('ws7_토큰_' + team + '_' + lastIssued.length + '개.csv', head + body);
    };
  }

  function bindTokens() {
    $('btnTokReload').onclick = function () { say('tokMsg', '불러오는 중…', ''); loadTokens().then(function () { say('tokMsg', '', ''); }); };
    $('btnTokCsv').onclick = function () {
      var rows = tokenRows();
      if (!rows.length) { say('tokMsg', '내보낼 토큰이 없습니다.', 'err'); return; }
      var head = '코드,팀코드,팀이름,상태,사용자,현재일차,메모,발급일\n';
      var body = rows.map(function (r) {
        return [r.code, r.team, TEAM_NAME[r.team] || '', STATUS_LABEL[r.status], r.user,
        r.day || '', r.memo, fmtWhen(r.issuedAt)].map(csvCell).join(',');
      }).join('\n');
      download('ws7_토큰목록_' + rows.length + '개.csv', head + body);
      say('tokMsg', rows.length + '개를 CSV 로 내보냈습니다.', 'ok');
    };
    $('btnTokProbe').onclick = function () { loadProgress('tokMsg').then(renderTokens); };

    ['fTeam', 'fStatus'].forEach(function (id) { $(id).onchange = renderTokens; });
    $('fQuery').oninput = renderTokens;

    $('btnAddCodes').onclick = function () {
      var all = $('inAddCodes').value.split(/[\s,;]+/).map(normCode).filter(Boolean);
      var raw = all.filter(validCode);
      var wrong = all.filter(function (c) { return !validCode(c); });
      if (!raw.length) {
        say('tokMsg', wrong.length ? '코드 형식이 아닙니다(WS7-XXXX-XXXX): ' + wrong.join(', ') : '코드를 입력하세요.', 'err');
        return;
      }
      say('tokMsg', raw.length + '개 조회 중…', '');
      $('btnAddCodes').disabled = true;
      /* ws7load 는 부작용이 없다(ws7check 와 달리 unused 를 active 로 바꾸지 않는다) */
      pool(raw, GAS_PAR, function (c) { return window.Backend.load(c); }).then(function (res) {
        var okN = 0, bad = [];
        res.forEach(function (r, i) {
          var c = raw[i];
          if (!r || !r.ok) { bad.push(c); PROG[c] = { progress: null, err: (r && r.reason) || '응답 없음' }; return; }
          okN++;
          PROG[c] = { progress: r.progress || null, updatedAt: r.updatedAt || '' };
          var p = r.progress || {};
          var one = Object.assign({ team: p.team || '', status: p.day ? 'active' : 'unused', issuedAt: '', memo: '' }, TOK[c] || {});
          if (p.team) one.team = p.team;
          if (p.name) one.name = p.name;
          TOK[c] = Object.assign({ local: true }, one);
          ledgerPut(c, { team: one.team, status: one.status, issuedAt: one.issuedAt || '', memo: one.memo || '', name: one.name || '' });
        });
        $('btnAddCodes').disabled = false;
        $('inAddCodes').value = '';
        renderTokens(); renderProgress();
        say('tokMsg', okN + '개를 목록에 넣었습니다.' +
          (bad.length ? ' 없는 코드: ' + bad.join(', ') : '') +
          (wrong.length ? ' 형식이 아닌 것: ' + wrong.join(', ') : ''),
          (bad.length || wrong.length) ? 'err' : 'ok');
      });
    };
  }

  /* ══════════════════════════════════════════════════════════════════════
     3. 사용자 — RTDB ws7/users
     ══════════════════════════════════════════════════════════════════════ */

  function loadUsers() {
    if (!rtdbUsable()) {
      USERS = [];
      renderUsers(LOCAL ? '로컬 검사 모드에서는 사용자 목록을 읽지 않습니다.' : 'RTDB 를 읽지 못해 사용자 목록이 비어 있습니다.');
      return Promise.resolve();
    }
    return db.ref('ws7/users').once('value').then(function (snap) {
      var v = snap.val() || {};
      USERS = Object.keys(v).map(function (uid) {
        var u = v[uid] || {};
        return {
          uid: uid,
          name: u.name || '',
          org: u.org || u.affil || u.school || u.belong || '',
          email: u.email || '',
          team: u.team || '',
          code: normCode(u.code || ''),
          day: u.day || u.lastDay || null,
          lastSeen: u.lastSeen || u.updatedAt || u.lastAt || u.joinedAt || ''
        };
      });
      renderUsers();
    }).catch(function (e) {
      markRtdbBlocked('사용자 목록 읽기', e);
      USERS = [];
      renderUsers('RTDB 를 읽지 못했습니다.');
    });
  }

  function renderUsers(note) {
    $('nUsers').textContent = USERS.length ? String(USERS.length) : '';
    var body = $('usrBody');
    if (!USERS.length) {
      body.innerHTML = '<tr><td colspan="8" class="empty">' + esc(note || '가입한 학생이 아직 없습니다.') + '</td></tr>';
      return;
    }
    body.innerHTML = USERS.slice().sort(function (a, b) {
      return String(b.lastSeen || '').localeCompare(String(a.lastSeen || ''));
    }).map(function (u) {
      var p = PROG[u.code];
      var day = (p && p.progress && p.progress.day) || u.day || null;
      return '<tr>' +
        '<td>' + esc(u.name || '—') + '</td>' +
        '<td>' + esc(u.org || '—') + '</td>' +
        '<td class="muted">' + esc(u.email || '—') + '</td>' +
        '<td>' + esc(TEAM_NAME[u.team] || u.team || '—') + '</td>' +
        '<td class="mono">' + esc(u.code || '—') + '</td>' +
        '<td class="num">' + (day ? day + '일차' : '—') + '</td>' +
        '<td class="muted">' + esc(fmtWhen(u.lastSeen)) + '</td>' +
        '<td>' + (u.code
          ? '<button class="gh sm" data-code="' + esc(u.code) + '">진행 보기</button>'
          : '<span class="muted">토큰 없음</span>') + '</td>' +
        '</tr>';
    }).join('');
    Array.prototype.forEach.call(body.querySelectorAll('button[data-code]'), function (b) {
      b.onclick = function () { openStudent(b.dataset.code); };
    });
  }

  function bindUsers() {
    $('btnUsrReload').onclick = function () { say('usrMsg', '불러오는 중…', ''); loadUsers().then(function () { say('usrMsg', '', ''); }); };
    $('btnUsrCsv').onclick = function () {
      if (!USERS.length) { say('usrMsg', '내보낼 사용자가 없습니다.', 'err'); return; }
      var head = '이름,소속,이메일,팀,토큰,현재일차,마지막접속\n';
      var body = USERS.map(function (u) {
        var p = PROG[u.code];
        var day = (p && p.progress && p.progress.day) || u.day || '';
        return [u.name, u.org, u.email, TEAM_NAME[u.team] || u.team, u.code, day, fmtWhen(u.lastSeen)].map(csvCell).join(',');
      }).join('\n');
      download('ws7_사용자_' + USERS.length + '명.csv', head + body);
      say('usrMsg', USERS.length + '명을 CSV 로 내보냈습니다.', 'ok');
    };
  }

  /* ── 관리자 계정 (ws7/admins) ── */

  function loadAdmins() {
    if (!rtdbUsable()) { ADMINS = []; renderAdmins(LOCAL ? '로컬 검사 모드에서는 읽지 않습니다.' : 'RTDB 를 읽지 못했습니다.'); return Promise.resolve(); }
    return db.ref('ws7/admins').once('value').then(function (snap) {
      var v = snap.val() || {};
      ADMINS = Object.keys(v).map(function (uid) {
        var a = v[uid];
        if (a === true || typeof a !== 'object') a = {};
        return { uid: uid, memo: a.memo || '', by: a.by || '', at: a.at || '' };
      });
      renderAdmins();
    }).catch(function (e) {
      markRtdbBlocked('관리자 목록 읽기', e);
      ADMINS = []; renderAdmins('RTDB 를 읽지 못했습니다.');
    });
  }

  function renderAdmins(note) {
    /* 추가·삭제는 규칙상 대표 계정만 통과한다. 못 누를 버튼을 보여 주면 고장으로 읽힌다 */
    $('admAddRow').classList.toggle('hide', !isOwner);
    var body = $('admBody');
    if (!ADMINS.length) {
      body.innerHTML = '<tr><td colspan="5" class="empty">' +
        esc(note || '등록된 관리자가 없습니다 — 대표 계정(' + OWNER_EMAIL + ')은 등록 없이 통과합니다.') + '</td></tr>';
      return;
    }
    body.innerHTML = ADMINS.map(function (a) {
      return '<tr>' +
        '<td class="mono">' + esc(a.uid) + '</td>' +
        '<td>' + esc(a.memo || '—') + '</td>' +
        '<td class="muted">' + esc(a.by || '—') + '</td>' +
        '<td class="muted">' + esc(fmtWhen(a.at)) + '</td>' +
        '<td>' + (isOwner ? '<button class="gh sm" data-uid="' + esc(a.uid) + '">삭제</button>' : '<span class="muted">대표만</span>') + '</td>' +
        '</tr>';
    }).join('');
    Array.prototype.forEach.call(body.querySelectorAll('button[data-uid]'), function (b) {
      b.onclick = function () { removeAdmin(b.dataset.uid); };
    });
  }

  var UID_RE = /^[A-Za-z0-9_-]{20,64}$/;

  function bindAdmins() {
    $('btnAdmReload').onclick = function () { say('admMsg', '불러오는 중…', ''); loadAdmins().then(function () { say('admMsg', '', ''); }); };
    $('btnAdmAdd').onclick = function () {
      var uid = $('inAdmUid').value.trim();
      var memo = $('inAdmMemo').value.trim();
      if (!UID_RE.test(uid)) { say('admMsg', 'uid 형식이 아닙니다. Firebase 콘솔 → Authentication 에서 그대로 복사하세요.', 'err'); return; }
      if (!rtdbUsable()) { say('admMsg', 'RTDB 에 접근할 수 없어 등록하지 못했습니다.', 'err'); return; }
      $('btnAdmAdd').disabled = true;
      db.ref('ws7/admins/' + uid).set({ by: (auth.currentUser && auth.currentUser.email) || '', at: new Date().toISOString(), memo: memo })
        .then(function () {
          $('inAdmUid').value = ''; $('inAdmMemo').value = '';
          say('admMsg', uid + ' 을 관리자로 등록했습니다.', 'ok');
          return loadAdmins();
        })
        .catch(function (e) {
          say('admMsg', '등록 실패: ' + (/permission|PERMISSION/.test((e && e.message) || '')
            ? '규칙상 대표 계정(' + OWNER_EMAIL + ')만 등록할 수 있습니다.' : (e && e.message)), 'err');
        })
        .then(function () { $('btnAdmAdd').disabled = false; });
    };
  }

  function removeAdmin(uid) {
    if (!rtdbUsable()) return;
    db.ref('ws7/admins/' + uid).remove()
      .then(function () { say('admMsg', uid + ' 을 관리자에서 뺐습니다.', 'ok'); return loadAdmins(); })
      .catch(function (e) { say('admMsg', '삭제 실패: ' + ((e && e.message) || ''), 'err'); });
  }

  /* ══════════════════════════════════════════════════════════════════════
     4. 진행 현황 — GAS ws7load
     ══════════════════════════════════════════════════════════════════════ */

  function dayScore(d) {
    if (!d || !d.cards) return null;
    var sum = 0, n = 0;
    Object.keys(d.cards).forEach(function (id) {
      var s = d.cards[id] && d.cards[id].score;
      if (typeof s === 'number' && isFinite(s)) { sum += s; n++; }
    });
    return n ? Math.round(sum / n) : null;
  }

  function progSummary(p) {
    var done = (p && p.done) || {};
    var days = Object.keys(done).map(Number).filter(function (n) { return n >= 1 && n <= 7; }).sort(function (a, b) { return a - b; });
    var scores = {}, sum = 0, n = 0;
    days.forEach(function (d) {
      var s = dayScore(done[String(d)]);
      scores[d] = s;
      if (s != null) { sum += s; n++; }
    });
    var ncs = {}, cnt = {};
    days.forEach(function (d) {
      var v = (done[String(d)] || {}).ncs || {};
      AXES.forEach(function (a) {
        if (typeof v[a] === 'number') { ncs[a] = (ncs[a] || 0) + v[a]; cnt[a] = (cnt[a] || 0) + 1; }
      });
    });
    AXES.forEach(function (a) { if (cnt[a]) ncs[a] = Math.round(ncs[a] / cnt[a]); });
    return {
      days: days, lastDone: days.length ? days[days.length - 1] : 0,
      scores: scores, avg: n ? Math.round(sum / n) : null, ncs: ncs
    };
  }

  /* 목록에 있는 모든 토큰의 진행을 GAS 에서 읽는다. ws7load 는 부작용이 없다 */
  function loadProgress(msgId) {
    var codes = Object.keys(TOK);
    if (!codes.length) { say(msgId || 'progMsg', '먼저 토큰을 발급하거나 목록에 넣으세요.', 'err'); return Promise.resolve(); }
    if (!window.Backend || !window.Backend.isOn()) {
      say(msgId || 'progMsg', '백엔드 주소가 설정되지 않았습니다(js/backend-url.js).', 'err');
      return Promise.resolve();
    }
    var btn = $('btnProgLoad'); btn.disabled = true;
    var done = 0;
    say(msgId || 'progMsg', '0/' + codes.length + ' 조회 중…', '');
    return pool(codes, GAS_PAR, function (c) {
      return window.Backend.load(c).then(function (r) {
        done++;
        say(msgId || 'progMsg', done + '/' + codes.length + ' 조회 중…', '');
        return r;
      });
    }).then(function (res) {
      var withProg = 0, failed = [];
      res.forEach(function (r, i) {
        var c = codes[i];
        if (!r) { PROG[c] = { progress: null, err: '응답 없음' }; failed.push(c); return; }
        if (!r.ok) { PROG[c] = { progress: null, err: r.reason || '실패' }; failed.push(c); return; }
        PROG[c] = { progress: r.progress || null, updatedAt: r.updatedAt || '' };
        if (r.progress) withProg++;
      });
      btn.disabled = false;
      say(msgId || 'progMsg',
        codes.length + '개 조회 완료 · 진행이 있는 학생 ' + withProg + '명' +
        (failed.length ? ' · 조회 실패 ' + failed.length + '개(' + failed.join(', ') + ') — 다시 눌러 보세요' : ''),
        failed.length ? 'err' : 'ok');
      renderProgress(); renderTokens(); renderUsers();
    });
  }

  function progRows() {
    return Object.keys(PROG).map(function (c) {
      var p = PROG[c] && PROG[c].progress;
      if (!p) return null;
      var s = progSummary(p);
      return {
        code: c, team: p.team || (TOK[c] || {}).team || '',
        name: p.name || (TOK[c] || {}).name || '',
        day: p.day || 1, lastDone: s.lastDone, avg: s.avg,
        updatedAt: p.updatedAt || (PROG[c] || {}).updatedAt || ''
      };
    }).filter(Boolean).sort(function (a, b) {
      return (b.lastDone - a.lastDone) || a.code.localeCompare(b.code);
    });
  }

  function renderProgress() {
    var rows = progRows();

    /* ── 팀별 완료 일차 분포 ── */
    var byTeam = {};
    rows.forEach(function (r) {
      var t = r.team || '기타';
      byTeam[t] = byTeam[t] || { n: 0, days: [0, 0, 0, 0, 0, 0, 0], none: 0 };
      byTeam[t].n++;
      if (r.lastDone >= 1) byTeam[t].days[r.lastDone - 1]++;
      else byTeam[t].none++;
    });
    var order = TEAMS.map(function (t) { return t[0]; }).filter(function (k) { return byTeam[k]; })
      .concat(Object.keys(byTeam).filter(function (k) { return TEAMS.every(function (t) { return t[0] !== k; }); }));

    var dist = $('dist');
    if (!order.length) {
      dist.innerHTML = '<div class="empty">진행이 있는 학생이 아직 없습니다. 「진행 불러오기」를 눌러 보세요.</div>';
      $('distLegend').classList.add('hide');
    } else {
      dist.innerHTML = order.map(function (k) {
        var v = byTeam[k];
        var segs = v.days.map(function (c, i) {
          if (!c) return '';
          return '<i style="width:' + (c / v.n * 100) + '%;background:' + DAY_COLOR[i] + '" title="' + (i + 1) + '일차 완료 ' + c + '명"></i>';
        }).join('');
        if (v.none) segs += '<i style="width:' + (v.none / v.n * 100) + '%;background:' + NONE_COLOR + '" title="시작 전 ' + v.none + '명"></i>';
        return '<div class="r">' +
          '<span class="nm">' + esc(TEAM_NAME[k] || k) + '</span>' +
          '<span class="bar">' + segs + '</span>' +
          '<span class="ct">' + v.n + '명</span>' +
          '</div>';
      }).join('');
      /* 같은 계열 일곱 단계는 색 이름으로 구분되지 않는다 — 눈금 하나와 양 끝 라벨로 줄인다.
         어느 학생이 몇 일차인지는 막대의 툴팁과 아래 학생별 표에서 정확히 읽는다. */
      $('distLegend').innerHTML =
        '<span class="sc">완료 일차<span class="ramp">' +
        DAY_COLOR.map(function (c, i) {
          return '<i style="background:' + c + '" title="' + (i + 1) + '일차 완료"></i>';
        }).join('') +
        '</span>1일 → 7일</span>' +
        '<span class="one"><i style="background:' + NONE_COLOR + '"></i>시작 전</span>';
      $('distLegend').classList.remove('hide');
    }

    /* ── 학생별 표 ── */
    var body = $('progBody');
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="7" class="empty">진행 데이터가 있는 학생이 없습니다.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(function (r) {
      return '<tr class="pick" data-code="' + esc(r.code) + '" tabindex="0">' +
        '<td class="mono">' + esc(r.code) + '</td>' +
        '<td>' + esc(TEAM_NAME[r.team] || r.team || '—') + '</td>' +
        '<td>' + esc(r.name || '—') + '</td>' +
        '<td class="num">' + r.day + '일차</td>' +
        '<td class="num">' + (r.lastDone ? r.lastDone + '일' : '—') + '</td>' +
        '<td class="num">' + (r.avg == null ? '—' : r.avg) + '</td>' +
        '<td class="muted">' + esc(fmtWhen(r.updatedAt)) + '</td>' +
        '</tr>';
    }).join('');
    Array.prototype.forEach.call(body.querySelectorAll('tr[data-code]'), function (tr) {
      tr.onclick = function () { openStudent(tr.dataset.code); };
      tr.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openStudent(tr.dataset.code); } };
    });
  }

  /* ── 학생 상세 ── */
  function openStudent(code) {
    code = normCode(code);
    var rec = PROG[code];
    var open = function () {
      var p = (PROG[code] || {}).progress;
      stuCur = { code: code, progress: p || null };
      $('stuTitle').textContent = code + ' · ' + (TEAM_NAME[(p && p.team) || (TOK[code] || {}).team] || '팀 미상');
      $('stuBody').innerHTML = studentHtml(code, p);
      if (!$('dlgStu').open) $('dlgStu').showModal();
    };
    if (rec) { open(); return; }
    $('stuTitle').textContent = code;
    $('stuBody').innerHTML = '<div class="empty">GAS 에서 진행을 읽는 중…</div>';
    if (!$('dlgStu').open) $('dlgStu').showModal();
    window.Backend.load(code).then(function (r) {
      PROG[code] = (r && r.ok) ? { progress: r.progress || null, updatedAt: r.updatedAt || '' } : { progress: null, err: (r && r.reason) || '실패' };
      open(); renderProgress(); renderTokens();
    });
  }

  function studentHtml(code, p) {
    if (!p) {
      return '<div class="note">이 코드에는 <b>저장된 진행이 없습니다</b>. 아직 한 번도 플레이하지 않았거나 이미 초기화된 상태입니다.' +
        ((PROG[code] || {}).err ? '<br><span class="muted">' + esc(PROG[code].err) + '</span>' : '') + '</div>';
    }
    var s = progSummary(p);
    var out = '<div class="kv">' +
      '<b>이름</b><span>' + esc(p.name || '—') + '</span>' +
      '<b>팀</b><span>' + esc(TEAM_NAME[p.team] || p.team || '—') + '</span>' +
      '<b>현재 일차</b><span>' + (p.day || 1) + '일차</span>' +
      '<b>완료한 날</b><span>' + (s.days.length ? s.days.join(', ') + '일차' : '없음') + '</span>' +
      '<b>평균 점수</b><span>' + (s.avg == null ? '—' : s.avg + '점') + '</span>' +
      '<b>마지막 저장</b><span>' + esc(fmtWhen(p.updatedAt || (PROG[code] || {}).updatedAt)) + '</span>' +
      '</div>';

    out += '<h3 class="sec">7일 점수</h3><div class="bars">';
    for (var d = 1; d <= 7; d++) {
      var v = s.scores[d];
      var has = (v != null);
      out += '<span' + (has ? '' : ' class="z"') + '>' + d + '일차</span>' +
        '<span class="b"><i style="width:' + (has ? v : 0) + '%"></i></span>' +
        '<span class="v">' + (has ? v : (s.days.indexOf(d) >= 0 ? '기록' : '—')) + '</span>';
    }
    out += '</div>';

    var anyNcs = AXES.some(function (a) { return typeof s.ncs[a] === 'number'; });
    out += '<h3 class="sec">NCS 10축 (완료한 날의 평균)</h3>';
    if (!anyNcs) {
      out += '<div class="note">아직 NCS 기록이 없습니다. 하루를 끝까지 마쳐야 축이 켜집니다.</div>';
    } else {
      out += '<div class="bars">';
      AXES.forEach(function (a) {
        var v = s.ncs[a];
        var has = (typeof v === 'number');
        out += '<span' + (has ? '' : ' class="z"') + '>' + CIRC[a] + ' ' + NCS_NAMES[a] + '</span>' +
          '<span class="b"><i style="width:' + (has ? v : 0) + '%"></i></span>' +
          '<span class="v">' + (has ? v : '—') + '</span>';
      });
      out += '</div>';
    }
    return out;
  }

  /* ── 진행 초기화 ── */
  function bindStudent() {
    $('stuClose').onclick = $('stuClose2').onclick = function () { $('dlgStu').close(); };

    $('stuReset').onclick = function () {
      if (!stuCur) return;
      var p = stuCur.progress || {};
      var s = p.done ? progSummary(p) : { days: [] };
      $('cfCode').textContent = stuCur.code;
      $('cfTeam').textContent = TEAM_NAME[p.team] || p.team || '—';
      $('cfName').textContent = p.name || '—';
      $('cfWhat').textContent = s.days.length
        ? s.days.join(', ') + '일차 결과 · 현재 ' + (p.day || 1) + '일차'
        : '저장된 진행 없음';
      $('cfEcho').textContent = stuCur.code;
      $('cfType').value = '';
      $('cfGo').disabled = true;
      say('cfMsg', '', '');
      $('dlgConfirm').showModal();
      setTimeout(function () { $('cfType').focus(); }, 30);
    };

    $('cfType').oninput = function () {
      $('cfGo').disabled = normCode($('cfType').value) !== (stuCur ? stuCur.code : '');
    };
    $('cfCancel').onclick = function () { $('dlgConfirm').close(); };

    $('cfGo').onclick = function () {
      if (!stuCur) return;
      var code = stuCur.code;
      var team = (stuCur.progress && stuCur.progress.team) || (TOK[code] || {}).team || '';
      var name = (stuCur.progress && stuCur.progress.name) || '';
      $('cfGo').disabled = true;
      say('cfMsg', '초기화 중…', '');

      var empty = { code: code, team: team, name: name, day: 1, done: {}, clues: {}, trust: {}, unlocked: [], cur: null };
      var pr = window.Backend.save(code, empty);
      window.Backend.flush();
      pr.then(function (r) {
        if (!r || !r.ok) { say('cfMsg', '초기화 실패: ' + ((r && r.reason) || '알 수 없는 오류'), 'err'); $('cfGo').disabled = false; return; }
        PROG[code] = { progress: empty, updatedAt: r.updatedAt || '' };
        stuCur.progress = empty;
        /* RTDB 쪽 학생 기록의 일차도 되돌린다 — 화면 두 곳이 다른 말을 하지 않게 */
        var u = USERS.filter(function (x) { return x.code === code; })[0];
        var after = function () {
          $('dlgConfirm').close();
          $('stuBody').innerHTML = studentHtml(code, empty);
          renderProgress(); renderTokens(); renderUsers();
          say('progMsg', code + ' 의 진행을 초기화했습니다(1일차부터 다시 시작).', 'ok');
        };
        if (u && rtdbUsable()) {
          db.ref('ws7/users/' + u.uid).update({ day: 1 }).then(after).catch(function (e) { markRtdbBlocked('사용자 일차 되돌리기', e); after(); });
        } else after();
      });
    };

    $('btnProgLoad').onclick = function () { loadProgress('progMsg'); };
  }

  /* ══════════════════════════════════════════════════════════════════════
     5. 시작
     ══════════════════════════════════════════════════════════════════════ */

  function refreshAll() {
    renderSecret();
    loadTokens();
    loadUsers();
    loadAdmins();
    renderProgress();
  }

  function boot() {
    if (window.Backend && typeof window.Backend.configure === 'function') {
      window.Backend.configure(window.BACKEND_URL || '', { timeoutMs: 25000 });
    }
    fillTeamSelects();
    bindTabs();
    bindAuth();
    bindIssue();
    bindTokens();
    bindUsers();
    bindAdmins();
    bindStudent();
    showTab('issue');
    gate();
    /* 헤드리스 검사에서 화면 상태를 확인하기 위한 손잡이(읽기 전용) */
    window.__admin = {
      tab: showTab,
      tokens: function () { return TOK; },
      prog: function () { return PROG; },
      open: openStudent,
      ready: true
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})();
