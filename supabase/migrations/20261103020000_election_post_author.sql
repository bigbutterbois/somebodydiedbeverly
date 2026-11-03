-- Election night live blog: who wrote each post ("WM Admin" for Mike's own,
-- "WMHQ Bot" for the automatic race-call posts) and, for call posts, which
-- call it announces, so each call is posted exactly once. Safe to run twice.

alter table public.election_posts add column if not exists author text not null default 'WM Admin';
alter table public.election_posts add column if not exists call_key text;
create unique index if not exists election_posts_call_key on public.election_posts (call_key);
