// /lab/flip — banco de pruebas del giro de carta (solo en `npm run dev`).
// Compara el giro actual (13 cuadros pre-renderizados) contra un giro 3D real
// con resorte, estilo ReactBits Flip Card. Nada de esto toca el sitio.
import { useEffect, useRef, useState, useCallback } from 'react';
import { animateSpring } from '../lib/spring';
import './FlipLab.css';

const C = '/Cartas/';
const dorso = (t) => `${C}00000_arlequin_dorso_${t}.avif`;
const frente = (t) => `${C}00012_arlequin_frente_${t}.avif`;
const frames = (t) => Array.from({ length: 13 }, (_, i) =>
  `${C}${String(i).padStart(5, '0')}_arlequin_${i < 7 ? 'dorso' : 'frente'}_${t}.avif`);

const PRESETS = [
  { id: 'suave', name: 'Resorte suave', note: 'Agranda y después gira, con rebote marcado.',
    mode: 'seq', grow: [180, 20], flip: [90, 9], lift: 0, tilt: 0 },
  { id: 'firme', name: 'Resorte firme', note: 'Agranda y gira rápido, rebote corto.',
    mode: 'seq', grow: [260, 26], flip: [240, 19], lift: 0, tilt: 0 },
  { id: 'juntos', name: 'Juntos + se levanta', note: 'Agranda mientras gira; a mitad del giro se acerca.',
    mode: 'together', grow: [140, 18], flip: [110, 12], lift: 0.18, tilt: 0 },
  { id: 'inclina', name: 'Con inclinación', note: 'Gira con un leve cabeceo, como tirada con la mano.',
    mode: 'seq', grow: [200, 22], flip: [120, 11], lift: 0.08, tilt: 14 },
];

const DEFAULT_CUSTOM = { id: 'custom', name: 'Personalizada', note: 'Movés los controles de abajo.',
  mode: 'seq', grow: [200, 22], flip: [120, 12], lift: 0.1, tilt: 6 };

