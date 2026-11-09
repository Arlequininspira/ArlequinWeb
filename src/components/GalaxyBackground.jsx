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

function GalaxyBackground({ isDarkMode = true, isLowEnd = false, prefersReducedMotion = false, isPaused = false }) {
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
        // 3 capas en vez de 4: ~25 % menos estrellas y ~25 % menos trabajo de
        // GPU por píxel (el costo depende de las capas, no de cuántas estrellas
        // se ven; bajar `density` sacaría estrellas pero no aliviaría nada).
        layers={3}
        // Pantalla completa: limitar la resolución alivia la GPU del celular.
        dpr={isMobile ? 1 : 1.5}
      />
    </div>
  );
}

export default GalaxyBackground;
