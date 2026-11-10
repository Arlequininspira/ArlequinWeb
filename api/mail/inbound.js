// Resend "email.received" webhook → stores the mail for every matching casilla.
// The webhook only carries metadata: body comes from the Receiving API and
// attachments are downloaded (signed URLs, 1 h) and copied to Supabase Storage.
import { randomUUID } from 'node:crypto';
import {
  env, db, storageUpload, resend, verifyWebhook, parseAddress, addressList, snippetOf, safeName, json,
} from '../_lib/mail.js';

export const maxDuration = 60;

export async function POST(request) {
  const raw = await request.text();
  if (!verifyWebhook(raw, request.headers, process.env.RESEND_WEBHOOK_SECRET)) {
    return new Response('Invalid signature', { status: 401 });
  }
  const { missing } = env();
  if (missing.length) return json({ ok: false, error: `Faltan variables: ${missing.join(', ')}` }, 500);

  let event;
  try { event = JSON.parse(raw); } catch { return new Response('Bad JSON', { status: 400 }); }
  if (event?.type !== 'email.received' || !event.data?.email_id) return json({ ok: true, ignored: event?.type });

  try {
    return json(await store(event.data.email_id));
  } catch (e) {
    console.error('[mail/inbound]', e);
    return json({ ok: false, error: String(e.message || e) }, 500); // 5xx → Resend retries
  }
}

async function store(emailId) {
  const mail = await resend(`/emails/receiving/${encodeURIComponent(emailId)}`);

  // received_for covers BCC deliveries, which don't appear in to/cc.
  const rcpts = addressList([...(mail.to || []), ...(mail.cc || []), ...(mail.received_for || [])]);
  if (!rcpts.length) return { ok: true, stored: 0 };
  const list = rcpts.map((a) => `"${a.replace(/"/g, '')}"`).join(',');
  const boxes = await db(`mailboxes?select=id,address&address=in.(${encodeURIComponent(list)})`);
  if (!boxes.length) return { ok: true, stored: 0, reason: 'sin casilla' };

  const from = parseAddress(mail.headers?.from || mail.from);
  const h = lowerKeys(mail.headers);

  // Real (non-inline) attachments; inline images already come embedded in html.
  let files = [];
  if ((mail.attachments || []).some((a) => a.content_disposition !== 'inline')) {
    const listed = await resend(`/emails/receiving/${encodeURIComponent(emailId)}/attachments?limit=100`);
    files = (listed.data || []).filter((a) => a.content_disposition !== 'inline' && a.download_url);
  }
  const blobs = [];
  for (const f of files) {
    const res = await fetch(f.download_url);
    if (!res.ok) throw new Error(`descarga adjunto ${f.filename}: ${res.status}`);
    blobs.push({ meta: f, bytes: new Uint8Array(await res.arrayBuffer()) });
  }

  let stored = 0;
  for (const box of boxes) {
    const [row] = await db('mail_messages?on_conflict=mailbox_id,resend_id', {
      method: 'POST',
      prefer: 'return=representation,resolution=ignore-duplicates',
      body: {
        mailbox_id: box.id,
        folder: 'inbox',
        resend_id: mail.id,
        message_id: mail.message_id || h['message-id'] || null,
        in_reply_to: h['in-reply-to'] || null,
        refs: h['references'] || null,
        from_addr: from.address,
        from_name: from.name,
        to_addrs: addressList(mail.to),
        cc_addrs: addressList(mail.cc),
        reply_to: addressList(mail.reply_to),
        subject: mail.subject || '',
        snippet: snippetOf(mail.text, mail.html),
        text_body: mail.text || null,
        html_body: mail.html || null,
        has_attachments: blobs.length > 0,
        auth_result: mail.authentication || null,
        sent_at: mail.created_at || new Date().toISOString(),
      },
    });
    if (!row) continue; // duplicate retry: already stored
    stored++;
    const atts = [];
    for (const { meta, bytes } of blobs) {
      const path = `${box.id}/in/${randomUUID()}/${safeName(meta.filename)}`;
      await storageUpload(path, bytes, meta.content_type);
      atts.push({ message_id: row.id, filename: safeName(meta.filename), content_type: meta.content_type || null, size: meta.size ?? bytes.length, storage_path: path });
    }
    if (atts.length) await db('mail_attachments', { method: 'POST', body: atts, prefer: 'return=minimal' });
  }
  return { ok: true, stored };
}

const lowerKeys = (o) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v.join(' ') : v]));
