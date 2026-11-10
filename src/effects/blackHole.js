// Cambio de tema "agujero negro": el botón de tema se vuelve un agujero que se
// traga las estrellas del fondo y la página entera (logo, cartas, footer…). En
// el pico se cambia el tema y todo vuelve a salir del agujero girando al revés,
// ya en el tema nuevo (agujero blanco).
//
// Cómo: se "fotografía" lo que está en pantalla dentro de las capas
// `.bh-layer` (imágenes, canvas, fondos, textos) en un canvas 2D, se pasa como
// textura al shader de Galaxy y Galaxy se pone por encima de la página durante
// el efecto. El shader deforma la foto con el mismo mapeo en espiral que las
// estrellas, así que las imágenes se estiran y se chupan hacia el agujero.

const SUCK_MS = 1600;
const HOLD_MS = 240;
const EMERGE_MS = 1400;
const HORIZON_PX = 36;
// Último tramo de la salida: la foto se funde con la página real (en vez de
// cambiarla de golpe) mientras termina de desenrollarse.
const REVEAL_FROM = 0.7;

const easeInCubic = (t) => t * t * t;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function animateValue(ms, fn) {
  // Solo en dev: window.__bhSlow = 8 → cámara lenta para revisar el efecto.
  if (import.meta.env.DEV && window.__bhSlow) ms *= window.__bhSlow;
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

// ---------------------------------------------------------------- captura --

const bgCache = new Map();
const urlOf = (bg) => /url\(["']?([^"')]+)["']?\)/.exec(bg)?.[1];

function loadBg(url) {
  if (!bgCache.has(url)) {
    const img = new Image();
    img.src = url;
    bgCache.set(url, img.decode().then(() => img).catch(() => null));
  }
  return bgCache.get(url);
}

// Espera (con tope) a que las imágenes y fondos de las capas estén decodificados.
async function settle(layers) {
  const jobs = [];
  for (const layer of layers) {
    layer.querySelectorAll('img').forEach((img) => {
      if (img.currentSrc && !img.complete) jobs.push(img.decode().catch(() => {}));
    });
    layer.querySelectorAll('*').forEach((el) => {
      const url = urlOf(getComputedStyle(el).backgroundImage);
      if (url) jobs.push(loadBg(url));
    });
  }
  await Promise.race([Promise.all(jobs), wait(500)]);
}

function fitRect(fit, iw, ih, r) {
  if (fit !== 'contain' && fit !== 'cover') return [r.left, r.top, r.width, r.height];
  const k = (fit === 'contain' ? Math.min : Math.max)(r.width / iw, r.height / ih);
  const w = iw * k;
  const h = ih * k;
  return [r.left + (r.width - w) / 2, r.top + (r.height - h) / 2, w, h];
}

async function paintBackground(ctx, cs, r, scale = 1) {
  const url = urlOf(cs.backgroundImage);
  const img = url && (await loadBg(url));
  if (!img) return;
  const [sw, sh] = cs.backgroundSize.split(' ');
  let tw;
  let th;
  if (sw === 'cover' || sw === 'contain') {
    const k = (sw === 'cover' ? Math.max : Math.min)(r.width / img.width, r.height / img.height);
    tw = img.width * k;
    th = img.height * k;
  } else {
    const px = (v, full) => (v?.endsWith('%') ? (parseFloat(v) / 100) * full : parseFloat(v));
    tw = sw && sw !== 'auto' ? px(sw, r.width) : NaN;
    th = sh && sh !== 'auto' ? px(sh, r.height) : NaN;
    // backgroundSize está en px sin transformar; el rect ya viene escalado.
    tw *= scale;
    th *= scale;
    if (isNaN(tw) && isNaN(th)) { tw = img.width * scale; th = img.height * scale; }
    else if (isNaN(tw)) tw = (img.width * th) / img.height;
    else if (isNaN(th)) th = (img.height * tw) / img.width;
  }
  const repX = /repeat(?!-y)/.test(cs.backgroundRepeat) && !/no-repeat/.test(cs.backgroundRepeat);
  const repY = /repeat(?!-x)/.test(cs.backgroundRepeat) && !/no-repeat/.test(cs.backgroundRepeat);
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.left, r.top, r.width, r.height);
  ctx.clip();
  const x0 = r.left;
  const y0 = r.top;
  const xs = repX ? Math.max(0, Math.floor(-x0 / tw)) : 0;
  const xe = repX ? Math.ceil((Math.min(r.right, window.innerWidth) - x0) / tw) : 1;
  const ye = repY ? Math.ceil(r.height / th) : 1;
  for (let j = 0; j < ye; j++) {
    for (let i = xs; i < xe; i++) ctx.drawImage(img, x0 + i * tw, y0 + j * th, tw, th);
  }
  ctx.restore();
}

