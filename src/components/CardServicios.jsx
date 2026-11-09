import { useState, useEffect, useRef } from 'react';
import './CardQueEsArlequin.css';
import { drawFlip, playFlip, FLIP_DELAY_FROM_GRID, usePageTurn } from './cardFlip';
import './CardServicios.css';

// Open animation frames
const CARD_FRAMES_CLEAR = [
  '00000_arlequin_dorso_clear.avif',
  '00001_arlequin_dorso_clear.avif',
  '00002_arlequin_dorso_clear.avif',
  '00003_arlequin_dorso_clear.avif',
  '00004_arlequin_dorso_clear.avif',
  '00005_arlequin_dorso_clear.avif',
  '00006_arlequin_dorso_clear.avif',
  '00007_arlequin_frente_clear.avif',
  '00008_arlequin_frente_clear.avif',
  '00009_arlequin_frente_clear.avif',
  '00010_arlequin_frente_clear.avif',
  '00011_arlequin_frente_clear.avif',
  '00012_arlequin_frente_clear.avif',
];

const CARD_FRAMES_DARK = [
  '00000_arlequin_dorso_dark.avif',
  '00001_arlequin_dorso_dark.avif',
  '00002_arlequin_dorso_dark.avif',
  '00003_arlequin_dorso_dark.avif',
  '00004_arlequin_dorso_dark.avif',
  '00005_arlequin_dorso_dark.avif',
  '00006_arlequin_dorso_dark.avif',
  '00007_arlequin_frente_dark.avif',
  '00008_arlequin_frente_dark.avif',
  '00009_arlequin_frente_dark.avif',
  '00010_arlequin_frente_dark.avif',
  '00011_arlequin_frente_dark.avif',
  '00012_arlequin_frente_dark.avif',
];

const CLOSE_FRAMES_CLEAR = [
  '00013_arlequin_frente_clear.avif',
  '00014_arlequin_frente_clear.avif',
  '00015_arlequin_frente_clear.avif',
  '00016_arlequin_frente_clear.avif',
  '00017_arlequin_frente_clear.avif',
  '00018_arlequin_frente_clear.avif',
  '00019_arlequin_dorso_clear.avif',
  '00020_arlequin_dorso_clear.avif',
  '00021_arlequin_dorso_clear.avif',
  '00022_arlequin_dorso_clear.avif',
  '00023_arlequin_dorso_clear.avif',
  '00000_arlequin_dorso_clear.avif',
  
];

const CLOSE_FRAMES_DARK = [
  '00013_arlequin_frente_dark.avif',
  '00014_arlequin_frente_dark.avif',
  '00015_arlequin_frente_dark.avif',
  '00016_arlequin_frente_dark.avif',
  '00017_arlequin_frente_dark.avif',
  '00018_arlequin_frente_dark.avif',
  '00019_arlequin_dorso_dark.avif',
  '00020_arlequin_dorso_dark.avif',
  '00021_arlequin_dorso_dark.avif',
  '00022_arlequin_dorso_dark.avif',
  '00023_arlequin_dorso_dark.avif',
  '00000_arlequin_dorso_dark.avif',
];

const CARD_FINAL_FRAME_CLEAR = '00012_arlequin_frente_clear_fija.avif';
const CARD_FINAL_FRAME_DARK   = '00012_arlequin_frente_dark_fija.avif';

const CARD_FRAME_DURATION = 25;
const CARD_WIDTH  = 550;
const CARD_HEIGHT = 680;

// DPR cap: 2 on desktop for crispness, 1.5 on mobile to cut the per-frame
// drawImage cost ~44% while keeping cards sharp under their CSS scale.
const getDpr = () => Math.min(
  window.devicePixelRatio || 1,
  window.matchMedia('(max-width: 768px)').matches ? 1.5 : 2
);

const _openCache  = {};
const _closeCache = {};

const drawCardFrame = (ctx, frame, w, h) => {
  ctx.clearRect(0, 0, w, h);
  if (!frame) return;
  if (frame.naturalWidth >= 1000) {
    ctx.drawImage(frame, 0, 0, w, h);
  } else {
    ctx.drawImage(frame, 8, 9, 668, 932,
      166 / 1000 * w, 234 / 1400 * h,
      668 / 1000 * w, 932 / 1400 * h);
  }
};

// ── 7 páginas de contenido ────────────────────────────────────────
const page1Lines = [
  { text: 'Landing Page', diamond: true },
  { text: '(Página de aterrizaje)', centered: true },
  { text: '' },
  { text: 'Ideal para campañas,' },
  { text: 'lanzamientos o promociones.' },
  { text: '' },
  { text: '• Rápida' },
  { text: '• Directa' },
  { text: '• Enfocada en convertir' },
];

