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
// el mismo resorte. A los 90° (de canto) cambia la página y sigue girando, así
// se ve "frente → frente". También se puede arrastrar o revolear de costado:
//   hacia la izquierda = siguiente, hacia la derecha = anterior.
// Devuelve { turn(dir), bind } — bind va como props del contenedor.
const PAGE_PERSPECTIVE = 1600;     // px, en el espacio sin escalar de la carta
const DRAG_DEG_PER_PX = 0.55;
const EDGE_RESIST = 0.3;           // sin página para ir: tironea y vuelve
const EDGE_MAX = 35;

export function usePageTurn({ elRef, index, count, setIndex, enabled = true, reduced = false }) {
  const st = useRef({ a: 0, base: index, cancel: null, drag: null });
  const shownRef = useRef(index);
  const cfg = useRef({ count, setIndex, enabled, reduced });
  cfg.current = { count, setIndex, enabled, reduced };

  // Si la página cambia por fuera (p. ej. reset), seguirla cuando está quieta.
  useEffect(() => {
    const s = st.current;
    if (!s.cancel && !s.drag && s.a === 0) { s.base = index; shownRef.current = index; }
  }, [index]);

  const apply = useCallback((a) => {
    const s = st.current;
    s.a = a;
    const dir = Math.sign(a);
    const crossed = Math.abs(a) > 90;
    const shown = s.base + (crossed ? dir : 0);
    if (shown !== shownRef.current) { shownRef.current = shown; cfg.current.setIndex(shown); }
    const phi = crossed ? a - dir * 180 : a;
    const el = elRef.current;
    if (el) el.style.transform = Math.abs(phi) > 0.01 ? `perspective(${PAGE_PERSPECTIVE}px) rotateY(${phi}deg)` : '';
  }, [elRef]);

  const animate = useCallback((to, velocity = 0) => {
    const s = st.current;
    s.cancel?.();
    s.cancel = animateSpring({
      from: s.a, to, velocity, ...FLIP_SPRING, restDelta: 1.5, restSpeed: 30,
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
    if (s.a !== 0) { s.base = shownRef.current; apply(0); }
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
      style: enabled && !reduced ? { touchAction: 'pan-y', cursor: 'grab' } : undefined,
    },
  };
}
