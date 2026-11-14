// Giro 3D con resorte dibujado en el canvas de las cartas (reemplaza los
// 13 cuadros pre-renderizados del giro). Preset elegido en /lab/flip:
// "1 · Resorte suave" → primero agranda, después gira con rebote marcado.
import { useCallback, useEffect, useRef } from 'react';
import { animateSpring } from '../lib/spring';

export const FLIP_SPRING = { stiffness: 90, damping: 9 };
// Desde la grilla el canvas agranda con CSS en 0,3 s: el giro arranca un poco
// antes de que termine, igual que en el lab. (Fuera de la grilla las cartas
// ya esperan 600 ms antes de animar, así que ahí no hace falta demora.)
export const FLIP_DELAY_FROM_GRID = 260;

// Rectángulo visible de la carta dentro del lienzo 1000×1400 de los cuadros
// (los cuadros de 684×950 —el dorso— tienen la carta en 8,9 668×932).
const srcRect = (img) => (img.naturalWidth >= 1000
  ? { x: 166, y: 234, w: 668, h: 932 }
  : { x: 8, y: 9, w: 668, h: 932 });

// Dibuja la carta rotada `angle` grados sobre el eje vertical, con perspectiva.
// 0° = dorso de frente, 180° = frente. Se dibuja en franjas verticales: cada
// franja se escala según su profundidad, como haría CSS `perspective`.
export function drawFlip(ctx, back, front, angle, w, h, strips = 48) {
  ctx.clearRect(0, 0, w, h);
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const img = cos >= 0 ? back : front;
  if (!img) return;
  const s = srcRect(img);
  const cw = (668 / 1000) * w;
  const ch = (932 / 1400) * h;
  const cx = w / 2;
  const cy = h / 2;
  const p = cw * 4; // misma relación perspectiva/ancho que el lab
  const mirror = cos >= 0 ? 1 : -1; // el frente está pegado de espaldas

  for (let i = 0; i < strips; i++) {
    const x0 = -cw / 2 + (cw * i) / strips;
    const x1 = x0 + cw / strips;
    const f0 = p / (p + x0 * sin);
    const f1 = p / (p + x1 * sin);
    const X0 = x0 * cos * f0;
    const X1 = x1 * cos * f1;
    const fm = (f0 + f1) / 2;
    // columna de origen: en el frente se recorre al revés
    const u0 = mirror === 1 ? x0 : -x1;
    const sx = s.x + ((u0 + cw / 2) / cw) * s.w;
    const sw = s.w / strips;
    const dx = cx + Math.min(X0, X1);
    const dw = Math.abs(X1 - X0) + 0.6; // solapa medio píxel: sin costuras
    const dh = ch * fm;
    ctx.drawImage(img, sx, s.y, sw, s.h, dx, cy - dh / 2, dw, dh);
  }
}

// Corre el resorte de `from` a `to` grados llamando draw(angle) en cada cuadro.
export function playFlip({ from, to, draw, onDone }) {
  return animateSpring({
    from, to, ...FLIP_SPRING,
    // Termina cuando el rebote ya no se nota (±1,5°), no cuando queda
    // perfectamente quieto: si no, el texto tarda ~2 s en aparecer.
    restDelta: 1.5, restSpeed: 30,
    onUpdate: (a) => draw(a),
    onDone,
  });
}

// ── Pasar de página girando la carta ─────────────────────────────────────────
// Gira el contenedor entero de la carta (fondo + título + texto + botones) con
// un resorte propio, algo más lento que el de abrir. La vuelta es completa: frente → dorso → frente nuevo, así
// en la mitad del giro se ve el dorso de rombos y no se pierde que es una carta.
// El resorte corre de 0 a ±180; warp() lo
// estira a 0..±360 acelerando el centro del giro, no las puntas.
// También se puede arrastrar o revolear de costado:
//   hacia la izquierda = siguiente, hacia la derecha = anterior.
// Devuelve { turn(dir), bind } — bind va como props del contenedor.
const PAGE_PERSPECTIVE = 1600;     // px, en el espacio sin escalar de la carta
const DRAG_DEG_PER_PX = 0.55;
const EDGE_RESIST = 0.3;           // sin página para ir: tironea y vuelve
const EDGE_MAX = 35;
// Más blando que FLIP_SPRING (90/9): el giro de página tarda ~1,3× más, con
// el mismo rebote proporcional.
const PAGE_SPRING = { stiffness: 52, damping: 6.8 };

// Tilt de la carta abierta, igual que en la grilla: mouse en escritorio,
// giroscopio en mobile. Se suma al giro de página.
const TILT_MAX = 8;        // grados, mouse
const GYRO_MAX = 7;        // grados, giroscopio
const GYRO_GAIN = 0.35;
const clampDeg = (v, m) => Math.max(-m, Math.min(m, v));