// ── Carta con giro 3D + resorte ─────────────────────────────────────────────
function SpringFlipCard({ theme, cfg, scaleTo, axis, playToken, perspective }) {
  const innerRef = useRef(null);
  const st = useRef({ s: 1, a: 0, open: false, cancels: [] });
  const drag = useRef(null);

  const paint = useCallback(() => {
    const { s, a } = st.current;
    const k = Math.sin((a * Math.PI) / 180);           // 0 → 1 → 0 durante el giro
    const scale = s * (1 + cfg.lift * Math.abs(k));
    const tilt = cfg.tilt * k;
    const rot = axis === 'x' ? `rotateX(${-a}deg) rotateY(${tilt}deg)` : `rotateX(${tilt}deg) rotateY(${a}deg)`;
    if (innerRef.current) innerRef.current.style.transform = `scale(${scale}) ${rot}`;
  }, [cfg.lift, cfg.tilt, axis]);

  const stop = () => { st.current.cancels.forEach((c) => c()); st.current.cancels = []; };

  const spring = (key, to, [k, c], extra = {}) => new Promise((done) => {
    st.current.cancels.push(animateSpring({
      from: st.current[key], to, stiffness: k, damping: c, ...extra,
      onUpdate: (x) => { st.current[key] = x; paint(); },
      onDone: done,
    }));
  });

  // Arranca el giro cuando el agrandado llegó (casi) al tamaño final,
  // sin esperar a que termine de rebotar.
  const whenGrown = (target) => new Promise((go) => {
    const check = () => (Math.abs(st.current.s - target) < Math.abs(target - 1) * 0.06 ? go() : requestAnimationFrame(check));
    check();
  });

  const toggle = useCallback(async () => {
    stop();
    const open = !st.current.open;
    st.current.open = open;
    const sTo = open ? scaleTo : 1;
    const aTo = open ? 180 : 0;
    if (cfg.mode === 'together') {
      spring('s', sTo, cfg.grow); spring('a', aTo, cfg.flip);
    } else if (open) {
      spring('s', sTo, cfg.grow); await whenGrown(sTo); if (st.current.open) spring('a', aTo, cfg.flip);
    } else {
      spring('a', aTo, cfg.flip);
      await new Promise((r) => setTimeout(r, 220));
      if (!st.current.open) spring('s', sTo, cfg.grow);
    }
  }, [cfg, scaleTo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (playToken) toggle(); }, [playToken]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { paint(); }, [paint]);
  useEffect(() => stop, []);

  // Arrastrar / revolear para girar (como el original de ReactBits).
  const onDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, a: st.current.a, t: performance.now(), last: e.clientX, v: 0, moved: false };
  };
  const onMove = (e) => {
    const d = drag.current; if (!d) return;
    const dx = (axis === 'x' ? -(e.clientY - d.y) : e.clientX - d.x);
    if (Math.abs(dx) > 5 && !d.moved) { d.moved = true; stop(); }
    if (!d.moved) return;
    const now = performance.now();
    const pos = axis === 'x' ? -e.clientY : e.clientX;
    d.v = ((pos - d.last) / Math.max(now - d.t, 1)) * 1000 * 0.6;
    d.last = pos; d.t = now;
    st.current.a = d.a + dx * 0.6;
    paint();
  };
  const onUp = () => {
    const d = drag.current; drag.current = null;
    if (!d) return;
    if (!d.moved) { toggle(); return; }
    const projected = st.current.a + d.v * 0.25;
    const to = Math.round(projected / 180) * 180;
    st.current.open = Math.abs(to / 180) % 2 === 1;
    spring('a', to, cfg.flip, { velocity: d.v });
    spring('s', st.current.open ? scaleTo : 1, cfg.grow);
  };

  return (
    <div className="fl-card" style={{ perspective: `${perspective}px` }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <div className="fl-inner" ref={innerRef}>
        <div className="fl-face fl-back"><img src={dorso(theme)} alt="" draggable="false" /></div>
        <div className={`fl-face fl-front${axis === 'x' ? ' x' : ''}`}><img src={frente(theme)} alt="" draggable="false" /></div>
      </div>
    </div>
  );
}

// ── Giro actual: cuadros pre-renderizados (25 ms c/u) ───────────────────────
function FramesCard({ theme, scaleTo, playToken }) {
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  const timer = useRef(0);
  const list = frames(theme);

  const toggle = useCallback(() => {
    clearInterval(timer.current);
    const next = !open; setOpen(next);
    let f = next ? 0 : 12;
    // igual que el sitio: primero agranda (0,3 s) y después pasan los cuadros
    setTimeout(() => {
      timer.current = setInterval(() => {
        f += next ? 1 : -1; setI(f);
        if (f <= 0 || f >= 12) clearInterval(timer.current);
      }, 25);
    }, next ? 300 : 0);
  }, [open]);

  useEffect(() => { if (playToken) toggle(); }, [playToken]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearInterval(timer.current), []);

  return (
    <div className="fl-card" onClick={toggle}>
      <div className="fl-frames" style={{ transform: `scale(${open ? scaleTo : 1})`, transition: `transform .3s ${open ? 'ease-out' : 'ease-in .3s'}` }}>
        <img className={i === 0 ? 'dorso' : 'frame'} src={list[i]} alt="" draggable="false" />
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step = 1, onChange, hint }) {
  return (
    <label className="fl-slider">
      <span>{label} <b>{value}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      {hint && <small>{hint}</small>}
    </label>
  );
}

