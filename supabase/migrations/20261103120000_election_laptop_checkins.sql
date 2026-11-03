-- Election night: one row each time the laptop script (scripts/nyt_laptop.py)
-- checks in, even when it has nothing new to send, so Admin -> Election can
-- show whether it's running every minute and what it sent for each state.
-- The server writes with the secret key and keeps about two hours; only the
-- owner can read it directly. Safe to run twice.

create table if not exists public.election_laptop_checkins (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  -- [{state, units, reporting, votes, statewide, saved}] for each state sent
  states jsonb not null default '[]'::jsonb,
  -- [{state, error}] for states the laptop couldn't read this round
  failed jsonb not null default '[]'::jsonb,
  -- states with no votes yet (read fine, nothing to send)
  waiting jsonb not null default '[]'::jsonb
);
create index if not exists election_laptop_checkins_at on public.election_laptop_checkins (at desc);

alter table public.election_laptop_checkins enable row level security;
drop policy if exists "Owner reads laptop check-ins" on public.election_laptop_checkins;
create policy "Owner reads laptop check-ins" on public.election_laptop_checkins
  for select using ((select public.is_owner()));