// Progreso del resorte (0..±180) → ángulo visible (0..±360). Pendiente 1 en
// las puntas (el rebote final se ve igual que antes) y 2,5 en el medio.
const warp = (a) => {
  const t = Math.min(Math.abs(a), 180) / 180;
  return a + Math.sign(a) * 180 * t * t * (3 - 2 * t);
};

// Capa con el dorso (misma imagen que la grilla) sobre el rectángulo de la
// carta dentro del canvas. Se crea a mano para no tocar cada componente.
// Cuadro del dorso: 684×950 con la carta en 8,9 668×932; en el canvas la
// carta ocupa 166,234 668×932 de un lienzo 1000×1400.
function ensureDorso(el, theme) {
  let layer = el.querySelector(':scope > .page-turn-dorso');
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'page-turn-dorso';
    layer.setAttribute('aria-hidden', 'true');
    const img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    layer.appendChild(img);
    el.appendChild(layer);
  }
  const img = layer.firstChild;
  const src = `/Cartas/00000_arlequin_dorso_${theme}.avif`;
  if (img.getAttribute('src') !== src) img.setAttribute('src', src);
  const canvas = el.querySelector('canvas');
  if (canvas) {
    const cw = canvas.offsetWidth;
    const ch = canvas.offsetHeight;
    const w = (668 / 1000) * cw;
    const h = (932 / 1400) * ch;
    Object.assign(layer.style, {
      left: `${canvas.offsetLeft + (166 / 1000) * cw}px`,
      top: `${canvas.offsetTop + (234 / 1400) * ch}px`,
      width: `${w}px`,
      height: `${h}px`,
    });
    Object.assign(img.style, {
      width: `${(684 / 668) * w}px`,
      height: `${(950 / 932) * h}px`,
      left: `${(-8 / 668) * w}px`,
      top: `${(-9 / 932) * h}px`,
    });
  }
  return layer;
}

