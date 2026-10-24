import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, q } from '../lib/supabase';
import { useStore } from '../lib/store';
import {
  PBKDF2_ITERATIONS, randomSalt, deriveKey, encryptText, decryptText, makeVerifier, checkVerifier,
} from '../lib/vaultCrypto';
import { Modal, Field, Form, Empty, ConfirmButton, str } from '../components/ui';

const IDLE_LOCK_MS = 5 * 60 * 1000;   // auto-lock after 5 min without activity
const REVEAL_MS = 20 * 1000;          // revealed password hides itself
const CLIPBOARD_CLEAR_MS = 30 * 1000;

// The derived key lives only in memory (never in storage). Module scope so
// switching tabs inside the panel doesn't force a re-unlock.
let vaultKey = null;
let lockTimer = null;
const listeners = new Set();
const setKey = (k) => { vaultKey = k; listeners.forEach((fn) => fn(k)); };
export const lockVault = () => setKey(null);
const touch = () => {
  clearTimeout(lockTimer);
  if (vaultKey) lockTimer = setTimeout(() => setKey(null), IDLE_LOCK_MS);
};

function useVaultKey() {
  const [key, setK] = useState(vaultKey);
  useEffect(() => {
    listeners.add(setK);
    const evs = ['pointerdown', 'keydown'];
    evs.forEach((e) => window.addEventListener(e, touch));
    return () => { listeners.delete(setK); evs.forEach((e) => window.removeEventListener(e, touch)); };
  }, []);
  return key;
}

export default function Cuentas() {
  const key = useVaultKey();
  const [meta, setMeta] = useState(undefined);

  useEffect(() => {
    q(supabase.from('vault_meta').select('*').maybeSingle()).then(setMeta).catch(() => setMeta(null));
  }, []);

  if (meta === undefined) return <div className="adm-center"><div className="adm-spinner" /></div>;
  if (!meta) return <CreateVault onCreated={setMeta} />;
  if (!key) return <Unlock meta={meta} />;
  return <Vault vkey={key} />;
}

function CreateVault({ onCreated }) {
  const [show, setShow] = useState(false);
  const create = async (fd) => {
    const a = String(fd.get('p1'));
    if (a.length < 12) throw new Error('Usá al menos 12 caracteres (mejor una frase).');
    if (a !== String(fd.get('p2'))) throw new Error('Las claves no coinciden.');
    const salt = randomSalt();
    const k = await deriveKey(a, salt, PBKDF2_ITERATIONS);
    const row = { id: 1, salt, iterations: PBKDF2_ITERATIONS, verifier: await makeVerifier(k) };
    await q(supabase.from('vault_meta').insert(row));
    onCreated(row);
    setKey(k);
    touch();
  };
  return (
    <section className="adm-panel adm-vault-lock">
      <h2>Crear clave maestra</h2>
      <p className="adm-muted">
        Cifra todas las contraseñas <b>en tu navegador</b> antes de guardarlas. La base sólo guarda texto cifrado:
        ni Supabase ni alguien que robe la base puede leerlas. La comparten los dos admins.
      </p>
      <p className="adm-warn">⚠ No se puede recuperar. Si se pierde, las contraseñas guardadas se pierden. Anotala en un lugar seguro.</p>
      <Form onSubmit={create} submitLabel="Crear bóveda">
        <Field label="Clave maestra" wide><input name="p1" type={show ? 'text' : 'password'} autoComplete="new-password" required autoFocus /></Field>
        <Field label="Repetir clave maestra" wide><input name="p2" type={show ? 'text' : 'password'} autoComplete="new-password" required /></Field>
        <label className="adm-check wide"><input type="checkbox" onChange={(e) => setShow(e.target.checked)} /> Mostrar</label>
      </Form>
    </section>
  );
}

