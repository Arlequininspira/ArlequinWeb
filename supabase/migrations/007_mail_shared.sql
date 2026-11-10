-- ═══════════════════════════════════════════════════════════════════════════
--  007 — Casillas compartidas
--  Pegar en Supabase → SQL Editor → Run. Idempotente. Requiere la 006.
--
--  Una casilla puede tener varios usuarios (mailbox_members). Al correrla,
--  TODOS los dueños de casillas pasan a ver TODAS las casillas (Ariel y Lucas
--  ven agonzalez@ y lrementeria@). En /mails se elige la casilla en el menú.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.mailbox_members (
  mailbox_id uuid not null references public.mailboxes (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (mailbox_id, user_id)
);
create index if not exists mailbox_members_user_idx on public.mailbox_members (user_id);

-- Acceso = dueño original o miembro.
create or replace function public.owns_mailbox(p_mailbox uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.mailboxes where id = p_mailbox and user_id = auth.uid())
      or exists (select 1 from public.mailbox_members where mailbox_id = p_mailbox and user_id = auth.uid());
$$;

drop policy if exists mailboxes_own_select on public.mailboxes;
create policy mailboxes_own_select on public.mailboxes
  for select to authenticated using (public.owns_mailbox(id));

alter table public.mailbox_members enable row level security;
drop policy if exists mailbox_members_own_select on public.mailbox_members;
create policy mailbox_members_own_select on public.mailbox_members
  for select to authenticated using (user_id = auth.uid());
revoke all on public.mailbox_members from anon, authenticated;
grant select on public.mailbox_members to authenticated;

-- Compartir: cada dueño de alguna casilla accede a todas.
insert into public.mailbox_members (mailbox_id, user_id)
select m.id, o.user_id
from public.mailboxes m
cross join (select distinct user_id from public.mailboxes) o
on conflict do nothing;

-- Para sumar a alguien más a una casilla:
-- insert into public.mailbox_members (mailbox_id, user_id)
-- select m.id, u.id from public.mailboxes m, auth.users u
-- where m.address = 'agonzalez@arlequin.com.ar' and u.email = '<login>'
-- on conflict do nothing;
