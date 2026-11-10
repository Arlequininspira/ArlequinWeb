import { useEffect, useMemo, useState } from 'react';
import LogoLoop from './logoloop/LogoLoop';
import './FooterBanner.css';

// Zócalo: las piezas de la tira original (public/Cartas/arlequin_banner_zocalo_*)
// recortadas una por una en public/Cartas/zocalo/ y animadas con LogoLoop de
// React Bits. Mismo orden que la tira.
const SEQUENCE = ['arlequin', 'rombo', 'gorro', 'rombo', 'haz-diseno', 'haz-arte', 'inspira', 'rombo', 'mascara', 'rombo'];
const ALT = {
  arlequin: 'Arlequín', rombo: '', gorro: '', 'haz-diseno': 'Haz diseño',
  'haz-arte': 'Haz arte', inspira: 'Inspira', mascara: '',
};

const isMobileWidth = () => window.matchMedia('(max-width: 500px)').matches;

function FooterBanner({ isDarkMode }) {
  const [mobile, setMobile] = useState(isMobileWidth);
  // El cambio de tema con agujero negro saca una foto de la página: el zócalo
  // se frena mientras dura para que la foto y la página real coincidan.
  const [frozen, setFrozen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 500px)');
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener('change', onChange);
    const html = document.documentElement;
    const observer = new MutationObserver(() => setFrozen(html.classList.contains('bh-running')));
    observer.observe(html, { attributes: true, attributeFilter: ['class'] });
    return () => {
      mq.removeEventListener('change', onChange);
      observer.disconnect();
    };
  }, []);

  const logos = useMemo(() => {
    const theme = isDarkMode ? 'dark' : 'clear';
    return SEQUENCE.map((name) => ({ src: `/Cartas/zocalo/${name}_${theme}.webp`, alt: ALT[name] }));
  }, [isDarkMode]);

  // Alturas y velocidades iguales a la tira anterior (desktop 55px a ~53px/s;
  // mobile ~36px). gap ≈ el espacio entre piezas de la tira (0.72 × alto).
  const height = mobile ? 36 : 55;
  return (
    <div className="footer-banner">
      <LogoLoop
        logos={logos}
        speed={frozen ? 0 : mobile ? 35 : 53}
        direction="left"
        logoHeight={height}
        gap={Math.round(height * 0.72)}
        hoverSpeed={12}
        scaleOnHover
        draggable={!mobile}
        fadeOut
        fadeOutWidth={0.06}
        intro
        ariaLabel="Arlequín · Haz diseño · Haz arte · Inspira"
        className="footer-banner-loop"
      />
    </div>
  );
}

export default FooterBanner;
