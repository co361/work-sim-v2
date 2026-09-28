/* ======================================================================
   내 결과 PDF — 7일을 마친 학생이 자기 기록을 A4 PDF 파일로 내려받는다(2026-09-28 강승민
   「게임 플레이 마무리하면 ncs 점수랑 플레이하는 동안 뭐 했던 것들 등등이 … pdf로 다운로드」 · 「나의 강점 약점 이런 것도」).
   ----------------------------------------------------------------------
   - 계산은 하지 않는다. NCS 는 NcsEval.report(P) — 7일 결과 화면(ep7.js renderWeek)과 같은 호출 · 기록 뽑기는 NcsReport.essay/student.
     이 파일은 그 결과를 글과 쪽으로 옮길 뿐이다(같은 표를 다시 셈하지 않는다).
   - 저장본(P)만 있으면 된다 — 새로고침·다른 날 접속 뒤에도(이어 하기와 같은 loadProgress). 카드 제목·팀장 한마디는 화 데이터(loadStory —
     로컬은 파일, 배포본은 서버 공개본)에서 이름만 읽는다.
   - 🔒 정답을 싣지 않는다: 모범 답안(compose.model)·7화 좋은 예(example)·정답 선택지·채점 기준·힌트·코칭 문장(카드별 tip)은 읽지도 않는다.
     싣는 것 = 학생이 한 것(고른 처리·쓴 글·답)·점수·결과 화면에 이미 보이는 말(팀장 한마디·NCS 표·강점/다음엔 — 레지스트리 문장).
   - 만드는 법: 보고서 쪽(794×1123 CSS px = A4)을 DOM 으로 짜서 html2canvas 로 쪽마다 그림 → jsPDF 로 PDF 한 파일(한글이 글꼴 없이도 안전).
     라이브러리는 누를 때만 cdnjs 에서(판 고정 + SRI). 못 받으면 같은 쪽을 브라우저 인쇄(「PDF로 저장」)로 연다.
   - model()·lines() 는 DOM 없이 돈다 — node 검사(tools/result_pdf_check.mjs)가 같은 함수를 부른다.
   ====================================================================== */
