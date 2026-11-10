/*
 * Demo subscription checkout (no real charges).
 *
 * Proposed production flow: Mercado Pago Suscripciones (preapproval) for recurring
 * ARS payments, Checkout Pro for one-time payments, PayPal for foreign supporters.
 * This module only simulates the UX; nothing is sent anywhere.
 *
 * Usage:
 *   import { openCheckout } from '../_lib/checkout.js';
 *   openCheckout({ brand: 'Gelatina', amount: 15000, period: 'monthly', onDone });
 * Theme through CSS custom properties on :root (see checkout.css):
 *   --ck-accent, --ck-accent-ink, --ck-surface, --ck-ink, --ck-muted, --ck-line, --ck-display
 */

const css = document.createElement('link');
css.rel = 'stylesheet';
css.href = new URL('./checkout.css', import.meta.url).href;
document.head.appendChild(css);

const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = n => '$' + Math.round(n).toLocaleString('es-AR');
const PERIOD = {
  monthly: { label: 'Mensual', unit: '/mes', recurring: true },
  yearly: { label: 'Anual', unit: '/año', recurring: true },
  once: { label: 'Única vez', unit: '', recurring: false }
};
const METHODS = [
  {
    id: 'mp',
    title: 'Mercado Pago',
    desc: 'Con tarjeta o dinero en cuenta. Débito automático, cancelás cuando quieras.',
    tag: 'Recomendado',
    when: () => true
  },
  {
    id: 'card',
    title: 'Tarjeta de crédito o débito',
    desc: 'Visa, Mastercard, Amex, Naranja, Cabal. Procesado por Mercado Pago.',
    when: () => true
  },
  {
    id: 'cash',
    title: 'Transferencia o efectivo',
    desc: 'CVU / alias, Rapipago o Pago Fácil. Solo para aportes únicos.',
    when: p => p === 'once'
  },
  {
    id: 'paypal',
    title: 'PayPal',
    desc: 'Si estás fuera de Argentina. Se cobra en USD.',
    when: () => true
  }
];

let root = null;
let state = null;

const el = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};

function build() {
  root = el(`
    <div class="ck" hidden>
      <div class="ck-backdrop" data-close></div>
      <section class="ck-panel" role="dialog" aria-modal="true" aria-labelledby="ck-title">
        <header class="ck-head">
          <div>
            <p class="ck-kicker"></p>
            <h2 id="ck-title" class="ck-title"></h2>
          </div>
          <button class="ck-x" type="button" aria-label="Cerrar" data-close>✕</button>
        </header>
        <ol class="ck-steps" aria-hidden="true"><li></li><li></li><li></li></ol>
        <div class="ck-body"></div>
        <footer class="ck-foot">
          <span class="ck-lock" aria-hidden="true">🔒</span>
          <span>Pago procesado por Mercado Pago / PayPal. El sitio no guarda datos de tarjeta.</span>
          <strong class="ck-demo">Demo: no se realiza ningún cobro.</strong>
        </footer>
      </section>
    </div>`);
  document.body.appendChild(root);
  root.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) close();
  });
  root.addEventListener('keydown', e => {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') trapFocus(e);
  });
}

function trapFocus(e) {
  const f = [...root.querySelectorAll('button, input, a[href], [tabindex]:not([tabindex="-1"])')].filter(
    n => !n.disabled && n.offsetParent !== null
  );
  if (!f.length) return;
  const first = f[0];
  const last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    last.focus();
    e.preventDefault();
  } else if (!e.shiftKey && document.activeElement === last) {
    first.focus();
    e.preventDefault();
  }
}

function setStep(n) {
  state.step = n;
  root.querySelectorAll('.ck-steps li').forEach((li, i) => li.classList.toggle('is-on', i <= Math.min(n, 2)));
  const body = root.querySelector('.ck-body');
  body.replaceChildren(VIEWS[n]());
  body.classList.remove('ck-enter');
  void body.offsetWidth;
  body.classList.add('ck-enter');
  const focusable = body.querySelector('[autofocus]') || body.querySelector('input') || body.querySelector('.ck-btn');
  focusable?.focus({ preventScroll: true });
}

const total = () => state.amount;
const summary = () => {
  const p = PERIOD[state.period];
  return `<div class="ck-sum">
    <span class="ck-sum-label">${p.label}</span>
    <span class="ck-sum-amount">${fmt(total())}<small>${p.unit}</small></span>
  </div>`;
};

