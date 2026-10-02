-- Baseline schema for somebodydiedbeverly.com.
--
-- These tables were first created by hand for the v1 site. Every statement here
-- is idempotent, so this migration is safe on the existing database (it keeps
-- all existing rows) and also builds the same schema on a brand-new project.
--
-- Access model: anyone can read public content; only a signed-in user can
-- write. Public sign-ups are disabled in Supabase Auth, so the only users are
-- the ones created in the Supabase dashboard (i.e. the site owner).

create extension if not exists pgcrypto;

-- Keeps updated_at current on every update.
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

-- ---------------------------------------------------------------------------
-- Blog
-- ---------------------------------------------------------------------------

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  content text,
  published boolean not null default false,
  password text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Diplomat license plate tracker
-- ---------------------------------------------------------------------------

create table if not exists public.countries (
  id uuid primary key default gen_random_uuid(),
  country_name text not null,
  country_code text not null
);

create table if not exists public.plate_sightings (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries (id) on delete cascade,
  date_spotted date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists plate_sightings_country_id_idx
  on public.plate_sightings (country_id);

-- ---------------------------------------------------------------------------
-- Art gallery
-- ---------------------------------------------------------------------------

create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists gallery_set_updated_at on public.gallery;
create trigger gallery_set_updated_at
  before update on public.gallery
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.posts enable row level security;
alter table public.countries enable row level security;
alter table public.plate_sightings enable row level security;
alter table public.gallery enable row level security;

-- Public reads. Password-protected posts stay hidden from the public API; the
-- server reads them with the service role after checking the password.
drop policy if exists "Public can read published posts" on public.posts;
create policy "Public can read published posts" on public.posts
  for select to anon
  using (published and password is null);

drop policy if exists "Public can read countries" on public.countries;
create policy "Public can read countries" on public.countries
  for select to anon
  using (true);

drop policy if exists "Public can read plate sightings" on public.plate_sightings;
create policy "Public can read plate sightings" on public.plate_sightings
  for select to anon
  using (true);

drop policy if exists "Public can read gallery" on public.gallery;
create policy "Public can read gallery" on public.gallery
  for select to anon
  using (true);

-- The signed-in owner can read and write everything. Anonymous sign-ins also
-- get the authenticated role, so they are excluded explicitly.
create or replace function public.is_owner()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
$$;

drop policy if exists "Owner manages posts" on public.posts;
create policy "Owner manages posts" on public.posts
  for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

drop policy if exists "Owner manages countries" on public.countries;
create policy "Owner manages countries" on public.countries
  for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

drop policy if exists "Owner manages plate sightings" on public.plate_sightings;
create policy "Owner manages plate sightings" on public.plate_sightings
  for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

drop policy if exists "Owner manages gallery" on public.gallery;
create policy "Owner manages gallery" on public.gallery
  for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

-- Never expose post passwords to the public API, even for rows it can see.
revoke select on public.posts from anon;
grant select (id, title, slug, content, published, created_at, updated_at)
  on public.posts to anon;
