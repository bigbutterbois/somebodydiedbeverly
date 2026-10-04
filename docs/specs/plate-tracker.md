# Diplomat plate tracker

## Decisions

- **Shape**: a checklist of countries, each spotted or not. A sighting is just the country: no date or note (Mike simplified this on 2026-10-04; the old columns stay in the table but the app ignores them). Reference: `legacy-v1:src/lib/diplomat-plates.ts`, `legacy-v1:src/data/diplomatCodes.ts`, `legacy-v1:scripts/seed-countries.ts`.
- **Logging**: a quick one-screen form that works well on a phone (pick a country, save).
- **Visibility**: friends and family see progress read-only on the public side. Logging and editing are admin-only.
- v1 data is not carried over (see project memory); the country list is re-seeded. Mike's earlier sightings were loaded by migration on 2026-10-04.

## Public side (`src/app/(site)/plates`)

- Progress summary (X of Y countries spotted).
- Country checklist with spotted/not spotted, and sighting count.
- `/plates/[code]`: a country's plate codes and how many times it has been spotted.
- Plate code lookup (type a code, see the country), as in v1.

## Admin side (`src/app/admin/plates`)

- `/admin/plates/log`: the one-screen phone form. Country search should be fast (type-ahead by name or plate code).
- List of sightings with edit and delete.

## Data

- `countries`: id, name, plate codes (seeded from the v1 code list).
- `plate_sightings`: id, country_id, created_at (date_spotted and note are legacy, unused).
- RLS: public read, owner write.

## Out of scope

Photos and map locations per sighting (Mike chose to keep the v1 shape).
