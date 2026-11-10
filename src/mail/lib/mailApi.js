import { supabase, q } from '../../admin/lib/supabase';

const LIST_COLS = 'id,folder,from_addr,from_name,to_addrs,cc_addrs,subject,snippet,is_read,has_attachments,sent_at';

export const myMailboxes = () =>
  q(supabase.from('mailboxes').select('id,address,display_name').order('address'));

export function listMessages(mailboxId, folder, search = '') {
  let query = supabase.from('mail_messages').select(LIST_COLS)
    .eq('mailbox_id', mailboxId).eq('folder', folder)
    .order('sent_at', { ascending: false }).limit(200);
  // PostgREST "or" syntax breaks on , ( ) — strip them from the term.
  const t = search.replace(/[,()*%\\]/g, ' ').trim();
  if (t) query = query.or(['subject', 'from_addr', 'from_name', 'snippet'].map((c) => `${c}.ilike.*${t}*`).join(','));
  return q(query);
}

export async function unreadCount(mailboxId) {
  const { count, error } = await supabase.from('mail_messages').select('id', { count: 'exact', head: true })
    .eq('mailbox_id', mailboxId).eq('folder', 'inbox').eq('is_read', false);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getMessage(id) {
  const [msg] = await q(supabase.from('mail_messages').select('*').eq('id', id));
  if (!msg) throw new Error('El mensaje ya no existe.');
  const attachments = msg.has_attachments
    ? await q(supabase.from('mail_attachments').select('id,filename,content_type,size,storage_path').eq('message_id', id).order('created_at'))
    : [];
  return { ...msg, attachments };
}

export const markRead = (id, is_read = true) => q(supabase.from('mail_messages').update({ is_read }).eq('id', id));
export const moveTo = (id, folder) => q(supabase.from('mail_messages').update({ folder }).eq('id', id));
export const deleteForever = (id) => q(supabase.from('mail_messages').delete().eq('id', id).eq('folder', 'trash'));

export async function attachmentUrl(path, filename) {
  const { data, error } = await supabase.storage.from('mail').createSignedUrl(path, 300, { download: filename || true });
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function uploadAttachment(mailboxId, file) {
  const name = file.name.replace(/[\\/\x00-\x1f]/g, '_').slice(0, 150) || 'archivo';
  const path = `${mailboxId}/out/${crypto.randomUUID()}/${name}`;
  const { error } = await supabase.storage.from('mail').upload(path, file, { contentType: file.type || 'application/octet-stream' });
  if (error) throw new Error(error.message);
  return { storage_path: path, filename: name, content_type: file.type || null, size: file.size };
}

export async function sendMail(payload) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch('/api/mail/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token}` },
    body: JSON.stringify(payload),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `Error ${res.status}`);
  return j;
}

// ── Formatting helpers ──────────────────────────────────────────────────
export function fmtDate(iso, long = false) {
  const d = new Date(iso);
  const now = new Date();
  if (long) return d.toLocaleString('es-AR', { dateStyle: 'full', timeStyle: 'short' });
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export const fmtSize = (n) => (n == null ? '' : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);

export function htmlToText(html = '') {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('style,script,head').forEach((n) => n.remove());
  doc.querySelectorAll('br').forEach((n) => n.replaceWith('\n'));
  doc.querySelectorAll('p,div,tr,li,h1,h2,h3,h4').forEach((n) => n.append('\n'));
  return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

export const bodyText = (m) => m.text_body || htmlToText(m.html_body || '');
