export const ADMIN_ICON = '/favicon_back.avif';   // logo + favicon del panel

export const CURRENCIES = ['ARS', 'USD'];

export const INCOME_CATEGORIES = ['Mantenimiento', 'Desarrollo web', 'Diseño', 'Otros'];
export const EXPENSE_CATEGORIES = ['ARCA', 'Dominios', 'Hosting', 'Software', 'Publicidad', 'Equipamiento', 'Otros'];

// Socios a los que se imputa cada gasto (transactions.paid_by). Para sumar uno,
// agregarlo acá: la columna es texto libre.
export const PARTNERS = [
  { id: 'ariel', label: 'Ariel' },
  { id: 'lucas', label: 'Lucas' },
];
export const partnerLabel = (id) => PARTNERS.find((p) => p.id === id)?.label ?? id ?? '';
// Socio del usuario logueado, deducido del email ("gonzalez.r.ariel@…" → ariel).
export const partnerFromEmail = (email = '') =>
  PARTNERS.find((p) => email.toLowerCase().split('@')[0].includes(p.id))?.id ?? '';

const fmt = {
  ARS: new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }),
  USD: new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }),
};

export const money = (amount, currency = 'ARS') => fmt[currency].format(Number(amount) || 0);

export const todayISO = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD local
export const monthISO = (d = new Date()) => d.toLocaleDateString('sv-SE').slice(0, 7);

export function dateAR(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function monthLabel(ym) {
  const [y, m] = ym.split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

export function lastMonths(n) {
  const out = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < n; i++) {
    out.unshift(monthISO(d));
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

// { ARS: {in, out}, USD: {in, out} } for a list of transactions
export function totals(txs) {
  const t = { ARS: { in: 0, out: 0 }, USD: { in: 0, out: 0 } };
  for (const x of txs) t[x.currency][x.kind === 'ingreso' ? 'in' : 'out'] += Number(x.amount);
  return t;
}

export function downloadCSV(filename, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(esc).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
