(function () {
  'use strict';
  // Zoom-stable scroll: custom overlay scrollbar + DPR-ratio scrollY correction.
  //
  // The native scrollbar is hidden because it reflects CSS scrollY, which
  // necessarily changes when DPR changes (zoom). The custom scrollbar is
  // frozen during the zoom transition so the user sees no movement.
  // After ~380ms the custom scrollbar snaps to the post-zoom position.

  // ── Custom overlay scrollbar ───────────────────────────────────────────────
  var SB_W = 6; // px, thumb width
  var SB_PAD = 3; // px, inset from edge

  var styleEl = document.createElement('style');
  styleEl.textContent = [
    'html { scrollbar-width: none !important; }',
    '::-webkit-scrollbar { display: none !important; }',
    '#__zsb {',
    '  position: fixed; right: ' + SB_PAD + 'px; top: 4px; bottom: 4px;',
    '  width: ' + SB_W + 'px; z-index: 2147483647; pointer-events: none;',
    '  border-radius: ' + SB_W + 'px; background: rgba(0,0,0,0.08);',
    '}',
    '#__zsb-t {',
    '  position: absolute; left: 0; right: 0;',
    '  background: rgba(0,0,0,0.38); border-radius: ' + SB_W + 'px;',
    '  min-height: 24px; will-change: top, height;',
    '}'
  ].join('\n');
  document.head.appendChild(styleEl);

  var sbTrack = document.createElement('div');
  sbTrack.id = '__zsb';
  var sbThumb = document.createElement('div');
  sbThumb.id = '__zsb-t';
  sbTrack.appendChild(sbThumb);
  // Append after DOM is ready
  function mountSb() { document.body && document.body.appendChild(sbTrack); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountSb);
  } else {
    mountSb();
  }

  var sbFrozen = false; // true during zoom transition

  function renderSb() {
    if (sbFrozen) return;
    var vh = window.innerHeight;
    var sh = Math.max(document.body ? document.body.scrollHeight : vh, vh + 1);
    var scrollable = sh - vh;
    var frac = scrollable > 0 ? Math.min(window.scrollY / scrollable, 1) : 0;
    var trackH = vh - 8; // 4px top + 4px bottom offset
    var thumbH = Math.max((vh / sh) * trackH, 24);
    var maxY = trackH - thumbH;
    sbThumb.style.top = (frac * maxY).toFixed(1) + 'px';
    sbThumb.style.height = thumbH.toFixed(1) + 'px';
  }

  window.addEventListener('scroll', renderSb, { passive: true });
  window.addEventListener('resize', renderSb);
  setTimeout(renderSb, 0);

  // ── Scroll anchor: correct scrollY on DPR change ───────────────────────────
  var lastDPR = window.devicePixelRatio || 1;
  var capturedScrollY = window.scrollY;
  var locked = false;
  var timers = [];
  var zoomRafPending = false;

  function capture() {
    if (locked) return;
    if ((window.devicePixelRatio || 1) !== lastDPR) return;
    capturedScrollY = window.scrollY;
  }

  function correct() {
    var nd = window.devicePixelRatio || 1;
    if (nd === lastDPR) return;
    var target = capturedScrollY * (lastDPR / nd);
    if (Math.abs(target - window.scrollY) > 0.5) window.scrollTo(0, target);
  }

  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  function beginZoom(source) {
    locked = true;
    sbFrozen = true; // freeze scrollbar immediately — no visual movement during zoom
    if (zoomRafPending) return;
    zoomRafPending = true;
    clearTimers();
    requestAnimationFrame(function () {
      zoomRafPending = false;
      correct();
      [150, 320].forEach(function (t) {
        timers.push(setTimeout(correct, t));
      });
      timers.push(setTimeout(function () {
        lastDPR = window.devicePixelRatio || 1;
        capturedScrollY = window.scrollY;
        locked = false;
        sbFrozen = false;
        renderSb(); // single update after zoom settles
      }, 380));
    });
  }

  function maybeZoomFromResize(src) {
    var nd = window.devicePixelRatio || 1;
    if (nd === lastDPR) return;
    beginZoom(src);
  }

  window.addEventListener('scroll', capture, { passive: true });
  window.addEventListener('resize', function () { maybeZoomFromResize('resize'); });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function () { maybeZoomFromResize('vp'); });
  }
  // Pre-lock on zoom intent (before DPR actually changes) so capture() doesn't grab mid-zoom scroll
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
      locked = true; sbFrozen = true;
    }
  });
  document.addEventListener('wheel', function (e) {
    if (e.ctrlKey) { locked = true; sbFrozen = true; }
  }, { passive: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', capture);
  } else {
    capture();
  }

  console.log('[SAI] zoom-stable loaded. dpr=' + lastDPR.toFixed(3));
})();
