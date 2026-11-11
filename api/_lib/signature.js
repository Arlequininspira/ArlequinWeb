// Firma de los mails enviados desde /mails. Sin dependencias: la usan
// /api/mail/send (envío real) y la página /mails (vista previa).
// Parte fija = imagen clickeable de /firma; parte variable = texto que
// configura cada casilla (arriba y/o debajo de la imagen).

const SITE = 'https://arlequininspira.com';
const IMG_BASE = 'https://www.arlequininspira.com/Firma/mail/';
const WA = 'https://wa.me/5491155706893';

// Imagen "interactiva" de /firma: los mails no soportan SVG ni <map>, así que
// va recortada en piezas (tools/firma-mail-slices.mjs → public/Firma/mail/),
// cada una con su link: WhatsApp, X, Instagram, Facebook y el resto a la web.
// [archivo, ancho, alto, link] por fila; cada fila suma 480px.
const SLICES = [
  [['r0c0', 480, 77, SITE]],
  [['r1c0', 175, 17, SITE], ['r1c1', 120, 17, WA], ['r1c2', 185, 17, SITE]],
  [['r2c0', 480, 40, SITE]],
  [['r3c0', 175, 21, SITE], ['r3c1', 23, 21, 'https://x.com/arlequininspira'],
    ['r3c2', 25, 21, 'https://www.instagram.com/arlequininspira/'],
    ['r3c3', 24, 21, 'https://www.facebook.com/arlequininspira'], ['r3c4', 233, 21, SITE]],
  [['r4c0', 480, 7, SITE]],
];

function imageHtml() {
  const rows = SLICES.map((cells) => `<tr><td style="padding:0;line-height:0;font-size:0"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr>${cells
    .map(([f, w, h, href]) => `<td style="padding:0;line-height:0;font-size:0"><a href="${href}" target="_blank" style="text-decoration:none"><img src="${IMG_BASE}${f}.png" width="${w}" height="${h}" alt="" style="display:block;border:0;width:${w}px;height:${h}px"></a></td>`)
    .join('')}</tr></table></td></tr>`).join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="480" style="border-collapse:collapse;width:480px" title="Arlequín · Diseño Web, UX &amp; UI y Soluciones Digitales">${rows}</table>`;
}

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

// Arriba: primera línea en negrita (el nombre). Imagen clickeable. Abajo: texto libre.
export function signatureHtml(saved = '') {
  const { above, below } = splitSignature(saved);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;font-family:Arial,Helvetica,sans-serif;border-collapse:collapse">
${block(above, true, '0 0 10px')}<tr><td style="padding:0">${imageHtml()}</td></tr>
${block(below, false, '10px 0 0')}</table>`;
}

export function signatureText(saved = '') {
  const { above, below } = splitSignature(saved);
  return ['-- ', above, 'Arlequín · Diseño Web, UX & UI y Soluciones Digitales', below]
    .filter(Boolean).join('\n');
}