function paintText(ctx, node, cs) {
  ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  ctx.fillStyle = cs.color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  if ('letterSpacing' in ctx) ctx.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
  const range = document.createRange();
  const text = node.textContent;
  for (const m of text.matchAll(/\S+/g)) {
    range.setStart(node, m.index);
    range.setEnd(node, m.index + m[0].length);
    const rect = range.getClientRects()[0];
    if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) continue;
    let word = m[0];
    if (cs.textTransform === 'uppercase') word = word.toUpperCase();
    else if (cs.textTransform === 'lowercase') word = word.toLowerCase();
    ctx.fillText(word, rect.left, rect.top + rect.height / 2, rect.width + 2);
  }
}

async function paintTree(ctx, el, alpha) {
  for (const child of el.children) {
    const cs = getComputedStyle(child);
    if (cs.display === 'none') continue;
    const a = alpha * parseFloat(cs.opacity || '1');
    if (a < 0.01) continue;
    const visible = cs.visibility !== 'hidden';
    const r = child.getBoundingClientRect();
    const onScreen = r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
    if (visible && onScreen && r.width > 0 && r.height > 0) {
      ctx.globalAlpha = a;
      const bgc = cs.backgroundColor;
      if (bgc && bgc !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(bgc)) {
        ctx.fillStyle = bgc;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(r.left, r.top, r.width, r.height, parseFloat(cs.borderTopLeftRadius) || 0);
        else ctx.rect(r.left, r.top, r.width, r.height);
        ctx.fill();
      }
      if (cs.backgroundImage !== 'none') await paintBackground(ctx, cs, r, child.offsetWidth ? r.width / child.offsetWidth : 1);
      const tag = child.tagName;
      if (tag === 'IMG') {
        if (child.complete && child.naturalWidth) {
          const [x, y, w, h] = fitRect(cs.objectFit, child.naturalWidth, child.naturalHeight, r);
          try { ctx.drawImage(child, x, y, w, h); } catch { /* imagen rota */ }
        }
        continue;
      }
      if (tag === 'CANVAS') {
        if (child.width && child.height) {
          try { ctx.drawImage(child, r.left, r.top, r.width, r.height); } catch { /* canvas vacío */ }
        }
        continue;
      }
      for (const node of child.childNodes) {
        if (node.nodeType === 3 && node.textContent.trim()) paintText(ctx, node, cs);
      }
    }
    if (child.tagName !== 'svg') await paintTree(ctx, child, a);
  }
}

async function capture(layers, w, h, ratio) {
  await settle(layers);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  ctx.imageSmoothingQuality = 'high';
  for (const layer of layers) await paintTree(ctx, layer, 1);
  return canvas;
}

// ----------------------------------------------------------------- efecto --

// La capa (normalmente `display: contents`) pasa a ser una caja fija a pantalla
// completa, así se le puede animar la opacidad sin tocar la de sus hijos.
function startReveal(layers) {
  const ms = EMERGE_MS * (1 - REVEAL_FROM) * (import.meta.env.DEV && window.__bhSlow ? window.__bhSlow : 1);
  for (const el of layers) {
    el.style.zIndex = el.dataset.z || '2';
    el.classList.add('bh-reveal');
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms, easing: 'ease-in-out', fill: 'backwards' });
  }
}

