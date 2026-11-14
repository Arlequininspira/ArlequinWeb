import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import emailjs from '@emailjs/browser';
import contactConfig from '../config/contact.json';
import { runPaperPlane } from '../effects/paperPlane';
import './ContactButton.css';

const WHATSAPP_URL = 'https://wa.me/5491155706893';
// En local (npm run dev) el envío se simula para no mandar mails de prueba.
// VITE_CONTACT_REAL_SEND=1 en .env.local para mandar de verdad.
const SIMULATE_SEND = import.meta.env.DEV && import.meta.env.VITE_CONTACT_REAL_SEND !== '1';

const MAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const telOk = (t) => /^\+?[\d\s\-().]{8,20}$/.test(t.trim()) && t.replace(/\D/g, '').length >= 8;

function ChatIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M10 12h28a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H22l-8 7v-7h-4a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="17" cy="23" r="2.4" fill="currentColor" />
      <circle cx="24" cy="23" r="2.4" fill="currentColor" />
      <circle cx="31" cy="23" r="2.4" fill="currentColor" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect x="8" y="13" width="32" height="22" rx="3" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M9 15l15 11 15-11" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}

// ── Carta formulario ──────────────────────────────────────────────────────────
function ContactFormCard({ isDarkMode, prefersReducedMotion, onClose, onSent }) {
  const cardRef = useRef(null);
  const firstRef = useRef(null);
  const [nombre, setNombre] = useState('');
  const [mail, setMail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [touched, setTouched] = useState({});
  const [estado, setEstado] = useState('idle'); // idle | enviando | error | volando
  const [closing, setClosing] = useState(false);

  const mailValido = MAIL_RE.test(mail.trim());
  const telValido = telOk(telefono);
  const errores = {
    nombre: !nombre.trim() && 'Contanos tu nombre',
    mail: !mailValido && (mail.trim() ? 'Mail inválido' : 'Falta tu mail'),
    telefono: !telValido && (telefono.trim() ? 'Teléfono inválido' : 'Falta tu teléfono'),
    descripcion: !descripcion.trim() && '¿Qué necesitás?',
  };
  const formValido = !Object.values(errores).some(Boolean);
  const busy = estado === 'enviando' || estado === 'volando';
  const busyRef = useRef(false);
  busyRef.current = busy;

  useEffect(() => {
    const t = setTimeout(() => firstRef.current?.focus({ preventScroll: true }), 350);
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => {
    if (busyRef.current) return;
    setClosing(true);
    setTimeout(onClose, 260);
  };

  const enviar = async (e) => {
    e.preventDefault();
    setTouched({ nombre: true, mail: true, telefono: true, descripcion: true });
    if (!formValido || busy) return;
    setEstado('enviando');
    try {
      if (SIMULATE_SEND) {
        await new Promise((r) => setTimeout(r, 700));
        console.info('[contacto] envío simulado (dev):', { nombre, mail, telefono, descripcion });
      } else {
        const { serviceId, templateId, publicKey } = contactConfig.emailjs;
        await emailjs.send(serviceId, templateId, {
          to_email: contactConfig.destinatario,
          from_name: nombre,
          from_email: mail,
          telefono,
          descripcion,
        }, publicKey);
      }
    } catch (err) {
      console.error('Error al enviar:', err);
      setEstado('error');
      return;
    }
    setEstado('volando');
    document.activeElement?.blur?.();
    if (!prefersReducedMotion && cardRef.current) {
      await new Promise((r) => setTimeout(r, 380)); // se borra el contenido antes de plegar
      await runPaperPlane({
        cardEl: cardRef.current,
        targetEl: document.querySelector('.theme-toggle'),
        isDarkMode,
      }).catch((err) => console.error(err));
    }
    onSent();
  };

  const field = (name, props) => (
    <label className={`cform-field${touched[name] && errores[name] ? ' cform-field--error' : ''}`}>
      <span className="cform-label">{props.label}</span>
      {props.textarea ? (
        <textarea
          rows={3}
          maxLength={500}
          value={props.value}
          onChange={(e) => props.set(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, [name]: true }))}
          placeholder={props.placeholder}
          disabled={busy}
        />
      ) : (
        <input
          ref={props.inputRef}
          type={props.type || 'text'}
          inputMode={props.inputMode}
          autoComplete={props.autoComplete}
          value={props.value}
          onChange={(e) => props.set(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, [name]: true }))}
          placeholder={props.placeholder}
          disabled={busy}
        />
      )}
      <span className="cform-error" aria-live="polite">{touched[name] && errores[name] ? errores[name] : ''}</span>
    </label>
  );

  return createPortal(
    <div className={`cform-root${isDarkMode ? ' cform-dark' : ' cform-clear'}${closing ? ' cform-closing' : ''}${estado === 'volando' ? ' cform-flying' : ''}`}>
      <div className="cform-backdrop" onClick={close} />
      <form
        ref={cardRef}
        className={`cform-card${estado === 'volando' ? ' cform-card--folding' : ''}`}
        onSubmit={enviar}
        noValidate
        role="dialog"
        aria-label="Formulario de contacto"
      >
        <button type="button" className="cform-close" onClick={close} aria-label="Cerrar" disabled={busy}>
          <img src={`/Cartas/arlequin_elemento_web_X_${isDarkMode ? 'dark' : 'clare'}.avif`} alt="" />
        </button>
        <div className="cform-content">
          <h2 className="cform-title">Contacto</h2>
          <p className="cform-sub"><span className="cform-diamond">♦</span>Contanos tu proyecto</p>
          {field('nombre', { label: 'Nombre', value: nombre, set: setNombre, autoComplete: 'name', inputRef: firstRef })}
          {field('mail', { label: 'Mail', value: mail, set: setMail, type: 'email', inputMode: 'email', autoComplete: 'email', placeholder: '@' })}
          {field('telefono', { label: 'Teléfono', value: telefono, set: setTelefono, type: 'tel', inputMode: 'tel', autoComplete: 'tel' })}
          {field('descripcion', { label: 'Servicio de interés', value: descripcion, set: setDescripcion, textarea: true })}
          <div className="cform-actions">
            {estado === 'error' && <span className="cform-send-error">No se pudo enviar. Probá de nuevo.</span>}
            <button type="submit" className="cform-send" disabled={busy}>
              {estado === 'enviando' ? 'Enviando…' : <>Enviar <span aria-hidden="true">✈</span></>}
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  );
}

