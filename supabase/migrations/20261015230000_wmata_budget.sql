-- Keeps the Metro pages inside WMATA's free API tier: 10 calls a second and
-- 50,000 a day. The site asks wmata_take() before every call it makes to WMATA
-- and skips the call when the answer is false. It allows at most 8 calls in
-- any one second and 45,000 in the last 25 hours (counted in hourly buckets, so
-- any calendar day, in any time zone, stays under the cap), leaving headroom.
-- Safe to run twice: it was applied by hand first so the PR preview could test it.

create table if not exists public.wmata_calls (
  kind text not null check (kind in ('second', 'hour')),
  start timestamptz not null,
  calls int not null default 0,
  primary key (kind, start)
);

-- Row level security with no policies: only the function below touches it.
alter table public.wmata_calls enable row level security;

create or replace function public.wmata_take()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  used int;
  this_second int;
begin
  delete from public.wmata_calls
  where (kind = 'second' and start < now() - interval '1 minute')
     or (kind = 'hour' and start < now() - interval '26 hours');

  select coalesce(sum(calls), 0) into used
  from public.wmata_calls
  where kind = 'hour' and start > now() - interval '25 hours';
  if used >= 45000 then
    return false;
  end if;

  insert into public.wmata_calls (kind, start, calls)
  values ('second', date_trunc('second', clock_timestamp()), 1)
  on conflict (kind, start) do update set calls = public.wmata_calls.calls + 1
  returning calls into this_second;
  if this_second > 8 then
    return false;
  end if;

  insert into public.wmata_calls (kind, start, calls)
  values ('hour', date_trunc('hour', now()), 1)
  on conflict (kind, start) do update set calls = public.wmata_calls.calls + 1;
  return true;
end;
$$;

-- Only the site's server (the secret key) may spend the budget.
revoke all on function public.wmata_take from public, anon, authenticated;
grant execute on function public.wmata_take to service_role;
