/*!
 * GeniusCFO animated logo — "The Answer"
 * Vanilla JS, no dependencies. Animates the inline SVG markup in place.
 *
 * The markup already renders the finished logo. This file only moves it, so
 * with JavaScript disabled, before hydration, or under prefers-reduced-motion,
 * the correct static logo is what the user sees.
 *
 * Usage
 *   Put the inline SVG inside an element carrying data-gcfo-logo, then from a
 *   module script:
 *
 *     import { mountLogo } from './geniuscfo-logo-animation.js';
 *     document.querySelectorAll('[data-gcfo-logo]').forEach((el) => mountLogo(el));
 */

/* ---------------------------------------------------------------- *
 * Geometry. Native coordinate space is the logo's own 240 x 52 grid.
 * ---------------------------------------------------------------- */

export const GEO = {
  cx: 26,
  cy: 26,
  handLength: 18,
  riseLength: 12,
  pivotRadius: 2.5,
  arcFraction: 216.9 / 360, // 0.6025
};

/* ---------------------------------------------------------------- *
 * Easing — four curves, no more.
 * ---------------------------------------------------------------- */

export function cubicBezier(p1x, p1y, p2x, p2y) {
  const A = (a, b) => 1 - 3 * b + 3 * a;
  const B = (a, b) => 3 * b - 6 * a;
  const C = (a) => 3 * a;
  const calc = (t, a, b) => ((A(a, b) * t + B(a, b)) * t + C(a)) * t;
  const slope = (t, a, b) => 3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a);
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const s = slope(t, p1x, p2x);
      if (s === 0) break;
      t -= (calc(t, p1x, p2x) - x) / s;
    }
    return calc(t, p1y, p2y);
  };
}

export const EASE = {
  linear: (x) => x,
  snap: cubicBezier(0.2, 0.9, 0.25, 1),
  enter: cubicBezier(0.16, 1, 0.3, 1),
  travel: cubicBezier(0.4, 0, 0.6, 1),
  resolve: cubicBezier(0.05, 0.86, 0.12, 1),
};

/* ---------------------------------------------------------------- *
 * Timeline, in seconds.
 * ---------------------------------------------------------------- */

export const TIMING = {
  pivotIn: [0.0, 0.16],
  pulse: [0.16, 0.44],
  pulseAmount: 0.42,
  ghostIn: [0.2, 0.52],
  ringIn: [0.3, 0.4],
  travel: [0.34, 1.34],
  revolutions: 2,
  segment: 0.13,
  resolve: [1.34, 1.8],
  hand: [1.76, 1.94],
  rise: [1.92, 2.12],
  word: { start: 1.96, duration: 0.4, stagger: 0.026 },
  duration: 2.6,
};

const WORD_RISE = 20;
const LETTERS = 9;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const span = (t, a, b, ease) => (ease || EASE.linear)(clamp01((t - a) / (b - a)));

/**
 * The whole animation as a function of time in seconds. Past TIMING.duration
 * this returns the settled state, which is the static logo exactly.
 */
export function logoStateAt(t) {
  const T = TIMING;
  const pivotIn = span(t, T.pivotIn[0], T.pivotIn[1], EASE.snap);
  const pulse =
    t > T.pulse[0] && t < T.pulse[1]
      ? Math.sin(((t - T.pulse[0]) / (T.pulse[1] - T.pulse[0])) * Math.PI) *
        T.pulseAmount
      : 0;

  let tail, lead, settle;
  if (t < T.resolve[0]) {
    const u = span(t, T.travel[0], T.travel[1], EASE.travel);
    tail = T.revolutions * u;
    lead = tail + T.segment;
    settle = 0;
  } else {
    const v = span(t, T.resolve[0], T.resolve[1], EASE.resolve);
    tail = T.revolutions;
    lead = T.revolutions + T.segment + (GEO.arcFraction - T.segment) * v;
    settle = span(t, T.resolve[0], T.resolve[1]);
  }
  const length = Math.max(0, lead - tail);

  const hand = span(t, T.hand[0], T.hand[1], EASE.snap);
  const rise = span(t, T.rise[0], T.rise[1], EASE.snap);

  const letters = [];
  for (let i = 0; i < LETTERS; i++) {
    const from = T.word.start + i * T.word.stagger;
    letters.push(span(t, from, from + T.word.duration, EASE.enter));
  }

  return {
    pivotR: GEO.pivotRadius * (0.3 + 0.7 * pivotIn) * (1 + pulse),
    pivotOpacity: pivotIn,
    ghostOpacity: span(t, T.ghostIn[0], T.ghostIn[1]),
    ringOpacity: span(t, T.ringIn[0], T.ringIn[1]),
    ringDashArray: length + ' ' + Math.max(0.0001, 1 - length),
    ringDashOffset: -tail,
    ringSettle: settle,
    handOpacity: hand > 0 ? 1 : 0,
    handX2: GEO.cx + GEO.handLength * hand,
    riseOpacity: rise > 0 ? 1 : 0,
    riseY2: GEO.cy - GEO.riseLength * rise,
    letters,
  };
}

/**
 * The waiting state on its own — the segment travelling at a constant rate,
 * seamlessly loopable. Use for an in-product "working on it" indicator, never
 * as a page header. `period` is seconds per revolution.
 */
