-- ═══════════════════════════════════════════════════════════════════════
--  ARLEQUÍN — Panel de administración (/login)
--  Pegar completo en Supabase → SQL Editor → Run. Es idempotente: se puede
--  volver a correr sin perder datos.
--
--  Seguridad:
--   · RLS en TODAS las tablas: sólo usuarios listados en public.admins.
--   · Las contraseñas de "Cuentas" llegan YA CIFRADAS desde el navegador
--     (AES-256-GCM con una clave derivada de la clave maestra). La base sólo
--     guarda texto cifrado: ni Supabase ni quien robe la base puede leerlas.
-- ═══════════════════════════════════════════════════════════════════════

-- ── Admins ──────────────────────────────────────────────────────────────
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ── Clientes y trabajos ─────────────────────────────────────────────────
create table if not exists public.clients (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(trim(name)) > 0),
  contact_name text,
  email        text,
  phone        text,
  notes        text,
  created_at   timestamptz not null default now()
);

create table if not exists public.projects (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients (id) on delete cascade,
  name         text not null check (length(trim(name)) > 0),
  url          text,
  status       text not null default 'activo' check (status in ('activo', 'pausado', 'finalizado')),
  billing_type text not null default 'mensual' check (billing_type in ('mensual', 'unico')),
  amount       numeric(14, 2) not null default 0 check (amount >= 0),
  currency     text not null default 'ARS' check (currency in ('ARS', 'USD')),
  start_date   date not null default current_date,
  notes        text,
  created_at   timestamptz not null default now()
);
create index if not exists projects_client_idx on public.projects (client_id);

-- ── Movimientos (ingresos y gastos) ─────────────────────────────────────
create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('ingreso', 'gasto')),
  date        date not null default current_date,
  amount      numeric(14, 2) not null check (amount > 0),
  currency    text not null default 'ARS' check (currency in ('ARS', 'USD')),
  category    text not null default 'Otros',
  description text,
  client_id   uuid references public.clients (id) on delete set null,
  project_id  uuid references public.projects (id) on delete set null,
  recurring_id uuid,
  period      text check (period ~ '^\d{4}-\d{2}$'),   -- YYYY-MM (mantenimiento)
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists transactions_date_idx on public.transactions (date desc);
-- Un mismo mes de mantenimiento no se puede cobrar dos veces.
create unique index if not exists transactions_project_period_uq
  on public.transactions (project_id, period)
  where kind = 'ingreso' and project_id is not null and period is not null;

-- ── Gastos fijos (ARCA, dominios, hosting…) ─────────────────────────────
create table if not exists public.recurring_expenses (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  category   text not null default 'Otros',
  amount     numeric(14, 2) not null check (amount >= 0),
  currency   text not null default 'ARS' check (currency in ('ARS', 'USD')),
  frequency  text not null default 'mensual' check (frequency in ('mensual', 'anual')),
  next_due   date not null default current_date,
  active     boolean not null default true,
  notes      text,
  created_at timestamptz not null default now()
);

do $$ begin
  alter table public.transactions
    add constraint transactions_recurring_fk
    foreign key (recurring_id) references public.recurring_expenses (id) on delete set null;
exception when duplicate_object then null; end $$;

-- ── Bóveda de cuentas (sólo texto cifrado) ──────────────────────────────
create table if not exists public.vault_meta (
  id         int primary key default 1 check (id = 1),
  salt       text not null,           -- base64, 16 bytes aleatorios
  iterations int  not null,           -- PBKDF2-SHA256
  verifier   text not null,           -- cifrado de un texto fijo: valida la clave maestra
  created_at timestamptz not null default now()
);