const page2Lines = [
  { text: 'Sitio web profesional', diamond: true },
  { text: 'o personal', centered: true },
  { text: '' },
  { text: 'Mostrá quién sos, tu' },
  { text: 'experiencia y lo que hacés.' },
  { text: 'Ideal para portfolios,' },
  { text: 'freelancers o profesionales.' },
];

const page3Lines = [
  { text: 'Página de turnos', diamond: true },
  { text: 'o reservas', centered: true },
  { text: '' },
  { text: 'Gestioná citas de forma' },
  { text: 'simple y ordenada.' },
  { text: 'Perfecta para peluquerías,' },
  { text: 'estudios, consultorios y' },
  { text: 'espacios de atención.' },
];

const page4Lines = [
  { text: 'Sitio para negocios', diamond: true },
  { text: 'o emprendimientos', centered: true },
  { text: '' },
  { text: 'Mostrá tus productos o' },
  { text: 'servicios y convertí visitas' },
  { text: 'en clientes. Sumá formularios,' },
  { text: 'integrá redes sociales y' },
  { text: 'gestioná consultas fácilmente.' },
];

const page5Lines = [
  { text: 'Sistemas de gestión', diamond: true },
  { text: 'a medida', centered: true },
  { text: '' },
  { text: 'Desarrollamos plataformas' },
  { text: 'para administrar turnos,' },
  { text: 'pagos, clientes o lo que' },
  { text: 'necesites. Con acceso para' },
  { text: 'usuarios y administradores.' },
];

const page6Lines = [
  { text: 'Productos digitales', diamond: true },
  { text: 'propios (próximamente)', centered: true },
  { text: '' },
  { text: 'Plataformas listas para usar,' },
  { text: 'desarrolladas por Arlequín.' },
  { text: 'Disponibles bajo suscripción' },
  { text: 'mensual o anual.' },
];

const page7Lines = [
  { text: '' },
  { text: 'Completá el formulario de' },
  { text: 'contacto y contanos qué' },
  { text: 'servicio necesitás para' },
  { text: 'tu proyecto.' },
];

const cardTexts = [page1Lines, page2Lines, page3Lines, page4Lines, page5Lines, page6Lines, page7Lines];

