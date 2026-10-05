-- Visitor stats for the admin Visitors page.
--
-- One row per page view on the public side, plus one per wrong friends &
-- family password. No IP addresses are stored: location comes from Vercel's
-- city/region/country headers, and `visitor` is a hash of IP + browser that
-- changes every day, so it can count unique visitors per day but can't be
-- traced back to an address or followed across days. The owner's own visits
-- are not logged.

create table public.visits (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null default 'view' check (kind in ('view', 'bad_password')),
  path text not null,
  referrer text,
  country text,
  region text,
  city text,
  device text,
  browser text,
  os text,
  visitor text
);

create index visits_created_at_idx on public.visits (created_at desc);

alter table public.visits enable row level security;

-- Only the owner reads (and can clear) visits. Nobody inserts directly: the
-- site logs through log_visit() below.
create policy "Owner reads visits" on public.visits
  for select to authenticated
  using ((select public.is_owner()));

create policy "Owner deletes visits" on public.visits
  for delete to authenticated
  using ((select public.is_owner()));

-- Records one visit. Callable by anyone who reaches the site, so it trims
-- every field and only accepts the two known kinds.
create or replace function public.log_visit(
  p_kind text,
  p_path text,
  p_referrer text,
  p_country text,
  p_region text,
  p_city text,
  p_device text,
  p_browser text,
  p_os text,
  p_visitor text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.visits
    (kind, path, referrer, country, region, city, device, browser, os, visitor)
  select
    p_kind,
    left(coalesce(p_path, '/'), 300),
    left(p_referrer, 200),
    left(p_country, 2),
    left(p_region, 80),
    left(p_city, 120),
    left(p_device, 20),
    left(p_browser, 40),
    left(p_os, 40),
    left(p_visitor, 64)
  where p_kind in ('view', 'bad_password')
$$;

revoke all on function public.log_visit from public;
grant execute on function public.log_visit to anon, authenticated;

-- Everything the Visitors page shows, for the last `p_days` days, with days
-- counted in Eastern time. Runs as the caller, so row level security means
-- only the owner gets numbers back.
create or replace function public.visit_stats(p_days int)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with range as (
    select (now() at time zone 'America/New_York')::date - (p_days - 1) as first_day
  ),
  v as (
    select *, (created_at at time zone 'America/New_York')::date as day
    from public.visits, range
    where created_at >= (range.first_day::timestamp at time zone 'America/New_York')
  ),
  views as (select * from v where kind = 'view')
  select jsonb_build_object(
    'views', (select count(*) from views),
    'visitors', (select count(distinct (day, visitor)) from views),
    'bad_passwords', (select count(*) from v where kind = 'bad_password'),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', d.day, 'views', coalesce(c.views, 0), 'visitors', coalesce(c.visitors, 0)
      ) order by d.day), '[]')
      from (
        select generate_series(
          range.first_day::timestamp,
          (range.first_day + (p_days - 1))::timestamp,
          interval '1 day'
        )::date as day
        from range
      ) d
      left join (
        select day, count(*) as views, count(distinct visitor) as visitors
        from views group by day
      ) c using (day)
    ),
    'pages', (
      select coalesce(jsonb_agg(t), '[]') from (
        select path as label, count(*) as n from views
        group by path order by n desc limit 10
      ) t
    ),
    'referrers', (
      select coalesce(jsonb_agg(t), '[]') from (
        select referrer as label, count(*) as n from views
        where referrer is not null
        group by referrer order by n desc limit 10
      ) t
    ),
    'countries', (
      select coalesce(jsonb_agg(t), '[]') from (
        select country as label, count(*) as n, count(distinct (day, visitor)) as visitors
        from views where country is not null
        group by country order by n desc limit 15
      ) t
    ),
    'cities', (
      select coalesce(jsonb_agg(t), '[]') from (
        select city, region, country, count(*) as n, count(distinct (day, visitor)) as visitors
        from views where city is not null
        group by city, region, country order by n desc limit 15
      ) t
    ),
    'devices', (
      select coalesce(jsonb_agg(t), '[]') from (
        select coalesce(device, 'desktop') as label, count(*) as n from views
        group by 1 order by n desc
      ) t
    ),
    'browsers', (
      select coalesce(jsonb_agg(t), '[]') from (
        select coalesce(browser, 'Unknown') as label, count(*) as n from views
        group by 1 order by n desc limit 8
      ) t
    )
  )
$$;

grant execute on function public.visit_stats to authenticated;
