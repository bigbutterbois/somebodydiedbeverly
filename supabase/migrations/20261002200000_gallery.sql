-- Gallery: one flat, hand-ordered set of pieces, each an image and a title.
-- See docs/specs/gallery.md.

create table public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  -- Path inside the "gallery" storage bucket.
  image_path text not null unique,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  -- Lowest first. New uploads go to the top.
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index gallery_items_display_order_idx on public.gallery_items (display_order);

create trigger gallery_items_set_updated_at before update on public.gallery_items
  for each row execute function public.set_updated_at();

alter table public.gallery_items enable row level security;

create policy "Anyone can read gallery items" on public.gallery_items
  for select to anon, authenticated
  using (true);

create policy "Owner manages gallery items" on public.gallery_items
  for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

-- The images. Public so the site can show them without signed URLs; file names
-- are random, so they can't be listed or guessed.
insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true);

create policy "Owner uploads gallery images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'gallery' and (select public.is_owner()));

create policy "Owner updates gallery images" on storage.objects
  for update to authenticated
  using (bucket_id = 'gallery' and (select public.is_owner()));

create policy "Owner deletes gallery images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'gallery' and (select public.is_owner()));
