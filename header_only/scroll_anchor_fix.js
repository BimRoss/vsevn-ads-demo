(function () {
  'use strict';
  // v6 — element-anchor with DPR-ratio scaling.
  // v5 held the row's CSS-pixel offset constant, but the on-screen position of
  // a row equals cssTop * devicePixelRatio. On a zoom-invariant (vw) layout the
  // physical content size is constant, so to keep a row visually pinned we must
  // hold its PHYSICAL offset constant: newCssTop = oldCssTop * (oldDPR/newDPR).
  // Goal: on browser zoom the visible table rows must stay exactly where they
  // are. Ratio-based anchoring failed because the top nav header has a fixed
  // (px) height that does NOT scale with the vw-based table, so the scroll
  // fraction no longer maps to the same content. Instead we pin the top-most
  // visible row to its viewport offset and restore it once per zoom — no
  // continuous scrollBy loop, so the scrollbar does not drift on its own.
  if (window.__saiAnchor) { try { window.__saiAnchor.destroy(); } catch (e) {} }

  var anchorEl = null;
  var anchorTop = 0;
  var locked = false;
  var lastDPR = window.devicePixelRatio || 1;
  var timers = [];

  // ── DEBUG LOG ──────────────────────────────────────────────────────────────
  // Set window.__saiDebug = false in console to mute.
  function dbg(label, data) {
    if (window.__saiDebug === false) return;
    var vp = window.visualViewport;
    var info = {
      t: performance.now().toFixed(1) + 'ms',
      dpr: (window.devicePixelRatio || 1).toFixed(3),
      vpScale: vp ? vp.scale.toFixed(3) : 'n/a',
      scrollY: window.scrollY.toFixed(1),
      locked: locked
    };
    if (data) Object.assign(info, data);
    console.log('[SAI] ' + label, info);
  }

  function rows() {
    var b = document.getElementById('adsTableBody');
    return b ? b.children : [];
  }

  // Remember the top-most visible row + its offset from the viewport top.
  // Never while a zoom is in progress (guarded by lock + devicePixelRatio).
  function capture() {
    if (locked) return;
    if ((window.devicePixelRatio || 1) !== lastDPR) return; // zoom-induced scroll
    var list = rows();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    for (var i = 0; i < list.length; i++) {
      var r = list[i].getBoundingClientRect();
      if (r.bottom > 1 && r.top < vh) {
        anchorEl = list[i];
        anchorTop = r.top;
        dbg('capture', { rowIndex: i, rowTop: r.top.toFixed(1) });
        return;
      }
    }
    anchorEl = null;
  }

  function correct() {
    if (!anchorEl || !anchorEl.isConnected) return;
    var nd = window.devicePixelRatio || 1;
    // anchorTop was measured at lastDPR; rescale to keep the physical position.
    var target = anchorTop * (lastDPR / nd);
    var actual = anchorEl.getBoundingClientRect().top;
    var diff = actual - target;
    dbg('correct', {
      lastDPR: lastDPR.toFixed(3),
      newDPR: nd.toFixed(3),
      anchorTop: anchorTop.toFixed(1),
      target: target.toFixed(1),
      actual: actual.toFixed(1),
      diff: diff.toFixed(1),
      willScroll: Math.abs(diff) > 0.5
    });
    if (Math.abs(diff) > 0.5) window.scrollBy(0, diff);
  }

  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  // Called on any zoom intent (resize / visualViewport / Ctrl+wheel / Ctrl+/-).
  function beginZoom(source) {
    dbg('beginZoom ▶', { source: source || '?', lastDPR: lastDPR.toFixed(3), newDPR: (window.devicePixelRatio || 1).toFixed(3) });
    locked = true;            // freeze capture immediately (keep pre-zoom anchor)
    clearTimers();
    requestAnimationFrame(function () {
      correct();
      // text_zoom_fix.js re-adjusts --fsm at ~50/150ms which changes row
      // heights; re-pin the same row after those late reflows.
      [150, 320].forEach(function (t) {
        timers.push(setTimeout(function() {
          dbg('correct@' + t + 'ms (late reflow)');
          correct();
        }, t));
      });
      timers.push(setTimeout(function () {
        lastDPR = window.devicePixelRatio || 1;
        locked = false;
        dbg('unlock', { lastDPR: lastDPR.toFixed(3) });
      }, 380));
    });
  }

  // A resize / visualViewport-resize is only a *zoom* when devicePixelRatio
  // actually changes. At fractional zoom (e.g. 175%) plain wheel scrolling
  // fires spurious visualViewport resizes with an UNCHANGED dpr; treating those
  // as zoom made correct() yank the scroll back to the anchor — the upward jerk.
  // Gate the resize path on a real dpr change so scrolling never re-pins.
  function maybeZoomFromResize(src) {
    var nd = window.devicePixelRatio || 1;
    if (nd === lastDPR) {
      dbg('resize IGNORED (dpr unchanged)', { src: src, dpr: nd.toFixed(3) });
      return; // scroll/chrome resize, not zoom
    }
    dbg('resize → zoom detected', { src: src, oldDPR: lastDPR.toFixed(3), newDPR: nd.toFixed(3) });
    beginZoom(src);
  }

  window.addEventListener('scroll', capture, { passive: true });
  window.addEventListener('resize', function() { maybeZoomFromResize('window.resize'); });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function() { maybeZoomFromResize('visualViewport.resize'); });
  }
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) &&
        (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
      dbg('keydown zoom', { key: e.key });
      beginZoom('keydown');
    }
  });
  document.addEventListener('wheel', function (e) {
    if (e.ctrlKey) {
      dbg('wheel zoom', { deltaY: e.deltaY });
      beginZoom('ctrl+wheel');
    }
  }, { passive: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', capture);
  } else {
    capture();
  }

  window.__saiAnchor = { mode: 'v6-element-dpr', destroy: function () {
    clearTimers();
    window.removeEventListener('scroll', capture);
    window.removeEventListener('resize', maybeZoomFromResize);
    if (window.visualViewport) window.visualViewport.removeEventListener('resize', maybeZoomFromResize);
  } };

  console.log('[SAI] scroll_anchor_fix v6-debug loaded. dpr=' + lastDPR + '. Mute with: window.__saiDebug = false');
})();
