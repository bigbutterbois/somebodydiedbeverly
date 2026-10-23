-- Plate key corrections from the October 2026 audit. The State Department
-- doesn't publish its codes, so this follows the two most complete public
-- lists (dcplates.com and an old Washington Times list). Where both agree and
-- the key disagreed, the key changes here. Also adds the countries that had
-- no row, brings old names up to date, and logs Mike's plates that the
-- corrected key identifies.

-- Codes filed under the wrong country.
update public.countries set plate_codes = array_remove(plate_codes, 'TF') where name = 'Iraq';
update public.countries set plate_codes = array_remove(plate_codes, 'QX') where name = 'Iran';
update public.countries set plate_codes = array_remove(plate_codes, 'DH') where name = 'Cote d''Ivoire';
update public.countries set plate_codes = array_remove(plate_codes, 'DI') where name = 'South Africa';
update public.countries set plate_codes = array_remove(plate_codes, 'PD') where name = 'United Kingdom';
update public.countries set plate_codes = array_remove(plate_codes, 'TK') where name = 'Liechtenstein';
update public.countries set plate_codes = array_replace(plate_codes, 'BV', 'BY') where name = 'Solomon Islands';
update public.countries set plate_codes = array_replace(plate_codes, 'CK', 'KT') where name = 'Namibia';

-- Codes the key was missing.
update public.countries c set plate_codes = c.plate_codes || array(
    select unnest(v.codes) except select unnest(c.plate_codes)
  )
from (values
  ('Iraq', array['BZ']),
  ('Israel', array['DI', 'FI', 'PI']),
  ('Yemen', array['QA']),
  ('Turkey', array['GM']),
  ('Monaco', array['MQ']),
  ('Czech Republic', array['PH']),
  ('Uzbekistan', array['YU'])
) as v (name, codes)
where c.name = v.name;

-- Countries and organizations with no row. Only the African Union has a
-- known code; the rest are checklist entries until a plate turns up.
insert into public.countries (name, slug, plate_codes) values
  ('African Union', 'african-union', array['AW']),
  ('Kiribati', 'kiribati', '{}'),
  ('Kosovo', 'kosovo', '{}'),
  ('Montenegro', 'montenegro', '{}'),
  ('South Sudan', 'south-sudan', '{}'),
  ('Taiwan', 'taiwan', '{}'),
  ('Timor-Leste', 'timor-leste', '{}'),
  ('Tuvalu', 'tuvalu', '{}')
on conflict (name) do nothing;

-- Current names (Yugoslavia's JM code is now Serbia's).
update public.countries c set name = v.new_name, slug = v.new_slug
from (values
  ('Swaziland', 'Eswatini', 'eswatini'),
  ('Western Samoa', 'Samoa', 'samoa'),
  ('Zaire', 'Democratic Republic of the Congo', 'democratic-republic-of-the-congo'),
  ('Yugoslavia', 'Serbia', 'serbia'),
  ('European Economic Communities', 'European Union', 'european-union'),
  ('Cape Verde', 'Cabo Verde', 'cabo-verde'),
  ('Czech Republic', 'Czechia', 'czechia')
) as v (old_name, new_name, new_slug)
where c.name = v.old_name;

-- Mike's unidentified plates that the key now covers (DYA, DYY, DJT, DKD,
-- DAE, DLM, DYT, DYK, DGN, DYJ, SUH, DVJ, CVJ, DSF, CQM, VKD). Countries
-- already spotted are skipped, so nothing is counted twice.
insert into public.plate_sightings (country_id, date_spotted)
select c.id, null
from (values
  ('Armenia'),
  ('Kyrgyzstan'),
  ('Croatia'),
  ('Eritrea'),
  ('Uzbekistan'),
  ('North Macedonia'),
  ('Turkmenistan'),
  ('Kazakhstan'),
  ('Turkey'),
  ('Tajikistan'),
  ('Spain'),
  ('Brazil'),
  ('Czechia'),
  ('Bulgaria'),
  ('Singapore')
) as v (name)
join public.countries c on c.name = v.name
where not exists (select 1 from public.plate_sightings s where s.country_id = c.id);
