import './RotateHint.css';

// Phones in landscape have ~300px of height: escudo + grid + footer can't
// stack in that. Shown only by CSS (touch + landscape + short), so desktop
// windows resized to a short height are never blocked.
function RotateHint({ isDarkMode }) {
  return (
    <div className={`rotate-hint ${isDarkMode ? 'dark' : 'light'}`} aria-hidden="true">
      <div className="rotate-hint-phone" />
      <p>Girá tu celular</p>
    </div>
  );
}

export default RotateHint;
