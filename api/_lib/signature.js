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

// Texto libre: primera línea en negrita (el nombre), el resto normal.
export function signatureHtml(extraText = '') {
  const lines = String(extraText).replace(/\r/g, '').split('\n').map((l) => l.trimEnd());
  while (lines.length && !lines.at(-1)) lines.pop();
  const extra = lines.length
    ? `<tr><td style="font-size:14px;line-height:1.45;padding:0 0 10px;color:#222">${lines
      .map((l, i) => (i === 0 ? `<b>${esc(l)}</b>` : esc(l))).join('<br>')}</td></tr>`
    : '';
  const links = LINKS.map(([t, u]) => `<a href="${u}" style="color:#0a28bd;text-decoration:none">${esc(t)}</a>`).join(' &middot; ');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;font-family:Arial,Helvetica,sans-serif;border-collapse:collapse">
${extra}<tr><td><a href="${SITE}" style="text-decoration:none"><img src="${SIGNATURE_IMG}" width="480" alt="Arlequín · Diseño Web, UX &amp; UI y Soluciones Digitales" style="display:block;width:480px;max-width:100%;height:auto;border:0"></a></td></tr>
<tr><td style="font-size:12px;line-height:1.6;padding-top:6px;color:#555">${links}</td></tr>
</table>`;
}

export function signatureText(extraText = '') {
  const extra = String(extraText).replace(/\r/g, '').trim();
  return `-- \n${extra ? `${extra}\n` : ''}Arlequín · Diseño Web, UX & UI y Soluciones Digitales\n${SITE} · WhatsApp +54 9 11 5570-6893`;
}