export default function FlipLab() {
  const [theme, setTheme] = useState('dark');
  const [axis, setAxis] = useState('y');
  const [scaleTo, setScaleTo] = useState(1.5);
  const [perspective, setPerspective] = useState(900);
  const [all, setAll] = useState(0);
  const [custom, setCustom] = useState(DEFAULT_CUSTOM);
  const set = (patch) => setCustom((c) => ({ ...c, ...patch }));

  // Precargar ambos temas para que la primera prueba no parpadee.
  useEffect(() => {
    ['dark', 'clear'].forEach((t) => [...frames(t), dorso(t), frente(t)].forEach((src) => { new Image().src = src; }));
    document.title = 'Arlequín · Lab giro de carta';
  }, []);

  const cards = [...PRESETS, custom];

  return (
    <div className={`fl-page ${theme}`}>
      <header className="fl-head">
        <div>
          <h1>Prueba de giro de carta</h1>
          <p>Click en una carta: se agranda y gira. Click de nuevo: vuelve. También se puede <b>arrastrar o revolear</b> para girarla.</p>
        </div>
        <div className="fl-tools">
          <button onClick={() => setAll((n) => n + 1)} className="primary">Probar todas</button>
          <button onClick={() => setTheme(theme === 'dark' ? 'clear' : 'dark')}>Tema: {theme === 'dark' ? 'oscuro' : 'claro'}</button>
          <button onClick={() => setAxis(axis === 'y' ? 'x' : 'y')}>Eje: {axis === 'y' ? 'horizontal' : 'vertical'}</button>
        </div>
      </header>

      <div className="fl-grid">
        <figure className="fl-cell">
          <FramesCard key={theme} theme={theme} scaleTo={scaleTo} playToken={all} />
          <figcaption><b>0 · Actual</b><span>13 cuadros pre-renderizados, sin rebote.</span></figcaption>
        </figure>
        {cards.map((c, n) => (
          <figure className="fl-cell" key={c.id}>
            <SpringFlipCard theme={theme} cfg={c} axis={axis} scaleTo={scaleTo} perspective={perspective} playToken={all} />
            <figcaption><b>{n + 1} · {c.name}</b><span>{c.note}</span></figcaption>
          </figure>
        ))}
      </div>

      <section className="fl-panel">
        <h2>Controles de la “Personalizada” (5)</h2>
        <div className="fl-row">
          <label className="fl-slider"><span>Orden</span>
            <select value={custom.mode} onChange={(e) => set({ mode: e.target.value })}>
              <option value="seq">Primero agranda, después gira</option>
              <option value="together">Agranda y gira a la vez</option>
            </select>
          </label>
          <Slider label="Velocidad del giro" value={custom.flip[0]} min={40} max={400} onChange={(v) => set({ flip: [v, custom.flip[1]] })} hint="más alto = gira más rápido" />
          <Slider label="Freno del giro" value={custom.flip[1]} min={4} max={40} onChange={(v) => set({ flip: [custom.flip[0], v] })} hint="más bajo = más rebote" />
          <Slider label="Velocidad al agrandar" value={custom.grow[0]} min={40} max={400} onChange={(v) => set({ grow: [v, custom.grow[1]] })} />
          <Slider label="Freno al agrandar" value={custom.grow[1]} min={4} max={40} onChange={(v) => set({ grow: [custom.grow[0], v] })} />
          <Slider label="Se levanta" value={custom.lift} min={0} max={0.4} step={0.02} onChange={(v) => set({ lift: v })} hint="cuánto se acerca a mitad del giro" />
          <Slider label="Inclinación" value={custom.tilt} min={0} max={30} onChange={(v) => set({ tilt: v })} hint="grados de cabeceo" />
        </div>
        <h2>Para todas</h2>
        <div className="fl-row">
          <Slider label="Tamaño al seleccionar" value={scaleTo} min={1} max={2} step={0.05} onChange={setScaleTo} />
          <Slider label="Perspectiva" value={perspective} min={300} max={2000} step={50} onChange={setPerspective} hint="más bajo = 3D más exagerado" />
        </div>
        <pre className="fl-code">{JSON.stringify({ ...custom, id: undefined, name: undefined, note: undefined, scaleTo, perspective, axis })}</pre>
      </section>
    </div>
  );
}
