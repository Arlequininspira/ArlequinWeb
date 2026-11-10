import { useState } from 'react';
import Galaxy from './galaxy/Galaxy';
import BackgroundAnimation from './BackgroundAnimation';

// Fondo del sitio: galaxia WebGL de React Bits. Si el navegador no tiene
// WebGL2 (o la placa está bloqueada), o el equipo es de gama baja, vuelve a
// las estrellas de siempre. `?fondo=estrellas` fuerza el fondo viejo para
// comparar.
const hasWebGL2 = () => {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
};

// Configs elegidas en reactbits.dev (Customize). lightMode no se fija: sigue al
// tema del sitio (claro = estrellas oscuras).
// Oscuro: preset Sparkle, menos luminoso que Classic sobre fondo negro.
const DARK_SKY = {
  hueShift: 0, saturation: 0, density: 0.8, glowIntensity: 0.2, starSize: 1,
  flareIntensity: 4, twinkleIntensity: 0.04, starSpeed: 0.5, speed: 0.5,
  rotationSpeed: 0.03, layers: 2, direction: 'forward',
};
// Claro: preset Classic (la config anterior).
const LIGHT_SKY = {
  hueShift: 0, saturation: 0, density: 0.5, glowIntensity: 0.63, starSize: 0.75,
  flareIntensity: 2.3, twinkleIntensity: 0.5, starSpeed: 1.5, speed: 0.1,
  rotationSpeed: 0.01, layers: 2, direction: 'forward',
};

function GalaxyBackground({ isDarkMode = true, isLowEnd = false, prefersReducedMotion = false, isPaused = false, holeRef }) {
  const [useGalaxy] = useState(() =>
    hasWebGL2() && !isLowEnd && new URLSearchParams(window.location.search).get('fondo') !== 'estrellas');

  if (!useGalaxy) {
    return (
      <BackgroundAnimation isDarkMode={isDarkMode} isLowEnd={isLowEnd}
        prefersReducedMotion={prefersReducedMotion} isPaused={isPaused} />
    );
  }

  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  return (
    <div className="galaxy-background" aria-hidden="true"
      style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none', background: isDarkMode ? '#000' : '#fff' }}>
      <Galaxy
        transparent={false}
        lightMode={!isDarkMode}
        disableAnimation={isPaused || prefersReducedMotion}
        {...(isDarkMode ? DARK_SKY : LIGHT_SKY)}
        mouseInteraction={false}
        mouseRepulsion={false}
        clickWarp={false}
        intro
        holeRef={holeRef}
        // Pantalla completa: limitar la resolución alivia la GPU del celular.
        dpr={isMobile ? 1 : 1.5}
      />
    </div>
  );
}

export default GalaxyBackground;
