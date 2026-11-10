import { useCallback, useEffect, useState } from 'react';
import { supabase, isConfigured } from '../admin/lib/supabase';
import { ADMIN_ICON } from '../admin/lib/format';
import Login from '../admin/pages/Login';
import MessageView from './MessageView';
import Compose from './Compose';
import {
  myMailboxes, listMessages, unreadCount, getMessage, markRead, moveTo, deleteForever, fmtDate, bodyText,
} from './lib/mailApi';
import '../admin/admin.css';
import './mail.css';

const FOLDERS = [
  { id: 'inbox', label: 'Recibidos' },
  { id: 'sent', label: 'Enviados' },
  { id: 'trash', label: 'Papelera' },
];
const POLL_MS = 60_000;

const prefixed = (p, s = '') => (new RegExp(`^${p}:`, 'i').test(s.trim()) ? s.trim() : `${p}: ${s.trim()}`);
const quote = (t) => t.split('\n').map((l) => `> ${l}`).join('\n');

function useSession() {
  const [session, setSession] = useState(undefined);
  useEffect(() => {
    if (!isConfigured) return setSession(null);
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  return session;
}

function Mailbox({ session, boxes }) {
  const [box, setBox] = useState(boxes[0]);
  const [folder, setFolder] = useState('inbox');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState(null);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(null);      // full message
  const [draft, setDraft] = useState(null);    // compose modal
  const [err, setErr] = useState(null);
  const [toast, setToast] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [list, n] = await Promise.all([listMessages(box.id, folder, search), unreadCount(box.id)]);
      setItems(list);
      setUnread(n);
      setErr(null);
    } catch (e) { setErr(e.message); }
  }, [box.id, folder, search]);

  useEffect(() => { setItems(null); setOpen(null); }, [box.id, folder]);
  useEffect(() => {
    const t = setTimeout(refresh, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [refresh, search]);
  useEffect(() => {
    const tick = () => document.visibilityState === 'visible' && refresh();
    const id = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [refresh]);
  useEffect(() => {
    document.title = `${unread ? `(${unread}) ` : ''}Correo · ${box.address}`;
  }, [unread, box.address]);

  const flash = (t) => { setToast(t); setTimeout(() => setToast(null), 3000); };

  const openMsg = async (it) => {
    try {
      const m = await getMessage(it.id);
      setOpen(m);
      if (!m.is_read) {
        await markRead(m.id);
        setItems((l) => l.map((x) => (x.id === m.id ? { ...x, is_read: true } : x)));
        setUnread((n) => Math.max(0, n - 1));
      }
    } catch (e) { setErr(e.message); }
  };

  const act = async (fn, msg) => {
    try { await fn(); setOpen(null); flash(msg); refresh(); } catch (e) { setErr(e.message); }
  };

  const reply = (all) => {
    const m = open;
    const self = box.address;
    const to = m.folder === 'sent' ? m.to_addrs : [m.reply_to[0] || m.from_addr];
    const cc = all ? [...m.to_addrs, ...m.cc_addrs].filter((a) => a !== self && !to.includes(a)) : [];
    setDraft({
      to: to.join(', '), cc: cc.join(', '), subject: prefixed('Re', m.subject), reply_to_message_id: m.id,
      text: `\n\n\nEl ${fmtDate(m.sent_at, true)}, ${m.from_name || m.from_addr} escribió:\n${quote(bodyText(m))}`,
    });
  };

  const forward = () => {
    const m = open;
    setDraft({
      to: '', subject: prefixed('Fwd', m.subject), attachments: m.attachments,
      text: `\n\n\n---------- Mensaje reenviado ----------\nDe: ${m.from_name ? `${m.from_name} <${m.from_addr}>` : m.from_addr}\nFecha: ${fmtDate(m.sent_at, true)}\nAsunto: ${m.subject}\nPara: ${m.to_addrs.join(', ')}\n\n${bodyText(m)}`,
    });
  };

  return (
    <div className={`ml-shell${open ? ' reading' : ''}`}>
      <aside className={`adm-side ml-side${menuOpen ? ' open' : ''}`}>
        <div className="adm-brand">
          <img src={ADMIN_ICON} alt="" />
          <span>Arlequín<small>Correo</small></span>
        </div>
        {boxes.length > 1 && (
          <label className="adm-field ml-box-select">
            <span>Casilla</span>
            <select value={box.id} onChange={(e) => { setBox(boxes.find((b) => b.id === e.target.value)); setMenuOpen(false); }}>
              {boxes.map((b) => <option key={b.id} value={b.id}>{b.address}</option>)}
            </select>
          </label>
        )}
        <button className="adm-btn primary block ml-new" onClick={() => { setDraft({}); setMenuOpen(false); }}>✉ Redactar</button>
        <nav>
          {FOLDERS.map((f) => (
            <button key={f.id} className={f.id === folder ? 'active' : ''} onClick={() => { setFolder(f.id); setMenuOpen(false); }}>
              {f.label}
              {f.id === 'inbox' && unread > 0 && <span className="adm-nav-badge">{unread}</span>}
            </button>
          ))}
        </nav>
        <div className="adm-user">
          <span title={session.user.email}>{box.address}</span>
          <button className="adm-btn ghost small" onClick={() => supabase.auth.signOut()}>Salir</button>
        </div>
      </aside>
      {menuOpen && <div className="adm-side-backdrop" onClick={() => setMenuOpen(false)} />}

      <section className="ml-list-pane">
        <header className="ml-list-head">
          <button className="adm-icon-btn adm-menu-btn" onClick={() => setMenuOpen(true)} aria-label="Menú">☰</button>
          <h1>{FOLDERS.find((f) => f.id === folder).label}</h1>
          <button className="adm-icon-btn" onClick={refresh} title="Actualizar" aria-label="Actualizar">⟳</button>
        </header>
        <input className="ml-search" type="search" placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {err && <p className="adm-error">{err}</p>}
        {items === null ? <div className="adm-spinner" /> : items.length === 0 ? (
          <p className="adm-muted ml-empty">{search ? 'Sin resultados.' : 'No hay mensajes.'}</p>
        ) : (
          <ul className="ml-list">
            {items.map((it) => (
              <li key={it.id}>
                <button className={`ml-item${it.is_read ? '' : ' unread'}${open?.id === it.id ? ' active' : ''}`} onClick={() => openMsg(it)}>
                  <span className="ml-item-top">
                    <span className="ml-item-from">{folder === 'sent' ? `Para: ${it.to_addrs.join(', ')}` : it.from_name || it.from_addr}</span>
                    <span className="ml-item-date">{it.has_attachments && '📎 '}{fmtDate(it.sent_at)}</span>
                  </span>
                  <span className="ml-item-subj">{it.subject || '(sin asunto)'}</span>
                  <span className="ml-item-snip">{it.snippet}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ml-read-pane">
        {open ? (
          <MessageView
            msg={open}
            onBack={() => setOpen(null)}
            onReply={() => reply(false)}
            onReplyAll={() => reply(true)}
            onForward={forward}
            onToggleRead={() => act(() => markRead(open.id, false), 'Marcado como no leído')}
            onTrash={() => act(() => moveTo(open.id, 'trash'), 'Movido a la papelera')}
            onRestore={() => act(() => moveTo(open.id, open.from_addr === box.address ? 'sent' : 'inbox'), 'Restaurado')}
            onDelete={() => window.confirm('¿Borrar este mensaje para siempre? No se puede deshacer.') && act(() => deleteForever(open.id), 'Borrado')}
          />
        ) : (
          <div className="ml-placeholder adm-muted">Elegí un mensaje para leerlo.</div>
        )}
      </section>

      {draft && (
        <Compose mailbox={box} draft={draft} onClose={() => setDraft(null)}
          onSent={() => { setDraft(null); flash('Mensaje enviado'); if (folder === 'sent') refresh(); }} />
      )}
      {toast && <div className="ml-toast" role="status">{toast}</div>}
    </div>
  );
}

export default function MailApp() {
  const session = useSession();
  const [boxes, setBoxes] = useState(undefined);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    document.title = 'Arlequín · Correo';
    document.documentElement.classList.add('adm-html');
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    const icon = document.querySelector("link[rel~='icon']") ?? document.head.appendChild(document.createElement('link'));
    icon.rel = 'icon';
    icon.type = 'image/avif';
    icon.href = ADMIN_ICON;
  }, []);

  useEffect(() => {
    if (!session) return setBoxes(undefined);
    myMailboxes().then((b) => {
      if (b.length) { setBoxes(b); setDenied(false); }
      else { setDenied(true); supabase.auth.signOut(); }
    }).catch(() => { setDenied(true); supabase.auth.signOut(); });
  }, [session]);

  if (!isConfigured) {
    return <div className="adm-root adm-center"><div className="adm-card"><h2>Falta configurar Supabase</h2></div></div>;
  }
  if (session === undefined || (session && !boxes)) {
    return <div className="adm-root adm-center"><div className="adm-spinner" /></div>;
  }
  return (
    <div className="adm-root">
      {session
        ? <Mailbox session={session} boxes={boxes} />
        : <Login denied={denied} subtitle="Correo @arlequin.com.ar" deniedMessage="Ese usuario no tiene una casilla de correo asignada." />}
    </div>
  );
}
