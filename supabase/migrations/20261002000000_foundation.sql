-- Foundation for the somebodydiedbeverly.com database. Starts empty: each
-- feature (blog, plate tracker, ...) adds its own tables in a later migration.
--
-- Access model for every table: the public can read what is meant to be
-- public, and only the signed-in owner can write. Public sign-ups are disabled
-- in Supabase Auth, so the only account is the site owner's.

-- Keeps an updated_at column current. Attach it to a table with:
--   create trigger <table>_set_updated_at before update on public.<table>
--     for each row execute function public.set_updated_at();
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- True for the signed-in owner. Use it in write policies:
--   create policy "Owner manages <table>" on public.<table>
--     for all to authenticated
--     using ((select public.is_owner())) with check ((select public.is_owner()));
-- Anonymous sign-ins also get the authenticated role, so they are excluded.
create or replace function public.is_owner()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
$$;