const VIEWS = [
  // 0 — amount & frequency
  () => {
    const v = el(`<div>
      <h3 class="ck-h">Tu aporte</h3>
      <div class="ck-seg" role="radiogroup" aria-label="Frecuencia">
        ${Object.entries(PERIOD)
          .map(
            ([k, p]) =>
              `<button type="button" role="radio" aria-checked="${k === state.period}" data-period="${k}">${p.label}</button>`
          )
          .join('')}
      </div>
      <label class="ck-field">
        <span>Monto (ARS)</span>
        <input type="number" inputmode="numeric" min="1000" step="500" value="${state.amount}" />
      </label>
      <p class="ck-hint">${PERIOD[state.period].recurring ? 'Se renueva automáticamente. Podés pausar o cancelar cuando quieras.' : 'Un solo pago, sin renovación.'}</p>
      <button type="button" class="ck-btn" data-next>Continuar</button>
    </div>`);
    v.querySelectorAll('[data-period]').forEach(b =>
      b.addEventListener('click', () => {
        state.period = b.dataset.period;
        if (!METHODS.find(m => m.id === state.method)?.when(state.period)) state.method = 'mp';
        setStep(0);
      })
    );
    const input = v.querySelector('input');
    input.addEventListener('input', () => (state.amount = Math.max(0, Number(input.value) || 0)));
    v.querySelector('[data-next]').addEventListener('click', () => {
      if (state.amount < 1000) {
        input.setCustomValidity('El mínimo es $1.000');
        input.reportValidity();
        return;
      }
      input.setCustomValidity('');
      setStep(1);
    });
    return v;
  },

  // 1 — personal data
  () => {
    const v = el(`<form novalidate>
      <h3 class="ck-h">Tus datos</h3>
      ${summary()}
      <label class="ck-field"><span>Nombre y apellido</span>
        <input name="name" autocomplete="name" required value="${esc(state.name)}" /></label>
      <label class="ck-field"><span>Email</span>
        <input name="email" type="email" autocomplete="email" required value="${esc(state.email)}" /></label>
      <label class="ck-check"><input type="checkbox" name="news" ${state.news ? 'checked' : ''} /> Quiero recibir novedades y beneficios</label>
      <div class="ck-row">
        <button type="button" class="ck-btn ck-btn-ghost" data-back>Volver</button>
        <button type="submit" class="ck-btn">Elegir medio de pago</button>
      </div>
    </form>`);
    v.querySelector('[data-back]').addEventListener('click', () => setStep(0));
    v.addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(v);
      state.name = String(f.get('name') || '').trim();
      state.email = String(f.get('email') || '').trim();
      state.news = !!f.get('news');
      const bad = [...v.querySelectorAll('input[required]')].find(i => !i.checkValidity() || !i.value.trim());
      if (bad) {
        bad.reportValidity();
        return;
      }
      setStep(2);
    });
    return v;
  },

  // 2 — payment method
  () => {
    const list = METHODS.filter(m => m.when(state.period));
    const v = el(`<div>
      <h3 class="ck-h">Medio de pago</h3>
      ${summary()}
      <div class="ck-methods" role="radiogroup" aria-label="Medio de pago">
        ${list
          .map(
            m => `<button type="button" role="radio" class="ck-method" aria-checked="${m.id === state.method}" data-method="${m.id}">
              <span class="ck-radio" aria-hidden="true"></span>
              <span class="ck-mtext"><strong>${m.title}${m.tag ? ` <em>${m.tag}</em>` : ''}</strong><span>${m.desc}</span></span>
            </button>`
          )
          .join('')}
      </div>
      <div class="ck-row">
        <button type="button" class="ck-btn ck-btn-ghost" data-back>Volver</button>
        <button type="button" class="ck-btn" data-pay>Pagar ${fmt(total())}${PERIOD[state.period].unit}</button>
      </div>
    </div>`);
    v.querySelectorAll('[data-method]').forEach(b =>
      b.addEventListener('click', () => {
        state.method = b.dataset.method;
        v.querySelectorAll('[data-method]').forEach(x => x.setAttribute('aria-checked', String(x === b)));
      })
    );
    v.querySelector('[data-back]').addEventListener('click', () => setStep(1));
    v.querySelector('[data-pay]').addEventListener('click', () => setStep(3));
    return v;
  },

  // 3 — processing (simulated redirect / tokenisation)
  () => {
    const m = METHODS.find(x => x.id === state.method);
    const v = el(`<div class="ck-wait" role="status">
      <span class="ck-spinner" aria-hidden="true"></span>
      <p>Conectando con <strong>${m.title}</strong>…</p>
      <p class="ck-hint">En producción, acá se abre el checkout seguro del proveedor y vuelve al sitio con la confirmación.</p>
    </div>`);
    setTimeout(() => state && state.step === 3 && setStep(4), 1800);
    return v;
  },

  // 4 — success
  () => {
    const first = state.name.split(' ')[0] || '';
    const p = PERIOD[state.period];
    const v = el(`<div class="ck-done">
      <div class="ck-badge" aria-hidden="true">✓</div>
      <h3 class="ck-h">¡Listo${first ? ', ' + esc(first) : ''}! Ya sos parte de ${esc(state.brand)}.</h3>
      ${summary()}
      <p class="ck-hint">Te mandamos el comprobante a <strong>${esc(state.email)}</strong>.
        ${p.recurring ? 'Próximo débito: ' + nextDate(state.period) + '.' : ''}</p>
      <div class="ck-row">
        ${p.recurring ? '<button type="button" class="ck-btn ck-btn-ghost" data-manage>Administrar suscripción</button>' : ''}
        <button type="button" class="ck-btn" data-close>Volver al sitio</button>
      </div>
    </div>`);
    v.querySelector('[data-manage]')?.addEventListener('click', e => {
      e.currentTarget.textContent = 'Pausar · Cambiar monto · Cancelar (demo)';
      e.currentTarget.disabled = true;
    });
    state.onDone?.({ ...state });
    return v;
  }
];

function nextDate(period) {
  const d = new Date();
  if (period === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
}

let lastFocus = null;

export function openCheckout({ brand = 'nosotros', amount = 10000, period = 'monthly', onDone } = {}) {
  if (!root) build();
  lastFocus = document.activeElement;
  state = {
    brand,
    amount,
    period: PERIOD[period] ? period : 'monthly',
    method: 'mp',
    name: state?.name || '',
    email: state?.email || '',
    news: true,
    step: 0,
    onDone
  };
  root.querySelector('.ck-kicker').textContent = 'Suscripción';
  root.querySelector('.ck-title').textContent = `Apoyá a ${brand}`;
  root.hidden = false;
  document.documentElement.classList.add('ck-lock-scroll');
  requestAnimationFrame(() => root.classList.add('is-open'));
  setStep(0);
}

export function close() {
  if (!root || root.hidden) return;
  root.classList.remove('is-open');
  document.documentElement.classList.remove('ck-lock-scroll');
  if (state) state.step = -1;
  setTimeout(() => (root.hidden = true), 280);
  lastFocus?.focus?.({ preventScroll: true });
}
