import { openCheckout } from '../_lib/checkout.js';
import { halftoneLens, tiltLogo, glitch, powerOn, countUp } from './fx.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- data (from the show posters) ---------------- */
const MON_FRI = [1, 2, 3, 4, 5];
const SHOWS = [
  { id: 'trinchera', name: 'La Trinchera', img: 'programa-trinchera', c: '#8fb98a', slots: [{ days: MON_FRI, from: 14, to: 16 }] },
  { id: 'fuerza', name: 'La Fuerza', img: 'programa-la-fuerza', c: '#f2d20b', slots: [{ days: MON_FRI, from: 16, to: 18 }] },
  { id: 'linea', name: 'Línea Roja', img: 'programa-linea-roja', c: '#e5262e', slots: [{ days: MON_FRI, from: 18, to: 19 }] },
  { id: 'ruckauf', name: 'Un café con Ruckauf', img: 'programa-cafe-con-ruckauf', c: '#c9873e', slots: [{ days: [1], from: 19, to: 20 }] },
  { id: 'misa', name: 'La Misa', img: 'programa-la-misa', c: '#2f7bff', slots: [{ days: [1], from: 20, to: 23 }, { days: [2, 3, 4, 5], from: 21, to: 23 }] },
  { id: 'anclas', name: 'Las Tres Anclas', img: 'programa-las-tres-anclas', c: '#5aa9ff', slots: [{ days: [4], from: 19, to: 21 }] },
  { id: 'otra', name: 'La Otra Cara', img: 'programa-la-otra-cara', c: '#2fe0e0', slots: [{ days: [5], from: 19, to: 21 }] }
];
const DAY = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const FIRST_HOUR = 14;
const LAST_HOUR = 23;
const img = s => `assets/${s.img}.webp`;

/* Argentina time, regardless of the viewer's timezone */
const nowAR = () => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Argentina/Buenos_Aires', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false })
      .formatToParts(new Date())
      .map(p => [p.type, p.value])
  );
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  const h = Number(parts.hour) % 24;
  return { day, h, m: Number(parts.minute), t: h + Number(parts.minute) / 60 };
};

const occurrences = () =>
  SHOWS.flatMap(show => show.slots.flatMap(slot => slot.days.map(day => ({ show, day, from: slot.from, to: slot.to }))));

const liveNow = n => occurrences().find(o => o.day === n.day && n.t >= o.from && n.t < o.to);
const nextUp = n => {
  const all = occurrences();
  for (let add = 0; add < 8; add++) {
    const d = (n.day + add) % 7;
    const cands = all.filter(o => o.day === d && (add > 0 || o.from > n.t)).sort((a, b) => a.from - b.from);
    if (cands.length) return { ...cands[0], add };
  }
  return null;
};

/* ---------------- hero: binocular halftone + 3D logo with TV glitch ---------------- */
const hero = document.querySelector('.hero');
const heroLogo = document.getElementById('hero-logo');
const logoBtn = heroLogo.querySelector('.logo-3d');
const hint = heroLogo.querySelector('.hint');
halftoneLens(hero.querySelector('.halftone'), hero);
tiltLogo(heroLogo, hero);
powerOn(heroLogo);
logoBtn.addEventListener('click', () => {
  glitch(logoBtn);
  hint.classList.add('is-gone');
});
// random "signal noise" every few seconds while the hero is on screen
if (!reduce) setInterval(() => {
  if (!document.hidden && scrollY < innerHeight * 0.6 && Math.random() < 0.5) glitch(logoBtn, 450);
}, 4200);

/* ---------------- live band + header pill ---------------- */
const live = document.querySelector('.live');
const pill = document.querySelector('.live-pill');
const renderLive = () => {
  const n = nowAR();
  const on = liveNow(n);
  live.classList.toggle('is-live', !!on);
  pill.hidden = !on;
  const o = on || nextUp(n);
  if (!o) return;
  live.style.setProperty('--c', o.show.c);
  live.querySelector('.live-thumb').src = img(o.show);
  live.querySelector('.live-title').textContent = o.show.name;
  if (on) {
    live.querySelector('.live-kicker').innerHTML = '<span class="dot"></span> En vivo ahora';
    live.querySelector('.live-when').textContent = `${o.from} a ${o.to} hs · quedan ${Math.max(1, Math.round((o.to - n.t) * 60))} min`;
    live.querySelector('.live-bar span').style.width = `${((n.t - o.from) / (o.to - o.from)) * 100}%`;
    pill.querySelector('.live-pill-text').innerHTML = `En vivo<span class="lp-show"> · ${o.show.name}</span>`;
  } else {
    const when = o.add === 0 ? 'Hoy' : o.add === 1 ? 'Mañana' : DAY[o.day];
    live.querySelector('.live-kicker').textContent = 'Próximo en vivo';
    let rest = '';
    if (o.add === 0) {
      const mins = Math.round((o.from - n.t) * 60);
      rest = mins < 60 ? ` · en ${mins} min` : ` · en ${Math.floor(mins / 60)} h ${mins % 60} min`;
    }
    live.querySelector('.live-when').textContent = `${when} ${o.from} hs${rest}`;
  }
  renderNowLine(n, on);
};

