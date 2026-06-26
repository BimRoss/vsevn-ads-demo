(function () {
  'use strict';
  // v8 — pure-arithmetic scroll anchor.
  // After a zoom step (DPR: A → B), the correct scrollY is:
  //   newScrollY = capturedScrollY × (A / B)
  // This keeps the same physical content at the top of the viewport without
  // any DOM layout queries. Works correctly through rapid multi-step zoom.
  if (window.__saiAnchor) { try { window.__saiAnchor.destroy(); } catch (e) {} }

  var lastDPR = window.devicePixelRatio || 1;
  var capturedScrollY = window.scrollY;
  var locked = false;
  var timers = [];
  var zoomRafPending = false;

  // ── DEBUG LOG ──────────────────────────────────────────────────────────────
  // Mute with: window.__saiDebug = false
  function dbg(label, data) {
    if (window.__saiDebug === false) return;
    var info = {
      t: performance.now().toFixed(1) + 'ms',
      dpr: (window.devicePixelRatio || 1).toFixed(3),
      scrollY: window.scrollY.toFixed(1),
      locked: locked
    };
    if (data) Object.assign(info, data);
    console.log('[SAI] ' + label, info);
  }

  // Capture current scrollY as the anchor when not in a zoom transition.
  function capture() {
    if (locked) return;
    if ((window.devicePixelRatio || 1) !== lastDPR) return;
    capturedScrollY = window.scrollY;
    dbg('capture', { capturedScrollY: capturedScrollY.toFixed(1) });
  }

  // Compute and apply the correct scrollY for the current DPR.
  function correct() {
    var nd = window.devicePixelRatio || 1;
    if (nd === lastDPR) {
      dbg('correct (skip: dpr unchanged)');
      return;
    }
    var target = capturedScrollY * (lastDPR / nd);
    var diff = target - window.scrollY;
    dbg('correct', {
      lastDPR: lastDPR.toFixed(3),
      nd: nd.toFixed(3),
      captured: capturedScrollY.toFixed(1),
      target: target.toFixed(1),
      diff: diff.toFixed(1),
      willScroll: Math.abs(diff) > 0.5
    });
    if (Math.abs(diff) > 0.5) window.scrollTo(0, target);
  }

  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  // Called when DPR has actually changed (from resize events).
  // ctrl+wheel / keydown only pre-lock — correction waits for the real DPR change.
  function beginZoom(source) {
    locked = true;
    if (zoomRafPending) {
      dbg('beginZoom (deduped)', { source: source });
      return;
    }
    zoomRafPending = true;
    clearTimers();
    dbg('beginZoom ▶', {
      source: source,
      lastDPR: lastDPR.toFixed(3),
      newDPR: (window.devicePixelRatio || 1).toFixed(3)
    });
    requestAnimationFrame(function () {
      zoomRafPending = false;
      correct();
      // text_zoom_fix.js adjusts --fsm at ~50/150ms; re-check after reflow.
      [150, 320].forEach(function (t) {
        timers.push(setTimeout(function () {
          dbg('correct@' + t + 'ms');
          correct();
        }, t));
      });
      timers.push(setTimeout(function () {
        lastDPR = window.devicePixelRatio || 1;
        locked = false;
        capturedScrollY = window.scrollY; // re-anchor at new DPR
        dbg('unlock', { lastDPR: lastDPR.toFixed(3), capturedScrollY: capturedScrollY.toFixed(1) });
      }, 380));
    });
  }

  // Only treat resize as zoom when DPR actually changed.
  // Spurious resize events (plain scroll at fractional DPR) have unchanged DPR — ignore them.
  function maybeZoomFromResize(src) {
    var nd = window.devicePixelRatio || 1;
    if (nd === lastDPR) {
      dbg('resize IGNORED (dpr unchanged)', { src: src });
      return;
    }
    dbg('resize → zoom', { src: src, oldDPR: lastDPR.toFixed(3), newDPR: nd.toFixed(3) });
    beginZoom(src);
  }

  window.addEventListener('scroll', capture, { passive: true });
  window.addEventListener('resize', function () { maybeZoomFromResize('window.resize'); });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function () { maybeZoomFromResize('vp.resize'); });
  }

  // ctrl+wheel and keydown fire BEFORE the browser applies zoom.
  // We pre-lock immediately to prevent a stale capture mid-transition,
  // but do NOT queue a correction RAF — that waits for the resize event
  // which fires when DPR actually changes.
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) &&
        (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
      locked = true;
      dbg('keydown: pre-lock', { key: e.key });
    }
  });
  document.addEventListener('wheel', function (e) {
    if (e.ctrlKey) {
      locked = true;
      dbg('wheel: pre-lock');
    }
  }, { passive: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', capture);
  } else {
    capture();
  }

  window.__saiAnchor = { mode: 'v8-scrolly-ratio', destroy: function () {
    clearTimers();
    window.removeEventListener('scroll', capture);
    window.removeEventListener('resize', maybeZoomFromResize);
    if (window.visualViewport) window.visualViewport.removeEventListener('resize', maybeZoomFromResize);
  } };

  console.log('[SAI] scroll_anchor_fix v8 loaded. dpr=' + lastDPR.toFixed(3) + '. Mute: window.__saiDebug=false');
})();
