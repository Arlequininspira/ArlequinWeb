/*
 * Carajo hero effects — TV / broadcast language:
 *  - halftoneLens: halftone dot field; a pair of "binocular" lenses follows the pointer and enlarges the dots
 *  - tiltLogo: perspective tilt + moving extrusion shadow + glare
 *  - glitch: RGB-split signal glitch (also used as a celebration)
 *  - powerOn: CRT switch-on intro
 *  - countUp: numeric tween for prices
 */
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function halftoneLens(canvas, area) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const STEP = 13;
  let w = 0, h = 0, dpr = 1;
  const target = { x: 0.68, y: 0.45, active: false };
  const lens = { x: 0.68, y: 0.45, open: 0 };
  let raf = 0, visible = true, t0 = performance.now();

  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = area.clientWidth;
    h = area.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    kick();
  };

  const draw = now => {
    raf = 0;
    const t = (now - t0) / 1000;
    if (!target.active) {
      // idle drift so touch devices still see the lenses
      target.x = 0.62 + Math.sin(t * 0.35) * 0.22;
      target.y = 0.48 + Math.sin(t * 0.53) * 0.16;
    }
    lens.x += (target.x - lens.x) * 0.08;
    lens.y += (target.y - lens.y) * 0.08;
    lens.open += ((reduce ? 0.8 : 1) - lens.open) * 0.05;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const R = Math.max(70, Math.min(w, h) * 0.2) * lens.open;
    const gap = R * 0.92;
    const cx = lens.x * w, cy = lens.y * h;
    const lx = cx - gap, rx = cx + gap;

    const base = new Path2D();
    const hot = new Path2D();
    for (let y = STEP / 2; y < h; y += STEP) {
      for (let x = STEP / 2; x < w; x += STEP) {
        const d = Math.min(Math.hypot(x - lx, y - cy), Math.hypot(x - rx, y - cy));
        const inLens = d < R;
        const wave = reduce ? 0 : Math.sin(x * 0.02 + y * 0.015 + t * 1.4) * 0.35;
        let r;
        if (inLens) {
          const k = 1 - d / R;
          r = 2.2 + k * 3.6 + wave;
          hot.moveTo(x + r, y);
          hot.arc(x, y, r, 0, Math.PI * 2);
        } else {
          r = 1.15 + wave * 0.6;
          if (r <= 0.2) continue;
          base.moveTo(x + r, y);
          base.arc(x, y, r, 0, Math.PI * 2);
        }
      }
    }
    ctx.fillStyle = 'rgba(205, 204, 226, 0.16)';
    ctx.fill(base);
    ctx.fillStyle = 'rgba(120, 140, 255, 0.85)';
    ctx.fill(hot);
    // lens rims
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(205, 204, 226, 0.45)';
    ctx.beginPath();
    ctx.arc(lx, cy, R, 0, Math.PI * 2);
    ctx.moveTo(rx + R, cy);
    ctx.arc(rx, cy, R, 0, Math.PI * 2);
    ctx.stroke();

    if (visible && !document.hidden && !reduce) raf = requestAnimationFrame(draw);
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(draw); };

  area.addEventListener('pointermove', e => {
    const r = area.getBoundingClientRect();
    target.x = (e.clientX - r.left) / r.width;
    target.y = (e.clientY - r.top) / r.height;
    target.active = e.pointerType === 'mouse';
    kick();
  }, { passive: true });
  area.addEventListener('pointerleave', () => (target.active = false));
  new ResizeObserver(resize).observe(area);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); }).observe(area);
  document.addEventListener('visibilitychange', kick);
  resize();
}

export function tiltLogo(wrap, zone = wrap) {
  if (reduce) return;
  const card = wrap.querySelector('.logo-3d');
  let raf = 0, tx = 0, ty = 0, x = 0, y = 0;
  const loop = () => {
    x += (tx - x) * 0.12;
    y += (ty - y) * 0.12;
    card.style.setProperty('--rx', `${(-y * 14).toFixed(2)}deg`);
    card.style.setProperty('--ry', `${(x * 18).toFixed(2)}deg`);
    card.style.setProperty('--sx', `${(-x * 22).toFixed(1)}px`);
    card.style.setProperty('--sy', `${(18 - y * 12).toFixed(1)}px`);
    card.style.setProperty('--gx', `${50 + x * 40}%`);
    raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.001 ? requestAnimationFrame(loop) : 0;
  };
  zone.addEventListener('pointermove', e => {
    const r = wrap.getBoundingClientRect();
    tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
    ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
    if (!raf) raf = requestAnimationFrame(loop);
  }, { passive: true });
  zone.addEventListener('pointerleave', () => {
    tx = ty = 0;
    if (!raf) raf = requestAnimationFrame(loop);
  });
}

export function glitch(el, ms = 650) {
  if (reduce) return;
  el.classList.remove('is-glitch');
  void el.offsetWidth;
  el.classList.add('is-glitch');
  clearTimeout(el._g);
  el._g = setTimeout(() => el.classList.remove('is-glitch'), ms);
}

export function powerOn(el) {
  if (reduce) return;
  el.classList.add('is-powering');
  el.addEventListener('animationend', () => el.classList.remove('is-powering'), { once: true });
}

export function countUp(node, to, { prefix = '$', ms = 600 } = {}) {
  const from = Number(node.dataset.value || 0);
  node.dataset.value = to;
  const fmt = n => prefix + Math.round(n).toLocaleString('es-AR');
  if (reduce || !from) {
    node.firstChild.nodeValue = fmt(to);
    return;
  }
  const t0 = performance.now();
  const step = now => {
    const k = Math.min(1, (now - t0) / ms);
    const e = 1 - Math.pow(1 - k, 3);
    node.firstChild.nodeValue = fmt(from + (to - from) * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