export function usePageTurn({ elRef, index, count, setIndex, enabled = true, reduced = false, isDarkMode = true }) {
  const st = useRef({ a: 0, base: index, cancel: null, drag: null });
  const shownRef = useRef(index);
  const backRef = useRef(false);
  // phi = ángulo del giro de página; tilt = inclinación actual/objetivo.
  const view = useRef({ phi: 0, x: 0, y: 0, tx: 0, ty: 0, raf: 0 });
  const cfg = useRef({ count, setIndex, enabled, reduced, isDarkMode });
  cfg.current = { count, setIndex, enabled, reduced, isDarkMode };

  // Si la página cambia por fuera (p. ej. reset), seguirla cuando está quieta.
  useEffect(() => {
    const s = st.current;
    if (!s.cancel && !s.drag && s.a === 0) { s.base = index; shownRef.current = index; }
  }, [index]);

  const apply = useCallback((a) => {
    const s = st.current;
    s.a = a;
    const dir = Math.sign(a);
    const v = warp(a);
    const av = Math.abs(v);
    // 0..90 página actual · 90..270 dorso · 270..360 página nueva
    const back = av > 90 && av < 270;
    const crossed = av >= 270;
    const shown = s.base + (crossed ? dir : 0);
    if (shown !== shownRef.current) { shownRef.current = shown; cfg.current.setIndex(shown); }
    const phi = crossed ? v - dir * 360 : back ? v - dir * 180 : v;
    view.current.phi = phi;
    const el = elRef.current;
    if (!el) return;
    if (back !== backRef.current) {
      backRef.current = back;
      if (back) ensureDorso(el, cfg.current.isDarkMode ? 'dark' : 'clear');
      el.classList.toggle('page-turn--back', back);
    }
    paint();
  }, [elRef]); // eslint-disable-line react-hooks/exhaustive-deps

  // Arma el transform con el giro de página + el tilt.
  const paint = () => {
    const el = elRef.current;
    if (!el) return;
    const { phi, x, y } = view.current;
    const ry = phi + y;
    el.style.transform = Math.abs(ry) > 0.01 || Math.abs(x) > 0.01
      ? `perspective(${PAGE_PERSPECTIVE}px) rotateX(${x.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`
      : '';
  };
  // El tilt va suavizado hacia el objetivo; mientras gira o se arrastra la
  // página, el objetivo es 0 para que el giro se vea limpio.
  const tiltTick = () => {
    const t = view.current;
    const busy = st.current.cancel || st.current.drag;
    const gx = busy ? 0 : t.tx;
    const gy = busy ? 0 : t.ty;
    t.x += (gx - t.x) * 0.15;
    t.y += (gy - t.y) * 0.15;
    if (Math.abs(gx - t.x) + Math.abs(gy - t.y) < 0.02) { t.x = gx; t.y = gy; t.raf = 0; }
    else t.raf = requestAnimationFrame(tiltTick);
    paint();
  };
  const setTilt = (x, y) => {
    const t = view.current;
    t.tx = x; t.ty = y;
    if (!t.raf) t.raf = requestAnimationFrame(tiltTick);
  };

  // Giroscopio (mobile), con la misma "posición neutra" que se acomoda sola.
  useEffect(() => {
    if (!enabled || reduced) return;
    if (window.matchMedia('(hover: hover)').matches) return;
    if (typeof DeviceOrientationEvent === 'undefined') return;
    let base = null;
    const onOrient = (e) => {
      if (e.beta == null || e.gamma == null) return;
      if (!base) base = { b: e.beta, g: e.gamma };
      base.b += (e.beta - base.b) * 0.01;
      base.g += (e.gamma - base.g) * 0.01;
      setTilt(clampDeg(-(e.beta - base.b) * GYRO_GAIN, GYRO_MAX), clampDeg((e.gamma - base.g) * GYRO_GAIN, GYRO_MAX));
    };
    window.addEventListener('deviceorientation', onOrient);
    return () => { window.removeEventListener('deviceorientation', onOrient); setTilt(0, 0); };
  }, [enabled, reduced]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => cancelAnimationFrame(view.current.raf), []);

  const animate = useCallback((to, velocity = 0) => {
    const s = st.current;
    s.cancel?.();
    s.cancel = animateSpring({
      from: s.a, to, velocity, ...PAGE_SPRING, restDelta: 1.5, restSpeed: 30,
      onUpdate: apply,
      onDone: () => {
        s.cancel = null;
        if (Math.abs(to) === 180) s.base += Math.sign(to);
        apply(0);
      },
    });
  }, [apply]);

  const canGo = (dir) => {
    const t = st.current.base + dir;
    return t >= 0 && t < cfg.current.count;
  };

  const turn = useCallback((dir) => {
    const s = st.current;
    if (!cfg.current.enabled || s.drag) return;
    // Si todavía está girando, la base ya es la página que se está mostrando.
    if (s.cancel) { s.cancel(); s.cancel = null; s.base = shownRef.current; s.a = 0; apply(0); }
    if (!canGo(dir)) return;
    if (cfg.current.reduced) { s.base += dir; shownRef.current = s.base; cfg.current.setIndex(s.base); return; }
    animate(dir * 180);
  }, [animate, apply]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al cerrar la carta (enabled=false) se corta cualquier giro y se endereza.
  useEffect(() => {
    if (enabled) return;
    const s = st.current;
    s.cancel?.(); s.cancel = null; s.drag = null;
    const t = view.current;
    cancelAnimationFrame(t.raf);
    Object.assign(t, { x: 0, y: 0, tx: 0, ty: 0, raf: 0 });
    if (s.a !== 0) s.base = shownRef.current;
    apply(0);
  }, [enabled, apply]);
  useEffect(() => () => st.current.cancel?.(), []);

  const onPointerDown = (e) => {
    const s = st.current;
    if (!cfg.current.enabled || cfg.current.reduced || e.button > 0) return;
    if (e.target.closest('button, a, input, textarea, select')) return;
    if (e.pointerType === 'mouse') e.preventDefault(); // sin selección de texto
    s.cancel?.(); s.cancel = null;
    s.drag = { x: e.clientX, a0: s.a, moved: false, last: e.clientX, t: performance.now(), v: 0, id: e.pointerId };
  };
  const onPointerMove = (e) => {
    const d = st.current.drag;
    if (!d && e.pointerType === 'mouse' && cfg.current.enabled && !cfg.current.reduced) {
      const r = e.currentTarget.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      setTilt(clampDeg(-py * 2 * TILT_MAX, TILT_MAX), clampDeg(px * 2 * TILT_MAX, TILT_MAX));
      return;
    }
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    if (!d.moved) {
      if (Math.abs(dx) < 6) return;
      d.moved = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    const now = performance.now();
    d.v = (-(e.clientX - d.last) * DRAG_DEG_PER_PX) / Math.max((now - d.t) / 1000, 0.001);
    d.last = e.clientX; d.t = now;
    let a = d.a0 - dx * DRAG_DEG_PER_PX;
    if (!canGo(Math.sign(a))) a = Math.sign(a) * Math.min(Math.abs(a) * EDGE_RESIST, EDGE_MAX);
    apply(Math.max(-180, Math.min(180, a)));
  };
  const onPointerUp = (e) => {
    const s = st.current;
    const d = s.drag;
    if (!d || e.pointerId !== d.id) return;
    s.drag = null;
    if (!d.moved) { if (s.a !== 0) animate(0); return; }
    const projected = s.a + d.v * 0.2;
    const dir = Math.sign(projected);
    const go = Math.abs(projected) > 90 && canGo(dir);
    animate(go ? dir * 180 : 0, d.v);
  };

  return {
    turn,
    bind: {
      onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp,
      onPointerLeave: (e) => { if (e.pointerType === 'mouse') setTilt(0, 0); },
      style: enabled && !reduced ? { touchAction: 'pan-y', cursor: 'grab' } : undefined,
    },
  };
}
