import { useMemo, useState } from 'react';
import { Modal } from '../admin/components/ui';
import { signatureHtml } from '../../api/_lib/signature.js';
import { saveSignature } from './lib/mailApi';

// Preview exactly as the recipient sees it (white mail background).
export function SignatureFrame({ html }) {
  const doc = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">
<style>html,body{margin:0;padding:4px 10px 10px;background:#fff}</style></head><body>${html}</body></html>`;
  return <iframe className="ml-sig-frame" title="Vista previa de la firma" sandbox="allow-popups" srcDoc={doc} />;
}

export function SignatureSettings({ mailbox, onClose, onSaved }) {
  const [text, setText] = useState(mailbox.signature_text || '');
  const [enabled, setEnabled] = useState(mailbox.signature_enabled !== false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const preview = useMemo(() => signatureHtml(text), [text]);
  const supported = 'signature_text' in mailbox;

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const [row] = await saveSignature(mailbox.id, text, enabled);
      onSaved(row);
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={`Firma · ${mailbox.address}`} onClose={() => !busy && onClose()} width={640}>
      <div className="ml-compose">
        {!supported && <p className="adm-error">Falta correr la migración 008_mail_signature.sql en Supabase.</p>}
        <label className="adm-field">
          <span>Texto de la firma <small className="adm-muted">(la primera línea va en negrita; la imagen de Arlequín se agrega sola)</small></span>
          <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)}
            placeholder={'Ariel Gonzalez\nCofundador · Jefe de Desarrollo Web'} />
        </label>
        <label className="ml-sig-toggle">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Agregar la firma por defecto en mails nuevos y respuestas
        </label>
        <span className="adm-muted">Vista previa:</span>
        <SignatureFrame html={preview} />
        {err && <p className="adm-error">{err}</p>}
        <div className="ml-compose-actions">
          <span style={{ flex: 1 }} />
          <button type="button" className="adm-btn ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="button" className="adm-btn primary" onClick={save} disabled={busy || !supported}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </Modal>
  );
}