// ─────────────────────────────────────────────────────────────────
function CardServicios({ isDarkMode, onClose, onCloseStart, fromGrid = false, preload = false, isLowEnd = false, prefersReducedMotion = false }) {
  const canvasRef          = useRef(null);
  const imagesRef          = useRef([]);
  const closeImagesRef     = useRef([]);
  const animationRef       = useRef(null);
  const currentFrameRef    = useRef(0);
  const lastFrameTimeRef   = useRef(0);
  const isCompleteRef      = useRef(false);
  const flipAngleRef = useRef(0);
  const closeFrameRef      = useRef(0);
  const lastCloseFrameTimeRef = useRef(0);
  const isLoadedRef        = useRef(false);

  const [isLoaded,          setIsLoaded]          = useState(false);
  const [canStartAnimation, setCanStartAnimation] = useState(false);
  const [showNavIcons,      setShowNavIcons]      = useState(false);
  const [currentCardIndex,  setCurrentCardIndex]  = useState(0);
  const [isClosing,         setIsClosing]         = useState(false);
  const [isHidingUI,        setIsHidingUI]        = useState(false);
  const [isScalingDown,     setIsScalingDown]     = useState(false);

  const themeSuffix  = isDarkMode ? 'dark' : 'clear';
  const cardFrames   = isDarkMode ? CARD_FRAMES_DARK   : CARD_FRAMES_CLEAR;
  const closeFrames  = isDarkMode ? CLOSE_FRAMES_DARK  : CLOSE_FRAMES_CLEAR;
  const cardFinalFrame = isDarkMode ? CARD_FINAL_FRAME_DARK : CARD_FINAL_FRAME_CLEAR;
  const totalFrames  = cardFrames.length;
  const isLastPage   = currentCardIndex === cardTexts.length - 1;

  // Pasar de página = girar la carta (botones, arrastre o revoleo).
  const containerRef = useRef(null);
  const page = usePageTurn({
    elRef: containerRef, index: currentCardIndex, count: cardTexts.length, setIndex: setCurrentCardIndex,
    enabled: showNavIcons && !isHidingUI, reduced: prefersReducedMotion,
  });

  const handleClose = () => {
    if (isClosing || isHidingUI) return;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    setIsHidingUI(true);
    setShowNavIcons(false);
    if (onCloseStart) onCloseStart();
    setTimeout(() => {
      setIsClosing(true);
    }, 350);
  };

  // Start open animation
  useEffect(() => {
    if (!isLoaded) return;
    if (fromGrid) {
      setCanStartAnimation(true);
    } else {
      const t = setTimeout(() => setCanStartAnimation(true), 600);
      return () => clearTimeout(t);
    }
  }, [isLoaded, fromGrid]);

  // Preload all frames
  // On first load: triggers animation start via setIsLoaded(true)
  // On theme change: silently swaps image buffers without resetting animation state
  useEffect(() => {
    const wasLoaded = isLoadedRef.current;

    const loadImages = async () => {
      const themeKey = isDarkMode ? 'dark' : 'clear';

      if (_openCache[themeKey]) {
        imagesRef.current = _openCache[themeKey];
        closeImagesRef.current = _closeCache[themeKey];
        if (!wasLoaded && !preload) {
          isLoadedRef.current = true;
          setIsLoaded(true);
        } else if (isCompleteRef.current && !preload) {
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          const finalFrame = _openCache[themeKey][_openCache[themeKey].length - 1];
          if (finalFrame) drawCardFrame(ctx, finalFrame, CARD_WIDTH, CARD_HEIGHT);
        }
        return;
      }

      const openPromises = [...cardFrames, cardFinalFrame].map(file =>
        new Promise(resolve => {
          const img = new Image();
          img.onload  = () => img.decode().then(() => resolve(img)).catch(() => resolve(img));
          img.onerror = () => resolve(null);
          img.src = `/Cartas/${file}`;
        })
      );
      const closePromises = closeFrames.map(file =>
        new Promise(resolve => {
          const img = new Image();
          img.onload  = () => img.decode().then(() => resolve(img)).catch(() => resolve(img));
          img.onerror = () => resolve(null);
          img.src = `/Cartas/${file}`;
        })
      );
      const [openResults, closeResults] = await Promise.all([
        Promise.all(openPromises),
        Promise.all(closePromises),
      ]);

      _openCache[themeKey]   = openResults;
      _closeCache[themeKey]  = closeResults;
      imagesRef.current      = openResults;
      closeImagesRef.current = closeResults;

      if (!wasLoaded && !preload) {
        isLoadedRef.current = true;
        setIsLoaded(true);
      } else if (isCompleteRef.current && !preload) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const finalFrame = openResults[openResults.length - 1];
        if (finalFrame) drawCardFrame(ctx, finalFrame, CARD_WIDTH, CARD_HEIGHT);
      }
    };
    loadImages();
  }, [isDarkMode, preload]);

  // Draw first frame when loaded
  useEffect(() => {
    if (!isLoaded) return;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    const dpr = getDpr();
    canvas.width = Math.round(CARD_WIDTH * dpr);
    canvas.height = Math.round(CARD_HEIGHT * dpr);
    canvas.style.width = `${CARD_WIDTH}px`;
    canvas.style.height = `${CARD_HEIGHT}px`;
    ctx.scale(dpr, dpr);
    const first = imagesRef.current[0];
    if (first) drawCardFrame(ctx, first, CARD_WIDTH, CARD_HEIGHT);
  }, [isLoaded]);

  // Open animation loop
  useEffect(() => {
    if (!isLoaded || !canStartAnimation || isClosing) return;

    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    const dpr = getDpr();
    canvas.width = Math.round(CARD_WIDTH * dpr);
    canvas.height = Math.round(CARD_HEIGHT * dpr);
    canvas.style.width = `${CARD_WIDTH}px`;
    canvas.style.height = `${CARD_HEIGHT}px`;
    ctx.scale(dpr, dpr);

    // Giro 3D con resorte (ver cardFlip.js). imagesRef: [0]=dorso, [12]=frente,
    // [totalFrames]=frente fijo (sin palos) donde va el texto.
    const finish = () => {
      isCompleteRef.current = true;
      const finalFrame = imagesRef.current[totalFrames];
      if (finalFrame) drawCardFrame(ctx, finalFrame, CARD_WIDTH, CARD_HEIGHT);
      setShowNavIcons(true);
    };
    if (isCompleteRef.current || prefersReducedMotion) { finish(); return; }

    const draw = (a) => {
      flipAngleRef.current = a;
      const imgs = imagesRef.current;
      drawFlip(ctx, imgs[0], imgs[totalFrames - 1], a, CARD_WIDTH, CARD_HEIGHT, isLowEnd ? 24 : 48);
    };
    draw(flipAngleRef.current);

    let cancelFlip = null;
    const startTimer = setTimeout(() => {
      animationRef.current = null;
      cancelFlip = playFlip({ from: flipAngleRef.current, to: 180, draw, onDone: finish });
    }, flipAngleRef.current > 0 || !fromGrid ? 0 : FLIP_DELAY_FROM_GRID);
    return () => { clearTimeout(startTimer); cancelFlip?.(); };
  }, [isLoaded, canStartAnimation, totalFrames, isClosing]);

  // Close animation loop
  useEffect(() => {
    if (!isClosing || !isLoaded) return;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    closeFrameRef.current      = 0;
    lastCloseFrameTimeRef.current = 0;
    canvas.style.transition = '';
    canvas.style.transform = '';
    // Vuelta del giro con el mismo resorte: frente (180°) → dorso (0°), y
    // recién ahí achica hacia la grilla.
    const imgs = imagesRef.current;
    const done = () => {
      // card-exit-scale (380ms) shrinks to ~0.49 of canvas CSS size ≈ grid
      // card size, then fades. CDA mounts at the same apparent size so the
      // hand-off is seamless with no visible size jump.
      setIsScalingDown(true);
      setTimeout(() => onClose(), 400);
    };
    if (prefersReducedMotion) {
      drawCardFrame(ctx, imgs[0], CARD_WIDTH, CARD_HEIGHT);
      done();
      return;
    }
    const draw = (a) => drawFlip(ctx, imgs[0], imgs[totalFrames - 1], a, CARD_WIDTH, CARD_HEIGHT, isLowEnd ? 24 : 48);
    const cancelFlip = playFlip({ from: 180, to: 0, draw, onDone: done });
    return () => cancelFlip();
  }, [isClosing, isLoaded]);

  if (preload) return null;
  if (!isLoaded) return <div className="card-que-es-arlequin loading" />;

  return (
    <div className="card-que-es-arlequin" ref={containerRef} {...page.bind}>
      <button className={`card-close-btn${isHidingUI ? ' card-close-btn--hiding' : ''}`} onClick={handleClose} title="Cerrar">
        <img
          src={`/Cartas/arlequin_elemento_web_X_${themeSuffix === 'clear' ? 'clare' : themeSuffix}.avif`}
          alt="Cerrar"
          className="card-close-btn-img"
        />
      </button>

      <canvas
        ref={canvasRef}
        className={`card-canvas${isScalingDown ? ' card-canvas--exiting' : ''}${!isScalingDown && fromGrid ? ' card-canvas--open-from-collect' : ''}`}
      />

      {showNavIcons && (
        <div className={`card-text-container${isLastPage ? ' servicios-text-last' : ''}`}>
          <div className={`card-text ${!isDarkMode ? 'card-text--clear' : ''}`}>
            {cardTexts[currentCardIndex].map((line, i) => (
              <div
                key={i}
                className="card-text-line"
                style={{
                  paddingLeft: line.centered ? '22px' : undefined,
                  height: line.text === '' ? '14px' : undefined,
                }}
              >
                {line.diamond && (
                  <span style={{
                    display: 'inline-block',
                    width: '22px',
                    color: 'rgba(220, 50, 50, 0.68)',
                  }}>♦</span>
                )}
                {line.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {showNavIcons && (
        <>
          <button
            className="card-nav-button card-nav-prev"
            onClick={() => page.turn(1)}
            title="Página siguiente"
            disabled={isLastPage}
            style={{ opacity: isLastPage ? 0.3 : 1, cursor: isLastPage ? 'default' : 'pointer' }}
          >
            <img src="/Cartas/arlequin_baraja_A_pieza_avanzar_web.avif" alt="Adelante" />
          </button>

          <div className="card-title-container">
            <h2 className={`card-title ${!isDarkMode ? 'card-title--clear' : ''}`}>
              Servicios
            </h2>
          </div>

          <button
            className="card-nav-button card-nav-next"
            onClick={() => page.turn(-1)}
            title="Página anterior"
            disabled={currentCardIndex === 0}
            style={{ opacity: currentCardIndex === 0 ? 0.3 : 1, cursor: currentCardIndex === 0 ? 'default' : 'pointer' }}
          >
            <img src="/Cartas/arlequin_baraja_A_pieza_retroceder_web.avif" alt="Atrás" />
          </button>
        </>
      )}
    </div>
  );
}

export default CardServicios;
