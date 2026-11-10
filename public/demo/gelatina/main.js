import { createElasticMesh } from '../_lib/elastic-mesh.js';
import { openCheckout } from '../_lib/checkout.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- hero: the Gelatina logo as a real jelly ---------- */
const stage = document.querySelector('.hero-stage');
const host = document.getElementById('jelly');
const hint = document.querySelector('.hint');

const jelly = createElasticMesh(host, {
  src: 'assets/cropped-Gelatina-2025.png',
  imageColors: false,
  color: '#2929CE',
  material: 'jelly',
  theme: 'dark',
  inflate: 1.15,
  stiffness: 0.42,
  wobble: 0.78,
  grabRadius: 95,
  stretch: 0.6,
  press: 0.55,
  shadow: 0.6
});

if (!jelly) {
  // No WebGL2: static logo, same layout.
  host.remove();
  document.querySelector('.jelly-fallback').hidden = false;
  hint.remove();
}

/* flavour picker: recolours the jelly live, with a little jiggle */
const glow = c => `radial-gradient(60% 55% at 50% 45%, ${c}38, transparent 70%), #000`;
document.querySelectorAll('.flavors button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.flavors button').forEach(b => b.setAttribute('aria-checked', String(b === btn)));
    const c = btn.dataset.color;
    stage.style.background = glow(c);
    if (jelly) {
      jelly.set({ color: c });
      jelly.nudge(0.9);
    }
  });
});

if (jelly) {
  /* hide the hint after the first real interaction */
  host.addEventListener('pointerdown', () => hint.classList.add('is-gone'), { once: true });

  /* scroll velocity shakes the jelly, like a plate being bumped */
  let lastY = scrollY;
  addEventListener(
    'scroll',
    () => {
      const dy = scrollY - lastY;
      lastY = scrollY;
      if (scrollY < innerHeight) jelly.shake(0, Math.max(-60, Math.min(60, -dy * 4)));
    },
    { passive: true }
  );

  /* idle "breathing": a soft poke every few seconds if nobody touches it */
  let lastMove = performance.now();
  addEventListener('pointermove', () => (lastMove = performance.now()), { passive: true });
  if (!reduce) {
    setInterval(() => {
      if (document.hidden || scrollY > innerHeight * 0.8) return;
      if (performance.now() - lastMove > 2500) jelly.nudge(0.3 + Math.random() * 0.3);
    }, 3200);
  }
}

/* ---------- footer: giant wordmark in Fixture, as a balloon you can poke ---------- */
const footerHost = document.getElementById('jelly-footer');
const footerJelly = createElasticMesh(footerHost, {
  text: 'GELATINA',
  fontFamily: 'Fixture',
  fontWeight: 400,
  color: '#2929CE',
  material: 'balloon',
  theme: 'dark',
  inflate: 0.9,
  wobble: 0.7,
  grabRadius: 80,
  shadow: 0.4
});
// replay the letter-by-letter intro the first time the footer scrolls into view
if (footerJelly) {
  const once = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    once.disconnect();
    footerJelly.set({ text: 'GELATINA ' });
  }, { threshold: 0.4 });
  once.observe(footerHost);
}

/* ---------- plans ---------- */
const TIERS = [
  { name: 'Cucharadita', price: 8500, off: 0 },
  { name: 'Porción', price: 12000, off: 10 },
  { name: 'Molde', price: 15000, off: 15, featured: true },
  { name: 'Fuente', price: 22000, off: 20 },
  { name: 'Bandeja', price: 29000, off: 25 },
  { name: 'Fábrica', price: 36000, off: 30 }
];
const fmt = n => '$' + Math.round(n).toLocaleString('es-AR');
const tiersEl = document.getElementById('tiers');
const toggle = document.querySelector('.toggle');

const renderTiers = (period, bump = false) => {
  tiersEl.innerHTML = TIERS.map(t => {
    const yearly = period === 'yearly';
    const perMonth = yearly ? t.price * (1 - t.off / 100) : t.price;
    const sub = yearly
      ? t.off ? `${fmt(perMonth * 12)} al año · ahorrás ${fmt(t.price * 12 - perMonth * 12)}` : `${fmt(perMonth * 12)} al año`
      : t.featured ? 'El más elegido' : '';
    return `
      <article class="tier${t.featured ? ' is-featured' : ''}">
        ${yearly && t.off ? `<span class="badge">-${t.off}%</span>` : ''}
        <span class="tier-name">${t.name}</span>
        <span class="tier-price${bump ? ' price-bump' : ''}">${fmt(perMonth)}<small>/mes</small></span>
        <span class="tier-sub">${sub}</span>
        <button type="button" class="btn ${t.featured ? '' : 'btn-ghost'} jelly-hover" data-amount="${yearly ? Math.round(perMonth * 12) : t.price}" data-period="${period}">Asociarme</button>
      </article>`;
  }).join('');
};
renderTiers('monthly');

toggle.querySelectorAll('button').forEach(btn => {
  btn.addEventListener('click', () => {
    const period = btn.dataset.period;
    toggle.dataset.period = period;
    toggle.querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', String(b === btn)));
    renderTiers(period, true);
  });
});

/* checkout (demo) — the jelly celebrates every new member */
const celebrate = () => {
  if (!jelly) return;
  [0, 250, 500].forEach(t => setTimeout(() => jelly.nudge(1), t));
};
tiersEl.addEventListener('click', e => {
  const b = e.target.closest('[data-amount]');
  if (b) openCheckout({ brand: 'Gelatina', amount: Number(b.dataset.amount), period: b.dataset.period, onDone: celebrate });
});
document.querySelector('[data-once]').addEventListener('click', e => {
  e.preventDefault();
  const sel = document.querySelector('.once-amounts [aria-checked="true"]');
  const amount = Number((sel?.textContent || '15000').replace(/\D/g, ''));
  openCheckout({ brand: 'Gelatina', amount, period: 'once', onDone: celebrate });
});

/* one-time amounts */
document.querySelectorAll('.once-amounts button').forEach(btn => {
  btn.addEventListener('click', () =>
    document.querySelectorAll('.once-amounts button').forEach(b => b.setAttribute('aria-checked', String(b === btn)))
  );
});

/* ---------- marquee: duplicate items for a seamless loop ---------- */
const track = document.querySelector('.marquee-track');
[...track.children].forEach(node => {
  const clone = node.cloneNode(true);
  clone.setAttribute('aria-hidden', 'true');
  clone.tabIndex = -1;
  track.appendChild(clone);
});

/* ---------- reveal on scroll ---------- */
const io = new IntersectionObserver(
  entries => entries.forEach(e => e.isIntersecting && (e.target.classList.add('is-in'), io.unobserve(e.target))),
  { threshold: 0.15 }
);
document.querySelectorAll('.reveal').forEach((el, i) => {
  el.style.transitionDelay = `${(i % 3) * 80}ms`;
  io.observe(el);
});
