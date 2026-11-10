// Shared helpers for /api/mail/*. Files under api/_lib are not routes.
import { createHmac, timingSafeEqual } from 'node:crypto';

export const BUCKET = 'mail';
const RESEND = 'https://api.resend.com';

export function env() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  // Service key bypasses RLS: server only, never VITE_-prefixed.
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const missing = Object.entries({ SUPABASE_URL: url, SUPABASE_ANON_KEY: anon, SUPABASE_SERVICE_ROLE_KEY: service, RESEND_API_KEY: resendKey })
    .filter(([, v]) => !v).map(([k]) => k);
  return { url, anon, service, resendKey, missing };
}

// New-style keys (sb_publishable_/sb_secret_) aren't JWTs: send them only as apikey.
function keyHeaders(key, bearer) {
  return { apikey: key, ...(bearer ? { Authorization: `Bearer ${bearer}` } : key.startsWith('sb_') ? {} : { Authorization: `Bearer ${key}` }) };
}

// PostgREST call with the service key. Throws on HTTP errors.
export async function db(path, { method = 'GET', body, prefer } = {}) {
  const { url, service } = env();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: { ...keyHeaders(service), 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`db ${method} ${path.split('?')[0]}: ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

export async function storageUpload(path, bytes, contentType) {
  const { url, service } = env();
  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${encodePath(path)}`, {
    method: 'POST',
    headers: { ...keyHeaders(service), 'Content-Type': contentType || 'application/octet-stream', 'x-upsert': 'true' },
    body: bytes,
  });
  if (!res.ok) throw new Error(`storage upload: ${res.status} ${(await res.text()).slice(0, 200)}`);
}

export async function storageSignedUrl(path, expiresIn = 900) {
  const { url, service } = env();
  const res = await fetch(`${url}/storage/v1/object/sign/${BUCKET}/${encodePath(path)}`, {
    method: 'POST',
    headers: { ...keyHeaders(service), 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn }),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.signedURL) throw new Error(`storage sign: ${res.status}`);
  return `${url}/storage/v1${j.signedURL}`;
}

const encodePath = (p) => p.split('/').map(encodeURIComponent).join('/');

// Validates the caller's Supabase session token; returns the user or null.
export async function userFromRequest(request) {
  const { url, anon } = env();
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const res = await fetch(`${url}/auth/v1/user`, { headers: keyHeaders(anon, token) });
  if (!res.ok) return null;
  return res.json();
}

export async function resend(path, { method = 'GET', body, idempotencyKey } = {}) {
  const res = await fetch(`${RESEND}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env().resendKey}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`resend ${method} ${path}: ${res.status} ${j?.message || ''}`);
  return j;
}

// Resend webhooks are signed with Svix: HMAC-SHA256 over "id.timestamp.body",
// key = base64 part of "whsec_...", header "v1,<b64sig>" (space-separated list).
export function verifyWebhook(rawBody, headers, secret, toleranceSec = 300, now = Date.now()) {
  const id = headers.get('svix-id');
  const ts = headers.get('svix-timestamp');
  const sigs = headers.get('svix-signature');
  if (!id || !ts || !sigs || !secret) return false;
  if (!/^\d+$/.test(ts) || Math.abs(now / 1000 - Number(ts)) > toleranceSec) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key).update(`${id}.${ts}.${rawBody}`).digest();
  return sigs.split(' ').some((part) => {
    const [ver, sig] = part.split(',');
    if (ver !== 'v1' || !sig) return false;
    const got = Buffer.from(sig, 'base64');
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

// "Juan Pérez <juan@x.com>" → { name: 'Juan Pérez', address: 'juan@x.com' }
export function parseAddress(s = '') {
  const m = String(s).match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || null, address: m[2].trim().toLowerCase() };
  return { name: null, address: String(s).trim().toLowerCase() };
}

// Accepts string | string[] | comma/semicolon list → unique bare addresses.
export function addressList(v) {
  const arr = Array.isArray(v) ? v : String(v || '').split(/[,;]/);
  const out = [];
  for (const item of arr) {
    const { address } = parseAddress(item);
    if (address && !out.includes(address)) out.push(address);
  }
  return out;
}

export const isEmail = (a) => /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(a);

export function snippetOf(text, html) {
  const src = text || String(html || '')
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return src.replace(/\s+/g, ' ').trim().slice(0, 200);
}

export const safeName = (n) => String(n || 'archivo').replace(/[\\/\x00-\x1f]/g, '_').slice(0, 150) || 'archivo';

export const json = (data, status = 200) => Response.json(data, { status });