/* ---------------- poster rail ---------------- */
const rail = document.getElementById('rail');
rail.innerHTML = SHOWS.map(
  s => `<button class="poster" style="--c:${s.c}" data-show="${s.id}" aria-label="${s.name}">
      <img src="${img(s)}" alt="" loading="lazy" width="270" height="360" />
    </button>`
).join('');

/* ---------------- weekly grid ---------------- */
const grid = document.getElementById('grid');
const daysEl = document.querySelector('.days');
const rows = LAST_HOUR - FIRST_HOUR;
grid.style.setProperty('--rows', rows);
const today = nowAR().day;
let selectedDay = MON_FRI.includes(today) ? today : 1;

const slotLabel = o => `${o.from} a ${o.to} hs`;
grid.innerHTML = [
  '<span></span>',
  ...MON_FRI.map(d => `<span class="g-day${d === today ? ' is-today' : ''}" style="grid-column:${d + 1}">${DAY[d].slice(0, 3)}</span>`),
  ...Array.from({ length: rows }, (_, i) => `<span class="g-hour" style="grid-row:${i + 2}">${FIRST_HOUR + i}:00</span>`),
  ...occurrences()
    .filter(o => MON_FRI.includes(o.day))
    .map(
      o => `<button class="g-slot" data-day="${o.day}" data-show="${o.show.id}" style="--c:${o.show.c};grid-column:${o.day + 1};grid-row:${o.from - FIRST_HOUR + 2} / span ${o.to - o.from}">
        <strong>${o.show.name}</strong><span>${slotLabel(o)}</span></button>`
    ),
  '<span class="g-now" hidden></span>'
].join('');

daysEl.innerHTML = MON_FRI.map(
  d => `<button role="tab" data-day="${d}" aria-selected="${d === selectedDay}">${d === today ? 'Hoy' : DAY[d].slice(0, 3)}</button>`
).join('');
const selectDay = d => {
  selectedDay = d;
  daysEl.querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', String(Number(b.dataset.day) === d)));
  grid.querySelectorAll('.g-slot').forEach(s => {
    const on = Number(s.dataset.day) === d;
    s.classList.toggle('is-day', on);
  });
  // on narrow screens the selected day's slots move into the single column
  const narrow = matchMedia('(max-width: 960px)').matches;
  grid.querySelectorAll('.g-slot').forEach(s => (s.style.gridColumn = narrow ? (s.classList.contains('is-day') ? '2' : '') : `${Number(s.dataset.day) + 1}`));
};
daysEl.addEventListener('click', e => {
  const b = e.target.closest('[data-day]');
  if (b) selectDay(Number(b.dataset.day));
});
matchMedia('(max-width: 960px)').addEventListener('change', () => selectDay(selectedDay));
selectDay(selectedDay);

function renderNowLine(n, on) {
  const line = grid.querySelector('.g-now');
  const visible = MON_FRI.includes(n.day) && n.t >= FIRST_HOUR && n.t < LAST_HOUR;
  line.hidden = !visible;
  if (visible) {
    const row = Math.floor(n.t) - FIRST_HOUR + 2;
    line.style.gridRow = `${row}`;
    line.style.marginTop = `${(n.t % 1) * 68}px`;
  }
  grid.querySelectorAll('.g-slot').forEach(s => s.classList.remove('is-live'));
  rail.querySelectorAll('.live-tag').forEach(t => t.remove());
  if (on) {
    grid.querySelector(`.g-slot[data-day="${on.day}"][data-show="${on.show.id}"]`)?.classList.add('is-live');
    rail.querySelector(`[data-show="${on.show.id}"]`)?.insertAdjacentHTML('beforeend', '<span class="live-tag"><span class="dot"></span>En vivo</span>');
  }
}

