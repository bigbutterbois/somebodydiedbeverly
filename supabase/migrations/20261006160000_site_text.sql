-- Mike's edits to the public site's wording, made at /admin/text. The default
-- wording lives in code (src/lib/site-text.ts); a row here replaces one piece
-- of it, and deleting the row puts the default back.

create table public.site_text (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger site_text_set_updated_at before update on public.site_text
  for each row execute function public.set_updated_at();

alter table public.site_text enable row level security;

create policy "Owner manages site text" on public.site_text
  for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

-- Like the other content tables, the public key can't read it; the site's
-- server reads it with the secret key after the password check.
revoke all on public.site_text from anon;
