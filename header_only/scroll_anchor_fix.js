(function () {
  'use strict';
  // v7 — deduplicated RAFs: only one RAF fires per zoom step regardless of how
  // many events (ctrl+wheel, window.resize, visualViewport.resize) arrive.
  if (window.__saiAnchor) { try { window.__saiAnchor.destroy(); } catch (e) {} }

  var anchorEl = null;
  var anchorTop = 0;
  var locked = false;
  var lastDPR = window.devicePixelRatio || 1;
  var timers = [];
  var zoomRafPending = false; // prevents duplicate RAFs per zoom step

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

  // Capture the top-most visible row and its distance from viewport top.
  // Skip while locked (zoom in progress) or DPR mismatch (spurious scroll).
  function capture() {
    if (locked) return;
    if ((window.devicePixelRatio || 1) !== lastDPR) return;
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

  // Scroll to restore the anchor row to its pre-zoom viewport position.
  // DPR-ratio scaling: the vw layout is zoom-invariant in physical pixels, so
  // the target CSS-pixel offset = pre-zoom CSS offset × (oldDPR / newDPR).
  function correct() {
    if (!anchorEl || !anchorEl.isConnected) return;
    var nd = window.devicePixelRatio || 1;
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

  // beginZoom — called from multiple event sources per zoom step.
  // Only the FIRST call queues a RAF; subsequent calls just keep the lock.
  // This prevents 3× correct() and 3× timer sets per zoom step.
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
      // text_zoom_fix.js adjusts --fsm at ~50/150ms, changing row heights.
      // Re-pin the row after those late reflows.
      [150, 320].forEach(function (t) {
        timers.push(setTimeout(function () {
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

  // Gate resize events: only treat as zoom when DPR actually changed.
  // At fractional zoom levels, plain scrolling fires spurious resize events
  // with unchanged DPR — we must ignore those to avoid yanking the scroll.
  function maybeZoomFromResize(src) {
    var nd = window.devicePixelRatio || 1;
    if (nd === lastDPR) {
      dbg('resize IGNORED (dpr unchanged)', { src: src, dpr: nd.toFixed(3) });
      return;
    }
    dbg('resize → zoom detected', { src: src, oldDPR: lastDPR.toFixed(3), newDPR: nd.toFixed(3) });
    beginZoom(src);
  }

  window.addEventListener('scroll', capture, { passive: true });
  window.addEventListener('resize', function () { maybeZoomFromResize('window.resize'); });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function () { maybeZoomFromResize('visualViewport.resize'); });
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

  window.__saiAnchor = { mode: 'v7-dedup-raf', destroy: function () {
    clearTimers();
    window.removeEventListener('scroll', capture);
    window.removeEventListener('resize', maybeZoomFromResize);
    if (window.visualViewport) window.visualViewport.removeEventListener('resize', maybeZoomFromResize);
  } };

  console.log('[SAI] scroll_anchor_fix v7 loaded. dpr=' + lastDPR + '. Mute: window.__saiDebug=false');
})();
