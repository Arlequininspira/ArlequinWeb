import './WhatsAppButton.css';

const WHATSAPP_URL = 'https://wa.me/5491155706893';

function WhatsAppButton({ isDarkMode, isLowEnd = false }) {
  return (
    <a
      className={`whatsapp-button ${isDarkMode ? 'light-mode' : 'dark-mode'}${isLowEnd ? ' no-pulse' : ''}`}
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactanos por WhatsApp"
    >
      <img src="/LogoWp/arlequin_whatsapp_business.svg" alt="" width="60" height="60" />
    </a>
  );
}

export default WhatsAppButton;