export function waitingStateAt(t, period) {
  const settled = logoStateAt(TIMING.duration);
  const len = TIMING.segment;
  return Object.assign({}, settled, {
    ringOpacity: 1,
    ringDashArray: len + ' ' + (1 - len),
    ringDashOffset: -((t / (period || 1.1)) % 1),
    ringSettle: 0,
    handOpacity: 0,
    handX2: GEO.cx,
    riseOpacity: 0,
    riseY2: GEO.cy,
  });
}

export function mixHex(from, to, u) {
  const p = (c) => [
    parseInt(c.slice(1, 3), 16),
    parseInt(c.slice(3, 5), 16),
    parseInt(c.slice(5, 7), 16),
  ];
  const a = p(from);
  const b = p(to);
  return (
    '#' +
    a
      .map((v, i) =>
        Math.round(v + (b[i] - v) * clamp01(u))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

/* ---------------------------------------------------------------- *
 * Mounting
 * ---------------------------------------------------------------- */

const DEFAULTS = {
  /** 'sequence' plays once and rests on the logo. 'waiting' loops forever. */
  mode: 'sequence',
  /** Play as soon as the logo is at least 45% visible. Once, not on re-entry. */
  autoplay: true,
  /** Colour the travelling segment starts as, before it settles to the stroke. */
  signal: '#00a87c',
  /** Colour the arc rests at. Read from the markup when not given. */
  stroke: null,
  /** Seconds per revolution in 'waiting' mode. */
  period: 1.1,
  /** Skip the animation entirely and leave the static logo. */
  respectReducedMotion: true,
};

export function mountLogo(host, options) {
  const opts = Object.assign({}, DEFAULTS, options);
  const svg = host.tagName === 'svg' ? host : host.querySelector('svg');
  if (!svg) return null;

  const n = {
    ghost: svg.querySelector('.gcfo-ghost'),
    ring: svg.querySelector('.gcfo-ring'),
    hand: svg.querySelector('.gcfo-hand'),
    rise: svg.querySelector('.gcfo-rise'),
    pivot: svg.querySelector('.gcfo-pivot'),
    letters: Array.prototype.slice.call(svg.querySelectorAll('.gcfo-ltr')),
  };
  if (!n.ring) return null;

  const stroke =
    opts.stroke || n.ring.getAttribute('stroke') || '#0b0f1a';

  // The markup ships with a fixed clipPath id so it renders correctly on its
  // own. More than one copy on a page would collide, so re-id on mount.
  const clip = svg.querySelector('clipPath');
  if (clip) {
    const uid = 'gcfoWordClip-' + (mountLogo._n = (mountLogo._n || 0) + 1);
    const oldRef = 'url(#' + clip.id + ')';
    clip.id = uid;
    Array.prototype.forEach.call(svg.querySelectorAll('[clip-path]'), (el) => {
      if (el.getAttribute('clip-path') === oldRef) {
        el.setAttribute('clip-path', 'url(#' + uid + ')');
      }
    });
  }

  const reduced =
    opts.respectReducedMotion &&
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  const apply = (s) => {
    n.pivot.setAttribute('r', s.pivotR.toFixed(3));
    n.pivot.style.opacity = s.pivotOpacity;
    n.ghost.style.opacity = s.ghostOpacity;
    n.ring.style.opacity = s.ringOpacity;
    n.ring.setAttribute('stroke-dasharray', s.ringDashArray);
    n.ring.setAttribute('stroke-dashoffset', s.ringDashOffset.toFixed(5));
    n.ring.setAttribute('stroke', mixHex(opts.signal, stroke, s.ringSettle));
    n.hand.style.opacity = s.handOpacity;
    n.hand.setAttribute('x2', s.handX2.toFixed(3));
    n.rise.style.opacity = s.riseOpacity;
    n.rise.setAttribute('y2', s.riseY2.toFixed(3));
    for (let i = 0; i < n.letters.length; i++) {
      const u = s.letters[i] === undefined ? 1 : s.letters[i];
      n.letters[i].setAttribute(
        'transform',
        'translate(0 ' + ((1 - u) * WORD_RISE).toFixed(3) + ')',
      );
      n.letters[i].style.opacity = u < 0.001 ? 0 : 1;
    }
  };

  const settled = () => apply(logoStateAt(TIMING.duration));

  let raf = 0;
  let t0 = 0;

  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };

  const frame = (now) => {
    const t = (now - t0) / 1000;
    if (opts.mode === 'waiting') {
      apply(waitingStateAt(t, opts.period));
      raf = requestAnimationFrame(frame);
      return;
    }
    if (t >= TIMING.duration) {
      settled();
      raf = 0;
      return;
    }
    apply(logoStateAt(t));
    raf = requestAnimationFrame(frame);
  };

  const play = () => {
    if (reduced) return settled();
    stop();
    t0 = performance.now();
    raf = requestAnimationFrame(frame);
  };

  const seek = (t) => {
    stop();
    apply(opts.mode === 'waiting' ? waitingStateAt(t, opts.period) : logoStateAt(t));
  };

  const api = { play, stop, seek, settle: settled, element: svg };

  if (reduced) {
    settled();
    return api;
  }

  if (opts.autoplay) {
    if (typeof IntersectionObserver === 'function') {
      // Hold the first frame until it is actually on screen, so the animation
      // is never spent above the fold before anyone sees it.
      seek(0);
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (!e.isIntersecting) return;
            io.disconnect();
            play();
          });
        },
        { threshold: 0.45 },
      );
      io.observe(svg);
      api.stop = () => {
        io.disconnect();
        stop();
      };
    } else {
      play();
    }
  } else {
    settled();
  }

  return api;
}

export default mountLogo;
