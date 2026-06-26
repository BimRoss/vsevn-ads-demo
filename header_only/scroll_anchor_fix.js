(function () {
  'use strict';
  // Block Ctrl+wheel and Ctrl+/- browser zoom on this page.
  // The layout is vw-based — it already adapts to viewport width at any
  // window size, so browser zoom adds no value and causes scroll-position
  // jitter (DPR change → full page reflow in CSS pixels).
  // This is consistent with the existing maximum-scale=1 viewport meta
  // that already blocks pinch-zoom on mobile.

  // Ctrl+scroll wheel
  window.addEventListener('wheel', function (e) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
    }
  }, { passive: false });

  // Ctrl+/- and Ctrl+0
  window.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) &&
        (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
      e.preventDefault();
    }
  });

  console.log('[SAI] zoom-block loaded — Ctrl+wheel and Ctrl+/- disabled');
})();
