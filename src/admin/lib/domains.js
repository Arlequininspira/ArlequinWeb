import { todayISO } from './format';

// Domains expiring within this many days show up in Resumen.
export const DOMAIN_ALERT_DAYS = 45;
const URGENT_DAYS = 15;

export const DOMAIN_PROVIDERS = ['NIC Argentina', 'DonWeb', 'GoDaddy', 'Namecheap', 'Hostinger', 'Cloudflare', 'Google / Squarespace'];

const toUTC = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));

export function daysUntil(iso, from = todayISO()) {
  return Math.round((toUTC(iso) - toUTC(from)) / 864e5);
}

export function addYears(iso, years = 1) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y + years, m - 1, d));
  // 29-feb + 1 año → 28-feb (no 1-mar)
  if (dt.getUTCMonth() !== m - 1) dt.setUTCDate(0);
  return dt.toISOString().slice(0, 10);
}

// Next yearly renewal after `today` for a domain registered on `iso`
// (a domain registered in 2022 renews on its next anniversary, not 2023).
export function nextAnniversary(iso, today = todayISO()) {
  let years = 1;
  while (addYears(iso, years) <= today) years++;
  return addYears(iso, years);
}

// 'vencido' | 'urgente' | 'pronto' | 'ok'
export function domainStatus(domain) {
  const days = daysUntil(domain.expires_on);
  if (days < 0) return 'vencido';
  if (days <= URGENT_DAYS) return 'urgente';
  if (days <= DOMAIN_ALERT_DAYS) return 'pronto';
  return 'ok';
}

export function dueLabel(domain) {
  const days = daysUntil(domain.expires_on);
  if (days < 0) return `Vencido hace ${-days} día${days === -1 ? '' : 's'}`;
  if (days === 0) return 'Vence hoy';
  if (days === 1) return 'Vence mañana';
  return `Vence en ${days} días`;
}

export const domainsDueSoon = (domains) =>
  domains.filter((d) => daysUntil(d.expires_on) <= DOMAIN_ALERT_DAYS)
    .sort((a, b) => a.expires_on.localeCompare(b.expires_on));

// "https://www.cafe.com.ar/x" → "cafe.com.ar"
export function hostFromUrl(url) {
  if (!url) return '';
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
