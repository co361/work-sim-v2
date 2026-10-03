/* 관리자 게시 후평가의 학생 표시. 진행/일반 점수/서명/개인 토큰 저장을 변경하지 않는다. */
(function (global) {
  'use strict';
  var active = null;
  var doc = global.document;
  var criterionLabels = {decision:'의사결정', evidence:'자료와 근거', calculation:'계산', execution:'실행 계획', communication:'전달과 협업', values:'취합 값', clarity:'명확성', idea:'아이디어'};
  function element(tag, cls, text) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = String(text);
    return e;
  }
  function session(state) {
    var s; try { s = state.getSession(); } catch (e) { return null; }
    if (!s || s.demo || !global.Backend || !global.Backend.isOn || !global.Backend.isOn()) return null;
    var code = String(s.code || '').trim().toUpperCase();
    var verification = global.WS7_VERIFICATION_DEMO === true && String(global.BACKEND_URL) === global.location.origin + '/api/game' && /^DEMO-[A-F0-9]{32}$/.test(code);
    return /^WS7-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code) || verification ? {code: code, name: String(s.name || '')} : null;
  }
  function safeText(value, s) {
    var t = String(value == null ? '' : value).replace(/WS7-[A-Z0-9]{4}-[A-Z0-9]{4}|DEMO-[A-F0-9]{32}/gi, '[개인 토큰]');
    if (s.name) t = t.split(s.name).join('[학생]');
    return t;
  }
  function finiteScore(n, max) { return typeof n === 'number' && isFinite(n) && n >= 0 && n <= max; }
  function valid(result) {
    return result && result.schema === 1 && finiteScore(result.overallScore, 100) &&
      Array.isArray(result.units) && result.units.length > 0 && result.units.length <= 200 &&
      result.units.every(function (u) {
        return u && typeof u.maxScore === 'number' && isFinite(u.maxScore) && u.maxScore > 0 && finiteScore(u.totalScore, u.maxScore) &&
          u.feedback && Array.isArray(u.feedback.strengths) && Array.isArray(u.feedback.improvements) &&
          typeof u.feedback.nextAction === 'string' && u.feedback.strengths.concat(u.feedback.improvements).every(function (x) { return typeof x === 'string'; });
      });
  }
  function visible(state) {
    return !state.disposed && state.host.isConnected && doc.visibilityState !== 'hidden' && state.host.getClientRects().length > 0;
  }
  function clearPanel(state) { if (state.panel) state.panel.remove(); state.panel = null; state.panelCode = ''; state.panelName = ''; }
  function abort(state) {
    state.generation++;
    if (state.controller) state.controller.abort();
    state.controller = null;
    state.requestCode = ''; state.requestName = '';
    if (state.timer) global.clearTimeout(state.timer);
    state.timer = null;
    state.busy = false;
  }
  function stop() {
    if (!active) return;
    var s = active; active = null; s.disposed = true;
    abort(s); clearPanel(s);
    global.removeEventListener('focus', s.onFocus);
    global.removeEventListener('pagehide', s.onPagehide);
    doc.removeEventListener('visibilitychange', s.onVisibility);
  }
  function list(parent, heading, items, s) {
    var block = element('div', 'ws7-ai-feedback'); block.appendChild(element('h4', '', heading));
    if (items.length) {
      var ul = element('ul'); items.forEach(function (x) { ul.appendChild(element('li', '', safeText(x, s))); }); block.appendChild(ul);
    } else block.appendChild(element('p', 'ws7-ai-note', '추가 내용이 없습니다.'));
    parent.appendChild(block);
  }
  function render(state, response, s) {
    clearPanel(state);
    var result = response.result, panel = element('section', 'ws7-ai-review');
    panel.setAttribute('aria-label', '관리자 게시 AI 평가');
    var head = element('div', 'ws7-ai-head');
    var heading = element('div'); heading.appendChild(element('h2', '', 'AI 평가'));
    heading.appendChild(element('p', 'ws7-ai-note', '관리자가 답안을 검토해 게시한 평가입니다.')); head.appendChild(heading);
    var button = element('button', 'btn ws7-ai-refresh', '평가 새로고침'); button.type = 'button';
    button.addEventListener('click', function () { refresh(state); }); head.appendChild(button); panel.appendChild(head);
    var current = response.isCurrent === true;
    panel.appendChild(element('p', current ? 'ws7-ai-current' : 'ws7-ai-asof', current ?
      '현재 저장된 답안을 기준으로 평가했습니다.' : '이전 답안 시점의 평가입니다. 이후 수정한 내용은 반영되지 않았습니다.'));
    panel.appendChild(element('p', 'ws7-ai-note', '업무별 판단과 근거에 대한 평가입니다. 기존 역량 수준과 함께 확인하세요.'));
    if (typeof response.publishedAt === 'number' && isFinite(response.publishedAt)) {
      var date = new Date(response.publishedAt);
      if (!isNaN(date.getTime())) panel.appendChild(element('p', 'ws7-ai-note ws7-ai-published', '게시 ' + date.toLocaleString('ko-KR', {year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit'})));
    }
    result.units.forEach(function (u, i) {
      var unit = element('article', 'ws7-ai-unit');
      var top = element('div', 'ws7-ai-unit-head'); top.appendChild(element('h3', '', u.title ? safeText(u.title, s) : '업무 평가 ' + (i + 1)));
      top.appendChild(element('p', 'ws7-ai-unit-score', u.totalScore + ' / ' + u.maxScore + '점')); unit.appendChild(top);
      if (Array.isArray(u.criteria) && u.criteria.length) {
        var criteria = element('dl', 'ws7-ai-criteria');
        u.criteria.forEach(function (c, j) {
          if (!c || typeof c.maxPoints !== 'number' || !isFinite(c.maxPoints) || c.maxPoints <= 0 || !finiteScore(c.score, c.maxPoints)) return;
          criteria.appendChild(element('dt', '', Object.prototype.hasOwnProperty.call(criterionLabels, c.id) ? criterionLabels[c.id] : '평가 기준 ' + (j + 1)));
          criteria.appendChild(element('dd', '', c.score + ' / ' + c.maxPoints + '점'));
        });
        if (criteria.childNodes.length) unit.appendChild(criteria);
      }
      list(unit, '강점', u.feedback.strengths, s); list(unit, '개선할 점', u.feedback.improvements, s);
      var next = element('div', 'ws7-ai-next'); next.appendChild(element('h4', '', '다음 행동'));
      next.appendChild(element('p', '', safeText(u.feedback.nextAction, s))); unit.appendChild(next); panel.appendChild(unit);
    });
    var status = element('p', 'ws7-ai-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); panel.appendChild(status);
    state.panel = panel;
    state.panelCode = s.code; state.panelName = s.name;
    state.host.insertBefore(panel, state.before && state.before.parentNode === state.host ? state.before : null);
  }
  async function refresh(state) {
    if (active !== state || !visible(state)) return;
    var s = session(state); if (!s) { abort(state); clearPanel(state); return; }
    if (state.panel && (state.panelCode !== s.code || state.panelName !== s.name)) clearPanel(state);
    if (state.busy && (state.requestCode !== s.code || state.requestName !== s.name)) abort(state);
    if (state.busy) return;
    var url = String(global.BACKEND_URL || '').trim(); if (!url) { clearPanel(state); return; }
    state.busy = true; var generation = ++state.generation;
    state.requestCode = s.code; state.requestName = s.name;
    var ctl = new AbortController(); state.controller = ctl;
    state.timer = global.setTimeout(function () { ctl.abort(); }, 8000);
    var button = state.panel && state.panel.querySelector('.ws7-ai-refresh');
    if (button) { button.disabled = true; button.textContent = '다시 불러오는 중'; }
    try {
      var raw = await global.fetch(url, {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'},
        body:JSON.stringify({action:'ws7AIReview', code:s.code}), signal:ctl.signal, cache:'no-store'});
      var response = await raw.json();
      var now = session(state);
      if (active !== state || generation !== state.generation || !visible(state)) return;
      if (!now || now.code !== s.code || now.name !== s.name) { clearPanel(state); return; }
      if (!raw.ok || !response || response.ok !== true || !valid(response.result)) { clearPanel(state); return; }
      render(state, response, s);
    } catch (e) { if (active === state && generation === state.generation) clearPanel(state); }
    finally {
      if (generation === state.generation) {
        if (state.timer) global.clearTimeout(state.timer);
        state.timer = null; state.controller = null; state.requestCode = ''; state.requestName = ''; state.busy = false;
      }
    }
  }
  function mount(host, getSession, before) {
    stop(); if (!host || typeof getSession !== 'function') return;
    var s = {host:host, before:before, getSession:getSession, disposed:false, busy:false, panel:null, generation:0, timer:null, controller:null};
    s.onFocus = function () { refresh(s); };
    s.onPagehide = stop;
    s.onVisibility = function () { if (doc.visibilityState === 'hidden') { abort(s); clearPanel(s); } else refresh(s); };
    active = s;
    global.addEventListener('focus', s.onFocus); global.addEventListener('pagehide', s.onPagehide);
    doc.addEventListener('visibilitychange', s.onVisibility);
    Promise.resolve().then(function () { refresh(s); });
  }
  global.StudentAIReview = {mount:mount, unmount:stop};
})(window);
