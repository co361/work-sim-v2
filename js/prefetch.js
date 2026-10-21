/* Public-shell prefetch. Native character/kit assets are loaded by office.html
   after roster selection; legacy model/animation downloads are deliberately absent.
   Exact versioned script/style URLs come from the public play.html, without running
   its scripts or accessing protected scenario data. stop() aborts this run only. */
(function (global) {
  'use strict';

  var WS = global.WS = global.WS || {};

  /* play.html 이 실제로 부르는 코드·데이터 */
  var CODE_FILES = [
    // Runtime-inserted backend script and assets whose URLs are shared by play.
    'js/backend.js', 'assets/wall/lake.webp?v=3',
    'assets/appicon/mail.webp?v=3', 'assets/appicon/messenger.webp?v=3',
    'assets/appicon/talk.webp?v=3', 'assets/appicon/clock.webp?v=3',
    'assets/appicon/book.webp?v=3', 'assets/appicon/log.webp?v=3',
    'assets/appicon/note.webp?v=3', 'assets/appicon/org.webp?v=3',
    'assets/appicon/memo.webp?v=3', 'assets/appicon/finish.webp?v=3',
    'assets/appicon/sheet.webp?v=3'
  ];

  var S = {
    running: false, mode: '', done: 0, total: 0, failed: 0, bytes: 0,
    label: '', id: 0, ctl: null, onProgress: null, finishedAt: 0
  };

  // The fixed native roster no longer loads the legacy rigged/animation files.
  // Before team/player selection, warm only the public shell and its exact URLs.
  // Derive versioned script/style URLs from play.html so cache keys cannot drift.
  function buildList(signal) {
    return fetch('play.html', signal ? {signal: signal} : {}).then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      return r.text();
    }).then(function (html) {
      var base = new URL('play.html', global.location.href);
      var prefix = new URL('./', base).pathname;
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var jobs = CODE_FILES.map(function (p) { return new URL(p, base).href; });
      doc.querySelectorAll('script[src],link[rel="stylesheet"][href]').forEach(function (el) {
        var url = new URL(el.getAttribute('src') || el.getAttribute('href'), base);
        if (url.origin === base.origin && url.pathname.indexOf(prefix) === 0 &&
            /\.(?:js|css)$/.test(url.pathname) && url.pathname.indexOf('/data/') < 0) jobs.push(url.href);
      });
      return Array.from(new Set(jobs));
    });
  }

  function active(id) { return S.running && S.id === id; }
  function fetchOne(url, id, signal) {
    return fetch(url, signal ? {signal: signal} : {}).then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      return r.arrayBuffer();
    }).then(function (buf) {
      if (!active(id)) return;
      S.bytes += (buf && buf.byteLength) || 0; S.done++; report();
    }).catch(function (e) {
      if (!active(id) || (e && e.name === 'AbortError')) return;
      S.failed++; S.done++; report();
    });
  }

  function report() {
    if (typeof S.onProgress === 'function') {
      try { S.onProgress(S.total ? (S.done / S.total) : 0, S.done, S.total, S.bytes); } catch (e) {}
    }
  }

  function runQueue(jobs, conc, id, signal) {
    var i = 0;
    function next() {
      if (!active(id) || i >= jobs.length) return Promise.resolve();
      var url = jobs[i++];
      return fetchOne(url, id, signal).then(next);
    }
    var lanes = [];
    for (var n = 0; n < conc; n++) lanes.push(next());
    return Promise.all(lanes);
  }

  var Prefetch = {

    /* opts = {team, mode:'full'|'light', onProgress(ratio, done, total, bytes)} */
    start: function (opts) {
      opts = opts || {};
      if (S.running) return Promise.resolve(Prefetch.status());
      var mode = 'light'; // 'full' remains a compatible input; obsolete models are never fetched.

      S.running = true; S.mode = mode; S.done = 0; S.total = 0; S.failed = 0; S.bytes = 0;
      S.onProgress = opts.onProgress || null;
      S.ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var id = ++S.id, signal = S.ctl && S.ctl.signal;

      return buildList(signal).then(function (jobs) {
        if (!active(id)) return Prefetch.status();
        S.total = jobs.length;
        report();
        return runQueue(jobs, 3, id, signal).then(function () {
          if (!active(id)) return Prefetch.status();
          S.running = false; S.finishedAt = Date.now();
          report();
          return Prefetch.status();
        });
      }).catch(function () {
        if (!active(id)) return Prefetch.status();
        S.running = false;
        return Prefetch.status();
      });
    },

    /* 사용자가 게임을 시작하면 대역폭을 즉시 비켜 준다 */
    stop: function () {
      S.running = false; S.id++;
      if (S.ctl) { try { S.ctl.abort(); } catch (e) {} }
      return Prefetch.status();
    },

    status: function () {
      return {
        running: S.running, mode: S.mode, done: S.done, total: S.total,
        failed: S.failed, bytes: S.bytes,
        ratio: S.total ? (S.done / S.total) : 0,
        finishedAt: S.finishedAt
      };
    }
  };

  WS.prefetch = Prefetch;
})(typeof window !== 'undefined' ? window : this);
