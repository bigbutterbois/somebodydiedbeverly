-- Mike's plate sightings from before v2, and a simpler sighting: just the
-- country, no date or note. The date_spotted and note columns stay so nothing
-- already logged is lost, but the app no longer asks for or shows them.

alter table public.plate_sightings
  alter column date_spotted drop not null,
  alter column date_spotted drop default;

-- Codes on Mike's list that the State Department list from v1 files under a
-- different country (codes get reassigned over time). Adding them keeps the
-- plate lookup finding the country he actually saw.
update public.countries set plate_codes = plate_codes || array['LR']
  where name = 'Liechtenstein' and not 'LR' = any (plate_codes);
update public.countries set plate_codes = plate_codes || array['TC']
  where name = 'Mali' and not 'TC' = any (plate_codes);

insert into public.countries (name, slug, plate_codes)
  values ('Bermuda', 'bermuda', array['PD'])
  on conflict (name) do nothing;

-- One sighting per country on the list, with no date or note. Countries that
-- already have a sighting are skipped, so nothing gets counted twice.
insert into public.plate_sightings (country_id, date_spotted)
select c.id, null
from (values
  ('Japan'),
  ('Madagascar'),
  ('Panama'),
  ('Cape Verde'),
  ('Israel'),
  ('Ethiopia'),
  ('People''s Republic of China'),
  ('Colombia'),
  ('Costa Rica'),
  ('Cuba'),
  ('Dominican Republic'),
  ('Ecuador'),
  ('France'),
  ('India'),
  ('Denmark'),
  ('Bangladesh'),
  ('Ireland'),
  ('Liberia'),
  ('Libya'),
  ('Philippines'),
  ('Netherlands'),
  ('Qatar'),
  ('Sri Lanka'),
  ('Holy See'),
  ('Sweden'),
  ('Ukraine'),
  ('Belgium'),
  ('Guatemala'),
  ('Haiti'),
  ('Portugal'),
  ('Somalia'),
  ('Tunisia'),
  ('Lithuania'),
  ('Jordan'),
  ('Gabon'),
  ('Luxembourg'),
  ('Mexico'),
  ('Vietnam'),
  ('European Economic Communities'),
  ('Liechtenstein'),
  ('Germany'),
  ('Bahamas'),
  ('Oman'),
  ('Romania'),
  ('Angola'),
  ('Austria'),
  ('Belize'),
  ('Bermuda'),
  ('Bolivia'),
  ('Belarus'),
  ('Norway'),
  ('Chile'),
  ('Argentina'),
  ('Bulgaria'),
  ('Laos'),
  ('Lesotho'),
  ('New Zealand'),
  ('Nicaragua'),
  ('Poland'),
  ('Pakistan'),
  ('Indonesia'),
  ('Senegal'),
  ('Uruguay'),
  ('Mali'),
  ('Canada'),
  ('Egypt'),
  ('Iceland'),
  ('Nepal'),
  ('Italy'),
  ('Iraq'),
  ('Guyana'),
  ('Peru'),
  ('Bahrain'),
  ('Spain'),
  ('Trinidad & Tobago'),
  ('Thailand'),
  ('Tanzania'),
  ('Switzerland'),
  ('Brazil'),
  ('Singapore'),
  ('United Arab Emirates'),
  ('South Korea'),
  ('Australia'),
  ('Russia')
) as seen (name)
join public.countries c on c.name = seen.name
where not exists (
  select 1 from public.plate_sightings s where s.country_id = c.id
);