// ── Botón flotante ────────────────────────────────────────────────────────────
function ContactButton({ isDarkMode, isLowEnd = false, prefersReducedMotion = false }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [toast, setToast] = useState(false);
  const rootRef = useRef(null);
  const leaveTimer = useRef(null);
  const canHover = typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;

  // Tocar fuera cierra el menú (mobile).
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => { if (!rootRef.current?.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [menuOpen]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(false), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const enter = () => { if (!canHover) return; clearTimeout(leaveTimer.current); setMenuOpen(true); };
  const leave = () => { if (!canHover) return; leaveTimer.current = setTimeout(() => setMenuOpen(false), 280); };

  const theme = isDarkMode ? 'light-mode' : 'dark-mode'; // mismo criterio que el botón de WhatsApp

  return (
    <>
      <div
        ref={rootRef}
        className={`contact-fab ${theme}${menuOpen ? ' is-open' : ''}${isLowEnd ? ' no-pulse' : ''}`}
        onMouseEnter={enter}
        onMouseLeave={leave}
        // Sólo foco por teclado: en touch el foco llega antes del click y lo cerraría.
        onFocus={(e) => { if (e.target.matches(':focus-visible')) setMenuOpen(true); }}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setMenuOpen(false); }}
      >
        <div className="contact-fab-items" aria-hidden={!menuOpen}>
          <button
            type="button"
            className="contact-fab-item contact-fab-mail"
            onClick={() => { setMenuOpen(false); setFormOpen(true); }}
            tabIndex={menuOpen ? 0 : -1}
            aria-label="Escribinos por mail"
          >
            <MailIcon />
            <span className="contact-fab-tip">Mail</span>
          </button>
          <a
            className="contact-fab-item contact-fab-wp"
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            tabIndex={menuOpen ? 0 : -1}
            aria-label="Contactanos por WhatsApp"
            onClick={() => setMenuOpen(false)}
          >
            <img src="/LogoWp/arlequin_whatsapp_business.svg" alt="" />
            <span className="contact-fab-tip">WhatsApp</span>
          </a>
        </div>
        <button
          type="button"
          className="contact-fab-main"
          aria-label="Contacto"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => (canHover ? true : !o))}
        >
          <ChatIcon />
        </button>
      </div>

      {formOpen && (
        <ContactFormCard
          isDarkMode={isDarkMode}
          prefersReducedMotion={prefersReducedMotion}
          onClose={() => setFormOpen(false)}
          onSent={() => { setFormOpen(false); setToast(true); }}
        />
      )}

      {toast && createPortal(
        <div className={`cform-toast${isDarkMode ? ' cform-dark' : ' cform-clear'}`} role="status" onClick={() => setToast(false)}>
          <span>Gracias por tu Msj ⭐</span>
          <span>Nos comunicaremos a la Brevedad 🎭</span>
        </div>,
        document.body,
      )}
    </>
  );
}

export default ContactButton;
