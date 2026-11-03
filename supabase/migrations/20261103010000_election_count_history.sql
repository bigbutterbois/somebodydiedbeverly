-- Election night: each state's county counts every time its total moves, so
-- the admin county sheet can show how many votes each county added in the
-- last 15 minutes. The server writes with the secret key and keeps about two
-- hours per state; only the owner can read it directly. Safe to run twice.

create table if not exists public.election_count_history (
  id bigint generated always as identity primary key,
  state text not null,
  at timestamptz not null default now(),
  counties jsonb not null,
  total_votes bigint not null
);
create index if not exists election_count_history_state_at on public.election_count_history (state, at desc);

alter table public.election_count_history enable row level security;
drop policy if exists "Owner reads count history" on public.election_count_history;
create policy "Owner reads count history" on public.election_count_history
  for select using ((select public.is_owner()));