create table if not exists public.accounts (
  id          uuid primary key default gen_random_uuid(),
  service     text not null check (length(trim(service)) > 0),
  url         text,
  username    text,
  category    text not null default 'General',
  client_id   uuid references public.clients (id) on delete set null,
  secret      text not null,          -- base64(iv ‖ AES-GCM(password))
  notes_secret text,                  -- base64(iv ‖ AES-GCM(notas)) opcional
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

-- ── RLS: todo sólo para admins ──────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['admins','clients','projects','transactions','recurring_expenses','vault_meta','accounts']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format(
      'create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- Permisos explícitos: anon (no logueado) no toca nada; authenticated pasa
-- por RLS (sólo admins). Necesario en proyectos nuevos de Supabase, que ya
-- no exponen las tablas automáticamente.
revoke all on public.admins, public.clients, public.projects, public.transactions,
  public.recurring_expenses, public.vault_meta, public.accounts from anon;
grant select, insert, update, delete on public.clients, public.projects, public.transactions,
  public.recurring_expenses, public.accounts to authenticated;
grant select on public.admins to authenticated;
grant select, insert on public.vault_meta to authenticated;

-- La clave maestra no se puede pisar desde la app una vez creada.
drop policy if exists admin_all on public.vault_meta;
drop policy if exists vault_read on public.vault_meta;
drop policy if exists vault_create on public.vault_meta;
create policy vault_read   on public.vault_meta for select to authenticated using (public.is_admin());
create policy vault_create on public.vault_meta for insert to authenticated with check (public.is_admin());

-- ── Operaciones atómicas ────────────────────────────────────────────────
-- Cobrar un trabajo: crea el ingreso vinculado al cliente/proyecto.
create or replace function public.charge_project(
  p_project_id uuid, p_amount numeric, p_date date, p_period text default null, p_description text default null)
returns public.transactions
language plpgsql security invoker set search_path = ''
as $$
declare pr public.projects; tx public.transactions;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into pr from public.projects where id = p_project_id;
  if not found then raise exception 'Trabajo inexistente'; end if;

  insert into public.transactions (kind, date, amount, currency, category, description, client_id, project_id, period)
  values ('ingreso', coalesce(p_date, current_date), p_amount, pr.currency,
          case when pr.billing_type = 'mensual' then 'Mantenimiento' else 'Desarrollo web' end,
          coalesce(p_description, pr.name || case when p_period is not null then ' — ' || p_period else '' end),
          pr.client_id, pr.id, case when pr.billing_type = 'mensual' then p_period end)
  returning * into tx;
  return tx;
end $$;

-- Pagar un gasto fijo: crea el gasto y corre el próximo vencimiento.
create or replace function public.pay_recurring(p_id uuid, p_amount numeric, p_date date)
returns public.transactions
language plpgsql security invoker set search_path = ''
as $$
declare r public.recurring_expenses; tx public.transactions;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into r from public.recurring_expenses where id = p_id for update;
  if not found then raise exception 'Gasto fijo inexistente'; end if;

  insert into public.transactions (kind, date, amount, currency, category, description, recurring_id)
  values ('gasto', coalesce(p_date, current_date), p_amount, r.currency, r.category, r.name, r.id)
  returning * into tx;

  update public.recurring_expenses
     set next_due = (next_due + case when frequency = 'anual' then interval '1 year' else interval '1 month' end)::date
   where id = p_id;
  return tx;
end $$;

revoke all on function public.charge_project(uuid, numeric, date, text, text) from public, anon;
revoke all on function public.pay_recurring(uuid, numeric, date) from public, anon;
grant execute on function public.charge_project(uuid, numeric, date, text, text) to authenticated;
grant execute on function public.pay_recurring(uuid, numeric, date) to authenticated;

-- ── Dominios (renovación anual) ─────────────────────────────────────────
create table if not exists public.domains (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects (id) on delete cascade,
  name          text not null check (length(trim(name)) > 0),   -- cafemartinez.com.ar
  provider      text,                                          -- NIC Argentina, GoDaddy…
  registered_on date not null default current_date,
  expires_on    date not null,                                 -- próximo vencimiento
  cost          numeric(14, 2) not null default 0 check (cost >= 0),
  currency      text not null default 'ARS' check (currency in ('ARS', 'USD')),
  paid_by       text not null default 'agencia' check (paid_by in ('agencia', 'cliente')),
  notes         text,
  created_at    timestamptz not null default now()
);
create index if not exists domains_project_idx on public.domains (project_id);
create index if not exists domains_expires_idx on public.domains (expires_on);

alter table public.domains enable row level security;
drop policy if exists admin_all on public.domains;
create policy admin_all on public.domains for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.domains from anon;
grant select, insert, update, delete on public.domains to authenticated;

-- Renovar: corre el vencimiento N años y, si lo paga la agencia, registra
-- el gasto (categoría Dominios) vinculado al cliente y al trabajo.
create or replace function public.renew_domain(
  p_id uuid, p_amount numeric, p_date date, p_years int default 1)
returns public.domains
language plpgsql security invoker set search_path = ''
as $$
declare d public.domains; pr public.projects;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_years < 1 or p_years > 10 then raise exception 'Años inválidos'; end if;
  select * into d from public.domains where id = p_id for update;
  if not found then raise exception 'Dominio inexistente'; end if;
  select * into pr from public.projects where id = d.project_id;

  if d.paid_by = 'agencia' and coalesce(p_amount, 0) > 0 then
    insert into public.transactions (kind, date, amount, currency, category, description, client_id, project_id)
    values ('gasto', coalesce(p_date, current_date), p_amount, d.currency, 'Dominios',
            'Renovación ' || d.name, pr.client_id, pr.id);
  end if;

  update public.domains
     set expires_on = (expires_on + make_interval(years => p_years))::date,
         cost = coalesce(nullif(p_amount, 0), cost)
   where id = p_id
  returning * into d;
  return d;
end $$;

revoke all on function public.renew_domain(uuid, numeric, date, int) from public, anon;
grant execute on function public.renew_domain(uuid, numeric, date, int) to authenticated;

-- ── Cuentas: método de acceso (authenticator / 2FA) ────────────────────
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

-- ── Quién pagó cada gasto (Ariel / Lucas) ─────────────────────────────
-- Texto libre ('ariel', 'lucas'…): sumar un socio no requiere migración.
alter table public.transactions add column if not exists paid_by text;
create index if not exists transactions_paid_by_idx on public.transactions (paid_by);

-- Pagar un gasto fijo / renovar un dominio ahora registran quién pagó.
-- Se borra la firma vieja para que no quede una sobrecarga ambigua.
drop function if exists public.pay_recurring(uuid, numeric, date);
create or replace function public.pay_recurring(p_id uuid, p_amount numeric, p_date date, p_paid_by text default null)
returns public.transactions
language plpgsql security invoker set search_path = ''
as $$
declare r public.recurring_expenses; tx public.transactions;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into r from public.recurring_expenses where id = p_id for update;
  if not found then raise exception 'Gasto fijo inexistente'; end if;

  insert into public.transactions (kind, date, amount, currency, category, description, recurring_id, paid_by)
  values ('gasto', coalesce(p_date, current_date), p_amount, r.currency, r.category, r.name, r.id, nullif(trim(p_paid_by), ''))
  returning * into tx;

  update public.recurring_expenses
     set next_due = (next_due + case when frequency = 'anual' then interval '1 year' else interval '1 month' end)::date
   where id = p_id;
  return tx;
end $$;

drop function if exists public.renew_domain(uuid, numeric, date, int);
create or replace function public.renew_domain(
  p_id uuid, p_amount numeric, p_date date, p_years int default 1, p_paid_by text default null)
returns public.domains
language plpgsql security invoker set search_path = ''
as $$
declare d public.domains; pr public.projects;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_years < 1 or p_years > 10 then raise exception 'Años inválidos'; end if;
  select * into d from public.domains where id = p_id for update;
  if not found then raise exception 'Dominio inexistente'; end if;
  select * into pr from public.projects where id = d.project_id;

  if d.paid_by = 'agencia' and coalesce(p_amount, 0) > 0 then
    insert into public.transactions (kind, date, amount, currency, category, description, client_id, project_id, paid_by)
    values ('gasto', coalesce(p_date, current_date), p_amount, d.currency, 'Dominios',
            'Renovación ' || d.name, pr.client_id, pr.id, nullif(trim(p_paid_by), ''));
  end if;

  update public.domains
     set expires_on = (expires_on + make_interval(years => p_years))::date,
         cost = coalesce(nullif(p_amount, 0), cost)
   where id = p_id
  returning * into d;
  return d;
end $$;

revoke all on function public.pay_recurring(uuid, numeric, date, text) from public, anon;
grant execute on function public.pay_recurring(uuid, numeric, date, text) to authenticated;
revoke all on function public.renew_domain(uuid, numeric, date, int, text) from public, anon;
grant execute on function public.renew_domain(uuid, numeric, date, int, text) to authenticated;

-- ── Quién cobró cada ingreso ───────────────────────────────────────────
-- transactions.paid_by = quién pagó (gasto) o quién cobró (ingreso).
comment on column public.transactions.paid_by is 'Socio que pagó (gasto) o cobró (ingreso): ariel, lucas…';

-- Cobrar un trabajo ahora registra quién cobró.
drop function if exists public.charge_project(uuid, numeric, date, text, text);
create or replace function public.charge_project(
  p_project_id uuid, p_amount numeric, p_date date, p_period text default null, p_description text default null,
  p_paid_by text default null)
returns public.transactions
language plpgsql security invoker set search_path = ''
as $$
declare pr public.projects; tx public.transactions;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into pr from public.projects where id = p_project_id;
  if not found then raise exception 'Trabajo inexistente'; end if;

  insert into public.transactions (kind, date, amount, currency, category, description, client_id, project_id, period, paid_by)
  values ('ingreso', coalesce(p_date, current_date), p_amount, pr.currency,
          case when pr.billing_type = 'mensual' then 'Mantenimiento' else 'Desarrollo web' end,
          coalesce(p_description, pr.name || case when p_period is not null then ' — ' || p_period else '' end),
          pr.client_id, pr.id, case when pr.billing_type = 'mensual' then p_period end,
          nullif(trim(p_paid_by), ''))
  returning * into tx;
  return tx;
end $$;

revoke all on function public.charge_project(uuid, numeric, date, text, text, text) from public, anon;
grant execute on function public.charge_project(uuid, numeric, date, text, text, text) to authenticated;

-- ── Keep-alive (evita que el plan gratis pause el proyecto) ─────────────
create table if not exists public.keepalive (
  id        int primary key default 1 check (id = 1),
  pinged_at timestamptz not null default now(),
  count     bigint not null default 0
);
alter table public.keepalive enable row level security;   -- sin políticas: nadie la lee directo

create or replace function public.keepalive_ping()
returns timestamptz
language sql security definer set search_path = ''
as $$
  insert into public.keepalive (id, pinged_at, count) values (1, now(), 1)
  on conflict (id) do update set pinged_at = now(), count = public.keepalive.count + 1
  returning pinged_at;
$$;
revoke all on function public.keepalive_ping() from public;
grant execute on function public.keepalive_ping() to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════
--  ÚLTIMO PASO (después de crear los 2 usuarios en Authentication → Users):
--
--  insert into public.admins (user_id)
--  select id from auth.users where email in ('admin1@mail.com', 'admin2@mail.com')
--  on conflict do nothing;
-- ═══════════════════════════════════════════════════════════════════════
