-- ═══════════════════════════════════════════════════════════════════════════
--  006 — Correo @arlequin.com.ar (/mails)
--  Pegar en Supabase → SQL Editor → Run. Idempotente.
--
--  Cómo fluye:
--   · Entrada: Resend recibe el mail (MX) → webhook /api/mail/inbound → guarda
--     acá con la service key (el navegador NUNCA inserta mensajes).
--   · Salida: /mails → /api/mail/send (verifica la sesión) → Resend → copia en
--     la carpeta "sent".
--   · Cada usuario ve SÓLO las casillas cuyo user_id es él (RLS). No hace falta
--     ser admin del panel: alcanza con tener una casilla asignada.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Casillas ─────────────────────────────────────────────────────────────
create table if not exists public.mailboxes (
  id           uuid primary key default gen_random_uuid(),
  address      text not null unique check (address = lower(trim(address)) and address like '%@%'),
  display_name text,
  user_id      uuid not null references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now()
);
create index if not exists mailboxes_user_idx on public.mailboxes (user_id);

-- true si la casilla es del usuario logueado.
create or replace function public.owns_mailbox(p_mailbox uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.mailboxes where id = p_mailbox and user_id = auth.uid());
$$;
revoke all on function public.owns_mailbox(uuid) from public, anon;
grant execute on function public.owns_mailbox(uuid) to authenticated;

-- ── Mensajes ─────────────────────────────────────────────────────────────
create table if not exists public.mail_messages (
  id           uuid primary key default gen_random_uuid(),
  mailbox_id   uuid not null references public.mailboxes (id) on delete cascade,
  folder       text not null default 'inbox' check (folder in ('inbox', 'sent', 'trash')),
  resend_id    text,                 -- id de Resend (entrada) / id del envío (salida)
  message_id   text,                 -- Message-ID RFC 5322, para hilos
  in_reply_to  text,
  refs         text,                 -- header References
  from_addr    text not null,
  from_name    text,
  to_addrs     text[] not null default '{}',
  cc_addrs     text[] not null default '{}',
  reply_to     text[] not null default '{}',
  subject      text not null default '',
  snippet      text not null default '',
  text_body    text,
  html_body    text,
  has_attachments boolean not null default false,
  is_read      boolean not null default false,
  auth_result  jsonb,                -- spf / dkim / dmarc informados por Resend
  sent_at      timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  unique (mailbox_id, resend_id)     -- el webhook puede reintentar: sin duplicados
);
create index if not exists mail_messages_list_idx on public.mail_messages (mailbox_id, folder, sent_at desc);

create table if not exists public.mail_attachments (
  id           uuid primary key default gen_random_uuid(),
  message_id   uuid not null references public.mail_messages (id) on delete cascade,
  filename     text not null,
  content_type text,
  size         integer,
  storage_path text not null,        -- bucket "mail": <mailbox_id>/in|out/<uuid>/<archivo>
  created_at   timestamptz not null default now()
);
create index if not exists mail_attachments_msg_idx on public.mail_attachments (message_id);

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.mailboxes        enable row level security;
alter table public.mail_messages    enable row level security;
alter table public.mail_attachments enable row level security;

drop policy if exists mailboxes_own_select on public.mailboxes;
create policy mailboxes_own_select on public.mailboxes
  for select to authenticated using (user_id = auth.uid());

drop policy if exists mail_messages_own_select on public.mail_messages;
create policy mail_messages_own_select on public.mail_messages
  for select to authenticated using (public.owns_mailbox(mailbox_id));

drop policy if exists mail_messages_own_update on public.mail_messages;
create policy mail_messages_own_update on public.mail_messages
  for update to authenticated
  using (public.owns_mailbox(mailbox_id)) with check (public.owns_mailbox(mailbox_id));

-- Borrar definitivo sólo desde la papelera.
drop policy if exists mail_messages_own_delete on public.mail_messages;
create policy mail_messages_own_delete on public.mail_messages
  for delete to authenticated using (public.owns_mailbox(mailbox_id) and folder = 'trash');

drop policy if exists mail_attachments_own_select on public.mail_attachments;
create policy mail_attachments_own_select on public.mail_attachments
  for select to authenticated using (exists (
    select 1 from public.mail_messages m
    where m.id = mail_attachments.message_id and public.owns_mailbox(m.mailbox_id)));

-- El navegador sólo puede marcar leído y mover de carpeta; nada más.
revoke all on public.mailboxes, public.mail_messages, public.mail_attachments from anon, authenticated;
grant select on public.mailboxes, public.mail_messages, public.mail_attachments to authenticated;
grant update (is_read, folder) on public.mail_messages to authenticated;
grant delete on public.mail_messages to authenticated;

-- ── Adjuntos (Storage, bucket privado) ───────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('mail', 'mail', false, 26214400)          -- 25 MB por archivo
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- Primer segmento de la ruta = id de la casilla (validado como uuid antes de castear).
create or replace function public.mail_path_owned(p_name text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and public.owns_mailbox(split_part(p_name, '/', 1)::uuid);
$$;
revoke all on function public.mail_path_owned(text) from public, anon;
grant execute on function public.mail_path_owned(text) to authenticated;

drop policy if exists mail_storage_read on storage.objects;
create policy mail_storage_read on storage.objects
  for select to authenticated using (bucket_id = 'mail' and public.mail_path_owned(name));

-- Subir adjuntos para enviar: sólo en <mi casilla>/out/...
drop policy if exists mail_storage_upload on storage.objects;
create policy mail_storage_upload on storage.objects
  for insert to authenticated with check (
    bucket_id = 'mail' and public.mail_path_owned(name) and split_part(name, '/', 2) = 'out');

-- ── Alta de casillas (correr una vez, con los emails de login reales) ────
-- insert into public.mailboxes (address, display_name, user_id)
-- select 'agonzalez@arlequin.com.ar', 'Ariel González', id from auth.users where email = '<login de Ariel>'
-- on conflict (address) do nothing;
-- insert into public.mailboxes (address, display_name, user_id)
-- select 'lrementeria@arlequin.com.ar', '<Nombre>', id from auth.users where email = '<login>'
-- on conflict (address) do nothing;
