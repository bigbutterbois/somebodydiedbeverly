@AGENTS.md

# somebodydiedbeverly (v2)

Mike's personal website, hosted at `somebodydiedbeverly.com`. This is a fresh start: the previous site (blog, art gallery, diplomat plate tracker) is preserved on the `legacy-v1` branch for reference. Pull ideas or code from it deliberately; nothing from it is wired in here.

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS v4
- **Font**: Geist (via `next/font/google`)
- **Hosting**: Vercel (deploys `main` to production; every PR gets a preview URL)
- **Data** (when needed): Supabase (Postgres, storage, auth). Not wired in yet; add it only when a feature needs it.
- **CI**: GitHub Actions runs lint and build on every PR (`.github/workflows/ci.yml`)

## Project Structure

```
src/app/   # App Router pages and layouts
```

Add `src/components/` and `src/lib/` as they become needed.

## Dev Commands

```bash
npm run dev      # Start development server at localhost:3000
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

Run `npm run lint` and `npm run build` before pushing; CI runs the same checks.

## Conventions

- Secrets live in Vercel environment variables (and a local `.env.local`, which is gitignored). Never commit them.
- Work on a branch and open a PR; merging to `main` deploys to production.

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
