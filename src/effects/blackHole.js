// Cambio de tema "agujero negro": el botón de tema se vuelve un agujero que se
// traga las estrellas del fondo (shader de Galaxy) y las capas de la página
// (logo, cartas, footer…); en el pico se cambia el tema y todo vuelve a salir
// del agujero, girando al revés, ya en el tema nuevo (agujero blanco).
//
// Cada capa es un <div class="bh-layer"> que normalmente es `display: contents`
// (no existe para el layout). Durante el efecto pasa a `position: fixed;
// inset: 0` y se escala / rota alrededor del centro del botón: cada punto de
// la capa recorre una espiral hacia el agujero.

const SUCK_MS = 1500;
const HOLD_MS = 220;
const EMERGE_MS = 1300;
const LAYER_MS_IN = 1050;
const LAYER_MS_OUT = 1000;
const LAYER_SPIN = 300; // grados
const HORIZON_PX = 36;

const easeInCubic = (t) => t * t * t;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

function animateValue(ms, fn) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const step = (now) => {
      const t = clamp01((now - t0) / ms);
      fn(t);
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

function contentRect(layer) {
  const range = document.createRange();
  range.selectNodeContents(layer);
  const r = range.getBoundingClientRect();
  return r.width || r.height ? r : null;
}

/**
 * @param {object}   opts
 * @param {object}   opts.hole      Galaxy hole controller ({ set(next) }).
 * @param {Element}  opts.button    Botón de tema (centro del agujero).
 * @param {Function} opts.onPeak    Cambia el tema; se llama con todo tragado.
 */
export async function runBlackHole({ hole, button, onPeak }) {
  const b = button.getBoundingClientRect();
  const cx = b.left + b.width / 2;
  const cy = b.top + b.height / 2;
  const maxDist = Math.hypot(window.innerWidth, window.innerHeight);

  const layers = [...document.querySelectorAll('.bh-layer')].map((el) => {
    const r = contentRect(el);
    const dist = r ? Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy) : maxDist;
    return { el, near: clamp01(dist / maxDist) };
  });

  for (const { el } of layers) {
    el.style.transformOrigin = `${cx}px ${cy}px`;
    el.style.zIndex = el.dataset.z || '2';
    el.classList.add('bh-active');
  }
  document.documentElement.classList.add('bh-running');

  const swallow = (dir) =>
    layers.map(({ el, near }) => {
      const delay = dir > 0 ? near * 380 : near * 260;
      const ms = dir > 0 ? LAYER_MS_IN : LAYER_MS_OUT;
      const hidden = { transform: `rotate(${LAYER_SPIN * dir}deg) scale(0.001)`, opacity: 0 };
      const shown = { transform: 'rotate(0deg) scale(1)', opacity: 1 };
      const frames = dir > 0
        ? [shown, { opacity: 1, offset: 0.6 }, hidden]
        : [{ ...hidden, transform: `rotate(${-LAYER_SPIN}deg) scale(0.001)` }, { opacity: 1, offset: 0.4 }, shown];
      return el.animate(frames, {
        duration: ms,
        delay,
        easing: dir > 0 ? 'cubic-bezier(0.6, 0, 0.9, 0.5)' : 'cubic-bezier(0.1, 0.5, 0.4, 1)',
        fill: 'both',
      });
    });

  // 1 · Succión
  const buttonOut = button.animate(
    [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0.2) rotate(-200deg)', opacity: 0 }],
    { duration: 450, easing: 'ease-in', fill: 'forwards' }
  );
  const inAnims = swallow(1);
  await animateValue(SUCK_MS, (t) => {
    hole.set({
      x: cx, y: cy, spin: 1,
      amount: 0.985 * easeInCubic(t * 0.85 + 0.15 * t * t),
      radius: HORIZON_PX * easeOutCubic(clamp01(t / 0.45)),
    });
  });

  // 2 · Pico: todo adentro, se cambia el tema.
  onPeak();
  await nextFrame();
  await nextFrame();
  await new Promise((r) => setTimeout(r, HOLD_MS));
  inAnims.forEach((a) => a.cancel());

  // 3 · Agujero blanco: todo sale girando al revés.
  const outAnims = swallow(-1);
  await animateValue(EMERGE_MS, (t) => {
    const e = 1 - easeOutCubic(t);
    hole.set({ x: cx, y: cy, spin: -1, amount: 0.985 * e, radius: HORIZON_PX * clamp01(e / 0.5) });
  });
  hole.set({ amount: 0, radius: 0 });
  await Promise.all(outAnims.map((a) => a.finished.catch(() => {})));

  buttonOut.cancel();
  button.animate(
    [{ transform: 'scale(0.2) rotate(200deg)', opacity: 0 }, { transform: 'scale(1.12)', opacity: 1, offset: 0.7 }, { transform: 'scale(1)', opacity: 1 }],
    { duration: 520, easing: 'ease-out' }
  );

  outAnims.forEach((a) => a.cancel());
  for (const { el } of layers) {
    el.classList.remove('bh-active');
    el.style.transformOrigin = '';
    el.style.zIndex = '';
  }
  document.documentElement.classList.remove('bh-running');
}