function endReveal(layers) {
  for (const el of layers) {
    el.getAnimations().forEach((a) => a.cancel());
    el.classList.remove('bh-reveal');
    el.style.zIndex = '';
  }
}

/**
 * @param {object}   opts
 * @param {object}   opts.hole      Controlador del agujero de Galaxy ({ size(), set(next) }).
 * @param {Element}  opts.button    Botón de tema (centro del agujero).
 * @param {Element}  opts.sky       Contenedor fijo de Galaxy (se sube encima de la página).
 * @param {Function} opts.onPeak    Cambia el tema; se llama con todo tragado.
 */
export async function runBlackHole({ hole, button, sky, onPeak }) {
  const b = button.getBoundingClientRect();
  const cx = b.left + b.width / 2;
  const cy = b.top + b.height / 2;
  const layers = [...document.querySelectorAll('.bh-layer')]
    .sort((p, q) => (Number(p.dataset.z) || 0) - (Number(q.dataset.z) || 0));
  const [w, h, ratio] = hole.size();

  document.documentElement.classList.add('bh-running');
  const before = await capture(layers, w, h, ratio);
  hole.set({ snap: before, snapOn: 1, x: cx, y: cy, amount: 0, radius: 0, spin: 1 });
  await nextFrame();
  // Galaxy (opaco, ya con la foto) tapa la página; el botón queda encima.
  const prevZ = sky.style.zIndex;
  sky.style.zIndex = '1900';

  let buttonAnim = null;
  try {
    // 1 · Succión
    buttonAnim = button.animate(
      [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0.2) rotate(-200deg)', opacity: 0 }],
      { duration: 450, easing: 'ease-in', fill: 'forwards' }
    );
    await animateValue(SUCK_MS, (t) => {
      hole.set({
        amount: 0.985 * easeInCubic(t * 0.85 + 0.15 * t * t),
        radius: HORIZON_PX * easeOutCubic(clamp01(t / 0.45)),
      });
    });

    // 2 · Pico: todo adentro. Se cambia el tema y se fotografía la página nueva
    // (sigue debajo de Galaxy, así que no se ve todavía).
    onPeak();
    await nextFrame();
    await nextFrame();
    await wait(HOLD_MS);
    const after = await capture(layers, w, h, ratio);
    hole.set({ snap: after, spin: -1 });

    // 3 · Agujero blanco: todo sale girando al revés. Hacia el final la página
    // real aparece encima con fundido (capas transparentes → opacas) y la foto
    // de abajo se desvanece: sin salto al cambiar foto por página.
    let revealing = false;
    await animateValue(EMERGE_MS, (t) => {
      const e = 1 - easeOutCubic(t);
      const fade = clamp01((t - REVEAL_FROM) / (1 - REVEAL_FROM));
      if (!revealing && t >= REVEAL_FROM) {
        revealing = true;
        startReveal(layers);
        sky.style.zIndex = prevZ;
      }
      hole.set({
        amount: 0.985 * e,
        radius: HORIZON_PX * clamp01(e / 0.5),
        snapOn: 1 - fade * fade * (3 - 2 * fade),
      });
    });
  } finally {
    endReveal(layers);
    hole.set({ amount: 0, radius: 0 });
    sky.style.zIndex = prevZ;
    await nextFrame();
    hole.set({ snapOn: 0 });
    document.documentElement.classList.remove('bh-running');
    buttonAnim?.cancel();
    button.animate(
      [{ transform: 'scale(0.2) rotate(200deg)', opacity: 0 }, { transform: 'scale(1.12)', opacity: 1, offset: 0.7 }, { transform: 'scale(1)', opacity: 1 }],
      { duration: 520, easing: 'ease-out' }
    );
  }
}
