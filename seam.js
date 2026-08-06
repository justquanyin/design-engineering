// Figma → code seam. Drives the panel that replaced the hyperspace warp: each
// Figma layer row dims and fires a packet down the rail; the packet lands on the
// matching code line, which then wipes in.
//
// Scroll maps to a damped value rather than driving the frame directly — raw
// scroll mapping felt notchy, especially against the WebGL scene's frame budget.
// Hovering the panel runs the same transition to completion, so the payoff does
// not depend on finding the right scroll position.
//
// Two constraints shape this file:
//  - The panel is injected with dangerouslySetInnerHTML, so React can swap the
//    nodes out during hydration. References are re-acquired when they go stale.
//  - The loop reads layout at most once per frame (one getBoundingClientRect) and
//    writes nothing but transform / opacity / clip-path. It idles when off-screen.
(function () {
  'use strict';

  var LEAD = 0.12;      // scroll spent holding the default state before anything moves
  var TAIL = 0.16;      // scroll left settled at the end, before the next section
  var STAGGER = 0.09;   // progress offset between consecutive rows
  var SPAN = 0.55;      // progress a single row->line handoff occupies
  var EASE_IN = 0.14;   // damping toward the scroll target
  var HOVER_EASE = 0.09;

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smooth(t) { return t * t * (3 - 2 * t); }

  function acquire() {
    var seam = document.querySelector('.seam');
    if (!seam || !seam.isConnected) return null;
    var rows = [].slice.call(seam.querySelectorAll('.seam__row'));
    var beams = [].slice.call(seam.querySelectorAll('.seam__beam i'));
    var gutters = [].slice.call(seam.querySelectorAll('.seam__gutter'));
    var srcs = [].slice.call(seam.querySelectorAll('.seam__src'));
    var gap = seam.querySelector('.seam__gap');
    var sticky = seam.closest('.seam-stage');
    var track = sticky && sticky.parentElement;
    if (!rows.length || !track || !gap || rows.length !== srcs.length) return null;
    return { seam: seam, rows: rows, beams: beams, gutters: gutters, srcs: srcs, gap: gap, track: track };
  }

  // The packet column has to line up with the layer rows, but its offset depends on
  // the panel's border/padding/head metrics. Measure it instead of hard-coding — once
  // here and again on resize, never in the animation loop.
  function align(r) {
    var gapTop = r.gap.getBoundingClientRect().top;
    var rowTop = r.rows[0].getBoundingClientRect().top;
    r.seam.style.setProperty('--seam-beam-offset', Math.round(rowTop - gapTop) + 'px');
  }

  var canHover = !window.matchMedia || window.matchMedia('(hover: hover)').matches;
  var refs = null;
  var visible = true;
  var observer = null;
  var shown = 0;        // damped value actually rendered
  var hover = 0;        // damped hover contribution
  var hoverTarget = 0;
  var painted = -1;

  function bind(r) {
    if (!canHover) return;
    r.seam.addEventListener('pointerenter', function () { hoverTarget = 1; });
    r.seam.addEventListener('pointerleave', function () { hoverTarget = 0; });
  }

  function observe(r) {
    if (observer) observer.disconnect();
    observer = new IntersectionObserver(function (e) { visible = e[0].isIntersecting; },
      { rootMargin: '200px 0px' });
    observer.observe(r.track);
  }

  function render(r, progress) {
    for (var i = 0; i < r.rows.length; i++) {
      var p = smooth(clamp01((progress - i * STAGGER) / SPAN));

      r.rows[i].style.transform = 'translate3d(' + (p * 7).toFixed(1) + 'px,0,0)';
      r.rows[i].style.opacity = (1 - 0.72 * p).toFixed(3);

      // packet: a comet whose head runs ahead of its tail, then closes up
      var beam = r.beams[i];
      if (beam) {
        var head = clamp01(p / 0.72);
        var tail = clamp01((p - 0.28) / 0.72);
        var w = head - tail;
        beam.style.transform = 'translate3d(' + (tail * 100).toFixed(2) + '%,0,0) scaleX(' + w.toFixed(3) + ')';
        beam.style.opacity = (w > 0.01 ? Math.min(1, w * 3.2) : 0).toFixed(3);
      }

      var reveal = clamp01((p - 0.34) / 0.5);
      r.srcs[i].style.clipPath = 'inset(0 ' + ((1 - reveal) * 100).toFixed(2) + '% 0 0)';
      if (r.gutters[i]) r.gutters[i].style.opacity = clamp01((p - 0.3) / 0.3).toFixed(3);
    }
  }

  function frame() {
    requestAnimationFrame(frame);

    if (!refs || !refs.rows[0].isConnected) {
      refs = acquire();
      painted = -1;
      if (!refs) return;
      observe(refs);
      align(refs);
      bind(refs);
    }
    if (!visible) return;

    var rect = refs.track.getBoundingClientRect();          // the only layout read
    var range = rect.height - window.innerHeight;
    var raw = range > 0 ? clamp01(-rect.top / range) : 0;

    // hold the default state on the way in, and stay settled on the way out
    var target = clamp01((raw - LEAD) / (1 - LEAD - TAIL));

    hover += (hoverTarget - hover) * HOVER_EASE;
    shown += (Math.max(target, hover) - shown) * EASE_IN;

    if (Math.abs(shown - painted) < 0.0008) return;
    painted = shown;
    render(refs, shown);
  }

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { if (refs) { align(refs); painted = -1; } }, 150);
  });

  requestAnimationFrame(frame);
})();
