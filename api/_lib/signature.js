// Firma de los mails enviados desde /mails. Sin dependencias: la usan
// /api/mail/send (envío real) y la página /mails (vista previa).
// Parte fija = imagen de /firma (PNG: los clientes de correo no muestran SVG
// ni scripts) + links; parte variable = texto que configura cada casilla.

const SITE = 'https://arlequininspira.com';
export const SIGNATURE_IMG = 'https://www.arlequininspira.com/Firma/firma_arlequin_mail.png';
const LINKS = [
  ['WhatsApp +54 9 11 5570-6893', 'https://wa.me/5491155706893'],
  ['arlequininspira.com', SITE],
  ['Instagram', 'https://www.instagram.com/arlequininspira/'],
  ['Facebook', 'https://www.facebook.com/arlequininspira'],
  ['X', 'https://x.com/arlequininspira'],
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// El texto guardado se divide con una línea "[imagen]": lo de arriba va antes
// de la imagen y lo de abajo después. Sin marcador, todo va arriba.
export const IMAGE_MARKER = '[imagen]';

export function splitSignature(saved = '') {
  const lines = String(saved).replace(/\r/g, '').split('\n');
  const i = lines.findIndex((l) => l.trim().toLowerCase() === IMAGE_MARKER);
  const trim = (arr) => arr.join('\n').replace(/^\s*\n|\s+$/g, '');
  return i < 0 ? { above: trim(lines), below: '' } : { above: trim(lines.slice(0, i)), below: trim(lines.slice(i + 1)) };
}

export const joinSignature = (above = '', below = '') =>
  below.trim() ? `${above.trimEnd()}\n${IMAGE_MARKER}\n${below.trim()}` : above.trimEnd();

const block = (text, boldFirst, pad) => {
  const lines = text ? text.split('\n') : [];
  if (!lines.length) return '';
  return `<tr><td style="font-size:14px;line-height:1.45;padding:${pad};color:#222">${lines
    .map((l, i) => (boldFirst && i === 0 ? `<b>${esc(l)}</b>` : esc(l))).join('<br>')}</td></tr>`;
};

// Arriba: primera línea en negrita (el nombre). Imagen fija + links. Abajo: texto libre.
export function signatureHtml(saved = '') {
  const { above, below } = splitSignature(saved);
  const links = LINKS.map(([t, u]) => `<a href="${u}" style="color:#0a28bd;text-decoration:none">${esc(t)}</a>`).join(' &middot; ');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;font-family:Arial,Helvetica,sans-serif;border-collapse:collapse">
${block(above, true, '0 0 10px')}<tr><td><a href="${SITE}" style="text-decoration:none"><img src="${SIGNATURE_IMG}" width="480" alt="Arlequín · Diseño Web, UX &amp; UI y Soluciones Digitales" style="display:block;width:480px;max-width:100%;height:auto;border:0"></a></td></tr>
<tr><td style="font-size:12px;line-height:1.6;padding-top:6px;color:#555">${links}</td></tr>
${block(below, false, '10px 0 0')}</table>`;
}

export function signatureText(saved = '') {
  const { above, below } = splitSignature(saved);
  return ['-- ', above, 'Arlequín · Diseño Web, UX & UI y Soluciones Digitales', `${SITE} · WhatsApp +54 9 11 5570-6893`, below]
    .filter(Boolean).join('\n');
}
