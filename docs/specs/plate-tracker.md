# Diplomat plate tracker

## Decisions

- **Shape**: same as v1. A checklist of countries, each spotted or not, with every sighting recording a date and an optional note. Reference: `legacy-v1:src/lib/diplomat-plates.ts`, `legacy-v1:src/data/diplomatCodes.ts`, `legacy-v1:scripts/seed-countries.ts`.
- **Logging**: a quick one-screen form that works well on a phone (pick a country, date defaults to today, optional note, save).
- **Visibility**: friends and family see progress read-only on the public side. Logging and editing are admin-only.
- v1 data is not carried over (see project memory); the country list is re-seeded.

## Public side (`src/app/(site)/plates`)

- Progress summary (X of Y countries spotted).
- Country checklist with spotted/not spotted, first-spotted date, and sighting count.
- `/plates/[code]`: a country's plate codes and its sightings (dates and notes).
- Plate code lookup (type a code, see the country), as in v1.

## Admin side (`src/app/admin/plates`)

- `/admin/plates/log`: the one-screen phone form. Country search should be fast (type-ahead by name or plate code).
- List of sightings with edit and delete.

## Data

- `countries`: id, name, plate codes (seeded from the v1 code list).
- `plate_sightings`: id, country_id, date_spotted, note, created_at.
- RLS: public read, owner write.

## Out of scope

Photos and map locations per sighting (Mike chose to keep the v1 shape).
