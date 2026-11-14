// Avión de papel: la carta de contacto se pliega como un avión y vuela hasta el
// botón de tema (el agujero negro), donde lo chupa hasta el centro.
//
// Cómo: un SVG a pantalla completa con 4 polígonos (2 solapas + 2 mitades del
// cuerpo). Cada polígono interpola sus vértices entre "keyframes" de plegado
// (hoja plana → solapas dobladas → doblada al medio → alas abiertas) y después
// el grupo entero sigue una curva Bézier hasta el agujero, que lo chupa.

const SVG_NS = 'http://www.w3.org/2000/svg';
const FLIP_MS = 520;
const FOLD_MS = 1150;
const FLY_MS = 1700;
const SUCK_FROM = 0.74; // fracción del vuelo donde empieza la succión
const GOLD = '#FFD622';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeIn = (t) => t * t * t;

function animate(ms, fn) {
  // Solo en dev: window.__planeSlow = 8 → cámara lenta para revisar el plegado.
  if (import.meta.env.DEV && window.__planeSlow) ms *= window.__planeSlow;
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

// Keyframes de plegado, en px relativos al centro de la carta (w,h = medio ancho/alto).
function foldKeyframes(w, h) {
  const T = [0, -h];
  const fold = [0, -h + w]; // A reflejado sobre la diagonal T–Lm (doblez a 45°)
  const Lm = [-w, -h + w];
  const Rm = [w, -h + w];
  const flat = {
    flapL: [T, [-w, -h], Lm],
    flapR: [T, [w, -h], Rm],
    bodyL: [T, Lm, [-w, h], [0, h]],
    bodyR: [T, Rm, [w, h], [0, h]],
  };
  const flaps = { ...flat, flapL: [T, fold, Lm], flapR: [T, fold, Rm] };
  const squeeze = (k, sy = 1) => Object.fromEntries(Object.entries(flaps).map(([n, pts]) => [n, pts.map(([x, y]) => [x * k, y * sy])]));
  const half = squeeze(0.14, 0.92);
  // Avión visto desde arriba, nariz hacia arriba.
  const s = 0.62;
  const N = [0, -0.95 * h * s];
  const plane = {
    bodyL: [N, [-0.95 * w * s, 0.62 * h * s], [-0.3 * w * s, 0.74 * h * s], [0, 0.68 * h * s]],
    bodyR: [N, [0.95 * w * s, 0.62 * h * s], [0.3 * w * s, 0.74 * h * s], [0, 0.68 * h * s]],
    flapL: [N, [-0.07 * w * s, 0.6 * h * s], [-0.42 * w * s, 0.42 * h * s]],
    flapR: [N, [0.07 * w * s, 0.6 * h * s], [0.42 * w * s, 0.42 * h * s]],
  };
  return [flat, flaps, half, plane];
}

const STAGES = [0, 0.38, 0.68, 1]; // momento (0–1 del plegado) de cada keyframe

function shapeAt(kfs, t) {
  let i = 0;
  while (i < STAGES.length - 2 && t > STAGES[i + 1]) i++;
  const k = easeInOut(clamp01((t - STAGES[i]) / (STAGES[i + 1] - STAGES[i])));
  const a = kfs[i];
  const b = kfs[i + 1];
  return Object.fromEntries(Object.keys(a).map((n) => [n, a[n].map((p, j) => [lerp(p[0], b[n][j][0], k), lerp(p[1], b[n][j][1], k)])]));
}

const el = (tag, attrs = {}) => {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
};

// Matriz afín SVG (a b c d e f) que lleva el triángulo src al triángulo dst.
function affine(src, dst) {
  const [[x0, y0], [x1, y1], [x2, y2]] = src;
  const [[u0, v0], [u1, v1], [u2, v2]] = dst;
  const ax = x1 - x0, ay = y1 - y0, bx = x2 - x0, by = y2 - y0;
  const det = ax * by - bx * ay;
  if (Math.abs(det) < 1e-6) return null;
  const pu = u1 - u0, pv = v1 - v0, qu = u2 - u0, qv = v2 - v0;
  const a = (pu * by - qu * ay) / det;
  const c = (qu * ax - pu * bx) / det;
  const b = (pv * by - qv * ay) / det;
  const d = (qv * ax - pv * bx) / det;
  return [a, b, c, d, u0 - a * x0 - c * y0, v0 - b * x0 - d * y0];
}

// Agranda un poco el triángulo desde su centro: tapa las rendijas entre piezas.
function grow(tri, px) {
  const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
  const cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
  return tri.map(([x, y]) => {
    const dx = x - cx, dy = y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return [x + (dx / len) * px, y + (dy / len) * px];
  });
}

// Dorso de la carta (mismas imágenes que la grilla) + recorte de la carta dentro.
const DORSO = {
  dark:  { src: '/Cartas/00000_arlequin_dorso_dark.avif',  iw: 684, ih: 950, bx: 7, by: 8, bw: 669, bh: 936 },
  clear: { src: '/Cartas/00000_arlequin_dorso_clear.avif', iw: 684, ih: 950, bx: 8, by: 8, bw: 668, bh: 933 },
};
const dorsoReady = {};
function loadDorso(theme) {
  const d = DORSO[theme];
  if (!dorsoReady[theme]) {
    const img = new Image();
    img.src = d.src;
    dorsoReady[theme] = img.decode().then(() => d).catch(() => null);
  }
  // Tope de espera: si tarda, se pliega igual con un rojo liso.
  return Promise.race([dorsoReady[theme], new Promise((r) => setTimeout(() => r(null), 600))]);
}

const pts = (list) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

function bezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
  const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
  return [x, y];
}

