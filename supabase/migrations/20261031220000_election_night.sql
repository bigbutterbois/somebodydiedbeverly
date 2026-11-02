-- Election night (Nov 3, 2026): live Senate results.
--
-- election_counts: the latest county counts per state, from the site's own
--   fetch of each state's results feed or from the owner's laptop backup.
--   fetched_at = last good read, changed_at = last time the vote total moved,
--   checked_at = last attempt; the admin page shows these to spot lagging states.
-- election_snapshots: the model's output after each refresh, for the page and
--   the control-odds line through the night.
-- election_refresh: one row, so only one refresh runs at a time.
-- A pg_cron job asks the site to refresh every minute on election night
-- (and the following week, while late ballots are counted).
-- Safe to run twice.

create table if not exists public.election_counts (
  state text primary key,
  source text,
  via text not null default 'server' check (via in ('server', 'laptop')),
  counties jsonb not null default '[]'::jsonb,
  total_votes bigint not null default 0,
  fetched_at timestamptz,
  changed_at timestamptz,
  checked_at timestamptz,
  error text
);

create table if not exists public.election_snapshots (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  data jsonb not null
);
create index if not exists election_snapshots_created_at on public.election_snapshots (created_at desc);

create table if not exists public.election_refresh (
  id int primary key default 1 check (id = 1),
  started_at timestamptz
);
insert into public.election_refresh (id) values (1) on conflict do nothing;

-- The site's server reads and writes these with the secret key; the owner can read them.
alter table public.election_counts enable row level security;
alter table public.election_snapshots enable row level security;
alter table public.election_refresh enable row level security;
drop policy if exists "Owner reads counts" on public.election_counts;
create policy "Owner reads counts" on public.election_counts for select using ((select public.is_owner()));
drop policy if exists "Owner reads snapshots" on public.election_snapshots;
create policy "Owner reads snapshots" on public.election_snapshots for select using ((select public.is_owner()));

-- Starts a refresh unless one started less than min_seconds ago.
create or replace function public.election_claim_refresh(min_seconds int)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with claimed as (
    update public.election_refresh
    set started_at = now()
    where id = 1 and (started_at is null or started_at < now() - make_interval(secs => min_seconds))
    returning 1
  )
  select exists (select 1 from claimed);
$$;
revoke all on function public.election_claim_refresh from public, anon, authenticated;
grant execute on function public.election_claim_refresh to service_role;

-- Every minute from 5:30pm Eastern on Nov 3 until Nov 10, ask the site to
-- refresh. The site does nothing if it refreshed less than a minute ago.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('election-refresh') where exists (select 1 from cron.job where jobname = 'election-refresh');
select cron.schedule(
  'election-refresh',
  '* * * * *',
  $$
  select net.http_get(
    url := 'https://www.wilfullymisunderstand.com/api/election/refresh',
    timeout_milliseconds := 60000
  )
  where now() between '2026-11-03 22:30:00+00' and '2026-11-10 05:00:00+00';
  $$
);