/* link posters <-> grid */
const highlight = id => {
  document.querySelectorAll('[data-show]').forEach(el => el.classList.toggle('is-active', el.dataset.show === id));
};
document.querySelector('.schedule').addEventListener('pointerover', e => {
  const el = e.target.closest('[data-show]');
  highlight(el ? el.dataset.show : null);
});
rail.addEventListener('click', e => {
  const p = e.target.closest('[data-show]');
  if (!p) return;
  const slot = grid.querySelector(`.g-slot[data-show="${p.dataset.show}"]`);
  if (slot && matchMedia('(max-width: 960px)').matches) selectDay(Number(slot.dataset.day));
  highlight(p.dataset.show);
  grid.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
});

renderLive();
setInterval(renderLive, 30_000);

/* ---------------- plans + checkout ---------------- */
const TIERS = [
  { name: 'Abrazo', price: 5000 },
  { name: 'Abrazo fuerte', price: 7000 },
  { name: 'Abrazo de oso', price: 11000, featured: true },
  { name: 'Abrazo grupal', price: 17000 },
  { name: 'Abrazo eterno', price: 23000 },
  { name: 'Abrazo Carajo', price: 29000 }
];
const fmt = n => '$' + Math.round(n).toLocaleString('es-AR');
const tiersEl = document.getElementById('tiers');
const toggle = document.querySelector('.toggle');
let period = 'monthly';

const tierPrice = t => (period === 'yearly' ? t.price * 10 : t.price);
tiersEl.innerHTML = TIERS.map(
  (t, i) => `<article class="tier${t.featured ? ' is-featured' : ''}" data-i="${i}">
      <span class="badge"${t.featured ? '' : ' hidden'}>El más elegido</span>
      <span class="tier-name">${t.name}</span>
      <span class="tier-price">${fmt(t.price)}<small>/mes</small></span>
      <span class="tier-sub"></span>
      <button type="button" class="btn ${t.featured ? '' : 'btn-ghost'}" data-amount="${t.price}">Suscribirme</button>
    </article>`
).join('');
const updateTiers = () => {
  const yearly = period === 'yearly';
  tiersEl.querySelectorAll('.tier').forEach(card => {
    const t = TIERS[card.dataset.i];
    const price = tierPrice(t);
    const priceEl = card.querySelector('.tier-price');
    countUp(priceEl, price);
    priceEl.querySelector('small').textContent = yearly ? '/año' : '/mes';
    card.querySelector('.tier-sub').textContent = yearly ? `Equivale a ${fmt(price / 12)}/mes` : '';
    const badge = card.querySelector('.badge');
    badge.hidden = !(yearly || t.featured);
    badge.textContent = yearly ? '2 meses gratis' : 'El más elegido';
    card.querySelector('[data-amount]').dataset.amount = price;
  });
};
updateTiers();

toggle.addEventListener('click', e => {
  const b = e.target.closest('[data-period]');
  if (!b) return;
  period = b.dataset.period;
  toggle.dataset.period = period;
  toggle.querySelectorAll('button').forEach(x => x.setAttribute('aria-selected', String(x === b)));
  updateTiers();
});

const celebrate = () => {
  // after the modal closes: back to the top, CRT switch-on + glitch on the logo
  const once = new MutationObserver(() => {
    if (!document.documentElement.classList.contains('ck-lock-scroll')) {
      once.disconnect();
      scrollTo({ top: 0, behavior: 'auto' });
      powerOn(heroLogo);
      setTimeout(() => glitch(logoBtn), 900);
    }
  });
  once.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
};
const checkout = (amount, p) => openCheckout({ brand: 'Carajo', amount, period: p, onDone: celebrate });

tiersEl.addEventListener('click', e => {
  const b = e.target.closest('[data-amount]');
  if (b) checkout(Number(b.dataset.amount), period);
});

const chips = document.querySelector('.chips');
chips.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b) chips.querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', String(x === b)));
});
document.querySelector('[data-once]').addEventListener('click', () => {
  const sel = chips.querySelector('[aria-checked="true"]');
  checkout(Number(sel.textContent.replace(/\D/g, '')), 'once');
});
document.querySelector('[data-paypal]').addEventListener('click', () => checkout(10000, 'once'));
