-- Limits guesses at the friends & family password, so nobody can find it by
-- trying word after word. The site records each wrong guess against a key it
-- derives from the guesser's IP address and the site password (an HMAC, so
-- the address itself is never stored and nobody else can compute the key),
-- and refuses to check more guesses once a key has made too many in the last
-- hour. There's deliberately no site-wide cap: anyone can call these
-- functions, so one would let a stranger lock family out.

create table public.password_failures (
  id bigint generated always as identity primary key,
  key text not null,
  created_at timestamptz not null default now()
);

create index password_failures_key_idx on public.password_failures (key, created_at desc);
create index password_failures_created_at_idx on public.password_failures (created_at);

-- Row level security with no policies: nobody reads or writes the table
-- directly, only through the two functions below.
alter table public.password_failures enable row level security;

-- Wrong guesses from this key in the last hour.
create or replace function public.password_failures_recent(p_key text)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.password_failures
  where key = p_key and created_at > now() - interval '1 hour'
$$;

-- Records one wrong guess and clears out ones older than a day.
create or replace function public.record_password_failure(p_key text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.password_failures where created_at < now() - interval '1 day';
  insert into public.password_failures (key) values (left(p_key, 64));
$$;

revoke all on function public.password_failures_recent from public;
revoke all on function public.record_password_failure from public;
grant execute on function public.password_failures_recent to anon, authenticated;
grant execute on function public.record_password_failure to anon, authenticated;