/**
 * @param {object} o
 * @param {HTMLElement} o.cardEl  carta a plegar (se oculta al empezar)
 * @param {HTMLElement|null} o.targetEl  agujero (botón de tema); si falta, va a la esquina sup. izq.
 * @param {boolean} o.isDarkMode
 */
export async function runPaperPlane({ cardEl, targetEl, isDarkMode }) {
  const r = cardEl.getBoundingClientRect();
  const w = r.width / 2;
  const h = r.height / 2;
  const start = [r.left + w, r.top + h];
  const tr = targetEl?.getBoundingClientRect();
  const end = tr ? [tr.left + tr.width / 2, tr.top + tr.height / 2] : [50, 50];

  const paper = isDarkMode ? '#000000' : '#ffffff';
  const line = isDarkMode ? 'rgba(255,255,255,0.9)' : '#000000';
  const dorso = await loadDorso(isDarkMode ? 'dark' : 'clear');

  const svg = el('svg', { class: 'paper-plane-layer', 'aria-hidden': 'true' });
  Object.assign(svg.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: '3000', overflow: 'visible' });
  const defs = el('defs');
  svg.appendChild(defs);

  const trail = el('path', { fill: 'none', stroke: '#e53935', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-dasharray': '2 9' });
  svg.appendChild(trail);

  const g = el('g');
  svg.appendChild(g);

  // Frente liso (la carta del formulario ya vacía): se ve sólo en la 1ª mitad del giro.
  const front = el('rect', {
    x: -w, y: -h, width: 2 * w, height: 2 * h, rx: 0.12 * w,
    fill: paper, stroke: GOLD, 'stroke-width': Math.max(5, 0.036 * w),
  });
  g.appendChild(front);

  // Dorso: cada triángulo del papel lleva la imagen del dorso con una
  // transformación afín (hoja plana → forma actual), así los rombos siguen
  // al doblez. Las solapas dobladas muestran el dorso espejado.
  const back = el('g');
  g.appendChild(back);
  const kfs = foldKeyframes(w, h);
  const flat = kfs[0];
  const TRIS = [
    ['bodyL', [0, 1, 2]], ['bodyL', [0, 2, 3]],
    ['bodyR', [0, 1, 2]], ['bodyR', [0, 2, 3]],
    ['flapL', [0, 1, 2]], ['flapR', [0, 1, 2]],
  ];
  const uid = Math.random().toString(36).slice(2, 8);
  const tris = TRIS.map(([piece, idx], i) => {
    const clip = el('clipPath', { id: `pp-${uid}-${i}` });
    const clipPoly = el('polygon');
    clip.appendChild(clipPoly);
    defs.appendChild(clip);
    const wrap = el('g', { 'clip-path': `url(#pp-${uid}-${i})` });
    let tex;
    if (dorso) {
      // Ubica la imagen para que el recorte de la carta (bbox) cubra la hoja.
      const sx = (2 * w) / dorso.bw;
      const sy = (2 * h) / dorso.bh;
      tex = el('image', {
        href: dorso.src, preserveAspectRatio: 'none',
        x: -w - dorso.bx * sx, y: -h - dorso.by * sy, width: dorso.iw * sx, height: dorso.ih * sy,
      });
    } else {
      tex = el('rect', { x: -w * 2, y: -h * 2, width: 4 * w, height: 4 * h, fill: '#c62828' });
    }
    wrap.appendChild(tex);
    back.appendChild(wrap);
    return { piece, idx, clipPoly, tex, src: idx.map((j) => flat[piece][j]) };
  });
  // Sombra + líneas de pliegue por pieza (encima de la textura).
  const order = ['bodyL', 'bodyR', 'flapL', 'flapR'];
  const polys = Object.fromEntries(order.map((n) => {
    const p = el('polygon', { stroke: line, 'stroke-linejoin': 'round', fill: 'none' });
    back.appendChild(p);
    return [n, p];
  }));
  const keel = el('line', { stroke: line, 'stroke-linecap': 'round' });
  back.appendChild(keel);

  document.body.appendChild(svg);
  cardEl.style.visibility = 'hidden';

  const setShape = (shape, strokeW) => {
    for (const tri of tris) {
      const dst = tri.idx.map((j) => shape[tri.piece][j]);
      tri.clipPoly.setAttribute('points', pts(grow(dst, 0.9)));
      const m = affine(tri.src, dst);
      if (m) tri.tex.setAttribute('transform', `matrix(${m.map((v) => v.toFixed(4)).join(' ')})`);
    }
    for (const n of order) {
      polys[n].setAttribute('points', pts(shape[n]));
      polys[n].setAttribute('stroke-width', strokeW.toFixed(2));
    }
    const nose = shape.bodyL[0];
    const tail = shape.bodyL[3];
    keel.setAttribute('x1', nose[0]); keel.setAttribute('y1', nose[1]);
    keel.setAttribute('x2', tail[0]); keel.setAttribute('y2', tail[1]);
    keel.setAttribute('stroke-width', strokeW.toFixed(2));
  };
  const place = ([x, y], deg, s, sx = 1) => g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${deg.toFixed(1)}) scale(${(s * sx).toFixed(3)} ${s.toFixed(3)})`);

  try {
    // 0) La carta se da vuelta: frente liso → dorso de rombos.
    setShape(flat, 2);
    keel.setAttribute('opacity', '0');
    back.style.display = 'none';
    await animate(FLIP_MS, (t) => {
      const a = easeInOut(t) * Math.PI;
      const showBack = t >= 0.5;
      front.style.display = showBack ? 'none' : '';
      back.style.display = showBack ? '' : 'none';
      place([start[0], start[1]], 0, 1 + 0.06 * Math.sin(a), Math.max(Math.abs(Math.cos(a)), 0.002));
    });
    front.remove();

    // 1) Plegado en el lugar, con un pequeño "tomar aire" hacia arriba.
    await animate(FOLD_MS, (t) => {
      setShape(shapeAt(kfs, t), 2);
      keel.setAttribute('opacity', clamp01((t - 0.4) * 3).toFixed(2));
      place([start[0], start[1] - 18 * Math.sin(t * Math.PI)], 0, 1);
    });

    // 2) Vuelo: curva hasta el agujero; en el último tramo el agujero lo chupa.
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const p1 = [start[0] - dx * 0.05, start[1] - Math.abs(dy) * 0.55 - 80];
    const p2 = [end[0] + dx * -0.45, end[1] + Math.max(120, Math.abs(dy) * 0.25)];
    const hist = [];
    let prev = start;
    let ang = 0;
    await animate(FLY_MS, (t) => {
      // Tramo final: el agujero lo atrapa (frena un instante) y lo chupa
      // acelerando hasta el centro, achicándose y estirándose hacia adentro.
      const tail = clamp01((t - SUCK_FROM) / (1 - SUCK_FROM));
      const k = t < SUCK_FROM ? easeInOut(t / SUCK_FROM) * 0.9 : 0.9 + 0.1 * easeIn(tail);
      const pos = bezier(start, p1, p2, end, k);
      const vx = pos[0] - prev[0];
      const vy = pos[1] - prev[1];
      if (Math.hypot(vx, vy) > 0.5) {
        const target = (Math.atan2(vy, vx) * 180) / Math.PI + 90; // nariz hacia arriba en reposo
        let d = target - ang;
        d = ((d + 540) % 360) - 180;
        ang += d * Math.min(1, 0.12 + t * 0.6);
      }
      prev = pos;
      const scale = lerp(1, 0.32, Math.min(1, k / 0.9)) * (1 - easeIn(tail));
      place(pos, ang, Math.max(scale, 0.001), 1 - 0.55 * tail); // más fino = estirado hacia el centro
      svg.style.opacity = String(1 - clamp01((tail - 0.8) / 0.2));
      hist.push(pos);
      if (hist.length > 26) hist.shift();
      trail.setAttribute('d', hist.length > 1 ? `M${hist.map((p) => p.map((v) => v.toFixed(1)).join(' ')).join(' L')}` : '');
      trail.setAttribute('opacity', (0.7 * (1 - tail)).toFixed(2));
    });

    // 3) El agujero "traga".
    targetEl?.animate?.(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }],
      { duration: 520, easing: 'cubic-bezier(.3,1.6,.5,1)' },
    );
  } finally {
    svg.remove();
  }
}
