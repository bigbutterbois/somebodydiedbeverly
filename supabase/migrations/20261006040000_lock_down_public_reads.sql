-- Closes the back door around the friends & family password. Until now the
-- public (anon) key could read posts, gallery pieces and plate sightings
-- straight from Supabase, and that key ships in the site's JavaScript. Now
-- only the signed-in owner can read these tables through the API; the site's
-- server reads them with the secret key (src/lib/supabase/content.ts) after
-- the password check. Apply only once SUPABASE_SECRET_KEY is set in Vercel
-- and the code that uses it is live, or the public pages go blank.

revoke select on public.categories from anon;
revoke select on public.countries from anon;
revoke select on public.gallery_items from anon;
revoke select on public.plate_sightings from anon;
revoke select on public.posts from anon;
revoke select on public.visits from anon;
revoke select on public.password_failures from anon;
