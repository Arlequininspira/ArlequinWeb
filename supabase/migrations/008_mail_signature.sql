-- ═══════════════════════════════════════════════════════════════════════════
--  008 — Firma de correo por casilla
--  Pegar en Supabase → SQL Editor → Run. Idempotente. Requiere la 007.
--
--  La imagen de la firma es fija (la de /firma); cada casilla configura el
--  texto que va arriba (nombre, cargo, lo que quieran) desde /mails → Firma.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.mailboxes add column if not exists signature_text text not null default '';
alter table public.mailboxes add column if not exists signature_enabled boolean not null default true;

-- Texto inicial = nombre de la casilla (después cada uno lo edita).
update public.mailboxes set signature_text = display_name
where signature_text = '' and coalesce(display_name, '') <> '';

-- Cada uno sólo puede editar la firma de sus casillas (y nada más de la tabla).
drop policy if exists mailboxes_own_update on public.mailboxes;
create policy mailboxes_own_update on public.mailboxes
  for update to authenticated using (public.owns_mailbox(id)) with check (public.owns_mailbox(id));
grant update (signature_text, signature_enabled) on public.mailboxes to authenticated;
