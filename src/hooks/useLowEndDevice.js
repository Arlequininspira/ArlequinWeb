import { useEffect, useState } from 'react';

function benchmarkSync() {
  const t0 = performance.now();
  let x = 0;
  for (let i = 0; i < 500_000; i++) x += Math.sqrt(i);
  void x;
  return performance.now() - t0;
}

export function useLowEndDevice() {
  const [isLowEnd, setIsLowEnd] = useState(false);
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const cores = navigator.hardwareConcurrency || 4;
    const mem = navigator.deviceMemory || 4; // undefined on non-Chromium
    if (cores <= 2 || mem <= 1) {
      setIsLowEnd(true);
      return;
    }
    if (cores <= 4 || mem <= 2) {
      setIsLowEnd(benchmarkSync() > 50);
    }
  }, []);

  return { isLowEnd, prefersReducedMotion };
}
