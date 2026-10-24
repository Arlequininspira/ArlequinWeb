import { useEffect, useState } from 'react';

export function Modal({ title, onClose, children, width = 520 }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="adm-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="adm-modal" style={{ maxWidth: width }} role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <h3>{title}</h3>
          <button className="adm-icon-btn" onClick={onClose} aria-label="Cerrar">✕</button>
        </header>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, hint, wide }) {
  return (
    <label className={`adm-field${wide ? ' wide' : ''}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

// Form wrapper: handles submit state and shows the error from the action.
export function Form({ onSubmit, submitLabel = 'Guardar', onCancel, children, danger }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const handle = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await onSubmit(new FormData(e.currentTarget));
    } catch (ex) {
      setErr(friendlyError(ex.message));
      setBusy(false);
    }
  };

  return (
    <form className="adm-form" onSubmit={handle}>
      <div className="adm-form-grid">{children}</div>
      {err && <p className="adm-error">{err}</p>}
      <footer>
        {danger}
        <span className="adm-grow" />
        {onCancel && <button type="button" className="adm-btn ghost" onClick={onCancel}>Cancelar</button>}
        <button className="adm-btn primary" disabled={busy}>{busy ? 'Guardando…' : submitLabel}</button>
      </footer>
    </form>
  );
}

export function friendlyError(msg = '') {
  if (msg.includes('transactions_project_period_uq')) return 'Ese mes ya está cobrado para este trabajo.';
  if (msg.includes('forbidden') || msg.includes('row-level security')) return 'Tu usuario no tiene permisos de administrador.';
  if (msg.includes('Failed to fetch')) return 'Sin conexión con el servidor.';
  if (msg.includes('auth_method') || msg.includes('auth_app')) return 'Falta correr supabase/migrations/003_account_auth_method.sql en Supabase.';
  return msg;
}

export function Empty({ children }) {
  return <div className="adm-empty">{children}</div>;
}

export function ConfirmButton({ onConfirm, children = 'Eliminar', className = 'adm-btn danger' }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button type="button" className={className} onClick={() => (armed ? onConfirm() : setArmed(true))}>
      {armed ? '¿Seguro? Click de nuevo' : children}
    </button>
  );
}

// Reads a numeric field accepting "1.234,56" or "1234.56".
export function num(fd, name) {
  const raw = String(fd.get(name) ?? '').trim();
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  const n = Number(normalized);
  if (!Number.isFinite(n)) throw new Error('Monto inválido');
  return n;
}

export const str = (fd, name) => {
  const v = String(fd.get(name) ?? '').trim();
  return v || null;
};