function Unlock({ meta }) {
  const [show, setShow] = useState(false);
  const unlock = async (fd) => {
    const k = await deriveKey(String(fd.get('master')), meta.salt, meta.iterations);
    if (!(await checkVerifier(k, meta.verifier))) {
      await new Promise((r) => setTimeout(r, 800)); // slow down guessing
      throw new Error('Clave maestra incorrecta.');
    }
    setKey(k);
    touch();
  };
  return (
    <section className="adm-panel adm-vault-lock">
      <div className="adm-lock-icon">🔒</div>
      <h2>Bóveda bloqueada</h2>
      <p className="adm-muted">Ingresá la clave maestra para ver las cuentas. Se bloquea sola tras 5 minutos sin uso.</p>
      <Form onSubmit={unlock} submitLabel="Desbloquear">
        <Field label="Clave maestra" wide>
          <div className="adm-input-group">
            <input name="master" type={show ? 'text' : 'password'} autoComplete="off" required autoFocus />
            <button type="button" className="adm-icon-btn" onClick={() => setShow((s) => !s)} aria-label="Ver clave">{show ? '🙈' : '👁'}</button>
          </div>
        </Field>
      </Form>
    </section>
  );
}

function Vault({ vkey }) {
  const { clients } = useStore();
  const [accounts, setAccounts] = useState([]);
  const [search, setSearch] = useState('');
  const [revealed, setRevealed] = useState({});   // id → plaintext
  const [edit, setEdit] = useState(null);
  const [toast, setToast] = useState(null);
  const timers = useRef({});

  const load = useCallback(async () => {
    setAccounts(await q(supabase.from('accounts').select('*').order('service')));
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2200); };

  const toggleReveal = async (a) => {
    if (revealed[a.id]) {
      setRevealed(({ [a.id]: _, ...rest }) => rest);
      return;
    }
    try {
      const pw = await decryptText(vkey, a.secret);
      setRevealed((r) => ({ ...r, [a.id]: pw }));
      clearTimeout(timers.current[a.id]);
      timers.current[a.id] = setTimeout(() => setRevealed(({ [a.id]: _, ...rest }) => rest), REVEAL_MS);
    } catch {
      flash('No se pudo descifrar (¿dato dañado?)');
    }
  };

  const copy = async (a) => {
    const pw = await decryptText(vkey, a.secret);
    await navigator.clipboard.writeText(pw);
    flash('Copiada · se borra del portapapeles en 30 s');
    setTimeout(() => navigator.clipboard.writeText('').catch(() => {}), CLIPBOARD_CLEAR_MS);
  };

  const clientName = (id) => clients.find((c) => c.id === id)?.name;
  const list = accounts.filter((a) => !search ||
    `${a.service} ${a.username ?? ''} ${a.url ?? ''} ${a.category} ${clientName(a.client_id) ?? ''}`.toLowerCase().includes(search.toLowerCase()));
  const groups = [...new Set(list.map((a) => a.category))].sort();

  return (
    <div className="adm-page">
      <div className="adm-filters">
        <input type="search" placeholder="Buscar servicio, usuario, cliente…" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
        <span className="adm-grow" />
        <button className="adm-btn ghost" onClick={() => setKey(null)}>🔒 Bloquear</button>
        <button className="adm-btn primary" onClick={() => setEdit({})}>+ Cuenta</button>
      </div>

      {list.length === 0 && <Empty>{accounts.length ? 'Sin resultados.' : 'Todavía no hay cuentas guardadas.'}</Empty>}

      {groups.map((g) => (
        <section key={g} className="adm-panel">
          <header className="adm-panel-head"><h2>{g}</h2></header>
          <ul className="adm-list adm-accounts">
            {list.filter((a) => a.category === g).map((a) => (
              <li key={a.id}>
                <div>
                  <b className="clickable" onClick={() => setEdit(a)}>{a.service}</b>
                  <small>
                    {a.url && <a href={a.url.startsWith('http') ? a.url : `https://${a.url}`} target="_blank" rel="noreferrer noopener">{a.url.replace(/^https?:\/\//, '')}</a>}
                    {clientName(a.client_id) && <> · {clientName(a.client_id)}</>}
                  </small>
                </div>
                <code className="adm-user-cell" title="Usuario">{a.username}</code>
                <code className={`adm-secret${revealed[a.id] ? ' shown' : ''}`}>{revealed[a.id] ?? '••••••••••'}</code>
                <span className="adm-row-actions">
                  <button className="adm-icon-btn" onClick={() => toggleReveal(a)} aria-label={revealed[a.id] ? 'Ocultar' : 'Ver contraseña'}
                    title={revealed[a.id] ? 'Ocultar' : 'Ver contraseña'}>{revealed[a.id] ? '🙈' : '👁'}</button>
                  <button className="adm-icon-btn" onClick={() => copy(a)} aria-label="Copiar contraseña" title="Copiar">⧉</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {edit && <AccountModal account={edit} vkey={vkey} onClose={() => setEdit(null)} onSaved={load} />}
      {toast && <div className="adm-toast">{toast}</div>}
    </div>
  );
}

function generatePassword(len = 20) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*-_=+?';
  const rnd = crypto.getRandomValues(new Uint32Array(len));
  return Array.from(rnd, (n) => chars[n % chars.length]).join('');
}

function AccountModal({ account, vkey, onClose, onSaved }) {
  const { clients } = useStore();
  const isNew = !account.id;
  const [pw, setPw] = useState('');
  const [notes, setNotes] = useState('');
  const [show, setShow] = useState(isNew);
  const [ready, setReady] = useState(isNew);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      setPw(await decryptText(vkey, account.secret));
      if (account.notes_secret) setNotes(await decryptText(vkey, account.notes_secret));
      setReady(true);
    })();
  }, [account, isNew, vkey]);

  const save = async (fd) => {
    if (!pw) throw new Error('Falta la contraseña.');
    const row = {
      service: str(fd, 'service'),
      url: str(fd, 'url'),
      username: str(fd, 'username'),
      category: str(fd, 'category') ?? 'General',
      client_id: str(fd, 'client_id'),
      secret: await encryptText(vkey, pw),
      notes_secret: notes.trim() ? await encryptText(vkey, notes.trim()) : null,
      updated_at: new Date().toISOString(),
    };
    await q(isNew ? supabase.from('accounts').insert(row) : supabase.from('accounts').update(row).eq('id', account.id));
    await onSaved();
    onClose();
  };

  const remove = async () => {
    await q(supabase.from('accounts').delete().eq('id', account.id));
    await onSaved();
    onClose();
  };

  if (!ready) return <Modal title="Cuenta" onClose={onClose}><div className="adm-spinner" /></Modal>;

  return (
    <Modal title={isNew ? 'Nueva cuenta' : `Editar · ${account.service}`} onClose={onClose}>
      <Form onSubmit={save} onCancel={onClose} danger={!isNew && <ConfirmButton onConfirm={remove} />}>
        <Field label="Servicio"><input name="service" defaultValue={account.service ?? ''} placeholder="Hostinger, Gmail, ARCA…" required autoFocus /></Field>
        <Field label="Categoría">
          <input name="category" list="adm-acc-cats" defaultValue={account.category ?? 'General'} />
          <datalist id="adm-acc-cats">{['General', 'Hosting', 'Dominios', 'Email', 'Redes sociales', 'Bancos', 'ARCA', 'Clientes'].map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="URL" wide><input name="url" defaultValue={account.url ?? ''} /></Field>
        <Field label="Usuario / email" wide><input name="username" defaultValue={account.username ?? ''} autoComplete="off" /></Field>
        <Field label="Contraseña" wide>
          <div className="adm-input-group">
            <input value={pw} onChange={(e) => setPw(e.target.value)} type={show ? 'text' : 'password'} autoComplete="new-password" />
            <button type="button" className="adm-icon-btn" onClick={() => setShow((s) => !s)} aria-label="Ver">{show ? '🙈' : '👁'}</button>
            <button type="button" className="adm-btn small ghost" onClick={() => { setPw(generatePassword()); setShow(true); }}>Generar</button>
          </div>
        </Field>
        <Field label="Cliente (opcional)">
          <select name="client_id" defaultValue={account.client_id ?? ''}>
            <option value="">—</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Notas cifradas (códigos de respaldo, PIN…)" wide>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </Form>
    </Modal>
  );
}
