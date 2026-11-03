-- Election night live blog: short posts Mike writes from Admin -> Election,
-- shown at the top of /election. The site's server reads them with the secret
-- key (after the family password check); only the owner can write.
-- Safe to run twice.

create table if not exists public.election_posts (
  id bigint generated always as identity primary key,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists election_posts_created_at on public.election_posts (created_at desc);

alter table public.election_posts enable row level security;
drop policy if exists "Owner manages posts" on public.election_posts;
create policy "Owner manages posts" on public.election_posts
  for all using ((select public.is_owner())) with check ((select public.is_owner()));
