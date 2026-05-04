;(function () {
  // Flame flicker: 1500ms (bottom first, top last). Text always visible. Hold 2s minimum.
  var MIN_INTRO_MS       = 2000;
  var ANIM_SIGNAL_MAX_MS = 4500;
  var HARD_MAX_MS        = 15000;
  var REDUCED_MOTION_MS  = 500;

  function withTimeout(promise, ms) {
    return new Promise(function (resolve) {
      var t = setTimeout(function () { resolve('timeout'); }, ms);
      promise.then(function (v) { clearTimeout(t); resolve(v); },
                   function ()  { clearTimeout(t); resolve('error'); });
    });
  }

  function dismiss(root) {
    if (!root || root.getAttribute('data-dismissed') === '1') return;
    root.setAttribute('data-dismissed', '1');
    document.body.style.overflow = '';
    root.setAttribute('aria-busy', 'false');
    root.classList.add('site-preloader--done');
    var done = false;
    function remove() {
      if (done) return;
      done = true;
      if (root.parentNode) root.parentNode.removeChild(root);
    }
    root.addEventListener('transitionend', function (e) {
      if (e.propertyName === 'opacity') remove();
    });
    setTimeout(remove, 700);
  }

  // Expose so any other script can force-dismiss (e.g. error boundary)
  window.__dismissPreloader = function () {
    dismiss(document.getElementById('site-preloader'));
  };

  function waitForAnimations(svg) {
    return new Promise(function (resolve) {
      var nodes = svg.querySelectorAll('.logo-mark');
      var total = nodes.length;
      var ended = 0;
      var settled = false;

      function finish() {
        if (settled) return;
        settled = true;
        resolve();
      }

      if (!total) {
        // SVG missing classes — fall back to max wait
        setTimeout(finish, ANIM_SIGNAL_MAX_MS);
        return;
      }

      for (var i = 0; i < nodes.length; i++) {
        (function (node) {
          var fired = false;
          function once() {
            if (fired) return;
            fired = true;
            ended++;
            if (ended >= total) finish();
          }
          node.addEventListener('animationend',       once);
          node.addEventListener('webkitAnimationEnd', once);
        })(nodes[i]);
      }
    });
  }

  function init() {
    var root = document.getElementById('site-preloader');
    if (!root) return;
    if (root.getAttribute('data-started') === '1') return;
    root.removeAttribute('data-dismissed');
    root.classList.remove('site-preloader--done');
    root.setAttribute('data-started', '1');

    document.body.style.overflow = 'hidden';

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTimeout(function () { dismiss(root); }, REDUCED_MOTION_MS);
      return;
    }

    var svg = root.querySelector('svg#icfp-logo');
    if (svg) {
      // Inject logo-anim-once so one-shot animations fire
      svg.classList.add('logo-anim-once');
    }

    var introDone = Promise.all([
      new Promise(function (resolve) { setTimeout(resolve, MIN_INTRO_MS); }),
      svg ? withTimeout(waitForAnimations(svg), ANIM_SIGNAL_MAX_MS)
          : Promise.resolve()
    ]);

    withTimeout(introDone, HARD_MAX_MS).then(function () { dismiss(root); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Dismiss immediately on bfcache restore (page already loaded)
  window.addEventListener('pageshow', function (ev) {
    if (!ev.persisted) return;
    var root = document.getElementById('site-preloader');
    if (root) dismiss(root);
  });
})();
