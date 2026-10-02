-- Blog: posts with one category each, written in a rich-text editor and either
-- draft or published. See docs/specs/blog.md.

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

create policy "Anyone can read categories" on public.categories
  for select to anon, authenticated
  using (true);

create policy "Owner manages categories" on public.categories
  for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  -- HTML from the editor.
  content text not null default '',
  category_id uuid references public.categories (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index posts_category_id_idx on public.posts (category_id);
create index posts_published_idx on public.posts (published_at desc) where status = 'published';

create trigger posts_set_updated_at before update on public.posts
  for each row execute function public.set_updated_at();

alter table public.posts enable row level security;

create policy "Anyone can read published posts" on public.posts
  for select to anon, authenticated
  using (status = 'published');

create policy "Owner manages posts" on public.posts
  for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

-- Images dropped into posts. The bucket is public so <img> tags work without a
-- signed URL; file names are random, so they can't be listed or guessed.
insert into storage.buckets (id, name, public)
values ('blog', 'blog', true);

create policy "Owner uploads blog images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'blog' and (select public.is_owner()));

create policy "Owner updates blog images" on storage.objects
  for update to authenticated
  using (bucket_id = 'blog' and (select public.is_owner()));

create policy "Owner deletes blog images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'blog' and (select public.is_owner()));
