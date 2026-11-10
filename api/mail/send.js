// Sends a mail from the caller's casilla through Resend and stores a copy in "sent".
// Body: { mailbox_id?, to, cc?, subject, text, reply_to_message_id?, attachments?: [{ storage_path, filename, content_type, size }] }
// Attachments are uploaded by the browser to Storage (<mailbox>/out/...) first;
// here they're passed to Resend as short-lived signed URLs.
import { randomUUID } from 'node:crypto';
import {
  env, db, resend, storageSignedUrl, userFromRequest, addressList, isEmail, snippetOf, json,
} from '../_lib/mail.js';

export const maxDuration = 30;
const MAX_RCPT = 50;
const MAX_ATT_BYTES = 30 * 1024 * 1024;

export async function POST(request) {
  const { missing } = env();
  if (missing.length) return json({ error: `Faltan variables: ${missing.join(', ')}` }, 500);

  const user = await userFromRequest(request);
  if (!user?.id) return json({ error: 'Sesión vencida: volvé a ingresar.' }, 401);

  let b;
  try { b = await request.json(); } catch { return json({ error: 'Pedido inválido' }, 400); }

  // Own casillas + shared ones (mailbox_members, migración 007).
  const uid = encodeURIComponent(user.id);
  const shared = await db(`mailbox_members?select=mailbox_id&user_id=eq.${uid}`).catch(() => []);
  const ids = shared.map((r) => r.mailbox_id).filter((x) => /^[0-9a-f-]{36}$/.test(x));
  const boxes = await db(`mailboxes?select=id,address,display_name&or=(user_id.eq.${uid}${ids.length ? `,id.in.(${ids.join(',')})` : ''})&order=address`);
  const box = b.mailbox_id ? boxes.find((x) => x.id === b.mailbox_id) : boxes[0];
  if (!box) return json({ error: 'Tu usuario no tiene una casilla asignada.' }, 403);

  const to = addressList(b.to);
  const cc = addressList(b.cc);
  const bad = [...to, ...cc].filter((a) => !isEmail(a));
  if (!to.length) return json({ error: 'Falta el destinatario.' }, 400);
  if (bad.length) return json({ error: `Dirección inválida: ${bad.join(', ')}` }, 400);
  if (to.length + cc.length > MAX_RCPT) return json({ error: `Máximo ${MAX_RCPT} destinatarios.` }, 400);

  const subject = String(b.subject || '').slice(0, 500);
  const text = String(b.text || '');
  const html = textToHtml(text);

  // Threading headers when replying.
  let original = null;
  if (b.reply_to_message_id) {
    [original] = await db(`mail_messages?select=id,message_id,refs&id=eq.${encodeURIComponent(b.reply_to_message_id)}&mailbox_id=eq.${box.id}`);
  }
  const messageId = `<${randomUUID()}@${box.address.split('@')[1]}>`;
  const headers = { 'Message-ID': messageId };
  let refs = null;
  if (original?.message_id) {
    headers['In-Reply-To'] = original.message_id;
    refs = [original.refs, original.message_id].filter(Boolean).join(' ');
    headers['References'] = refs;
  }

  const atts = Array.isArray(b.attachments) ? b.attachments : [];
  // Own casilla only: out/ = uploaded for this mail, in/ = forwarding a received attachment.
  if (atts.some((a) => typeof a?.storage_path !== 'string' || !/^(in|out)\//.test(a.storage_path.slice(box.id.length + 1)) || !a.storage_path.startsWith(`${box.id}/`) || a.storage_path.includes('..'))) {
    return json({ error: 'Adjunto inválido.' }, 400);
  }
  if (atts.reduce((s, a) => s + (Number(a.size) || 0), 0) > MAX_ATT_BYTES) return json({ error: 'Los adjuntos superan 30 MB.' }, 400);
  const resendAtts = [];
  for (const a of atts) resendAtts.push({ filename: String(a.filename || 'archivo'), path: await storageSignedUrl(a.storage_path, 900) });

  const fromName = (box.display_name || '').replace(/[<>"]/g, '');
  let sent;
  try {
    sent = await resend('/emails', {
      method: 'POST',
      idempotencyKey: typeof b.client_id === 'string' ? b.client_id.slice(0, 200) : undefined,
      body: {
        from: fromName ? `${fromName} <${box.address}>` : box.address,
        to, ...(cc.length ? { cc } : {}),
        subject, text, html, headers,
        ...(resendAtts.length ? { attachments: resendAtts } : {}),
      },
    });
  } catch (e) {
    console.error('[mail/send]', e);
    return json({ error: `No se pudo enviar: ${e.message}` }, 502);
  }

  const [row] = await db('mail_messages', {
    method: 'POST',
    prefer: 'return=representation',
    body: {
      mailbox_id: box.id, folder: 'sent', resend_id: sent.id, message_id: messageId,
      in_reply_to: headers['In-Reply-To'] || null, refs,
      from_addr: box.address, from_name: box.display_name || null,
      to_addrs: to, cc_addrs: cc, subject, snippet: snippetOf(text), text_body: text, html_body: html,
      has_attachments: atts.length > 0, is_read: true,
    },
  });
  if (atts.length) {
    await db('mail_attachments', {
      method: 'POST', prefer: 'return=minimal',
      body: atts.map((a) => ({ message_id: row.id, filename: String(a.filename || 'archivo'), content_type: a.content_type || null, size: Number(a.size) || null, storage_path: a.storage_path })),
    });
  }
  return json({ ok: true, id: row.id });
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Plain text → simple HTML: escaped, links clickable, quoted lines (">") greyed.
function textToHtml(text) {
  const lines = esc(text).split(/\r?\n/).map((l) => {
    const linked = l.replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}">${u}</a>`);
    return /^&gt;/.test(l) ? `<span style="color:#777">${linked}</span>` : linked;
  });
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">${lines.join('<br>')}</div>`;
}
