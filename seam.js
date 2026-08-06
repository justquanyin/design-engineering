// Figma → code seam. Drives the panel that replaced the hyperspace warp:
// as the sticky section scrolls, each Figma layer row slides across the rail and
// hands off to its code line. Pure DOM/CSS — it only writes inline styles onto
// nodes React already rendered, so there is nothing for hydration to disagree with.
//
// The panel is injected with dangerouslySetInnerHTML, which means React can swap the
// nodes out from under us during hydration. So references are re-acquired whenever
// they go stale instead of being captured once.
(function () {
  'use strict';

  var STAGGER = 0.075;   // progress offset between consecutive rows
  var SPAN = 0.44;       // how much progress one row's crossing takes

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function reduced() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function acquire() {
    var seam = document.querySelector('.seam');
    if (!seam || !seam.isConnected) return null;
    var rows = [].slice.call(seam.querySelectorAll('.seam__row'));
    var lines = [].slice.call(seam.querySelectorAll('.seam__line'));
    var spark = seam.querySelector('.seam__spark');
    var gap = seam.querySelector('.seam__gap');
    var sticky = seam.closest('.seam-stage');
    var track = sticky && sticky.parentElement;
    if (!rows.length || rows.length !== lines.length || !spark || !gap || !track) return null;
    return { rows: rows, lines: lines, spark: spark, gap: gap, track: track };
  }

  var refs = null;
  var last = -1;

  function render(r, progress) {
    // on wide layouts the rail runs vertically between the panels; stacked, it runs across
    var horizontal = r.gap.offsetHeight > r.gap.offsetWidth;
    var travel = horizontal ? r.gap.offsetWidth + 30 : 0;
    var drop = horizontal ? 0 : r.gap.offsetHeight + 20;

    for (var i = 0; i < r.rows.length; i++) {
      var p = easeInOut(clamp01((progress - i * STAGGER) / SPAN));

      var out = clamp01((p - 0.45) / 0.55);
      r.rows[i].style.transform = 'translate3d(' + (p * travel).toFixed(2) + 'px,'
        + (p * drop).toFixed(2) + 'px,0) scaleX(' + (1 - 0.28 * out).toFixed(3) + ')';
      r.rows[i].style.opacity = (1 - out).toFixed(3);

      var inn = clamp01((p - 0.4) / 0.6);
      r.lines[i].style.opacity = inn.toFixed(3);
      r.lines[i].style.transform = 'translate3d(' + ((1 - inn) * -14).toFixed(2) + 'px,0,0)';
    }

    var sp = clamp01((progress - 0.05) / 0.8);
    r.spark.style.opacity = sp > 0.02 && sp < 0.98 ? '1' : '0';
    r.spark.style.transform = horizontal
      ? 'translateY(' + (sp * r.gap.offsetHeight).toFixed(1) + 'px)'
      : 'translate(' + (sp * r.gap.offsetWidth).toFixed(1) + 'px,0)';
  }

  function settle(r) {
    for (var i = 0; i < r.rows.length; i++) {
      r.rows[i].style.opacity = '0';
      r.lines[i].style.opacity = '1';
      r.lines[i].style.transform = 'none';
    }
    r.spark.style.opacity = '0';
  }

  function frame() {
    if (!refs || !refs.rows[0].isConnected) {
      refs = acquire();
      last = -1;
    }
    if (refs) {
      if (reduced()) {
        settle(refs);
      } else {
        var rect = refs.track.getBoundingClientRect();
        var range = rect.height - window.innerHeight;
        var progress = range > 0 ? clamp01(-rect.top / range) : 0;
        if (Math.abs(progress - last) > 0.0005) {
          last = progress;
          render(refs, progress);
        }
      }
    }
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
