-- ═══════════════════════════════════════════════════════════════════════
--  004 — Quién pagó cada gasto (Ariel / Lucas)
--  Pegar en Supabase → SQL Editor → Run. Idempotente.
--  (Ya incluido en schema.sql para instalaciones nuevas.)
-- ═══════════════════════════════════════════════════════════════════════

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
