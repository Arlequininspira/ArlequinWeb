-- ═══════════════════════════════════════════════════════════════════════
--  003 — Cuentas con Authenticator (sin contraseña) o con 2FA
--  Pegar en Supabase → SQL Editor → Run. Idempotente.
--  (Ya incluido en schema.sql para instalaciones nuevas.)
-- ═══════════════════════════════════════════════════════════════════════

alter table public.accounts
  add column if not exists auth_method text not null default 'password',
  add column if not exists auth_app    text,      -- Google Authenticator, Microsoft Authenticator…
  add column if not exists auth_device text;      -- dónde está: "celular de Ariel"

do $$ begin
  alter table public.accounts
    add constraint accounts_auth_method_chk check (auth_method in ('password', 'password_2fa', 'authenticator'));
exception when duplicate_object then null; end $$;

-- Una cuenta sólo-authenticator no tiene contraseña.
alter table public.accounts alter column secret drop not null;

do $$ begin
  alter table public.accounts
    add constraint accounts_secret_required_chk check (auth_method = 'authenticator' or secret is not null);
exception when duplicate_object then null; end $$;
