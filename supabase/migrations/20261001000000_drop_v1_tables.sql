-- Removes the v1 site's tables and their data. Confirmed by the site owner on
-- 2026-10-02 ("delete the old tables"): v2 starts with an empty database.
-- The v1 code that used them is preserved on the legacy-v1 branch.
drop table if exists public.plate_sightings cascade;
drop table if exists public.countries cascade;
drop table if exists public.posts cascade;
drop table if exists public.gallery cascade;
