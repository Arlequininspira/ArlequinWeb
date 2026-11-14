-- ═══════════════════════════════════════════════════════════════════════════
--  009 — Alias de correo (direcciones sin casilla propia)
--  Pegar en Supabase → SQL Editor → Run. Idempotente. Requiere la 006.
--
--  Un alias (ej. comercial@arlequin.com.ar) no tiene bandeja: cada mail que
--  llega se reparte a sus destinos (uno por fila):
--   · destino = dirección de una casilla existente → se guarda en esa bandeja.
--   · destino = dirección externa (ej. Gmail)      → se reenvía por Resend,
--     desde el alias, con Reply-To al remitente original.
--  Sólo lo lee el servidor (service key); el navegador no tiene acceso.
--  Ojo: cada reenvío externo cuenta para el límite de Resend (100/día gratis).
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.mail_aliases (
  address    text not null check (address = lower(trim(address)) and address like '%@%'),
  target     text not null check (target  = lower(trim(target))  and target  like '%@%' and target <> address),
  created_at timestamptz not null default now(),
  primary key (address, target)
);

alter table public.mail_aliases enable row level security;
revoke all on public.mail_aliases from anon, authenticated;

-- ── comercial@ → bandejas de Ariel y Lucas + copia a sus Gmail ───────────
insert into public.mail_aliases (address, target) values
  ('comercial@arlequin.com.ar', 'agonzalez@arlequin.com.ar'),
  ('comercial@arlequin.com.ar', 'lrementeria@arlequin.com.ar'),
  ('comercial@arlequin.com.ar', 'gonzalez.r.ariel@gmail.com'),
  ('comercial@arlequin.com.ar', 'lucasrementeria@gmail.com')
on conflict do nothing;
