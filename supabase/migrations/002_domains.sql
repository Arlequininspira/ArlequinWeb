-- ═══════════════════════════════════════════════════════════════════════
--  002 — Dominios de los trabajos web (renovación anual + recordatorio)
--  Pegar en Supabase → SQL Editor → Run. Idempotente.
--  (Ya incluido en schema.sql para instalaciones nuevas.)
-- ═══════════════════════════════════════════════════════════════════════

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
