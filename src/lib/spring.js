// Tiny damped-spring animator (no deps). Integrates with fixed sub-steps so
// the result is the same at 60 Hz or 144 Hz.
//   stiffness: how hard it pulls toward `to` (higher = faster)
//   damping:   how fast the bounce dies (lower = more rebote)
// Returns a cancel function.
export function animateSpring({
  from, to, velocity = 0, stiffness = 170, damping = 18, mass = 1,
  restDelta = 0.05, restSpeed = 0.05, onUpdate, onDone,
}) {
  let x = from;
  let v = velocity;
  let last = performance.now();
  let raf = 0;
  const STEP = 1 / 240;

  const tick = (now) => {
    let dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    while (dt > 0) {
      const h = Math.min(STEP, dt);
      const a = (-stiffness * (x - to) - damping * v) / mass;
      v += a * h;
      x += v * h;
      dt -= h;
    }
    const settled = Math.abs(v) < restSpeed && Math.abs(x - to) < restDelta;
    if (settled) {
      onUpdate?.(to, 0);
      onDone?.();
      return;
    }
    onUpdate?.(x, v);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}
