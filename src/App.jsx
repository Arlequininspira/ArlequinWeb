import { useState, useEffect, useRef } from 'react'
import { runBlackHole } from './effects/blackHole'
import GalaxyBackground from './components/GalaxyBackground'
import ThemeToggleStar from './components/ThemeToggleStar'
import LogoAnimation from './components/LogoAnimation'
import ArlequinMaskSystem from './components/ArlequinMaskSystem'
import FooterBanner from './components/FooterBanner'
import WhatsAppButton from './components/WhatsAppButton'
import RotateHint from './components/RotateHint'
import { useLowEndDevice } from './hooks/useLowEndDevice'
import './App.css'

const THEME_STORAGE_KEY = 'themeMode';

const ANIMATION_PHASE = {
  HOME: 'home',
  LOGO_SHRINKING: 'logoShrinking',
  MASK_CLOSING: 'maskClosing',
  MASK_OPENING: 'maskOpening',
  CONTENT_VISIBLE: 'contentVisible',
  REVERSE_CLOSING: 'reverseClosing',
  REVERSE_OPENING: 'reverseOpening',
  LOGO_GROWING: 'logoGrowing'
};

function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    return savedTheme ? savedTheme === 'dark' : true;
  });

  const [phase, setPhase] = useState(ANIMATION_PHASE.HOME);
  const { isLowEnd, prefersReducedMotion } = useLowEndDevice();

  // Pause ambient star canvases on mobile only: the main thread is shared with
  // card animations and constrained GPUs feel the difference. Desktop has enough
  // headroom to keep the background running continuously.
  const isMobileDevice = navigator.maxTouchPoints > 0 && !window.matchMedia('(hover: hover)').matches;
  const ambientPaused = isMobileDevice && phase === ANIMATION_PHASE.CONTENT_VISIBLE;

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);


  // Cambio de tema con agujero negro: solo con el fondo Galaxy (WebGL2) y sin
  // "reducir movimiento"; si no, cambio directo como siempre.
  const holeRef = useRef(null);
  const togglingRef = useRef(false);
  const handleToggle = (event) => {
    if (togglingRef.current) return;
    const hole = holeRef.current;
    const button = event?.currentTarget;
    if (!hole || !button || prefersReducedMotion || !Element.prototype.animate || !document.querySelector('.galaxy-background')) {
      setIsDarkMode(prev => !prev);
      return;
    }
    togglingRef.current = true;
    runBlackHole({ hole, button, sky: document.querySelector('.galaxy-background'), onPeak: () => setIsDarkMode(prev => !prev) })
      .catch((err) => console.error(err))
      .finally(() => { togglingRef.current = false; });
  };

  const handleLogoClick = () => {
    if (phase === ANIMATION_PHASE.HOME) {
      setPhase(ANIMATION_PHASE.LOGO_SHRINKING);
    }
  };

  const handleEscudoReset = () => {
    if (phase === ANIMATION_PHASE.CONTENT_VISIBLE) {
      setPhase(ANIMATION_PHASE.REVERSE_CLOSING);
    }
  };

  const handleMaskTransitionEnd = () => {
    if (phase === ANIMATION_PHASE.LOGO_SHRINKING) {
      setPhase(ANIMATION_PHASE.MASK_CLOSING);
      return;
    }

    if (phase === ANIMATION_PHASE.MASK_CLOSING) {
      setPhase(ANIMATION_PHASE.MASK_OPENING);
      return;
    }

    if (phase === ANIMATION_PHASE.MASK_OPENING) {
      setPhase(ANIMATION_PHASE.CONTENT_VISIBLE);
      return;
    }

    if (phase === ANIMATION_PHASE.REVERSE_CLOSING) {
      setPhase(ANIMATION_PHASE.REVERSE_OPENING);
      return;
    }

    if (phase === ANIMATION_PHASE.REVERSE_OPENING) {
      setPhase(ANIMATION_PHASE.LOGO_GROWING);
    }
  };

  const handleLogoGrowComplete = () => {
    setPhase(ANIMATION_PHASE.HOME);
  };

  // Handle request to close and reopen mask (for NO -> card animation)
  const handleRequestMaskAnimation = () => {
    if (phase === ANIMATION_PHASE.CONTENT_VISIBLE) {
      setPhase(ANIMATION_PHASE.MASK_CLOSING);
    }
  };

  const isLogoShrinking =
    phase === ANIMATION_PHASE.LOGO_SHRINKING ||
    phase === ANIMATION_PHASE.MASK_CLOSING ||
    phase === ANIMATION_PHASE.MASK_OPENING ||
    phase === ANIMATION_PHASE.CONTENT_VISIBLE ||
    phase === ANIMATION_PHASE.REVERSE_CLOSING ||
    phase === ANIMATION_PHASE.REVERSE_OPENING;

  const isLogoRestoring = phase === ANIMATION_PHASE.LOGO_GROWING;

  return (
    <div className="app">
      <GalaxyBackground isDarkMode={isDarkMode} isLowEnd={isLowEnd} prefersReducedMotion={prefersReducedMotion} isPaused={ambientPaused} holeRef={holeRef} />
      <ThemeToggleStar isDarkMode={isDarkMode} onToggle={handleToggle} isLowEnd={isLowEnd} isPaused={ambientPaused} />

      <div className="bh-layer" data-z="100">
      <LogoAnimation
        isDarkMode={isDarkMode}
        onClick={handleLogoClick}
        isShrinking={isLogoShrinking}
        isRestoring={isLogoRestoring}
        isHidden={false}
        onRestoreComplete={handleLogoGrowComplete}
      />
      </div>

      <div className="bh-layer" data-z="1000">
      <ArlequinMaskSystem
        isDarkMode={isDarkMode}
        phase={phase}
        onReset={handleEscudoReset}
        onMaskTransitionEnd={handleMaskTransitionEnd}
        onRequestMaskAnimation={handleRequestMaskAnimation}
        isLowEnd={isLowEnd}
        prefersReducedMotion={prefersReducedMotion}
      />
      </div>

      <div className="bh-layer" data-z="50"><FooterBanner isDarkMode={isDarkMode} /></div>
      <div className="bh-layer" data-z="1500"><WhatsAppButton isDarkMode={isDarkMode} isLowEnd={isLowEnd} /></div>
      <RotateHint isDarkMode={isDarkMode} />

      <main className="content" />
    </div>
  )
}

export default App
export { ANIMATION_PHASE };

