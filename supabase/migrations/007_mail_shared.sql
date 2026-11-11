-- ═══════════════════════════════════════════════════════════════════════════
--  007 — Casillas compartidas
--  Pegar en Supabase → SQL Editor → Run. Idempotente. Requiere la 006.
--
--  Una casilla puede tener más de un login (mailbox_members), p. ej. entrar a
--  agonzalez@ con el usuario agonzalez@arlequin.com.ar o con un Gmail.
--  Cada usuario ve sólo las casillas propias o donde es miembro; si tiene más
--  de una, en /mails la elige en el menú "Casilla".
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

-- Cada uno ve SÓLO lo suyo: se quitan accesos compartidos previos y el dueño
-- de cada casilla pasa a ser el login con el mismo email (si existe).
delete from public.mailbox_members;
update public.mailboxes m set user_id = u.id
from auth.users u
where lower(u.email) = m.address and m.user_id <> u.id;

-- Para que otro login (ej. un Gmail) también entre a una casilla:
-- insert into public.mailbox_members (mailbox_id, user_id)
-- select m.id, u.id from public.mailboxes m, auth.users u
-- where m.address = 'agonzalez@arlequin.com.ar' and u.email = '<login>'
-- on conflict do nothing;
