@AGENTS.md

# somebodydiedbeverly (v2)

Mike's personal website, hosted at `somebodydiedbeverly.com`. This is a fresh start: the previous site (blog, art gallery, diplomat plate tracker) is preserved on the `legacy-v1` branch for reference. Pull ideas or code from it deliberately; nothing from it is wired in here.

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS v4
- **Font**: Geist (via `next/font/google`)
- **Hosting**: Vercel (deploys `main` to production; every PR gets a preview URL)
- **Data**: Supabase (Postgres, storage, auth) via `@supabase/ssr`. Server code uses `createClient` from `src/lib/supabase/server.ts`; client components use `src/lib/supabase/client.ts`.
- **Access**: two gates, both enforced in `src/proxy.ts` and both remembered per device:
  - **Public side** (everything outside `/admin`): one shared friends & family password (`SITE_PASSWORD` env var), entered at `/enter`. Sets a 400-day cookie derived from the password (`src/lib/site-access.ts`), so changing the password signs everyone out.
  - **Private side** (`/admin`): owner-only Supabase email + password login at `/login`. Public sign-ups are off, so the only account is the owner's. The owner also gets past the public gate.
- The whole site is `noindex` (robots.txt, meta tag and `X-Robots-Tag` header).
- **CI**: GitHub Actions runs lint and build on every PR (`.github/workflows/ci.yml`)

## Project Structure

```
src/app/(site)/       # Public side, one folder per module: gallery, blog, forecast (Both / Senate / House sub-tabs; House hex map from scripts/district-tiles.mjs, to-scale map from scripts/district-shapes.mjs), plates
src/app/admin/        # Private side, one folder per tool: plates, blog, gallery, visitors
src/app/enter/        # Friends & family password page
src/app/login/        # Owner sign-in
src/components/       # Shared UI (Nav, Placeholder)
src/lib/supabase/     # Supabase clients (server and browser)
src/lib/site-access.ts # Friends & family password cookie
src/proxy.ts          # Both access gates + Supabase session refresh
supabase/migrations/  # Database schema as SQL migrations
forecast/             # Senate + House forecast model (Python): config.yaml, races.yaml, house.yaml, scrape, house, model, run
```

To add a module, create its folder under `src/app/(site)/` or `src/app/admin/` and add it to the `MODULES` or `TOOLS` list in that folder's `layout.tsx`. Modules: gallery, blog, the 2026 midterms forecast at `/forecast` (a Both summary tab first, then Senate and House; Python model in `forecast/`, the House's 435 districts scraped from Wikipedia each run, run daily at 6am Eastern by `.github/workflows/forecast.yml`, published as JSON to the `forecast-data` branch) and read-only plate tracker progress on the public side; diplomat plate tracker, blog/gallery editors and visitor stats (`src/lib/visits.ts`, no IPs stored) on the private side.

## Dev Commands

```bash
npm run dev      # Start development server at localhost:3000
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

Run `npm run lint` and `npm run build` before pushing; CI runs the same checks.

## Conventions

- UI follows `docs/design.md`: dark by default, light when the device is in light mode; use the theme color tokens (`text-muted`, `border-line`, `text-accent`…) instead of raw Tailwind palettes.
- Secrets (Supabase keys, `SITE_PASSWORD`) live in Vercel environment variables (and a local `.env.local`, which is gitignored). Never commit them.
- Work on a branch and open a PR; merging to `main` deploys to production.

## Database

- The schema lives in `supabase/migrations/`. To change it, add a new timestamped SQL file (`npx supabase migration new <name>`); never edit one that has already been applied.
- Migrations are applied to production automatically when they merge to `main` (`.github/workflows/db-migrations.yml`).
- Every table has row level security: the public can read published content, and only the signed-in owner can write. New tables need RLS enabled plus policies in the same migration; reuse `public.is_owner()` for write policies and `public.set_updated_at()` for `updated_at` columns (see the foundation migration).
- The database starts empty; each feature adds its own tables in its own migration.

## Workflow Instructions

### Planning vs. Execution Models

**This is a hard requirement. Do not skip it.**

- **Planning / context-gathering**: ALWAYS switch to the **Opus** model (`claude-opus-4-6`) BEFORE exploring the codebase or writing a plan. This applies any time I ask for a plan, describe a feature, or otherwise seem to be in an exploratory/design phase — even if I don't explicitly invoke plan mode. Do NOT use Sonnet for planning under any circumstances.
- **Execution**: Always use the **Sonnet** model (`claude-sonnet-4-6`) when implementing a plan.

### Default Task Flow

When I ask you to do a task, the default workflow is:

1. **Switch to Opus** — before doing anything else, switch to `claude-opus-4-6`.
2. **Plan** — use Opus to explore the codebase, gather context, and produce a concrete plan.
3. **Switch to Sonnet** — switch to `claude-sonnet-4-6` for implementation.
4. **Execute** — implement the plan without waiting for my approval, and summarize the plan alongside the result.

Only stop and ask me first for things that can't be undone (deleting data, changing DNS or production settings).

### Saving Notes

When I ask you to save notes on your work, always write them to:

```
/Users/michaelpulsipher/dev/vibe-coding-notes/
```

Use descriptive filenames (e.g., `diplomat-tracker-refactor.md`, `blog-layout-notes.md`). Prefer editing an existing notes file over creating a new one if the topic overlaps.
