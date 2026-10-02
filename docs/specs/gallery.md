# Gallery

## Decisions

- **Structure**: one flat gallery. No collections, series or medium filters.
- **Per piece**: an image and a title. Nothing else.
- **Blog embeds**: none.

## Public side (`src/app/(site)/gallery`)

- `/gallery`: a grid of pieces in the order Mike sets.
- Clicking a piece opens a larger view (lightbox or `/gallery/[id]`) showing the image and title, with next/previous.

## Admin side (`src/app/admin/gallery`)

- Upload one or more images; each gets a title field.
- Edit title, delete, and drag to reorder.
- Generate a smaller display size on upload (or use Next's image optimization) so the grid loads fast.

## Data

- `gallery_items`: id, title, image_path (Supabase Storage), width, height, display_order, created_at, updated_at.
- Storage bucket `gallery`.
- RLS: public read, owner write.

## Out of scope

Dates, medium, notes, sizes, prices, collections.
