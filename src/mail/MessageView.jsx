import { useEffect, useMemo, useState } from 'react';
import { attachmentUrl, fmtDate, fmtSize } from './lib/mailApi';

// Received HTML is untrusted: rendered in a sandboxed iframe (no scripts, no
// same-origin access) with a CSP that blocks remote content unless the user
// asks for images (remote images are how senders track opens).
function frameDoc(html, allowRemote) {
  const img = allowRemote ? 'data: cid: https: http:' : 'data: cid:';
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${img}; style-src 'unsafe-inline'${allowRemote ? ' https:' : ''}; font-src data:${allowRemote ? ' https:' : ''}">
<base target="_blank">
<style>html,body{margin:0;padding:12px;background:#fff;color:#222;font:14px/1.5 Arial,Helvetica,sans-serif;word-wrap:break-word}img{max-width:100%;height:auto}pre{white-space:pre-wrap}</style>
</head><body>${html}</body></html>`;
}

const hasRemote = (html = '') => /<img[^>]+src=["']?https?:/i.test(html) || /url\(\s*["']?https?:/i.test(html);

// Remote images load automatically for our own domains and for senders the
// user chose "always show" for (stored per browser).
const TRUSTED_DOMAINS = ['arlequin.com.ar', 'arlequininspira.com'];
const LS_KEY = 'ml-trusted-senders';
function trustedSenders() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}
function trustSender(addr) {
  try { localStorage.setItem(LS_KEY, JSON.stringify([...new Set([...trustedSenders(), addr])].slice(-500))); } catch { /* private mode */ }
}
const isTrusted = (addr = '') => TRUSTED_DOMAINS.includes(addr.split('@')[1]) || trustedSenders().includes(addr);

export default function MessageView({ msg, onReply, onReplyAll, onForward, onTrash, onRestore, onDelete, onToggleRead, onBack }) {
  const [remote, setRemote] = useState(() => isTrusted(msg.from_addr));
  const [err, setErr] = useState(null);
  useEffect(() => { setRemote(isTrusted(msg.from_addr)); setErr(null); }, [msg.id, msg.from_addr]);

  const doc = useMemo(() => (msg.html_body ? frameDoc(msg.html_body, remote) : null), [msg.html_body, remote]);
  const who = msg.from_name ? `${msg.from_name} <${msg.from_addr}>` : msg.from_addr;

  const download = async (a) => {
    try { window.location.href = await attachmentUrl(a.storage_path, a.filename); }
    catch (e) { setErr(`No se pudo descargar: ${e.message}`); }
  };

  return (
    <article className="ml-view">
      <div className="ml-view-actions">
        <button className="adm-btn ghost small ml-back" onClick={onBack}>← Volver</button>
        {msg.folder !== 'trash' ? (
          <>
            <button className="adm-btn primary small" onClick={onReply}>Responder</button>
            {(msg.to_addrs.length + msg.cc_addrs.length) > 1 && <button className="adm-btn small" onClick={onReplyAll}>Responder a todos</button>}
            <button className="adm-btn small" onClick={onForward}>Reenviar</button>
            {msg.folder === 'inbox' && <button className="adm-btn ghost small" onClick={onToggleRead}>Marcar no leído</button>}
            <button className="adm-btn ghost small" onClick={onTrash}>Eliminar</button>
          </>
        ) : (
          <>
            <button className="adm-btn small" onClick={onRestore}>Restaurar</button>
            <button className="adm-btn danger small" onClick={onDelete}>Borrar para siempre</button>
          </>
        )}
      </div>

      <header className="ml-view-head">
        <h2>{msg.subject || '(sin asunto)'}</h2>
        <div className="ml-meta">
          <div><b>De:</b> {who}</div>
          <div><b>Para:</b> {msg.to_addrs.join(', ')}</div>
          {msg.cc_addrs.length > 0 && <div><b>CC:</b> {msg.cc_addrs.join(', ')}</div>}
          <div className="adm-muted">{fmtDate(msg.sent_at, true)}</div>
        </div>
        {msg.auth_result?.dmarc === 'fail' && (
          <p className="adm-error">Cuidado: el remitente no pudo verificarse (DMARC). Puede ser un mail falso.</p>
        )}
      </header>

      {msg.attachments?.length > 0 && (
        <div className="ml-atts">
          {msg.attachments.map((a) => (
            <button key={a.id} className="ml-att" onClick={() => download(a)} title="Descargar">
              📎 {a.filename} <small>{fmtSize(a.size)}</small>
            </button>
          ))}
        </div>
      )}
      {err && <p className="adm-error">{err}</p>}

      {doc && hasRemote(msg.html_body) && !remote && (
        <div className="ml-remote">
          Las imágenes externas están bloqueadas para proteger tu privacidad.
          <button className="adm-btn ghost small" onClick={() => setRemote(true)}>Mostrar imágenes</button>
          <button className="adm-btn ghost small" onClick={() => { trustSender(msg.from_addr); setRemote(true); }}>
            Mostrar siempre de {msg.from_addr}
          </button>
        </div>
      )}

      <div className="ml-body">
        {doc
          ? <iframe title="Contenido del mensaje" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={doc} />
          : <pre className="ml-text">{msg.text_body || ''}</pre>}
      </div>
    </article>
  );
}
