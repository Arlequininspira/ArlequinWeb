-- ═══════════════════════════════════════════════════════════════════════
--  005 — Quién cobró cada ingreso
--  Pegar en Supabase → SQL Editor → Run. Idempotente. Requiere la 004.
--  (Ya incluido en schema.sql para instalaciones nuevas.)
-- ═══════════════════════════════════════════════════════════════════════

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
