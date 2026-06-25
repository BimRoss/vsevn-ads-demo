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
      if (r.bottom > 1 && r.top < vh) { anchorEl = list[i]; anchorTop = r.top; return; }
    }
    anchorEl = null;
  }

  function correct() {
    if (!anchorEl || !anchorEl.isConnected) return;
    var nd = window.devicePixelRatio || 1;
    // anchorTop was measured at lastDPR; rescale to keep the physical position.
    var target = anchorTop * (lastDPR / nd);
    var diff = anchorEl.getBoundingClientRect().top - target;
    if (Math.abs(diff) > 0.5) window.scrollBy(0, diff);
  }

  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  // Called on any zoom intent (resize / visualViewport / Ctrl+wheel / Ctrl+/-).
  function beginZoom() {
    locked = true;            // freeze capture immediately (keep pre-zoom anchor)
    clearTimers();
    requestAnimationFrame(function () {
      correct();
      // text_zoom_fix.js re-adjusts --fsm at ~50/150ms which changes row
      // heights; re-pin the same row after those late reflows.
      [150, 320].forEach(function (t) { timers.push(setTimeout(correct, t)); });
      timers.push(setTimeout(function () {
        lastDPR = window.devicePixelRatio || 1;
        locked = false;
      }, 380));
    });
  }

  // A resize / visualViewport-resize is only a *zoom* when devicePixelRatio
  // actually changes. At fractional zoom (e.g. 175%) plain wheel scrolling
  // fires spurious visualViewport resizes with an UNCHANGED dpr; treating those
  // as zoom made correct() yank the scroll back to the anchor — the upward jerk.
  // Gate the resize path on a real dpr change so scrolling never re-pins.
  function maybeZoomFromResize() {
    if ((window.devicePixelRatio || 1) === lastDPR) return; // scroll/chrome resize, not zoom
    beginZoom();
  }

  window.addEventListener('scroll', capture, { passive: true });
  window.addEventListener('resize', maybeZoomFromResize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', maybeZoomFromResize);
  }
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) &&
        (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
      beginZoom();
    }
  });
  document.addEventListener('wheel', function (e) {
    if (e.ctrlKey) beginZoom();
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
})();
