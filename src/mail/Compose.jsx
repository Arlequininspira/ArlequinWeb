import { useRef, useState } from 'react';
import { Modal } from '../admin/components/ui';
import { uploadAttachment, sendMail, fmtSize } from './lib/mailApi';

const MAX_TOTAL = 30 * 1024 * 1024;

// draft: { to, cc, subject, text, reply_to_message_id?, attachments? (forwarded) }
export default function Compose({ mailbox, draft, onClose, onSent }) {
  const [showCc, setShowCc] = useState(Boolean(draft.cc));
  const [atts, setAtts] = useState(draft.attachments || []);
  const [uploading, setUploading] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const clientId = useRef(crypto.randomUUID()); // idempotency: double-click won't send twice
  const fileRef = useRef(null);

  const total = atts.reduce((s, a) => s + (a.size || 0), 0);

  const addFiles = async (files) => {
    setErr(null);
    for (const f of files) {
      if (total + f.size > MAX_TOTAL) { setErr('Los adjuntos no pueden superar 30 MB en total.'); break; }
      setUploading((n) => n + 1);
      try {
        const a = await uploadAttachment(mailbox.id, f);
        setAtts((list) => [...list, a]);
      } catch (e) {
        setErr(`No se pudo subir ${f.name}: ${e.message}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setErr(null);
    try {
      await sendMail({
        mailbox_id: mailbox.id,
        client_id: clientId.current,
        to: String(fd.get('to') || ''),
        cc: String(fd.get('cc') || ''),
        subject: String(fd.get('subject') || ''),
        text: String(fd.get('text') || ''),
        reply_to_message_id: draft.reply_to_message_id || null,
        attachments: atts,
      });
      onSent();
    } catch (e2) {
      setErr(e2.message);
      setBusy(false);
    }
  };

  const title = draft.reply_to_message_id ? 'Responder' : draft.subject?.startsWith('Fwd:') ? 'Reenviar' : 'Nuevo mensaje';

  return (
    <Modal title={title} onClose={() => !busy && onClose()} width={720}>
      <form className="ml-compose" onSubmit={submit}>
        <div className="ml-from adm-muted">De: {mailbox.display_name ? `${mailbox.display_name} <${mailbox.address}>` : mailbox.address}</div>
        <label className="adm-field">
          <span>Para <small className="adm-muted">(separá varias direcciones con coma)</small></span>
          <div className="adm-input-group">
            <input name="to" type="text" defaultValue={draft.to || ''} required autoFocus={!draft.to} autoComplete="email" />
            {!showCc && <button type="button" className="adm-btn ghost small" onClick={() => setShowCc(true)}>CC</button>}
          </div>
        </label>
        {showCc && (
          <label className="adm-field"><span>CC</span><input name="cc" type="text" defaultValue={draft.cc || ''} /></label>
        )}
        <label className="adm-field"><span>Asunto</span><input name="subject" type="text" defaultValue={draft.subject || ''} /></label>
        <label className="adm-field">
          <span>Mensaje</span>
          <textarea name="text" rows={12} defaultValue={draft.text || ''} autoFocus={Boolean(draft.to)}
            onFocus={(e) => draft.reply_to_message_id && e.target.setSelectionRange(0, 0)} />
        </label>

        <div className="ml-atts">
          {atts.map((a) => (
            <span key={a.storage_path} className="ml-att">
              📎 {a.filename} <small>{fmtSize(a.size)}</small>
              <button type="button" className="adm-icon-btn" aria-label={`Quitar ${a.filename}`}
                onClick={() => setAtts((l) => l.filter((x) => x.storage_path !== a.storage_path))}>✕</button>
            </span>
          ))}
          {uploading > 0 && <span className="adm-muted">Subiendo {uploading}…</span>}
        </div>
        <input ref={fileRef} type="file" multiple hidden onChange={(e) => { addFiles([...e.target.files]); e.target.value = ''; }} />

        {err && <p className="adm-error">{err}</p>}
        <div className="ml-compose-actions">
          <button type="button" className="adm-btn ghost" onClick={() => fileRef.current.click()} disabled={busy}>Adjuntar</button>
          <span style={{ flex: 1 }} />
          <button type="button" className="adm-btn ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button className="adm-btn primary" disabled={busy || uploading > 0}>{busy ? 'Enviando…' : 'Enviar'}</button>
        </div>
      </form>
    </Modal>
  );
}