var ResultPdf = (function () {
  'use strict';
  var LIBS = [
    { key: 'html2canvas', src: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', sri: 'sha384-ZZ1pncU3bQe8y31yfZdMFdSpttDoPmOZg2wguVK9almUodir1PghgT0eY7Mrty8H', ok: function () { return typeof window.html2canvas === 'function'; } },
    { key: 'jspdf', src: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/4.2.1/jspdf.umd.min.js', sri: 'sha384-qovJwSBbRDPP5cEjCp8S0UP66wrvnjaa60XMOGzTNanrThcrGfXfnZkvgY8N1KT3', ok: function () { return !!(window.jspdf && window.jspdf.jsPDF); } }
  ];
  var GAME = '워크심(WORK SIM)';
  var TEAM_NAME = { cs: '고객상담팀', logi: '물류팀', acct: '회계팀', ga: '총무팀', rec: '채용팀', plan: '경영기획팀', qc: '품질관리팀', pr: '홍보팀', edu: '교육팀', buy: '구매팀' };
  var DAY_TITLE = { 1: '첫 출근', 2: '사규집', 3: '숫자', 4: '옆 팀', 5: '거절', 6: '위기', 7: '결정' };
  var ACT_DEFAULT = { reply: '회신', hold: '보류', delegate: '전달', confirm: '상신', reject: '거절', approve: '승인', deliver: '직접 전달', ask: '직접 질문', report: '보고', visit: '응대', work: '검산', none: '처리 못 함', timeout: '무응답', pick: '선택' };

  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function num(x) { return (typeof x === 'number' && isFinite(x)) ? x : null; }
  function str(x) { return x == null ? '' : String(x); }
  function dep(o, k) { if (o && o[k]) return o[k]; var g = (typeof globalThis !== 'undefined') ? globalThis : (typeof window !== 'undefined' ? window : {}); if (g[k]) return g[k]; throw new Error(k + ' 가 없습니다'); }
  function josa(w, a, b) { var c = str(w).charCodeAt(str(w).length - 1); if (!(c >= 0xac00 && c <= 0xd7a3)) return b; return (c - 0xac00) % 28 ? a : b; }
  function ymd(iso) { var t = Date.parse(iso || ''); if (!isFinite(t)) return ''; var d = new Date(t); return d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0'); }

  /* 화 데이터 → {day: story} (NcsReport 와 같은 모양을 받는다: window.STORY 통째 {'cs-ep1':…}) */
  function storyOf(stories, team, d) { if (!stories) return null; var s = stories[team + '-ep' + d] || stories[String(d)] || null; return isObj(s) ? s : null; }

  /* 팀장 한마디 — 디브리프(day.js buildResult)와 같은 자리: debrief.lead[그날 level]. 「오늘 그만하기」로 끝낸 날은 화면처럼 중립 한마디 */
  function leadLine(story, rec, fill) {
    var deb = (story && story.dialog && story.dialog.debrief) || null; if (!deb || !rec) return '';
    if (rec.ncs2 && rec.ncs2.quit) {
      var lead = ((story.dests || []).filter(function (x) { return x.seat === 'lead'; })[0] || {}).name || '팀장';
      var says = ((story.dialog.briefing || []).filter(function (l) { return l && l.who && (l.who === lead || lead.slice(-l.who.length) === l.who || l.who.slice(-lead.length) === lead); }).map(function (l) { return l.text; }).join(' ')) + ' ' + Object.keys(deb.lead || {}).map(function (k) { return deb.lead[k]; }).join(' ');
      var banmal = says.trim() && !/요[.?!…]|요\s*$/.test(says);
      return banmal ? '오늘은 여기까지네. 못 끝낸 건은 내일 아침에 이어서 보자.' : '오늘은 여기까지네요. 못 끝낸 건은 내일 아침에 이어서 봐요.';
    }
    var t = deb.lead && rec.level ? deb.lead[rec.level] : '';
    return t ? fill(str(t)) : '';
  }
  function leadName(story) { return (((story && story.dests) || []).filter(function (x) { return x.seat === 'lead'; })[0] || {}).name || '팀장'; }

  /* ── 자료 모양(DOM 없음) ───────────────────────────────────────────── */
  function model(P, stories, o) {
    o = o || {};
    var N = dep(o, 'NCS'), E = dep(o, 'NcsEval'), R = dep(o, 'NcsReport');
    var fill = typeof o.fill === 'function' ? o.fill : function (t) { return t; };
    var team = o.team || (P && P.team) || '';
    var name = str(o.name || (P && P.name) || '').trim();
    var es = R.essay(P, stories, { team: team });
    var st = R.student(P, stories, { team: team });
    var teamName = es.teamName || TEAM_NAME[team] || team;
    var done = (P && P.done) || {};
    var ats = Object.keys(done).map(function (k) { return done[k] && done[k].at; }).filter(Boolean).sort();
    var m = { game: GAME, name: name, team: team, teamName: teamName,
      period: { from: ymd(ats[0]), to: ymd(ats[ats.length - 1]) }, made: ymd(o.now || new Date().toISOString()),
      daysDone: st.daysDone.slice(), work: st.work, ending: null, total: null, ncs: null, sw: null, days: [], ep7: null };

    /* 카드 제목 — 화면(ep7.js titleOf)과 같이 이름 자리를 채운다. 화 데이터가 없어 id 만 남으면 id 를 내보내지 않는다 */
    var cardTitle = function (t, id, fallback) { t = str(t); if (!t || t === id) return fallback || '업무'; return fill(t); };
    var essayCard = {}; es.days.forEach(function (day) { day.cards.forEach(function (c) { essayCard[day.d + ':' + c.id] = c; }); });
    var cardName = function (d, id, ov) {
      if (!id) { var L = ov && N.ov[ov] && N.ov[ov].label; return d ? d + '일차 ' + (L || '업무') : ''; }
      var c = essayCard[d + ':' + id]; var t = c ? cardTitle(c.title, id, '') : ''; return t ? d + '일차 「' + t + '」' : d + '일차 업무';
    };

    /* NCS — 7일 결과 화면(ep7.js renderWeek)과 같은 호출·같은 글 */
    var Rw = null; try { Rw = E.report(P, { team: team }); } catch (e) { Rw = null; }
    var legacyOnly = !Rw || (Rw.legacy.length && !Object.keys(Rw.days).some(function (k) { var v = Rw.days[k]; return v === 'ok' || v === 'part' || v === 'quit'; }));
    if (Rw && !legacyOnly) {
      var nm = function (c) { return N.subs[c].name; };
      var notes = [];
      if (Rw.growth.length) notes.push({ label: '성장', text: Rw.growth.map(function (g) { return g.text; }).join(' · ') });
      notes.push({ label: '참고', text: nm('4-2') + ': ' + Rw.ref['4-2'].text });
      var judge = Rw.levelled.filter(function (c) { return Rw.subs[c].judge && Rw.subs[c].level < 4; });
      if (judge.length) { var j = judge.map(nm).join(', '); notes.push({ label: '판단 위주', text: j + josa(j, '은', '는') + ' 고르는 문제로 주로 확인됐어요. 「숙련」은 직접 써 보는 과제에서 확인돼야 나와요.' }); }
      var gray = [];
      var thin = Rw.thin.map(function (c) { return Rw.subs[c].n ? nm(c) + '(관찰 ' + Rw.subs[c].n + '건 · 잘함 ' + Rw.subs[c].ok + '건)' : nm(c) + '(관찰 없음)'; });
      if (thin.length) gray.push('근거 부족(참고): ' + thin.join(', '));
      if (Rw.notCovered.length) gray.push('이 과정에서 다루지 않은 하위능력: ' + Rw.notCovered.map(nm).join(', '));
      if (Rw.legacy.length) gray.push('이전 방식으로 기록된 날(새 역량 표에 없음): ' + Rw.legacy.join('·') + '일차');
      if (Rw.part.length) gray.push('역량 기록이 일부 빠진 날: ' + Rw.part.join('·') + '일차');
      if (Rw.quit.length) gray.push('중간에 끝낸 날: ' + Rw.quit.join('·') + '일차');
      var LVC = { level: null, thin: '근거 부족', ref: '참고', x: '다루지 않음' };
      var groups = Rw.areas.map(function (a) {
        return { name: a.name, hue: a.hue, rows: a.subs.map(function (c) {
          var X = Rw.subs[c], off = X.status === 'x', dcell = [];
          for (var d = 1; d <= 7; d++) { var b = !off && X.byDay[d]; dcell.push(b ? (b.w >= N.daily.w || b.S === 0 ? String(b.S) : '○') : off ? '' : '·'); }
          var ref = X.status === 'ref' ? (Rw.ref[c] && Rw.ref[c].n ? '반영 ' + Rw.ref[c].k + '/' + Rw.ref[c].n : '-') : X.best ? cardName(X.best.d, X.best.card, X.best.ov) : '-';
          return { code: c, name: X.name, off: off, judge: !!(X.judge && X.status === 'level' && X.level < 4), lv: X.status === 'level' ? X.levelName : (LVC[X.status] || ''),
            S: X.status === 'level' ? String(X.S) : '-', nok: off || !X.n ? '-' : X.n + '·' + X.ok, days: dcell, ref: ref };
        }) };
      });
      m.ncs = { std: N.std, provisional: !!N.provisional,
        areas: Rw.areas.map(function (a) { return { name: a.name, hue: a.hue, status: a.status, level: a.level, levelName: a.levelName || '', S: a.status === 'level' ? a.S : null,
          empty: a.status === 'x' ? '이 과정에서 다루지 않음' : '근거 부족(참고)', cov: a.status === 'x' ? '' : a.k + '/' + a.of }; }),
        notes: notes, gray: gray, groups: groups,
        gateNote: Rw.levelled.some(function (c) { return Rw.subs[c].S >= 85 && Rw.subs[c].level < 4 && !Rw.subs[c].judge; }),
        statement: E.STATEMENT };

      /* 나의 강점 · 보완할 점 — 판정은 화면과 같은 NcsEval 강점 2·보완 2(새 규칙 없음). 근거 행동은 그 학생의 증거에서:
         강점 = 화면이 짚은 대표 카드 + 자소서용 기록(essay)이 고른 잘한 근거 카드 · 보완 = 화면이 짚은 카드 + 같은 하위능력에서 낮았던 다른 카드 */
      var evOf = function (d, card, sub, good) { return st.evidence.filter(function (e) { return e.d === d && e.card === card && e.sub === sub && (good ? e.s >= 2 : e.s <= 1); }); };
      var actOf = function (d, card) { var c = essayCard[d + ':' + card]; if (!c) return ''; var a = c.actLabel || ''; return a && a !== c.act ? a : (ACT_DEFAULT[c.act] || ''); };
      var goodAct = function (d, card, ov, sub) {
        var e = evOf(d, card, sub, true)[0]; var k = ov || (e && e.ov); var meta = k && N.ov[k];
        var what = meta ? (meta.good || meta.label) : ''; var a = card ? actOf(d, card) : '';
        return { d: d, where: card ? cardName(d, card, k) : d + '일차 하루 기록', act: a, text: what };
      };
      var badAct = function (d, card, ov, sub) {
        var e = evOf(d, card, sub, false)[0]; var k = ov || (e && e.ov); var meta = k && N.ov[k];
        var a = card ? actOf(d, card) : '';
        return { d: d, where: card ? cardName(d, card, k) : d + '일차 하루 기록', act: a, text: meta ? '「' + meta.label + '」 부분이 아쉬웠어요' : '아쉬운 점이 있었어요' };
      };
      var subCards = {}; ((es.ncs && es.ncs.subs) || []).forEach(function (s) { subCards[s.code] = s.cards || []; });
      var strengths = Rw.strengths.map(function (x) {
        var acts = []; var seen = {};
        var bst = Rw.subs[x.sub].best;
        if (x.d) { acts.push(goodAct(x.d, x.card, bst && bst.ov, x.sub)); seen[x.d + ':' + (x.card || (bst && bst.ov))] = 1; }
        (subCards[x.sub] || []).forEach(function (c) {
          if (acts.length >= 2) return; var ev = st.evidence.filter(function (e) { return e.d === c.d && e.card === c.card && e.sub === x.sub && e.ovLabel === c.what; })[0];
          var key = c.d + ':' + (c.card || (ev && ev.ov)); if (seen[key]) return; seen[key] = 1; acts.push(goodAct(c.d, c.card, ev && ev.ov, x.sub)); });
        return { name: x.name, levelName: Rw.subs[x.sub].levelName || '', S: x.S, text: x.text, acts: acts };
      });
      var gaps = [], unsure = [];
      Rw.gaps.forEach(function (x) {
        if (x.S == null) { unsure.push({ name: x.name, text: '기록이 적어 판단하지 않음 — 「' + N.subs[x.sub].act + '」를 보여 줄 기회를 더 찾아봐요.' }); return; }
        var acts = []; var seen = {}; var wst = Rw.subs[x.sub].worst;
        if (x.d) { acts.push(badAct(x.d, x.card, wst && wst.ov, x.sub)); seen[x.d + ':' + x.card] = 1; }
        st.evidence.filter(function (e) { return e.sub === x.sub && e.s <= 1 && e.m !== 'r'; }).forEach(function (e) {
          if (acts.length >= 2) return; var key = e.d + ':' + e.card; if (seen[key] || (!e.card && seen[e.d + ':null'])) return; seen[key] = 1; acts.push(badAct(e.d, e.card, e.ov, x.sub)); });
        gaps.push({ name: x.name, levelName: Rw.subs[x.sub].levelName || '', S: x.S, tip: x.tip, acts: acts });
      });
      var thinNames = Rw.thin.filter(function (c) { return !unsure.some(function (u) { return u.name === N.subs[c].name; }); }).map(nm);
      m.sw = { strengths: strengths, gaps: gaps, unsure: unsure, thin: thinNames };
    } else {
      m.ncs = { legacy: true, text: '이전 방식으로만 기록된 7일이라 새 역량 표를 낼 수 없어요.' };
    }

    /* 일차별 기록 */
    es.days.forEach(function (day) {
      var story = storyOf(stories, team, day.d); var rec = done[String(day.d)];
      var cards = day.cards.map(function (c) {
        var ok = []; (c.ev || []).forEach(function (e) { if (e.s >= 2 && ok.indexOf(e.subName) < 0) ok.push(e.subName); });
        var act = c.handled ? (c.actLabel || ACT_DEFAULT[c.act] || '') : '처리 못 함';
        var choice = c.choiceText && c.choiceText !== c.actLabel ? fill(c.choiceText) : '';
        var texts = [];
        if (c.text) texts.push({ label: c.text2 ? '첫째 글' : '내가 쓴 글', text: c.text });
        if (c.text2) texts.push({ label: '둘째 글', text: c.text2 });
        if (c.answer) texts.push({ label: '내 답', text: c.answer });
        return { clock: c.clock || '', type: c.typeLabel || '', title: cardTitle(c.title, c.id, c.typeLabel || '업무'), from: c.from || '', branch: !!c.branch, followup: !!c.followup,
          act: act, choice: choice, score: c.score, late: !!c.late, handled: c.handled, abilities: ok, texts: texts };
      });
      var lead = day.d < 7 ? leadLine(story, rec, fill) : '';
      m.days.push({ d: day.d, title: day.title || DAY_TITLE[day.d] || '', date: day.date || '', work: day.work, state: day.state, stateLabel: day.state && day.state !== 'ok' ? day.stateLabel : '',
        attempts: day.attempts, leadName: leadName(story), lead: lead, cards: cards });
    });

    /* 7일차 — 결정·보고서·발표·회고·엔딩(엔딩 화면에 보이는 것 중 학생 기록과 점수만. 좋은 예·칸별 채점 문장은 싣지 않는다) */
    var r7 = done['7'];
    if (r7 && es.ep7) {
      var s7 = storyOf(stories, team, 7); var E7 = (s7 && s7.ep7) || {};
      var en = (E7.endings && E7.endings[r7.ending]) || null;
      m.ending = r7.ending || null; m.total = num(r7.total);
      m.ep7 = { ending: r7.ending || '', endingName: en && en.name ? en.name : '', total: num(r7.total), of: (es.ep7.report.length || 5) * 2,
        report: es.ep7.report.map(function (f) { return { title: f.title, text: f.text, score: r7.rubric && r7.rubric[f.key] != null ? r7.rubric[f.key] : null }; }),
        tableOk: num(r7.tableOk), tableAll: (E7.table || []).length || null, calcOk: num(r7.calcOk), calcAll: (E7.criteria || []).length || null,
        violations: (r7.violations || []).map(function (v) { return str(v.text); }).filter(Boolean), missing: (r7.missingClues || []).slice(),
        decision: es.ep7.decision, dropped: es.ep7.dropped, idea: es.ep7.idea,
        questions: es.ep7.questions.map(function (q) { return { q: fill(q.q), answer: fill(q.answer) || '(답 없음)', score: q.score }; }),
        reflection: es.ep7.reflection };
    }
    return m;
  }

  /* 모든 글(검사용 — 쪽에 들어가는 글과 같다) */
  function lines(m) {
    var L = [m.game + ' 결과', m.name, m.teamName, m.period.from + ' ~ ' + m.period.to];
    if (m.ncs && !m.ncs.legacy) {
      m.ncs.areas.forEach(function (a) { L.push(a.name + ' ' + (a.S != null ? a.levelName + ' ' + a.S : a.empty) + ' ' + a.cov); });
      m.ncs.notes.forEach(function (n) { L.push(n.label + ' ' + n.text); }); m.ncs.gray.forEach(function (g) { L.push(g); });
      m.ncs.groups.forEach(function (g) { L.push(g.name); g.rows.forEach(function (r) { L.push([r.name, r.lv, r.S, r.nok].concat(r.days, [r.ref]).join(' ')); }); });
      L.push(m.ncs.statement);
      m.sw.strengths.forEach(function (x) { L.push(x.name + ' ' + x.levelName + ' ' + x.S + ' ' + x.text); x.acts.forEach(function (a) { L.push(a.where + ' ' + a.act + ' ' + a.text); }); });
      m.sw.gaps.forEach(function (x) { L.push(x.name + ' ' + x.levelName + ' ' + x.S + ' ' + x.tip); x.acts.forEach(function (a) { L.push(a.where + ' ' + a.act + ' ' + a.text); }); });
      m.sw.unsure.forEach(function (x) { L.push(x.name + ' ' + x.text); }); if (m.sw.thin.length) L.push(m.sw.thin.join(', '));
    } else if (m.ncs) L.push(m.ncs.text);
    m.days.forEach(function (d) {
      L.push(d.d + '일차 ' + d.title + ' ' + d.date + ' ' + (d.work == null ? '' : d.work) + ' ' + d.lead);
      d.cards.forEach(function (c) { L.push([c.clock, c.type, c.title, c.from, c.act, c.choice, c.score == null ? '' : c.score, c.abilities.join('·')].join(' ')); c.texts.forEach(function (t) { L.push(t.label + ' ' + t.text); }); });
    });
    if (m.ep7) { var e = m.ep7; L.push('엔딩 ' + e.ending + ' ' + e.endingName + ' ' + e.total);
      e.decision.forEach(function (f) { L.push(f.field + ' ' + f.text); }); L.push(e.dropped, e.idea);
      e.report.forEach(function (f) { L.push(f.title + ' ' + f.score + ' ' + f.text); }); e.questions.forEach(function (q) { L.push(q.q + ' ' + q.answer + ' ' + q.score); });
      L.push(e.reflection); e.violations.forEach(function (v) { L.push(v); }); if (e.missing.length) L.push(e.missing.join(', ')); }
    return L.filter(function (x) { return x != null && x !== ''; });
  }

  /* ── 쪽 짜기(DOM) ─────────────────────────────────────────────────── */
  var PW = 794, PH = 1123, MX = 50, MT = 58, MB = 58;
  var CSS = [
    '.rp-root{position:fixed;left:0;top:0;z-index:-5;pointer-events:none;font:13px/1.55 -apple-system,system-ui,"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif;color:#1b2430;word-break:keep-all;overflow-wrap:anywhere;-webkit-font-smoothing:antialiased}',
    '.rp-root *{box-sizing:border-box}',
    '.rp-meas{width:' + (PW - 2 * MX) + 'px;position:absolute;left:0;top:0;visibility:hidden}',
    '.rp-page{width:' + PW + 'px;height:' + PH + 'px;background:#fff;position:relative;overflow:hidden;padding:' + MT + 'px ' + MX + 'px ' + MB + 'px}',
    '.rp-hd{position:absolute;left:' + MX + 'px;right:' + MX + 'px;top:22px;display:flex;justify-content:space-between;font-size:10.5px;color:#6b7684;border-bottom:1px solid #e3e7ee;padding-bottom:6px}',
    '.rp-ft{position:absolute;left:' + MX + 'px;right:' + MX + 'px;bottom:20px;display:flex;justify-content:space-between;font-size:10.5px;color:#8a94a3}',
    '.rp-b{padding-bottom:8px}',
    '.rp-h1{font-size:19px;font-weight:800;color:#143766;padding:6px 0 4px;border-bottom:2px solid #1f4e8c;margin-bottom:4px}',
    '.rp-h2{font-size:15px;font-weight:800;color:#1b2430;padding-top:8px;display:flex;align-items:baseline;gap:8px}',
    '.rp-h2 small{font-size:11.5px;font-weight:600;color:#5b6675}',
    '.rp-sub{font-size:11.5px;color:#5b6675}',
    '.rp-area{display:grid;grid-template-columns:118px 1fr 58px 38px;align-items:center;gap:10px;padding:5px 0;border-bottom:1px solid #eef0f4}',
    '.rp-area .n{font-weight:700;display:flex;align-items:center;gap:6px}.rp-area .n i{width:9px;height:9px;border-radius:50%;display:inline-block}',
    '.rp-bar{height:10px;border-radius:5px;background:#eef0f4;position:relative;overflow:hidden}.rp-bar b{position:absolute;left:0;top:0;bottom:0;border-radius:5px}',
    '.rp-bar-t{font-size:11.5px;color:#8a94a3}',
    '.rp-lv{font-weight:700;text-align:center;border-radius:6px;padding:1px 0;font-size:12px}.rp-cov{font-size:11px;color:#5b6675;text-align:right}',
    '.rp-note{padding:5px 0 5px 10px;border-left:3px solid #c5d5ee;margin:3px 0;font-size:12.5px}.rp-note b{margin-right:6px;color:#143766}',
    '.rp-gray{font-size:11.5px;color:#6b7684}',
    '.rp-tr{display:grid;grid-template-columns:112px 60px 34px 48px repeat(7,29px) 1fr;font-size:11px;border-bottom:1px solid #eef0f4;align-items:center}',
    '.rp-tr>span{padding:3px 3px}.rp-tr .c{text-align:center}.rp-tr.hd{font-weight:700;background:#f5f6f8;border-top:1px solid #dde3ec}',
    '.rp-tr.grp{grid-template-columns:1fr;font-weight:800;font-size:11.5px;background:#fafbfc}.rp-tr.off{color:#a0a8b4}',
    '.rp-tag{font-size:9.5px;border:1px solid #c5d5ee;border-radius:4px;padding:0 3px;margin-left:3px;color:#1f4e8c}',
    '.rp-sw{border:1px solid #dde3ec;border-radius:10px;padding:9px 12px;border-left:5px solid var(--c)}',
    '.rp-sw .t{font-weight:800;font-size:13.5px}.rp-sw .t small{font-weight:600;color:#5b6675;margin-left:6px}',
    '.rp-sw .x{margin:3px 0 2px}.rp-sw ul{margin:4px 0 0;padding-left:18px}.rp-sw li{margin:2px 0;font-size:12px}.rp-sw .tip{margin-top:5px;font-size:12.5px;color:#1b5e3a}',
    '.rp-day{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #1b2430;padding-bottom:4px;margin-top:4px}',
    '.rp-day .l{font-size:15.5px;font-weight:800}.rp-day .l small{font-size:12px;font-weight:600;color:#5b6675;margin-left:8px}.rp-day .r{font-size:12.5px;font-weight:700;color:#1f4e8c}',
    '.rp-lead{background:#f5f6f8;border-radius:8px;padding:6px 10px;font-size:12.5px}.rp-lead b{color:#b4530a;margin-right:6px}',
    '.rp-ct{display:grid;grid-template-columns:44px 50px 1fr 128px 42px;gap:0 6px;font-size:11.5px;border-bottom:1px solid #eef0f4;padding:4px 0;align-items:start}',
    '.rp-ct.hd{font-weight:700;background:#f5f6f8;border-top:1px solid #dde3ec;padding:3px 0}.rp-ct .v{text-align:right;font-weight:700}.rp-ct .s{color:#5b6675;font-size:10.5px}',
    '.rp-ct .lo{color:#b3261e}.rp-ct .mid{color:#9a4a06}',
    '.rp-txt{border:1px solid #e3e7ee;border-radius:8px;padding:7px 10px;background:#fcfcfd}.rp-txt .t{font-size:11.5px;font-weight:700;color:#5b6675;margin-bottom:2px}',
    '.rp-txt .p{white-space:pre-wrap;font-size:12px}',
    '.rp-kv{display:grid;grid-template-columns:128px 1fr;gap:4px 10px;font-size:12.5px}.rp-kv b{color:#5b6675;font-weight:700}',
    '.rp-cover{height:100%;display:flex;flex-direction:column}',
    '.rp-cover .brand{font-size:12px;font-weight:700;color:#1f4e8c;letter-spacing:.02em}',
    '.rp-cover h1{font-size:34px;line-height:1.25;margin:120px 0 6px;color:#143766;font-weight:800}',
    '.rp-cover .lead{font-size:14px;color:#5b6675}',
    '.rp-cover .who{margin-top:44px;display:grid;grid-template-columns:90px 1fr;gap:10px 14px;font-size:15px}.rp-cover .who b{color:#5b6675;font-weight:600}',
    '.rp-kpi{margin-top:44px;display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.rp-kpi div{border:1px solid #dde3ec;border-radius:10px;padding:10px 12px}',
    '.rp-kpi small{display:block;font-size:11px;color:#5b6675}.rp-kpi b{font-size:20px;color:#143766}',
    '.rp-cover .areas{margin-top:26px}.rp-cover .foot{margin-top:auto;font-size:11px;color:#6b7684;border-top:1px solid #e3e7ee;padding-top:10px}',
    '@media print{html,body{height:auto!important;overflow:visible!important;background:#fff!important}body>*:not(.rp-print){display:none!important}',
    '.rp-print{display:block!important;position:static!important;z-index:auto!important}.rp-print .rp-page{page-break-after:always;break-after:page}@page{size:A4;margin:0}}'
  ].join('\n');

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function blk(child, opt) { var b = el('div', 'rp-b'); if (child) b.appendChild(child); opt = opt || {}; if (opt.keep) b.dataset.keep = '1'; if (opt.group) b.dataset.group = opt.group; if (opt.head) b.dataset.head = '1'; if (opt.gap != null) b.style.paddingBottom = opt.gap + 'px'; return b; }
  function h1(t) { return blk(el('div', 'rp-h1', t), { keep: 1, gap: 8 }); }
  function h2(t, sub) { var d = el('div', 'rp-h2', t); if (sub) d.appendChild(el('small', null, sub)); return blk(d, { keep: 1, gap: 6 }); }
  function scoreCls(v) { return v == null ? '' : v < 60 ? 'lo' : v < 80 ? 'mid' : ''; }
  /* 긴 글은 문단(줄바꿈)마다, 문단이 길면 문장 경계에서 잘라 여러 덩이로 — 한 덩이가 한 쪽을 넘지 않게 */
  function chunks(text, max) { max = max || 650; var out = []; str(text).split(/\n{2,}/).forEach(function (p) { while (p.length > max) { var cut = p.lastIndexOf('. ', max); if (cut < max * 0.5) cut = p.lastIndexOf(' ', max); if (cut < max * 0.5) cut = max; out.push(p.slice(0, cut + 1).trim()); p = p.slice(cut + 1); } if (p.trim()) out.push(p.trim()); }); return out.length ? out : ['']; }
  function textBlocks(title, text, group) {
    var parts = chunks(text); return parts.map(function (p, i) { var box = el('div', 'rp-txt'); box.appendChild(el('div', 't', title + (i ? ' (이어서)' : ''))); box.appendChild(el('div', 'p', p)); return blk(box, { gap: 7, group: group }); });
  }

  function blocks(m) {
    var B = [];
    /* NCS */
    B.push({ pageBreak: true });
    B.push(h1('1. NCS 직업공통능력 결과'));
    if (m.ncs.legacy) { B.push(blk(el('div', 'rp-gray', m.ncs.text))); }
    else {
      B.push(blk(el('div', 'rp-sub', 'NCS 직업공통능력(' + String(m.ncs.std).replace('직업공통능력 ', '') + ') 7영역 — 7일 결과 화면과 같은 표입니다. 수준: 초보 · 준비 · 적응 · 숙련'), { gap: 6 }));
      m.ncs.areas.forEach(function (a) {
        var r = el('div', 'rp-area'); var n = el('div', 'n'); var dot = el('i'); dot.style.background = a.hue; n.appendChild(dot); n.appendChild(document.createTextNode(a.name)); r.appendChild(n);
        if (a.S != null) { var bar = el('div', 'rp-bar'); var f = el('b'); f.style.width = Math.max(2, Math.min(100, a.S)) + '%'; f.style.background = a.hue; bar.appendChild(f); var wrap = el('div'); wrap.style.cssText = 'display:grid;grid-template-columns:1fr 30px;gap:8px;align-items:center'; wrap.appendChild(bar); wrap.appendChild(el('span', null, String(a.S))); r.appendChild(wrap); }
        else r.appendChild(el('div', 'rp-bar-t', a.empty));
        var lv = el('div', 'rp-lv', a.levelName || ''); if (a.level) lv.style.background = a.hue + '1f'; r.appendChild(lv); var cov = el('div', 'rp-cov', a.cov); r.appendChild(cov);
        B.push(blk(r, { gap: 0 }));
      });
      B.push(blk(el('div', 'rp-gray', '오른쪽 숫자 = 포괄도(이 영역의 하위능력 3개 중 수준이 나온 수)'), { gap: 8 }));
      m.ncs.notes.forEach(function (n) { var d = el('div', 'rp-note'); d.appendChild(el('b', null, n.label)); d.appendChild(document.createTextNode(n.text)); B.push(blk(d, { gap: 2 })); });
      m.ncs.gray.forEach(function (g) { B.push(blk(el('div', 'rp-gray', g), { gap: 2 })); });
      B.push(h2('하위능력별로 보기', '날 칸: 숫자 = 그날 점수 · ○ = 근거가 얇은 날 · · = 관찰 없음'));
      var head = function () { var r = el('div', 'rp-tr hd'); ['하위능력', '수준', '점수', '관찰·잘함', '1', '2', '3', '4', '5', '6', '7', '대표 근거'].forEach(function (t, i) { r.appendChild(el('span', i >= 1 && i <= 10 ? 'c' : '', t)); }); return r; };
      B.push(blk(head(), { gap: 0, group: 'subs', head: 1, keep: 1 }));
      m.ncs.groups.forEach(function (g) {
        var gr = el('div', 'rp-tr grp'); var s = el('span', null, g.name); s.style.color = g.hue; gr.appendChild(s); B.push(blk(gr, { gap: 0, group: 'subs', keep: 1 }));
        g.rows.forEach(function (x) { var r = el('div', 'rp-tr' + (x.off ? ' off' : '')); var n = el('span', null, x.name); if (x.judge) n.appendChild(el('span', 'rp-tag', '판단 위주')); r.appendChild(n);
          [x.lv, x.S, x.nok].concat(x.days).forEach(function (t) { r.appendChild(el('span', 'c', t)); }); r.appendChild(el('span', null, x.ref)); B.push(blk(r, { gap: 0, group: 'subs' })); });
      });
      if (m.ncs.gateNote) B.push(blk(el('div', 'rp-gray', '점수가 85 이상이어도 직접 써 보는 과제에서 잘한 기록(어려운 과제 포함)이 모자라면 수준은 「적응」까지예요.'), { gap: 4 }));
      B.push(blk(el('div', 'rp-gray', '※ ' + m.ncs.statement), { gap: 4 }));

      /* 강점·보완 */
      B.push({ pageBreak: true });
      B.push(h1('2. 나의 강점 · 보완할 점'));
      B.push(blk(el('div', 'rp-sub', '7일 결과 화면의 강점·다음엔과 같은 판정입니다. 아래 행동은 내가 실제로 처리한 업무에서 골랐어요.'), { gap: 6 }));
      B.push(h2('강점'));
      if (!m.sw.strengths.length) B.push(blk(el('div', 'rp-gray', '65점 이상으로 수준이 나온 하위능력이 아직 없어요. 아래 보완할 점부터 해 보면 좋아요.')));
      m.sw.strengths.forEach(function (x) {
        var c = el('div', 'rp-sw'); c.style.setProperty('--c', '#177245'); var t = el('div', 't', x.name); t.appendChild(el('small', null, x.levelName + ' ' + x.S)); c.appendChild(t);
        c.appendChild(el('div', 'x', x.text)); if (x.acts.length) { var ul = el('ul'); x.acts.forEach(function (a) { ul.appendChild(el('li', null, a.where + (a.act ? '(' + a.act + ')' : '') + ' — ' + a.text)); }); c.appendChild(ul); }
        B.push(blk(c, { gap: 8 }));
      });
      B.push(h2('보완할 점'));
      if (!m.sw.gaps.length && !m.sw.unsure.length) B.push(blk(el('div', 'rp-gray', '수준이 나온 하위능력이 모두 85점 이상이에요.')));
      m.sw.gaps.forEach(function (x) {
        var c = el('div', 'rp-sw'); c.style.setProperty('--c', '#b4530a'); var t = el('div', 't', x.name); t.appendChild(el('small', null, x.levelName + ' ' + x.S)); c.appendChild(t);
        if (x.acts.length) { var ul = el('ul'); x.acts.forEach(function (a) { ul.appendChild(el('li', null, a.where + (a.act ? '(' + a.act + ')' : '') + ' — ' + a.text)); }); c.appendChild(ul); }
        c.appendChild(el('div', 'tip', '다음에 이렇게 해 보면 좋아요: ' + x.tip));
        B.push(blk(c, { gap: 8 }));
      });
      m.sw.unsure.forEach(function (x) { var c = el('div', 'rp-sw'); c.style.setProperty('--c', '#a0a8b4'); c.appendChild(el('div', 't', x.name)); c.appendChild(el('div', 'x', x.text)); B.push(blk(c, { gap: 8 })); });
      if (m.sw.thin.length) B.push(blk(el('div', 'rp-gray', '기록이 적어 강점·보완으로 판단하지 않은 능력: ' + m.sw.thin.join(', ')), { gap: 4 }));
    }

    /* 일차별 기록 */
    B.push({ pageBreak: true });
    B.push(h1('3. 일차별 기록'));
    B.push(blk(el('div', 'rp-sub', '날마다 처리한 업무와 내가 쓴 글입니다. 점수는 업무 점수(그날 카드 점수 평균)예요.'), { gap: 6 }));
    m.days.filter(function (d) { return d.d < 7 || d.cards.length; }).forEach(function (d, i) {   /* 7일차는 아래 4절 — 아침 카드가 있을 때만 여기에도 */
      if (i) B.push({ space: 10 });
      var hd = el('div', 'rp-day'); var l = el('div', 'l', d.d + '일차 「' + d.title + '」'); if (d.date) l.appendChild(el('small', null, d.date)); hd.appendChild(l);
      hd.appendChild(el('div', 'r', (d.work != null ? '업무 점수 ' + d.work : '') + (d.stateLabel ? ' · ' + d.stateLabel : '') + (d.attempts > 1 ? ' · ' + d.attempts + '번째 시도' : ''))); B.push(blk(hd, { keep: 1, gap: 6 }));
      if (d.lead) { var ld = el('div', 'rp-lead'); ld.appendChild(el('b', null, d.leadName + ' 한마디')); ld.appendChild(document.createTextNode(d.lead)); B.push(blk(ld, { keep: 1, gap: 6 })); }
      var g = 'day' + d.d;
      var ch = el('div', 'rp-ct hd'); ['시각', '종류', '업무', '한 일', '점수'].forEach(function (t, k) { ch.appendChild(el('span', k === 4 ? 'v' : '', t)); }); B.push(blk(ch, { gap: 0, group: g, head: 1, keep: 1 }));
      d.cards.forEach(function (c) {
        var r = el('div', 'rp-ct'); r.appendChild(el('span', null, c.clock)); r.appendChild(el('span', null, c.type));
        var t = el('span'); t.appendChild(document.createTextNode(c.title + (c.branch ? ' (전날 일의 후속)' : ''))); if (c.from || c.abilities.length) t.appendChild(el('div', 's', [c.from ? '보낸 사람 ' + c.from : '', c.abilities.length ? '드러난 역량 ' + c.abilities.join('·') : ''].filter(Boolean).join(' · '))); r.appendChild(t);
        var a = el('span', null, c.act + (c.late ? ' · 늦음' : '')); if (c.choice) a.appendChild(el('div', 's', '「' + c.choice + '」')); r.appendChild(a);
        r.appendChild(el('span', 'v ' + scoreCls(c.score), c.score == null ? '-' : String(c.score))); B.push(blk(r, { gap: 0, group: g }));
      });
      var wrote = d.cards.filter(function (c) { return c.texts.length; });
      if (wrote.length) { B.push({ space: 6 }); B.push(blk(el('div', 'rp-sub', d.d + '일차에 내가 쓴 글'), { keep: 1, gap: 4 }));
        wrote.forEach(function (c) { c.texts.forEach(function (t) { textBlocks((c.clock ? c.clock + ' ' : '') + c.title + ' — ' + t.label, t.text).forEach(function (b) { B.push(b); }); }); }); }
    });

    /* 7일차 */
    if (m.ep7) {
      var e = m.ep7;
      B.push({ pageBreak: true });
      B.push(h1('4. 7일차 「결정」 — 보고와 발표'));
      var kv = el('div', 'rp-kv'); var add = function (k, v) { if (!v) return; kv.appendChild(el('b', null, k)); kv.appendChild(el('span', null, v)); };
      add('엔딩', '엔딩 ' + e.ending + (e.endingName ? ' — ' + e.endingName : '')); add('보고서 채점', (e.total == null ? '-' : e.total) + '/' + e.of);
      if (e.tableOk != null || e.calcOk != null) add('취합·계산', '취합표 ' + (e.tableOk != null ? e.tableOk : '—') + (e.tableAll ? '/' + e.tableAll : '') + '칸 · 계산 ' + (e.calcOk != null ? e.calcOk : '—') + (e.calcAll ? '/' + e.calcAll : '') + '칸 맞음');
      if (e.violations.length) add('규정 위반', e.violations.join(' / ')); if (e.missing.length) add('놓친 단서', e.missing.join(', '));
      B.push(blk(kv, { gap: 10 }));
      if (e.decision.length || e.dropped || e.idea) {
        B.push(h2('나의 결정'));
        var dk = el('div', 'rp-kv'); e.decision.forEach(function (f) { dk.appendChild(el('b', null, f.field)); dk.appendChild(el('span', null, f.text)); });
        if (e.dropped) { dk.appendChild(el('b', null, '버린 안')); dk.appendChild(el('span', null, e.dropped)); } if (e.idea) { dk.appendChild(el('b', null, '아이디어')); dk.appendChild(el('span', null, e.idea)); }
        B.push(blk(dk, { gap: 8 }));
      }
      B.push(h2('나의 보고서', '칸마다 채점(0~2)'));
      e.report.forEach(function (f) { textBlocks(f.title + (f.score != null ? ' · ' + f.score + '/2' : ''), f.text || '(비워 둠)').forEach(function (b) { B.push(b); }); });
      if (e.questions.length) { B.push(h2('발표 질문과 내 답'));
        e.questions.forEach(function (q) { var d = el('div', 'rp-note'); d.appendChild(el('b', null, '「' + q.q + '」')); d.appendChild(document.createTextNode('→ ' + q.answer + (q.score != null ? ' · ' + q.score + '점' : ''))); B.push(blk(d, { gap: 2 })); }); }
      if (e.reflection) { B.push(h2('회고')); textBlocks('7일을 돌아보며', e.reflection).forEach(function (b) { B.push(b); }); }
    }
    return B;
  }

  function cover(m) {
    var c = el('div', 'rp-cover');
    c.appendChild(el('div', 'brand', '에듀메이커스 · ' + m.game));
    c.appendChild(el('h1', null, '7일 직무 체험\n결과 보고서')); c.lastChild.style.whiteSpace = 'pre-line';
    c.appendChild(el('div', 'lead', '신입사원으로 보낸 7일 동안의 업무 기록과 NCS 직업공통능력 결과'));
    var who = el('div', 'who'); var add = function (k, v) { who.appendChild(el('b', null, k)); who.appendChild(el('span', null, v || '—')); };
    add('이름', m.name || '(이름 없음)'); add('팀', m.teamName); add('기간', m.period.from ? (m.period.from === m.period.to ? m.period.from : m.period.from + ' ~ ' + m.period.to) : '—'); add('만든 날', m.made);
    c.appendChild(who);
    var k = el('div', 'rp-kpi'); var kp = function (t, v) { var d = el('div'); d.appendChild(el('small', null, t)); d.appendChild(el('b', null, v)); k.appendChild(d); };
    kp('마친 날', m.daysDone.length + '/7일'); kp('업무 점수 평균', m.work && m.work.avg != null ? String(m.work.avg) : '—'); kp('7일차 엔딩', m.ending ? '엔딩 ' + m.ending : '—'); kp('보고서 채점', m.total != null ? m.total + '/' + ((m.ep7 && m.ep7.of) || 10) : '—');
    c.appendChild(k);
    if (m.ncs && !m.ncs.legacy) {
      var ar = el('div', 'areas'); ar.appendChild(el('div', 'rp-sub', 'NCS 직업공통능력 7영역 수준'));
      m.ncs.areas.forEach(function (a) { var r = el('div', 'rp-area'); var n = el('div', 'n'); var dot = el('i'); dot.style.background = a.hue; n.appendChild(dot); n.appendChild(document.createTextNode(a.name)); r.appendChild(n);
        r.appendChild(a.S != null ? el('div', null, '') : el('div', 'rp-bar-t', a.empty)); var lv = el('div', 'rp-lv', a.levelName || ''); if (a.level) lv.style.background = a.hue + '1f'; r.appendChild(lv); r.appendChild(el('div', 'rp-cov', a.cov)); ar.appendChild(r); });
      c.appendChild(ar);
    }
    c.appendChild(el('div', 'foot', '이 보고서는 게임 속 행동 기록을 모은 것입니다. ' + (m.ncs && m.ncs.statement ? m.ncs.statement : '')));
    return c;
  }

  /* 블록을 쪽에 나눠 담는다 — 제목은 다음 덩이와 같이(keep), 표가 쪽을 넘으면 머리줄을 다시 */
  function paginate(m, root) {
    var avail = PH - MT - MB - 6;
    var meas = el('div', 'rp-meas'); root.appendChild(meas);
    var list = blocks(m); list.forEach(function (b) { if (b.nodeType) meas.appendChild(b); });
    var hOf = function (b) { return b.space != null ? b.space : b.nodeType ? b.getBoundingClientRect().height : 0; };
    var heads = {}; list.forEach(function (b) { if (b.nodeType && b.dataset.head) heads[b.dataset.group] = b; });
    var hs = list.map(hOf);
    var pages = [[]], used = 0, lastGroup = null;
    var newPage = function () { pages.push([]); used = 0; };
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (b.pageBreak) { if (pages[pages.length - 1].length) newPage(); continue; }
      if (b.space != null) { if (used > 0) { pages[pages.length - 1].push({ space: b.space }); used += b.space; } continue; }
      var h = hs[i];
      /* keep: 이 덩이와 뒤따르는 keep 덩이들 + 그다음 하나까지 한 쪽에 */
      var need = h; if (b.dataset.keep) { var j = i + 1; while (j < list.length && list[j].nodeType && list[j].dataset.keep) { need += hs[j]; j++; } if (j < list.length && list[j].nodeType) need += hs[j]; }
      /* 한 줄짜리 작은 덩이는 아래 여백으로 16px 까지 넘쳐도 둔다(그 한 줄만 다음 쪽에 가는 것을 막는다) */
      var tol = (!b.dataset.keep && h < 40) ? 16 : 0;
      if (used > 0 && used + Math.min(need, avail) > avail + tol) newPage();
      var g = b.dataset.group;
      if (used === 0 && g && !b.dataset.head && heads[g] && lastGroup === g) { var hc = heads[g].cloneNode(true); pages[pages.length - 1].push(hc); used += hs[list.indexOf(heads[g])]; }
      pages[pages.length - 1].push(b); used += h; lastGroup = g || null;
    }
    meas.remove();
    return pages.filter(function (p) { return p.length; });
  }

  function buildPages(m) {
    var old = document.querySelector('.rp-root'); if (old) old.remove();
    if (!document.getElementById('rpCss')) { var s = el('style'); s.id = 'rpCss'; s.textContent = CSS; document.head.appendChild(s); }
    var root = el('div', 'rp-root'); root.setAttribute('aria-hidden', 'true'); document.body.appendChild(root);
    var flow = paginate(m, root);
    var total = flow.length + 1; var out = [];
    var head = function (pg, n) { var hd = el('div', 'rp-hd'); hd.appendChild(el('span', null, m.game + ' 결과 보고서')); hd.appendChild(el('span', null, [m.name, m.teamName].filter(Boolean).join(' · '))); pg.appendChild(hd);
      var ft = el('div', 'rp-ft'); ft.appendChild(el('span', null, '에듀메이커스')); ft.appendChild(el('span', null, n + ' / ' + total)); pg.appendChild(ft); };
    var p0 = el('div', 'rp-page'); p0.appendChild(cover(m)); var f0 = el('div', 'rp-ft'); f0.appendChild(el('span', null, '')); f0.appendChild(el('span', null, '1 / ' + total)); p0.appendChild(f0); root.appendChild(p0); out.push(p0);
    flow.forEach(function (items, i) { var pg = el('div', 'rp-page'); head(pg, i + 2); items.forEach(function (b) { if (b.space != null) { var sp = el('div'); sp.style.height = b.space + 'px'; pg.appendChild(sp); } else pg.appendChild(b); }); root.appendChild(pg); out.push(pg); });
    return { root: root, pages: out };
  }

  /* ── 라이브러리·화면 ─────────────────────────────────────────────── */
  var libP = null;
  function loadLibs(timeout) {
    if (libP) return libP;
    libP = Promise.all(LIBS.map(function (L) {
      if (L.ok()) return true;
      return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = L.src; s.integrity = L.sri; s.crossOrigin = 'anonymous'; s.referrerPolicy = 'no-referrer';
        var t = setTimeout(function () { rej(new Error(L.key + ' 시간 초과')); }, timeout || 20000);
        s.onload = function () { clearTimeout(t); L.ok() ? res(true) : rej(new Error(L.key + ' 없음')); }; s.onerror = function () { clearTimeout(t); rej(new Error(L.key + ' 받기 실패')); }; document.head.appendChild(s); });
    })).catch(function (e) { libP = null; throw e; });
    return libP;
  }
  function overlay(text) {
    var o = document.getElementById('rpBusy');
    if (!o) { o = el('div'); o.id = 'rpBusy'; o.setAttribute('role', 'status'); o.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(245,246,248,.94);display:flex;align-items:center;justify-content:center;font:600 15px/1.5 -apple-system,system-ui,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#1b2430;text-align:center;padding:20px'; document.body.appendChild(o); }
    o.textContent = text; return o;
  }
  function closeOverlay() { var o = document.getElementById('rpBusy'); if (o) o.remove(); }
  function fileName(m) {
    var safe = function (s) { return str(s).replace(/[\\/:*?"<>|\s]+/g, '').slice(0, 20); };
    var d = new Date(); var day = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    return ['워크심_결과', safe(m.name) || '이름없음', safe(m.teamName), day].join('_') + '.pdf';
  }
  /* 쪽 → 그림 → PDF. scale 1.8 = 1429×2021(약 170dpi — 글자 선명) · JPEG 0.82 — 21쪽 5MB 안팎 */
  async function toPdf(m, built, onProgress) {
    var jsPDF = window.jspdf.jsPDF; var doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    doc.setProperties({ title: m.game + ' 결과 보고서 — ' + (m.name || ''), author: '에듀메이커스', subject: m.game + ' 7일 결과', creator: m.game });
    for (var i = 0; i < built.pages.length; i++) {
      if (built.cancel) throw new Error('취소됨');
      if (onProgress) onProgress(i + 1, built.pages.length);
      /* 한 번에 한 쪽만 보이게 — 쪽이 늘 화면 왼쪽 위(0,0)에 있어 html2canvas 가 자르지 않는다 */
      built.pages.forEach(function (pg, k) { pg.style.display = k === i ? '' : 'none'; });
      var cv = await window.html2canvas(built.pages[i], { scale: 1.8, backgroundColor: '#ffffff', logging: false, useCORS: false, width: PW, height: PH, windowWidth: PW, windowHeight: PH, scrollX: 0, scrollY: 0 });
      var img = cv.toDataURL('image/jpeg', 0.82);
      if (i) doc.addPage('a4', 'portrait');
      doc.addImage(img, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      cv.width = cv.height = 0;
    }
    return doc;
  }
  function printFallback(built) {
    built.cancel = true;
    built.pages.forEach(function (pg) { pg.style.display = ''; });
    built.root.className = 'rp-root rp-print'; built.root.style.cssText = 'display:none';
    var done = function () { window.removeEventListener('afterprint', done); built.root.remove(); };
    window.addEventListener('afterprint', done); setTimeout(function () { window.print(); }, 50);
  }

  /* 게임 안에서 부른다 — 전역 P·S·loadStory·fillName(core.js·day.js) */
  var busy = false;
  async function download(opt) {
    opt = opt || {};
    if (busy) return; busy = true;
    var Pg = opt.P || (typeof P !== 'undefined' ? P : null);
    try {
      if (!Pg || !Pg.done || !Object.keys(Pg.done).length) { alert('아직 저장된 기록이 없어요.'); return; }
      var team = Pg.team || (typeof S !== 'undefined' && S.team) || 'cs';
      overlay('결과 PDF를 만드는 중이에요… 기록을 모으고 있어요');
      var days = Object.keys(Pg.done).map(Number).filter(function (d) { return d >= 1 && d <= 7; });
      var libs = loadLibs().then(function () { return true; }, function (e) { console.info('PDF 라이브러리를 받지 못해 인쇄로 대신해요:', e && e.message); return false; });
      /* 화 데이터(제목·팀장 한마디만 읽는다) — 받지 못한 날은 「업무」로 적는다 */
      await Promise.all(days.map(function (d) { if (window.STORY && window.STORY[team + '-ep' + d]) return null; return (typeof loadStory === 'function' ? loadStory(team, d) : Promise.reject(new Error('loadStory 없음'))).catch(function (e) { console.info('결과 PDF: ' + d + '일차 제목을 불러오지 못함', e && e.message); }); }));
      var nm = (typeof S !== 'undefined' && S.name) || Pg.name || '';
      var fill = (typeof fillName === 'function') ? function (t) { return fillName(t); } : function (t) { return t; };
      var m = model(Pg, window.STORY || {}, { team: team, name: nm, fill: fill });
      var built = buildPages(m);
      var ok = await libs;
      if (!ok) { closeOverlay(); printFallback(built); return; }
      try {
        /* 느린 기기에서 멈춘 채 두지 않는다 — 쪽당 12초(최소 90초)를 넘기면 인쇄로 대신 */
        var limit = Math.max(90000, built.pages.length * 12000);
        var doc = await Promise.race([toPdf(m, built, function (i, n) { overlay('결과 PDF를 만드는 중이에요… ' + i + ' / ' + n + '쪽'); }),
          new Promise(function (_, rej) { setTimeout(function () { rej(new Error('시간 초과')); }, limit); })]);
        doc.save(fileName(m));
        built.root.remove();
      } catch (e) { console.warn('PDF 만들기 실패 — 인쇄로 대신해요', e); closeOverlay(); printFallback(built); return; }
    } catch (e) { console.warn('결과 PDF 실패', e); alert('결과 PDF를 만들지 못했어요. 잠시 뒤 다시 눌러 주세요.'); }
    finally { busy = false; closeOverlay(); }
  }
  function button(cls) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'btn' + (cls ? ' ' + cls : ''); b.textContent = '내 결과 PDF 내려받기';
    b.title = '7일 기록(NCS 결과·강점과 보완할 점·날마다 한 일과 쓴 글)을 PDF 파일로 저장해요';
    b.onclick = function () { download(); }; return b;
  }

  return { model: model, lines: lines, download: download, button: button, fileName: fileName, _build: buildPages, _toPdf: toPdf, _loadLibs: loadLibs, LIBS: LIBS };
})();
if (typeof module !== 'undefined' && module && module.exports) module.exports = ResultPdf;
if (typeof window !== 'undefined' && window) window.ResultPdf = ResultPdf;
