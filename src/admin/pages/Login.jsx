import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ADMIN_ICON } from '../lib/format';

export default function Login({ denied }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(denied ? 'Ese usuario no tiene acceso de administrador.' : null);
  const [show, setShow] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(fd.get('email')).trim(),
      password: String(fd.get('password')),
    });
    if (error) {
      // Same message for wrong user or wrong password: don't reveal which.
      const byCode = {
        email_provider_disabled: 'El login por email está desactivado en Supabase (Authentication → Sign In / Providers → Email).',
        email_not_confirmed: 'Usuario sin confirmar: en Supabase → Authentication → Users, confirmalo.',
        over_request_rate_limit: 'Demasiados intentos. Esperá unos minutos.',
      };
      setErr(byCode[error.code] ?? (error.status === 429 ? byCode.over_request_rate_limit : 'Usuario o contraseña incorrectos.'));
      setBusy(false);
    }
  };

  return (
    <div className="adm-center adm-login-bg">
      <form className="adm-card adm-login" onSubmit={submit}>
        <img src={ADMIN_ICON} alt="" className="adm-login-logo" />
        <h2>Arlequín</h2>
        <p className="adm-muted">Acceso administración</p>
        <label className="adm-field">
          <span>Email</span>
          <input name="email" type="email" autoComplete="username" required autoFocus />
        </label>
        <label className="adm-field">
          <span>Contraseña</span>
          <div className="adm-input-group">
            <input name="password" type={show ? 'text' : 'password'} autoComplete="current-password" required />
            <button type="button" className="adm-icon-btn" onClick={() => setShow((s) => !s)}
              aria-label={show ? 'Ocultar contraseña' : 'Ver contraseña'}>{show ? '🙈' : '👁'}</button>
          </div>
        </label>
        {err && <p className="adm-error">{err}</p>}
        <button className="adm-btn primary block" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button>
      </form>
    </div>
  );
}
