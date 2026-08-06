// Figma → code seam. Drives the panel that replaced the hyperspace warp: as the
// sticky section scrolls, each Figma layer row dims and fires a packet down the
// rail; the packet lands on the matching code line, which then wipes in.
//
// Two constraints shape this file:
//  - The panel is injected with dangerouslySetInnerHTML, so React can swap the
//    nodes out during hydration. References are re-acquired when they go stale.
//  - The page is already running a heavy WebGL scene, so the loop reads layout
//    at most once per frame (one getBoundingClientRect) and writes nothing but
//    transform / opacity / clip-path. It idles completely when off-screen.
(function () {
  'use strict';

  var STAGGER = 0.1;    // progress offset between consecutive rows
  var SPAN = 0.5;       // progress a single row->line handoff occupies

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ease(t) { return t * t * (3 - 2 * t); }   // smoothstep

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

  var refs = null;
  var visible = true;
  var observer = null;
  var last = -1;
  var prev = [];

  function observe(r) {
    if (observer) observer.disconnect();
    observer = new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
    }, { rootMargin: '200px 0px' });
    observer.observe(r.track);
  }

  function render(r, progress) {
    for (var i = 0; i < r.rows.length; i++) {
      var p = ease(clamp01((progress - i * STAGGER) / SPAN));
      if (prev[i] !== undefined && Math.abs(prev[i] - p) < 0.002) continue;
      prev[i] = p;

      // the source row settles back rather than vanishing — it stays the origin
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

      // code wipes in behind the packet
      var reveal = clamp01((p - 0.34) / 0.5);
      r.srcs[i].style.clipPath = 'inset(0 ' + ((1 - reveal) * 100).toFixed(2) + '% 0 0)';
      if (r.gutters[i]) r.gutters[i].style.opacity = clamp01((p - 0.3) / 0.3).toFixed(3);
    }
  }

  function frame() {
    requestAnimationFrame(frame);

    if (!refs || !refs.rows[0].isConnected) {
      refs = acquire();
      last = -1;
      prev = [];
      if (!refs) return;
      observe(refs);
      align(refs);
    }
    if (!visible) return;

    var rect = refs.track.getBoundingClientRect();          // the only layout read
    var range = rect.height - window.innerHeight;
    var progress = range > 0 ? clamp01(-rect.top / range) : 0;
    if (Math.abs(progress - last) < 0.0004) return;
    last = progress;
    render(refs, progress);
  }

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { if (refs) { align(refs); prev = []; last = -1; } }, 150);
  });

  requestAnimationFrame(frame);
})();
