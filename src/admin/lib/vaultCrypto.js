/*
 * Vault crypto — zero-knowledge, everything happens in the browser.
 *
 *   master password ──PBKDF2-SHA256 (600k it, random salt)──▶ AES-256-GCM key
 *
 * The key is non-extractable and only lives in memory while the vault is
 * unlocked. Supabase stores base64(iv ‖ ciphertext) and never sees the
 * master password or any plaintext. GCM authenticates the data, so a
 * tampered row fails to decrypt instead of returning garbage.
 */

export const PBKDF2_ITERATIONS = 600_000;
const VERIFIER_TEXT = 'arlequin-vault-v1';

const enc = new TextEncoder();
const dec = new TextDecoder();

const toB64 = (bytes) => btoa(String.fromCharCode(...bytes));
const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export function randomSalt() {
  return toB64(crypto.getRandomValues(new Uint8Array(16)));
}

export async function deriveKey(masterPassword, saltB64, iterations = PBKDF2_ITERATIONS) {
  const base = await crypto.subtle.importKey('raw', enc.encode(masterPassword), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromB64(saltB64), iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptText(key, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext)));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return toB64(out);
}

export async function decryptText(key, payloadB64) {
  const raw = fromB64(payloadB64);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, key, raw.slice(12));
  return dec.decode(pt);
}

export const makeVerifier = (key) => encryptText(key, VERIFIER_TEXT);

export async function checkVerifier(key, verifier) {
  try {
    return (await decryptText(key, verifier)) === VERIFIER_TEXT;
  } catch {
    return false;
  }
}
